#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  asString,
  flagString,
  getPath,
  isRecord,
  issue,
  loadLaneFromBusinessStateV2,
  loadProjectState,
  parseCliArgs,
  parseFlags,
  reportAndExit,
  type Issue,
} from "../../../tooling/lib/launch-state.js";

const argv = process.argv.slice(2);
const args = parseCliArgs(argv);
// Not a shared parseCliArgs flag: --providers scopes the ready-claim/open-blocker check below to
// a caller-named subset of the ledger's own providers, used only by ONB-22's own catalog gate
// (check:provider-proof-onboarding) so its acceptance does not depend on an unrelated provider row
// (Resend, App Store Connect, Sentry, ...) elsewhere in operations/PROVIDER_PROOF.md. The default
// (unscoped) invocation -- the general check:provider-proof audit step and
// workflow.process.provider-proof-verification -- keeps scanning the whole document.
const scopedProviders = flagString(parseFlags(argv, [{ flags: ["--providers"], key: "providers", kind: "string" }]), "providers")
  ?.split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry.length > 0);
// A durable-engine-managed workspace's canonical state lives at state/business-state.json (v2),
// not state/PROJECT_STATE.yaml (v1) -- see check-onboarding-graph.ts's identical bridge for the
// full rationale. Before this bridge, this validator called the v1-only loadProjectState()
// unconditionally: a genuine v2 workspace with no PROJECT_STATE.yaml at all failed permanently on
// project_state.missing, and a stale retained v1 file (the engine only ever writes v2) silently
// hid the real v2 lane status, so a done onboarding lane's PostHog/RevenueCat evidence requirement
// was never actually evaluated. v1 is now consulted only when v2's business-state.json does not
// exist at all -- its absence is normal for a v2-managed workspace, not an error to surface here.
const v2Exists = existsSync(path.join(args.root, "state", "business-state.json"));
const loaded = v2Exists ? { issues: [] as Issue[] } : loadProjectState(args);
const issues: Issue[] = [...loaded.issues];
const proofPath = path.join(args.root, "operations/PROVIDER_PROOF.md");
const proofText = existsSync(proofPath) ? readFileSync(proofPath, "utf8") : "";

const proofRequiredLanes = ["analytics_attribution", "revenue", "email", "store_console", "apple_signing", "security", "engineering", "onboarding"];

/**
 * Providers whose Proof Ledger row must be grounded on disk once a mapped lane
 * is done. MobAI/Doppler rows are not mapped: engineering and secrets proof
 * have their own validators and legitimately route through non-MobAI tooling.
 */
const providerLaneMap: Array<{ provider: string; lanes: string[] }> = [
  { provider: "PostHog", lanes: ["analytics_attribution", "onboarding"] },
  { provider: "RevenueCat", lanes: ["revenue", "onboarding"] },
  { provider: "Resend", lanes: ["email"] },
  { provider: "App Store Connect", lanes: ["store_console", "apple_signing"] },
  { provider: "Sentry", lanes: ["security"] },
];

// loadLaneFromBusinessStateV2's document-level failures (invalid JSON, failed schema validation)
// repeat identically across every lane call against the same file, so this dedupes them by
// message rather than reporting the same underlying problem once per proofRequiredLanes entry.
const reportedInvalidStateMessages = new Set<string>();

function laneStatus(lane: string): string | undefined {
  const v2Lane = loadLaneFromBusinessStateV2(args.root, lane);
  if (v2Lane.kind === "found") return v2Lane.status;
  if (v2Lane.kind === "invalid") {
    if (!reportedInvalidStateMessages.has(v2Lane.message)) {
      reportedInvalidStateMessages.add(v2Lane.message);
      issues.push(issue("error", "provider_proof.business_state_invalid", v2Lane.message, "state/business-state.json"));
    }
    return undefined;
  }
  // v2Lane.kind === "absent": no state/business-state.json at all, so v1 is this workspace's only
  // state source (loaded.state is populated in exactly this case -- see the v2Exists branch above).
  return loaded.state && isRecord(loaded.state) ? asString(getPath(loaded.state, `lanes.${lane}.status`)) : undefined;
}

