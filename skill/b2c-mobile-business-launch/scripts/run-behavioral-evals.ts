#!/usr/bin/env node
/**
 * run-behavioral-evals.ts — the execution layer that `npm run launchbench`
 * deliberately lacks.
 *
 * LaunchBench is a scenario DEFINITION lint plus deterministic validator
 * fixtures; scenario prompts are never executed against a live agent there.
 * This harness runs the opt-in flagship subset (`behavioral: true` in
 * evals/launchbench/*.yaml and evals/agent-behavior/*.yaml) against a live
 * Claude agent primed with SKILL.md, then grades must_catch / should_say /
 * must_use / forbidden assertions with a structured-output grader call and
 * writes a results artifact.
 *
 * It is intentionally NOT part of the PR-gating audit pipeline (cost and
 * model variance); it runs via the manually-triggered behavioral-evals
 * GitHub Actions workflow or locally. See machine/launchbench-evals.md
 * "Behavioral Eval Harness" for the honest split.
 *
 * Model ids come from the claude-api skill (checked 2026-07-25): default
 * agent and grader model is claude-opus-5; override with --model /
 * --grader-model. Never hardcode date-suffixed ids.
 *
 * Credentials: ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN, or --use-profile to
 * spend against an `ant auth login` profile. The gate is deliberately explicit
 * because check:agent-evals runs this script credential-free — without it the
 * SDK would resolve a local profile and bill a full run from the fixtures.
 *
 * npm script: evals:behavioral (root and runtime packages)
 * Usage:
 *   tsx scripts/run-behavioral-evals.ts --list
 *   ANTHROPIC_API_KEY=... tsx scripts/run-behavioral-evals.ts [--only id1,id2]
 *     [--model claude-opus-5] [--grader-model claude-opus-5] [--out results.json]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { asArray, asString, flagBoolean, flagString, isRecord, parseFlags } from "./lib/launch-state.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const DEFAULT_MODEL = "claude-opus-5";

type AssertionKind = "must_catch" | "should_say" | "must_use" | "forbidden";

interface BehavioralScenario {
  id: string;
  source: string;
  prompt: string;
  expectedGuardrail: string;
  assertions: Array<{ kind: AssertionKind; item: string }>;
}

interface GradedAssertion {
  kind: AssertionKind;
  item: string;
  pass: boolean;
  evidence: string;
}

interface ScenarioResult {
  id: string;
  source: string;
  pass: boolean;
  hard_failures: number;
  soft_misses: number;
  grades: GradedAssertion[];
  response: string;
}

const args = parseArgs(process.argv.slice(2));
const scenarios = collectScenarios();

if (scenarios.length === 0) {
  console.error("No behavioral scenarios found. Mark eligible scenarios with `behavioral: true`.");
  process.exit(1);
}

if (args.list) {
  console.log(`Behavioral eval subset (${scenarios.length} scenario(s), opt-in via behavioral: true):`);
  for (const scenario of scenarios) {
    console.log(`- ${scenario.id} [${scenario.source}] (${scenario.assertions.length} assertions)`);
  }
  process.exit(0);
}

// This gate is also a spend guard: check:agent-evals runs this script with no
// credentials, so the no-credential path must never reach the network. The SDK
// would otherwise silently resolve an `ant auth login` profile and bill a full
// flagship run from the fixture suite. ANTHROPIC_AUTH_TOKEN counts as an
// explicit credential; a profile requires the explicit --use-profile opt-in.
if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !args.useProfile) {
  console.error(
    "ANTHROPIC_API_KEY is required to run behavioral evals against a live agent (ANTHROPIC_AUTH_TOKEN also works, or pass --use-profile to spend against an `ant auth login` profile). Use --list to inspect the subset without credentials.",
  );
  process.exit(1);
}

const selected = args.only
  ? scenarios.filter((scenario) =>
      args.only
        ?.split(",")
        .map((id) => id.trim())
        .includes(scenario.id),
    )
  : scenarios;
if (selected.length === 0) {
  console.error(`--only matched no behavioral scenarios (have: ${scenarios.map((scenario) => scenario.id).join(", ")}).`);
  process.exit(1);
}

await run(selected);

async function run(toRun: BehavioralScenario[]): Promise<void> {
  // Lazy import so --list and the missing-key error stay dependency-light.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  // Thin untyped wrapper: request shapes (adaptive thinking, output_config
  // structured outputs) follow the claude-api skill docs and are validated by
  // the API, not by the SDK's currently-installed type surface.
  const createMessage: CreateMessage = async (params) => (await client.messages.create(params as never)) as unknown as { content: unknown };
  const skillText = readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  const systemPrompt = [
    "You are an autonomous launch agent with the b2c-mobile-business-launch skill loaded.",
    "The skill entrypoint (SKILL.md) follows; honor its routing, gates, and operating posture.",
    "Respond to the founder situation as you would in a real session: name the references you would load,",
    "the validators you would run, the founder-only gates you would pause at, and the concrete next actions.",
    "",
    skillText,
  ].join("\n");

  const results: ScenarioResult[] = [];
  const invalid: InvalidRun[] = [];
  for (const scenario of toRun) {
    console.log(`Running ${scenario.id} ...`);
    const agentMessage = await createMessage({
      model: args.model,
      // Adaptive thinking is on by default on current models and shares this
      // ceiling with the answer text, so 8192 truncated multi-assertion
      // scenarios. 16000 keeps a non-streaming request under SDK HTTP timeouts.
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: systemPrompt,
      messages: [{ role: "user", content: scenario.prompt }],
    });
    const responseText = textBlocks(agentMessage.content);

    // A refusal or a truncated answer is a broken run, not a failing agent:
    // grading either one silently reports every assertion as a miss.
    const stopReason = asString(agentMessage.stop_reason);
    if (stopReason === "refusal" || stopReason === "max_tokens" || responseText.trim().length === 0) {
      const detail =
        stopReason === "refusal"
          ? "the safety classifiers declined the prompt"
          : stopReason === "max_tokens"
            ? "the answer hit max_tokens"
            : "the response carried no text";
      console.log(`  INVALID (${detail}) — not graded`);
      invalid.push({ id: scenario.id, source: scenario.source, stop_reason: stopReason ?? "none", response: responseText });
      continue;
    }

    const outcome = await grade(createMessage, scenario, responseText);
    if (!outcome.ok) {
      console.log(`  INVALID (${outcome.invalidReason}) — not graded`);
      invalid.push({ id: scenario.id, source: scenario.source, stop_reason: outcome.invalidReason, response: responseText });
      continue;
    }
    const grades = outcome.grades;
    const hardFailures = grades.filter(
      (grade) => (grade.kind === "must_catch" || grade.kind === "must_use" || grade.kind === "forbidden") && !grade.pass,
    ).length;
    const softMisses = grades.filter((grade) => grade.kind === "should_say" && !grade.pass).length;
    const pass = hardFailures === 0;
    results.push({ id: scenario.id, source: scenario.source, pass, hard_failures: hardFailures, soft_misses: softMisses, grades, response: responseText });
    console.log(`  ${pass ? "PASS" : "FAIL"} (${hardFailures} hard failure(s), ${softMisses} soft miss(es))`);
  }

  const failed = results.filter((result) => !result.pass);
  const artifact = {
    generated_at: new Date().toISOString(),
    agent_model: args.model,
    grader_model: args.graderModel,
    summary: { total: toRun.length, graded: results.length, passed: results.length - failed.length, failed: failed.length, invalid: invalid.length },
    results,
    invalid,
  };
  mkdirSync(path.dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(`\nBehavioral eval run: ${results.length - failed.length}/${results.length} graded scenario(s) passed. Results artifact: ${args.out}`);
  if (failed.length > 0) {
    for (const result of failed) {
      console.log(`- FAIL ${result.id}: ${result.hard_failures} hard failure(s)`);
    }
    process.exitCode = 1;
  }
  if (invalid.length > 0) {
    // Ungraded scenarios mean the run did not measure what it claims to; fail
    // rather than reporting a clean pass over a shrunken subset.
    for (const run of invalid) {
      console.log(`- INVALID ${run.id}: stop_reason=${run.stop_reason} (not graded)`);
    }
    console.log(`${invalid.length} of ${toRun.length} scenario(s) produced no gradeable answer — this run is not a complete flagship pass.`);
    process.exitCode = 1;
  }
}

type CreateMessage = (params: Record<string, unknown>) => Promise<{ content: unknown; stop_reason?: unknown }>;

/** A run that produced no gradeable answer — a harness/model problem, not an agent miss. */
interface InvalidRun {
  id: string;
  source: string;
  stop_reason: string;
  response: string;
}

