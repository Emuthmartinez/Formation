#!/usr/bin/env node
/**
 * check-paid-tool-decisions
 *
 * Verifies that TOOL_DECISIONS.md exists and contains a decision entry for every
 * primary paid tool (AppKittie, XPOZ, Higgsfield, Refero, MobAI) whenever a
 * fallback was used in any lane doc.  Also checks that no fallback was taken
 * without a recorded founder approval.
 *
 * Run: npm run check:paid-tool-decisions -- --root <app-repo-root>
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "./lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

function includes(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle.toLowerCase());
}

function hasFallbackApproval(text: string): boolean {
  return /\b(founder approval|founder-approved|approved fallback|fallback approved|blocked waiting for access|stop for founder approval|requires founder approval|confirmed by founder|founder confirmed)\b/i.test(
    text,
  );
}

// ---------------------------------------------------------------------------
// Locate TOOL_DECISIONS.md
// ---------------------------------------------------------------------------
const toolDecisions = readText(args.root, "TOOL_DECISIONS.md");

const paidToolStatus = state ? asString(getPath(state, "lanes.paid_tool_routing.status"))?.toLowerCase() : undefined;
const skip = paidToolStatus === "not_needed" || paidToolStatus === "deferred";

if (!skip && !toolDecisions) {
  issues.push(
    issue(
      "error",
      "paid_tool_decisions.file_missing",
      "TOOL_DECISIONS.md is required when paid or account-gated tools are in scope. Create it and record the access status and founder decision for every primary paid tool (AppKittie, XPOZ, Higgsfield, Refero, MobAI).",
      "TOOL_DECISIONS.md",
    ),
  );
}

if (toolDecisions) {
  // -------------------------------------------------------------------------
  // Check that every tool that appears in a fallback context has a decision entry.
  // We scan a set of candidate lane docs plus TOOL_DECISIONS.md itself.
  // -------------------------------------------------------------------------
  const laneDocs: Array<{ path: string; text: string }> = [];
  for (const candidate of [
    "TOOL_DECISIONS.md",
    "RESEARCH.md",
    "CONTENT_ASSETS.md",
    "content-assets/CONTENT_ASSETS.md",
    "UX_PATTERNS.md",
    "ux-patterns/UX_PATTERNS.md",
    "ENGINEERING_PLAN.md",
    "PRODUCTION_READINESS.md",
    "SCREENSHOTS.md",
    "STORE_CONSOLE.md",
    "APP_STORE_LISTING.md",
    "FASTLANE_OPS.md",
    "ASO.md",
  ]) {
    const text = readText(args.root, candidate);
    if (text) {
      laneDocs.push({ path: candidate, text });
    }
  }

  // -------------------------------------------------------------------------
  // Per-tool checks
  // -------------------------------------------------------------------------
  interface ToolSpec {
    name: string;
    fallbackSignals: RegExp;
    entrySignals: RegExp;
    code: string;
  }

  const tools: ToolSpec[] = [
    {
      name: "AppKittie",
      fallbackSignals:
        /\b(appkittie unavailable|appkittie missing|appkittie blocked|no appkittie|without appkittie|appkittie fallback|skipped appkittie|manual keyword|manual aso|public app store search|app store search fallback)\b/i,
      entrySignals: /\bappkittie\b/i,
      code: "appkittie",
    },
    {
      name: "XPOZ",
      fallbackSignals:
        /\b(xpoz unavailable|xpoz missing|xpoz blocked|no xpoz|without xpoz|xpoz fallback|skipped xpoz|reddit json|curl.*reddit|platform.native search|browser.*reddit|public web search.*social|manual social research)\b/i,
      entrySignals: /\bxpoz\b/i,
      code: "xpoz",
    },
    {
      name: "Higgsfield",
      fallbackSignals:
        /\b(higgsfield unavailable|higgsfield missing|higgsfield blocked|no higgsfield|higgsfield fallback|replace higgsfield|replacing higgsfield|remotion fallback|fallback from higgsfield|higgsfield not invoked)\b/i,
      entrySignals: /\bhiggsfield\b/i,
      code: "higgsfield",
    },
    {
      name: "Refero",
      fallbackSignals:
        /\b(refero unavailable|refero missing|refero blocked|no refero|without refero|refero fallback|refero not found|free baseline route|bundled baseline)\b/i,
      entrySignals: /\brefero\b/i,
      code: "refero",
    },
    {
      name: "MobAI",
      // The in-app simulator alternations matter as much as the XcodeBuildMCP
      // ones: it is now the documented default route, it costs nothing, and
      // substituting it for MobAI drops all Android coverage — the most likely
      // silent downgrade in practice.
      fallbackSignals:
        /\b(mobai unavailable|mobai missing|mobai blocked|no mobai|without mobai|mobai fallback|xcodebuildmcp fallback|xcodebuildmcp instead of mobai|in-app simulator|in-app ios simulator|simulator pane|build-ios-apps|instead of mobai)\b/i,
      entrySignals: /\bmobai\b/i,
      code: "mobai",
    },
  ];

  for (const tool of tools) {
    // Does any lane doc (other than TOOL_DECISIONS.md) mention a fallback for this tool?
    const fallbackInLanes = laneDocs.some((doc) => doc.path !== "TOOL_DECISIONS.md" && tool.fallbackSignals.test(doc.text));

    // Does TOOL_DECISIONS.md mention this tool at all?
    const entryInDecisions = tool.entrySignals.test(toolDecisions);

    if (fallbackInLanes && !entryInDecisions) {
      issues.push(
        issue(
          "error",
          `paid_tool_decisions.${tool.code}.entry_missing`,
          `A ${tool.name} fallback was used in a lane doc but TOOL_DECISIONS.md has no entry for ${tool.name}. Record tool, lane, access status, founder confirmation, selected route, and fallback limitation.`,
          "TOOL_DECISIONS.md",
        ),
      );
    }

    // If TOOL_DECISIONS.md mentions this tool but has no approval language, flag it.
    if (entryInDecisions) {
      // Find the paragraph(s) that mention this tool and check for approval.
      const paragraphs = toolDecisions.split(/\n{2,}/);
      const toolParagraphs = paragraphs.filter((p) => tool.entrySignals.test(p));
      const anyApproved = toolParagraphs.some(
        (p) => hasFallbackApproval(p) || /\b(paid|provisioned|access confirmed|tool used|tool available|mcp confirmed|mcp path used)\b/i.test(p),
      );
      if (!anyApproved) {
        issues.push(
          issue(
            "warning",
            `paid_tool_decisions.${tool.code}.approval_unclear`,
            `TOOL_DECISIONS.md mentions ${tool.name} but the entry does not clearly record founder approval, confirmed access, or explicit fallback approval. Add a founder_confirmation field.`,
            "TOOL_DECISIONS.md",
          ),
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Required structural fields: every entry block must have key fields.
  // We look for the standard table or YAML-ish structure.
  // -------------------------------------------------------------------------
  const requiredSections = ["tool", "lane", "access status", "founder confirmation", "selected route"];
  for (const section of requiredSections) {
    if (!includes(toolDecisions, section)) {
      issues.push(
        issue(
          "warning",
          `paid_tool_decisions.structure.${section.replaceAll(" ", "_")}.missing`,
          `TOOL_DECISIONS.md should include a "${section}" field for each entry per the artifact contract in paid-tool-routing.md.`,
          "TOOL_DECISIONS.md",
        ),
      );
    }
  }

  // -------------------------------------------------------------------------
  // Confidence / limitation labels: fallback outputs must be labeled.
  // -------------------------------------------------------------------------
  const hasFallbackMention = /\b(fallback|free route|free baseline|free fallback|manual research)\b/i.test(toolDecisions);
  const hasLimitationLabel = /\b(fallback limitation|confidence|limitation|lower confidence|not equivalent|weaker than|what .* would have improved)\b/i.test(
    toolDecisions,
  );
  if (hasFallbackMention && !hasLimitationLabel) {
    issues.push(
      issue(
        "error",
        "paid_tool_decisions.fallback_limitation_unlabeled",
        "TOOL_DECISIONS.md records a fallback route but does not include a fallback_limitation or confidence note. Fallback outputs must be labeled with what the paid tool would have improved.",
        "TOOL_DECISIONS.md",
      ),
    );
  }
}

reportAndExit("Paid-tool decisions check", issues);
