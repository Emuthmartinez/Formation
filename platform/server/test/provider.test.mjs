import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BUDGET, PROVIDER_OUTCOMES, ProviderError, callProvider } from "../provider.mjs";

/**
 * The drafting provider call.
 *
 * Every branch is driven with an injected fetch, sleep, and clock, so these suites exercise a
 * gateway blip that clears, a rate limit that does not, a body that is not JSON, and a budget that
 * runs out mid-retry — with no network and no real waiting. The properties that matter:
 *
 * - a transient failure is tried again, a refusal is not;
 * - the *total* budget is enforced, not only the per-attempt one;
 * - what a founder is told never contains a status code, a URL, or a stack;
 * - nothing is ever half-written, and there is no silent substitution of a built-in draft.
 */

const OK_BODY = JSON.stringify({ title: "Draft", summary: "A summary.", confidence: 70, sections: [{ title: "One", body: "Body." }] });

/** A fetch that answers from a script, one entry per call, and records what it was asked. */
function scriptedFetch(script) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url: String(url), body: options.body, headers: options.headers });
    const next = script[Math.min(calls.length - 1, script.length - 1)];
    if (typeof next === "function") return next();
    if (next instanceof Error) throw next;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      headers: { get: (name) => next.headers?.[name.toLowerCase()] ?? null },
      text: async () => next.body ?? "",
    };
  };
  impl.calls = calls;
  return impl;
}

/** A clock the test moves by hand, and a sleep that moves it instead of waiting. */
function fakeTime() {
  let current = 0;
  return {
    clock: () => current,
    sleep: async (ms) => {
      current += ms;
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

const budget = { ...DEFAULT_BUDGET, attempts: 3, totalMs: 10_000, firstBackoffMs: 100, maxBackoffMs: 400 };

test("a good answer comes back on the first attempt, with what it cost", async () => {
  const fetchImpl = scriptedFetch([{ status: 200, body: JSON.stringify({ ...JSON.parse(OK_BODY), usage: { inputTokens: 120, outputTokens: 300, secretField: "nope" } }) }]);
  const time = fakeTime();
  const { payload, diagnostics } = await callProvider({ hello: "world" }, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time });

  assert.equal(payload.title, "Draft");
  assert.equal(diagnostics.outcome, "answered");
  assert.equal(diagnostics.attempts, 1);
  assert.deepEqual(diagnostics.declaredUsage, { inputTokens: 120, outputTokens: 300 }, "usage is copied field by field, so an unknown field stays with the provider");
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(JSON.parse(fetchImpl.calls[0].body).hello, "world");
});

test("a gateway blip is tried again and the second answer is used", async () => {
  const fetchImpl = scriptedFetch([{ status: 502 }, { status: 200, body: OK_BODY }]);
  const time = fakeTime();
  const { diagnostics } = await callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time });
  assert.equal(diagnostics.attempts, 2);
  assert.equal(fetchImpl.calls.length, 2);
});

test("a refusal is final — asking again produces the same refusal", async () => {
  const fetchImpl = scriptedFetch([{ status: 401 }, { status: 200, body: OK_BODY }]);
  const time = fakeTime();
  await assert.rejects(
    () => callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time }),
    (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.outcome, "refused");
      assert.equal(error.transient, false);
      return true;
    },
  );
  assert.equal(fetchImpl.calls.length, 1, "a permanent refusal must not be retried");
});

test("a rate limit is retried, and its own Retry-After is honoured", async () => {
  const fetchImpl = scriptedFetch([{ status: 429, headers: { "retry-after": "2" } }, { status: 200, body: OK_BODY }]);
  const time = fakeTime();
  const { diagnostics } = await callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time });
  assert.equal(diagnostics.attempts, 2);
  assert.ok(diagnostics.elapsedMs >= 2_000, `expected the provider's own 2s wait to be observed, got ${diagnostics.elapsedMs}ms`);
});

test("a network failure exhausts the attempts and is reported as unreachable", async () => {
  const fetchImpl = scriptedFetch([new Error("getaddrinfo ENOTFOUND provider.test")]);
  const time = fakeTime();
  await assert.rejects(
    () => callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time }),
    (error) => {
      assert.equal(error.outcome, "unreachable");
      assert.equal(error.diagnostics.attempts, budget.attempts);
      return true;
    },
  );
});

