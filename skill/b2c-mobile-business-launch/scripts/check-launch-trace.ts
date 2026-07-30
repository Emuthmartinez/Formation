#!/usr/bin/env node
/**
 * check-launch-trace.ts — content floor for the traceability lane.
 *
 * LAUNCH_TRACE.md is the chain from research to implementation; the lane
 * previously had no dedicated validator. Structure follows the
 * LAUNCH_TRACE.md contract in playbook/process/artifact-contracts.md.
 *
 * npm script: check:launch-trace
 * Usage: tsx scripts/check-launch-trace.ts --root <app-repo-root>
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

const laneStatus = state ? asString(getPath(state, "lanes.traceability.status"))?.toLowerCase() : undefined;
const skip = laneStatus === "not_needed" || laneStatus === "deferred";
const done = laneStatus === "done";
const text = readText(args.root, "LAUNCH_TRACE.md");

if (!skip && !text) {
  issues.push(
    issue(
      "error",
      "launch_trace.markdown_missing",
      "LAUNCH_TRACE.md is required for multi-artifact launches so the chain from research to implementation does not drift. Seed it from business/LAUNCH_TRACE.md.",
      "LAUNCH_TRACE.md",
    ),
  );
}

if (text) {
  for (const phrase of ["Decision Trace", "Rejected Decisions", "Founder-Only Decisions", "Blockers", "Verification"]) {
    if (!text.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(
        issue(
          done ? "error" : "warning",
          `launch_trace.${phrase.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
          `LAUNCH_TRACE.md should include ${phrase} (see the LAUNCH_TRACE.md contract in artifact-contracts.md).`,
          "LAUNCH_TRACE.md",
        ),
      );
    }
  }

  if (!/\bTRACE-\d+\b/.test(text)) {
    issues.push(
      issue(
        done ? "error" : "warning",
        "launch_trace.no_trace_ids",
        "LAUNCH_TRACE.md should carry stable TRACE-<n> IDs so builder prompts and readiness checks can reference decisions instead of restating context.",
        "LAUNCH_TRACE.md",
      ),
    );
  }

  for (const ref of ["RESEARCH.md", "SPEC.md"]) {
    if (!text.includes(ref)) {
      issues.push(
        issue(
          done ? "error" : "warning",
          `launch_trace.ref_${ref.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
          `LAUNCH_TRACE.md should reference ${ref} in its evidence/decision chain.`,
          "LAUNCH_TRACE.md",
        ),
      );
    }
  }

  if (done && /\breplace with\b|\b(TODO|TBD|placeholder)\b/i.test(text)) {
    issues.push(
      issue(
        "error",
        "launch_trace.placeholder_complete",
        "The traceability lane cannot be done while template placeholders ('replace with', TODO/TBD) remain in LAUNCH_TRACE.md.",
        "LAUNCH_TRACE.md",
      ),
    );
  }
}

reportAndExit("Launch trace check", issues);