/**
 * Markdown table body rows (header and separator rows excluded). Cells split
 * on raw "|" can shift when a cell contains a literal pipe (shell pipelines in
 * the proof-command column are common), so each row keeps its raw text and
 * path extraction scans the whole row instead of trusting a column index.
 */
const ledgerRows: Array<{ cells: string[]; raw: string }> = proofText
  .split("\n")
  .filter((line) => line.trim().startsWith("|"))
  .map((line) => ({
    raw: line,
    cells: line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim()),
  }))
  .filter(({ cells }) => cells.length >= 4 && !/^-+$/.test(cells[0] ?? "") && !/provider/i.test(cells[0] ?? ""));

/**
 * proofText with every ledger row belonging to an out-of-scope provider removed, when
 * --providers was passed; the unscoped default returns proofText unchanged. Only ledger table
 * rows are ever removed -- prose, headers, and the matching providers' own rows all stay, so the
 * ready-claim/open-blocker check below still sees genuinely relevant context, just not an
 * unrelated provider's still-pending row.
 */
function scopedProofText(): string {
  if (!scopedProviders || scopedProviders.length === 0) return proofText;
  const outOfScopeRows = new Set(ledgerRows.filter((row) => !scopedProviders.includes((row.cells[0] ?? "").toLowerCase())).map((row) => row.raw));
  if (outOfScopeRows.size === 0) return proofText;
  return proofText
    .split("\n")
    .filter((line) => !outOfScopeRows.has(line))
    .join("\n");
}

/** Path-like tokens: backtick-quoted spans (which may contain spaces) plus bare tokens with an extension. */
function pathTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const inner = (match[1] ?? "").trim();
    if (/[/.]/.test(inner)) {
      tokens.push(inner);
    }
  }
  tokens.push(...(text.match(/[A-Za-z0-9_@-]+(?:\/[A-Za-z0-9_.@-]+)*\.[A-Za-z0-9]+/g) ?? []));
  return tokens;
}

// A done proof-required lane is the hard trigger. Readiness prose in
// engineering/PRODUCTION_READINESS.md is only a soft signal: the shipped template's own
// cautionary boilerplate ("Do not mark this app launch-ready until ...")
// matches any naive readiness regex, so text alone must not hard-fail a repo
// where nothing is done yet.
// laneStatus() is self-sufficient across v1 and v2, so no outer "is there any state at all" guard
// is needed here -- unlike the old v1-only laneStatus(), which returned undefined for every lane
// whenever loaded.state was absent, silently skipping this whole loop even when v2 held the real
// answer.
let requiresProof = false;
for (const lane of proofRequiredLanes) {
  if (laneStatus(lane) === "done") {
    requiresProof = true;
  }
}
const readinessText = readOptional("engineering/PRODUCTION_READINESS.md");
const readinessProse = Boolean(readinessText && /\b(ready|done|verified|launch[- ]ready|production[- ]ready)\b/i.test(readinessText));

