#!/usr/bin/env node
/**
 * check-launch-trace.ts — content floor for the traceability lane.
 *
 * state/LAUNCH_TRACE.md is the chain from research to implementation; the lane
 * previously had no dedicated validator. Structure follows the
 * state/LAUNCH_TRACE.md contract in playbook/process/artifact-contracts.md.
 *
 * npm script: check:launch-trace
 * Usage: tsx gates/process/check-launch-trace.ts --root <app-repo-root>
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "../../scripts/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

const laneStatus = state ? asString(getPath(state, "lanes.traceability.status"))?.toLowerCase() : undefined;
const skip = laneStatus === "not_needed" || laneStatus === "deferred";
const done = laneStatus === "done";
const text = readText(args.root, "state/LAUNCH_TRACE.md");

if (!skip && !text) {
  issues.push(
    issue(
      "error",
      "launch_trace.markdown_missing",
      "state/LAUNCH_TRACE.md is required for multi-artifact launches so the chain from research to implementation does not drift. Seed it from business/state/LAUNCH_TRACE.md.",
      "state/LAUNCH_TRACE.md",
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
          `state/LAUNCH_TRACE.md should include ${phrase} (see the state/LAUNCH_TRACE.md contract in artifact-contracts.md).`,
          "state/LAUNCH_TRACE.md",
        ),
      );
    }
  }

  if (!/\bTRACE-\d+\b/.test(text)) {
    issues.push(
      issue(
        done ? "error" : "warning",
        "launch_trace.no_trace_ids",
        "state/LAUNCH_TRACE.md should carry stable TRACE-<n> IDs so builder prompts and readiness checks can reference decisions instead of restating context.",
        "state/LAUNCH_TRACE.md",
      ),
    );
  }

  for (const ref of ["strategy/RESEARCH.md", "product/SPEC.md"]) {
    if (!text.includes(ref)) {
      issues.push(
        issue(
          done ? "error" : "warning",
          `launch_trace.ref_${ref.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
          `state/LAUNCH_TRACE.md should reference ${ref} in its evidence/decision chain.`,
          "state/LAUNCH_TRACE.md",
        ),
      );
    }
  }

  if (done && /\breplace with\b|\b(TODO|TBD|placeholder)\b/i.test(text)) {
    issues.push(
      issue(
        "error",
        "launch_trace.placeholder_complete",
        "The traceability lane cannot be done while template placeholders ('replace with', TODO/TBD) remain in state/LAUNCH_TRACE.md.",
        "state/LAUNCH_TRACE.md",
      ),
    );
  }
}

reportAndExit("Launch trace check", issues);
