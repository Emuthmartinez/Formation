/**
 * The call to the drafting provider, and what Formation does when it does not go well.
 *
 * Before this module, a draft request made one attempt and any hiccup — a gateway blip, a rate
 * limit, a slow response — failed the job with the raw sentence "AI provider returned 502." Three
 * things were wrong with that. A transient failure was treated as final. A founder was shown a
 * status code. And "we could not reach the service", "the service refused us", and "the service
 * answered with something unusable" were indistinguishable, though only one of them is worth
 * trying again and only one of them needs an administrator.
 *
 * The budget is deliberately small and total. Attempts are bounded, each attempt is bounded, and
 * the *sum* is bounded — a per-attempt timeout alone lets three slow attempts hold a worker for
 * two minutes and a founder for longer. When the budget is spent, the honest answer is that
 * nothing was written.
 *
 * **There is no silent fallback.** When an endpoint is configured and the provider cannot answer,
 * this throws. Substituting the built-in deterministic draft would hand the founder a document
 * that looks like the one they asked for and is not — the same dishonesty the engine boundary
 * refuses when it reports "unreachable" instead of "no work ready".
 */

/** What went wrong, in the four categories that lead to different actions. */
export const PROVIDER_OUTCOMES = Object.freeze({
  unreachable: {
    id: "unreachable",
    transient: true,
    message: "Formation could not reach the drafting service. Nothing was written — this usually clears on its own, so try again in a few minutes.",
  },
  refused: {
    id: "refused",
    transient: false,
    message: "The drafting service refused the request. Nothing was written, and trying again will not help — someone who administers this Formation instance needs to check its connection.",
  },
  unusableAnswer: {
    id: "unusable-answer",
    transient: false,
    message: "The drafting service answered with something Formation could not use. Nothing was written; the draft was not partially saved.",
  },
  misconfigured: {
    id: "misconfigured",
    transient: false,
    message: "This Formation instance's drafting service is not set up correctly. Nothing was written — an administrator needs to correct it.",
  },
});

export class ProviderError extends Error {
  constructor(outcome, diagnostics = {}, cause) {
    super(outcome.message);
    this.name = "ProviderError";
    this.outcome = outcome.id;
    this.transient = outcome.transient;
    this.diagnostics = diagnostics;
    // The technical detail stays on the error for the server log; the message a founder sees is
    // the one above, and it never carries a status code or a URL.
    this.detail = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : null;
  }
}

/**
 * Status codes worth trying again. Everything else the provider returns is an answer: it
 * understood the request and declined it, and asking again produces the same decline.
 */
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export const DEFAULT_BUDGET = Object.freeze({
  attempts: 3,
  attemptTimeoutMs: 45_000,
  /** Wall clock across every attempt and every wait between them. */
  totalMs: 120_000,
  firstBackoffMs: 600,
  backoffFactor: 3,
  maxBackoffMs: 8_000,
  responseLimitBytes: 1_000_000,
});

/** A provider's own Retry-After, honoured but never trusted past the budget that remains. */
function retryAfterMs(response) {
  const header = response.headers?.get?.("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 30_000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 30_000)) : null;
}

function resolveEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new ProviderError(PROVIDER_OUTCOMES.misconfigured, {}, "FORMATION_AI_ENDPOINT is not a valid URL.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new ProviderError(PROVIDER_OUTCOMES.misconfigured, {}, "The production drafting endpoint must use HTTPS.");
  }
  return url;
}