test("the total budget stops the retries, not just the per-attempt one", async () => {
  const time = fakeTime();
  // Each attempt burns most of the budget before failing transiently.
  const fetchImpl = scriptedFetch([
    () => {
      time.advance(6_000);
      throw new Error("timed out");
    },
  ]);
  await assert.rejects(
    () => callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time }),
    (error) => {
      assert.equal(error.outcome, "unreachable");
      assert.ok(error.diagnostics.attempts < budget.attempts, `expected the total budget to stop retrying early, used ${error.diagnostics.attempts} attempts`);
      return true;
    },
  );
});

test("a body that is not JSON is worth one more try, and then it is not", async () => {
  const fetchImpl = scriptedFetch([{ status: 200, body: "<html>502 Bad Gateway</html>" }, { status: 200, body: OK_BODY }]);
  const time = fakeTime();
  const { diagnostics } = await callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time });
  assert.equal(diagnostics.attempts, 2, "a gateway error page is transient, so one more attempt is warranted");

  const alwaysHtml = scriptedFetch([{ status: 200, body: "<html>502</html>" }]);
  const time2 = fakeTime();
  await assert.rejects(
    () => callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl: alwaysHtml, ...time2 }),
    (error) => error.outcome === "unreachable" && error.diagnostics.attempts === budget.attempts,
  );
});

test("valid JSON in the wrong shape is final — the provider answered, it just answered wrong", async () => {
  const fetchImpl = scriptedFetch([{ status: 200, body: JSON.stringify({ title: "Draft" }) }]);
  const time = fakeTime();
  await assert.rejects(
    () => callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time }),
    (error) => error.outcome === "unusable-answer" && error.transient === false,
  );
  assert.equal(fetchImpl.calls.length, 1, "a wrong-shaped answer must not be retried");
});

test("an oversized answer is refused rather than read into memory twice", async () => {
  const fetchImpl = scriptedFetch([{ status: 200, body: "x".repeat(2_000_000) }]);
  const time = fakeTime();
  await assert.rejects(
    () => callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time }),
    (error) => error.outcome === "unusable-answer",
  );
});

test("a misconfigured endpoint is named as configuration, not as an outage", async () => {
  const time = fakeTime();
  await assert.rejects(
    () => callProvider({}, { endpoint: "not a url", budget, fetchImpl: scriptedFetch([{ status: 200, body: OK_BODY }]), ...time }),
    (error) => error.outcome === "misconfigured" && /administrator/.test(error.message),
  );
});

test("nothing a founder is shown carries a status code, a URL, or a stack", async () => {
  for (const outcome of Object.values(PROVIDER_OUTCOMES)) {
    assert.ok(!/\b[45]\d\d\b/.test(outcome.message), `a status code reached founder-facing copy: ${outcome.message}`);
    assert.ok(!/https?:\/\//.test(outcome.message), `a URL reached founder-facing copy: ${outcome.message}`);
    assert.match(outcome.message, /[Nn]othing was written/, "every failure must say plainly that nothing was written");
  }
});

test("the technical detail stays on the error for the log and off the founder's message", async () => {
  const fetchImpl = scriptedFetch([{ status: 403 }]);
  const time = fakeTime();
  const error = await callProvider({}, { endpoint: "https://provider.test/draft", budget, fetchImpl, ...time }).catch((caught) => caught);
  assert.match(error.detail, /403/);
  assert.ok(!error.message.includes("403"));
});

test("the api key travels in the header and never in the body", async () => {
  const fetchImpl = scriptedFetch([{ status: 200, body: OK_BODY }]);
  const time = fakeTime();
  await callProvider({ company: "Storywell" }, { endpoint: "https://provider.test/draft", apiKey: "secret-key-value", budget, fetchImpl, ...time });
  assert.equal(fetchImpl.calls[0].headers.authorization, "Bearer secret-key-value");
  assert.ok(!fetchImpl.calls[0].body.includes("secret-key-value"), "a credential must never be serialised into the request body");
});