if (!proofText.trim()) {
  if (requiresProof) {
    issues.push(
      issue(
        "error",
        "provider_proof.file_missing",
        "Provider-backed readiness requires operations/PROVIDER_PROOF.md with live evidence or explicit founder-only blockers.",
        "operations/PROVIDER_PROOF.md",
      ),
    );
  } else if (readinessProse) {
    issues.push(
      issue(
        "warning",
        "provider_proof.file_missing",
        "engineering/PRODUCTION_READINESS.md carries readiness language but operations/PROVIDER_PROOF.md does not exist yet. Seed it from business/operations/PROVIDER_PROOF.md before any provider-backed lane is marked done.",
        "operations/PROVIDER_PROOF.md",
      ),
    );
  }
} else {
  for (const keyword of [
    "PostHog",
    "RevenueCat",
    "Resend",
    "App Store Connect",
    "Sentry",
    "MobAI",
    "Doppler",
    "current status",
    "proof command",
    "evidence path",
    "founder-only",
  ]) {
    if (!proofText.toLowerCase().includes(keyword.toLowerCase())) {
      issues.push(
        issue("error", `provider_proof.${slug(keyword)}.missing`, `operations/PROVIDER_PROOF.md must include ${keyword}.`, "operations/PROVIDER_PROOF.md"),
      );
    }
  }

  const readyClaimScope = scopedProofText();
  const claimsReady = /\b(verified|ready|launch[- ]ready|production[- ]ready|live proof complete)\b/i.test(readyClaimScope);
  const containsOpenBlocker = /\b(not verified|pending|todo|unknown|placeholder|blocked|founder-only blocker)\b/i.test(readyClaimScope);
  if (claimsReady && containsOpenBlocker) {
    issues.push(
      issue(
        "error",
        "provider_proof.ready_claim_with_blocker",
        "Do not claim provider proof is ready while unresolved placeholders, pending items, or founder-only blockers remain.",
        "operations/PROVIDER_PROOF.md",
      ),
    );
  }

  // Ground the ledger in reality once a lane claims done: the provider's row
  // must exist, its status must read as captured evidence (not still-planned
  // work), and at least one path in its evidence-path cell must exist on disk.
  // Keyword presence alone cannot mark a provider-backed lane done.
  for (const mapping of providerLaneMap) {
    const doneLanes = mapping.lanes.filter((lane) => laneStatus(lane) === "done");
    if (doneLanes.length === 0) {
      continue;
    }
    const row = ledgerRows.find(({ cells }) => cells[0]?.toLowerCase().includes(mapping.provider.toLowerCase()));
    if (!row) {
      issues.push(
        issue(
          "error",
          `provider_proof.${slug(mapping.provider)}.row_missing`,
          `lanes.${doneLanes[0]} is done but operations/PROVIDER_PROOF.md has no ledger row for ${mapping.provider}.`,
          "operations/PROVIDER_PROOF.md",
        ),
      );
      continue;
    }
    const statusCell = row.cells[1] ?? "";
    if (/\b(needs|pending|todo|tbd|unknown|placeholder|planned)\b/i.test(statusCell)) {
      issues.push(
        issue(
          "error",
          `provider_proof.${slug(mapping.provider)}.status_unproven`,
          `lanes.${doneLanes[0]} is done but the ${mapping.provider} ledger status still reads as planned work ("${statusCell.trim()}"). Capture the live evidence or keep the lane partial/blocked.`,
          "operations/PROVIDER_PROOF.md",
        ),
      );
    }
    // Scan the whole raw row: a literal pipe in an earlier cell (shell
    // pipeline in the proof command) shifts positional cells, and the goal is
    // only that some named artifact from this row exists on disk.
    const evidencePaths = pathTokens(row.raw);
    if (evidencePaths.length === 0) {
      issues.push(
        issue(
          "error",
          `provider_proof.${slug(mapping.provider)}.evidence_path_unrecorded`,
          `lanes.${doneLanes[0]} is done but the ${mapping.provider} ledger row names no file path. Record the captured artifact's path (backtick-quote paths that contain spaces).`,
          "operations/PROVIDER_PROOF.md",
        ),
      );
    } else if (!evidencePaths.some((relative) => existsSync(path.join(args.root, relative)))) {
      issues.push(
        issue(
          "error",
          `provider_proof.${slug(mapping.provider)}.evidence_path_missing`,
          `lanes.${doneLanes[0]} is done but none of the ${mapping.provider} evidence paths exist on disk (${evidencePaths.join(", ")}). Run the live probe/capture so the artifact exists before marking the lane done.`,
          evidencePaths[0],
        ),
      );
    }
  }
}

reportAndExit("Live provider proof check", issues);

function readOptional(relativePath: string): string | undefined {
  const filePath = path.join(args.root, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : undefined;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