/** Concatenated text blocks from a Messages API response content array. */
function textBlocks(content: unknown): string {
  return asArray(content)
    .filter((block): block is Record<string, unknown> => isRecord(block) && block.type === "text")
    .map((block) => asString(block.text) ?? "")
    .join("\n");
}

/** Either a full set of verdicts, or the reason this scenario could not be graded. */
type GradeOutcome = { ok: true; grades: GradedAssertion[] } | { ok: false; invalidReason: string };

async function grade(createMessage: CreateMessage, scenario: BehavioralScenario, responseText: string): Promise<GradeOutcome> {
  const gradeSchema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            pass: { type: "boolean" },
            evidence: { type: "string" },
          },
          required: ["index", "pass", "evidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  };

  const checklist = scenario.assertions
    .map((assertion, index) =>
      assertion.kind === "forbidden"
        ? `${index}. [forbidden] PASS only if the response does NOT do/contain: ${assertion.item}`
        : `${index}. [${assertion.kind}] PASS only if the response substantively covers: ${assertion.item}`,
    )
    .join("\n");

  const graderMessage = await createMessage({
    model: args.graderModel,
    // Same ceiling reasoning as the agent call: adaptive thinking is on by
    // default on current models and shares max_tokens with the JSON payload,
    // which here is one {index, pass, evidence} object per assertion. Declared
    // explicitly rather than relying on the model default.
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: gradeSchema } },
    system:
      "You are a strict, literal eval grader. Judge only what the response text actually says; paraphrases count, vibes do not. Quote short evidence for every verdict.",
    messages: [
      {
        role: "user",
        content: [
          `Scenario guardrail (context only — grade the checklist, not this): ${scenario.expectedGuardrail}`,
          "",
          "Checklist:",
          checklist,
          "",
          "Agent response to grade:",
          "<response>",
          responseText,
          "</response>",
          "",
          "Return one verdict per checklist index.",
        ].join("\n"),
      },
    ],
  });

  // A refused or truncated grader must not take the whole run down with it:
  // results are only written to disk after the loop, so throwing here would
  // discard every scenario already graded (and paid for) in this run.
  const graderStop = asString(graderMessage.stop_reason);
  if (graderStop === "refusal" || graderStop === "max_tokens") {
    return { ok: false, invalidReason: `grader stopped with ${graderStop}` };
  }
  const graderText = textBlocks(graderMessage.content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(graderText);
  } catch {
    return { ok: false, invalidReason: "grader returned non-JSON output" };
  }
  const verdicts = isRecord(parsed) ? asArray(parsed.results) : [];

  return {
    ok: true,
    grades: scenario.assertions.map((assertion, index) => {
      const verdict = verdicts.find((item) => isRecord(item) && item.index === index);
      const pass = isRecord(verdict) && verdict.pass === true;
      const evidence = isRecord(verdict) ? (asString(verdict.evidence) ?? "") : "grader returned no verdict for this item";
      return { kind: assertion.kind, item: assertion.item, pass, evidence };
    }),
  };
}

