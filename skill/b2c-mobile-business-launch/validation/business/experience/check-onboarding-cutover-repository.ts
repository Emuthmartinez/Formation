#!/usr/bin/env node
/**
 * Independent, repository-grounded check for ONB-22's Zero-Legacy Cutover / Deletion Manifest.
 *
 * check-onboarding-graph.ts (and its --require-done wrapper, ONB-22's other gate) only ever
 * inspects product/ONBOARDING.md's own self-authored text -- it has no way to notice a Deletion
 * Manifest row that claims a legacy artifact was deleted while that artifact still sits on disk.
 * The executor's own record cannot be its own verification for a destructive, one-time cutover:
 * this check reads the Deletion Manifest table and, for every row whose Disposition claims
 * "delete," verifies the claim against actual filesystem state, exactly the way
 * check-live-provider-proof.ts already grounds provider-readiness claims in real evidence paths
 * rather than trusting prose.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { issue, parseCliArgs, readText, reportAndExit, stripNonRenderedMarkdown, type Issue } from "../../../tooling/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const issues: Issue[] = [];

const candidates = ["product/ONBOARDING.md", "business/product/ONBOARDING.md"];
const artifact = candidates
  .map((relativePath) => ({ relativePath, text: readText(args.root, relativePath) }))
  .find((candidate) => candidate.text !== undefined);

if (artifact) {
  const relativePath = artifact.relativePath;
  // check-onboarding-graph.ts already reports onboarding_graph.artifact_missing when this file is
  // absent; this check only has something to say once the artifact exists.
  const liveText = stripNonRenderedMarkdown(artifact.text ?? "");
  for (const row of deletionManifestRows(liveText)) {
    if (!/\bdelete\b/i.test(row.disposition)) continue;
    const spans = backtickSpans(row.raw);
    if (spans.length === 0) {
      issues.push(
        issue(
          "error",
          "onboarding_cutover.deletion_unverifiable",
          `${relativePath}'s Deletion Manifest has a row with Disposition "delete" but names no concrete artifact (a backtick-quoted path, key, or identifier) to verify the deletion against.`,
          relativePath,
        ),
      );
      continue;
    }
    for (const span of spans) {
      if (!/[/.]/.test(span)) continue;
      if (existsSync(path.join(args.root, span))) {
        issues.push(
          issue(
            "error",
            "onboarding_cutover.deletion_not_verified",
            `${relativePath}'s Deletion Manifest claims Disposition "delete" for a row naming \`${span}\`, but that path still exists in the repository. Delete it, or correct the manifest.`,
            span,
          ),
        );
      }
    }
  }
}

reportAndExit("Onboarding cutover repository check", issues);

/** Deletion Manifest table body rows (header and separator rows excluded), located by its own column headers. */
function deletionManifestRows(text: string): Array<{ disposition: string; raw: string }> {
  const lines = text.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === "### Deletion Manifest");
  if (startIndex === -1) return [];
  const rest = lines.slice(startIndex + 1);
  const endIndex = rest.findIndex((line) => /^#{1,6}\s/.test(line.trim()));
  const body = endIndex === -1 ? rest : rest.slice(0, endIndex);

  const tableLines = body.map((line) => line.trim()).filter((line) => line.startsWith("|"));
  const headerLine = tableLines[0];
  if (!headerLine) return [];
  const header = headerLine.split("|").map((cell) => cell.trim().toLowerCase());
  const dispositionIndex = header.indexOf("disposition");
  if (dispositionIndex === -1) return [];

  return tableLines
    .slice(1)
    .filter((line) => !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(line))
    .map((line) => ({
      raw: line,
      disposition: (line.split("|")[dispositionIndex] ?? "").trim(),
    }));
}

/** Backtick-quoted spans anywhere in a row's raw text. */
function backtickSpans(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((match) => (match[1] ?? "").trim()).filter((span) => span.length > 0);
}
