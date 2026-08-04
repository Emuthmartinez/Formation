#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { asString, getPath, isRecord, issue, loadProjectState, parseCliArgs, reportAndExit, type Issue } from "../../../tooling/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues: Issue[] = [...loaded.issues];
const proofPath = path.join(args.root, "operations/PROVIDER_PROOF.md");
const proofText = existsSync(proofPath) ? readFileSync(proofPath, "utf8") : "";

const proofRequiredLanes = ["analytics_attribution", "revenue", "email", "store_console", "apple_signing", "security", "engineering"];

/**
 * Providers whose Proof Ledger row must be grounded on disk once a mapped lane
 * is done. MobAI/Doppler rows are not mapped: engineering and secrets proof
 * have their own validators and legitimately route through non-MobAI tooling.
 */
const providerLaneMap: Array<{ provider: string; lanes: string[] }> = [
  { provider: "PostHog", lanes: ["analytics_attribution"] },
  { provider: "RevenueCat", lanes: ["revenue"] },
  { provider: "Resend", lanes: ["email"] },
  { provider: "App Store Connect", lanes: ["store_console", "apple_signing"] },
  { provider: "Sentry", lanes: ["security"] },
];

function laneStatus(lane: string): string | undefined {
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
let requiresProof = false;
if (loaded.state && isRecord(loaded.state)) {
  for (const lane of proofRequiredLanes) {
    if (laneStatus(lane) === "done") {
      requiresProof = true;
    }
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

  const claimsReady = /\b(verified|ready|launch[- ]ready|production[- ]ready|live proof complete)\b/i.test(proofText);
  const containsOpenBlocker = /\b(not verified|pending|todo|unknown|placeholder|blocked|founder-only blocker)\b/i.test(proofText);
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