function collectScenarios(): BehavioralScenario[] {
  const collected: BehavioralScenario[] = [];
  for (const source of ["evals/launchbench", "evals/agent-behavior"]) {
    const directory = path.join(skillRoot, source);
    if (!existsSync(directory)) {
      continue;
    }
    for (const file of readdirSync(directory)
      .filter((name) => name.endsWith(".yaml"))
      .sort()) {
      const parsed = parseYaml(readFileSync(path.join(directory, file), "utf8"));
      if (!isRecord(parsed) || parsed.behavioral !== true) {
        continue;
      }
      const id = asString(parsed.id) ?? path.basename(file, ".yaml");
      const prompt = asString(parsed.prompt);
      if (!prompt) {
        continue;
      }
      const assertions: Array<{ kind: AssertionKind; item: string }> = [];
      for (const kind of ["must_catch", "should_say", "must_use", "forbidden"] as const) {
        for (const item of asArray(parsed[kind])) {
          const text = asString(item);
          if (text) {
            assertions.push({ kind, item: text });
          }
        }
      }
      collected.push({
        id,
        source,
        prompt,
        expectedGuardrail: asString(parsed.expected_guardrail) ?? asString(parsed.expected_route) ?? "",
        assertions,
      });
    }
  }
  return collected;
}

interface Args {
  list: boolean;
  only?: string;
  model: string;
  graderModel: string;
  out: string;
  /** Explicit opt-in to spend against an `ant auth login` profile with no key exported. */
  useProfile: boolean;
}

function parseArgs(argv: string[]): Args {
  const flags = parseFlags(argv, [
    { flags: ["--list"], key: "list", kind: "boolean" },
    { flags: ["--only"], key: "only", kind: "string" },
    { flags: ["--model"], key: "model", kind: "string" },
    { flags: ["--grader-model"], key: "graderModel", kind: "string" },
    { flags: ["--use-profile"], key: "useProfile", kind: "boolean" },
    { flags: ["--out"], key: "out" },
  ]);
  return {
    list: flagBoolean(flags, "list"),
    only: flagString(flags, "only"),
    model: flagString(flags, "model") ?? DEFAULT_MODEL,
    graderModel: flagString(flags, "graderModel") ?? DEFAULT_MODEL,
    out: flagString(flags, "out") ?? path.join(skillRoot, "evals", "behavioral-results", `behavioral-${new Date().toISOString().replace(/[:.]/g, "-")}.json`),
    useProfile: flagBoolean(flags, "useProfile"),
  };
}