/** Declared usage, copied field by field. A provider that reports something else reports it to itself. */
function declaredUsage(payload) {
  const usage = payload?.usage;
  if (!usage || typeof usage !== "object") return null;
  const copied = {};
  for (const field of ["inputTokens", "outputTokens", "totalTokens"]) {
    if (Number.isFinite(usage[field])) copied[field] = usage[field];
  }
  return Object.keys(copied).length ? copied : null;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends one request and returns the provider's parsed answer plus what it cost in attempts and
 * wall clock. Throws `ProviderError` for every failure, classified.
 *
 * `fetchImpl`, `sleep`, and `clock` are injectable so the suites can drive every branch — a
 * gateway blip that clears, a rate limit that does not, a body that is not JSON, a budget that
 * runs out mid-retry — without a network or a real wait.
 */
export async function callProvider(request, { endpoint, apiKey, budget = DEFAULT_BUDGET, fetchImpl = fetch, sleep = defaultSleep, clock = () => Date.now() } = {}) {
  const url = resolveEndpoint(endpoint);
  const startedAt = clock();
  const remaining = () => budget.totalMs - (clock() - startedAt);

  let attempts = 0;
  let lastFailure;

  while (attempts < budget.attempts) {
    if (remaining() <= 0) break;
    attempts += 1;

    const controller = new AbortController();
    const attemptTimeout = Math.min(budget.attemptTimeoutMs, Math.max(1, remaining()));
    const timer = setTimeout(() => controller.abort(), attemptTimeout);
    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch (error) {
      // A refused connection, a DNS failure, and an abort are all "we did not get an answer".
      lastFailure = { outcome: PROVIDER_OUTCOMES.unreachable, cause: error };
      clearTimeout(timer);
      if (await waitForNextAttempt({ attempts, budget, remaining, sleep, delay: null })) continue;
      break;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const transient = TRANSIENT_STATUSES.has(response.status);
      lastFailure = {
        outcome: transient ? PROVIDER_OUTCOMES.unreachable : PROVIDER_OUTCOMES.refused,
        cause: `provider answered ${response.status}`,
      };
      if (!transient) break;
      if (await waitForNextAttempt({ attempts, budget, remaining, sleep, delay: retryAfterMs(response) })) continue;
      break;
    }

    let source;
    try {
      source = await response.text();
    } catch (error) {
      lastFailure = { outcome: PROVIDER_OUTCOMES.unreachable, cause: error };
      if (await waitForNextAttempt({ attempts, budget, remaining, sleep, delay: null })) continue;
      break;
    }

    if (Buffer.byteLength(source, "utf8") > budget.responseLimitBytes) {
      // Not retried: a provider that sent a megabyte will send a megabyte again.
      throw new ProviderError(PROVIDER_OUTCOMES.unusableAnswer, { attempts, elapsedMs: clock() - startedAt }, "response exceeded the safety limit");
    }

    let payload;
    try {
      payload = JSON.parse(source);
    } catch (error) {
      // Very often a gateway's HTML error page rather than the provider's own answer, so this is
      // worth one more attempt within the budget.
      lastFailure = { outcome: PROVIDER_OUTCOMES.unreachable, cause: error };
      if (await waitForNextAttempt({ attempts, budget, remaining, sleep, delay: null })) continue;
      break;
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray(payload.sections)) {
      // The provider answered, and its answer is the wrong shape. Asking again produces the same
      // shape, so this is final rather than transient.
      throw new ProviderError(PROVIDER_OUTCOMES.unusableAnswer, { attempts, elapsedMs: clock() - startedAt }, "answer did not match the required structure");
    }

    return {
      payload,
      diagnostics: {
        outcome: "answered",
        attempts,
        elapsedMs: clock() - startedAt,
        declaredUsage: declaredUsage(payload),
      },
    };
  }

  const failure = lastFailure ?? { outcome: PROVIDER_OUTCOMES.unreachable, cause: "the time allowed for drafting ran out" };
  throw new ProviderError(failure.outcome, { attempts, elapsedMs: clock() - startedAt }, failure.cause);
}

/**
 * Waits before the next attempt, or reports that there is no next attempt. Returns false when the
 * attempt count or the total budget is spent — including when the wait itself would not fit, which
 * is the case a per-attempt timeout alone gets wrong.
 */
async function waitForNextAttempt({ attempts, budget, remaining, sleep, delay }) {
  if (attempts >= budget.attempts) return false;
  const backoff = delay ?? Math.min(budget.firstBackoffMs * budget.backoffFactor ** (attempts - 1), budget.maxBackoffMs);
  if (remaining() <= backoff) return false;
  await sleep(backoff);
  return remaining() > 0;
}
