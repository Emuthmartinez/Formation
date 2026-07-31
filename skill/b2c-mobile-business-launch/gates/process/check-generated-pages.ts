#!/usr/bin/env node
/**
 * check-generated-pages.ts — no page in business/ is hand-authored, and none is
 * left undeclared.
 *
 * The four pages this gate was written for had all drifted from their Markdown
 * sources while the audit stayed green: security-review.html was missing about ten
 * of the fifteen sections its own opening line claimed to cover, store-console.html
 * had lost the entire App Review checklist that prevents a Guideline 2.1 rejection,
 * onboarding.html carried one screen's content under another screen's heading, and
 * orchestration.html contained a table row that had never been real. Nothing could
 * catch any of it, because nothing knew the pages had sources.
 *
 * Three assertions, and all three are needed. Any one alone passes vacuously:
 *
 *   1. Every root-level business/*.html appears in the manifest. Without this a
 *      new hand-authored page is simply invisible.
 *   2. Every manifest entry's file exists. Without this a deleted page reads as
 *      "nothing to check".
 *   3. Every `authored-from` page byte-matches a fresh render. Without this the
 *      first two only prove that a file exists under a name.
 *
 * This grades a launch's founder-facing documents rather than the skill's own
 * upkeep, so it is a gate; it spans store, trust, experience and process subjects
 * at once, so it is filed under the cross-cutting process domain.
 *
 * npm script: check:generated-pages
 * Usage: tsx gates/process/check-generated-pages.ts [--root /path/to/business]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { artifactPageEntries, artifactPages, listRootPages, renderAuthoredPage } from "../../scripts/lib/artifact-pages.js";
import { flagString, issue, parseFlags, reportAndExit, type Issue } from "../../scripts/lib/launch-state.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultBusinessRoot = path.join(path.resolve(scriptDir, "../.."), "business");

const flags = parseFlags(process.argv.slice(2), [{ flags: ["--root", "--business"], key: "root" }]);
const businessRoot = flagString(flags, "root") ?? defaultBusinessRoot;
const issues: Issue[] = [];

if (!existsSync(businessRoot)) {
  issues.push(issue("error", "generated_pages.business_root_missing", `Business directory is missing: ${businessRoot}`, businessRoot));
  reportAndExit("Generated pages", issues);
} else {
  // 1. Every page on disk is declared.
  for (const page of listRootPages(businessRoot)) {
    // hasOwn, not `in`: `in` walks the prototype chain, so a page whose name
    // collided with an Object.prototype key would read as already declared.
    if (Object.hasOwn(artifactPages, page)) continue;
    issues.push(
      issue(
        "error",
        "generated_pages.undeclared_page",
        `${page} sits at the root of business/ with no entry in scripts/lib/artifact-pages.ts. Declare where it comes from: a script that renders it, a starter placeholder, or the Markdown document it is written from.`,
        page,
      ),
    );
  }

  for (const [html, entry] of artifactPageEntries()) {
    // 2. Every declared page exists.
    const outputPath = path.join(businessRoot, html);
    if (!existsSync(outputPath)) {
      issues.push(
        issue(
          "error",
          "generated_pages.missing_page",
          `${html} is declared in scripts/lib/artifact-pages.ts but is not present. Restore the page or remove its entry.`,
          html,
        ),
      );
      continue;
    }

    if (entry.kind !== "authored-from") continue;

    const markdownPath = path.join(businessRoot, entry.markdown);
    if (!existsSync(markdownPath)) {
      issues.push(
        issue(
          "error",
          "generated_pages.source_missing",
          `${html} is written from ${entry.markdown}, which is not present. Without the source the page cannot be checked and becomes hand-authored again.`,
          entry.markdown,
        ),
      );
      continue;
    }

    // 3. The page still matches its source.
    let rendered: string;
    try {
      rendered = renderAuthoredPage(businessRoot, entry);
    } catch (error) {
      issues.push(
        issue(
          "error",
          "generated_pages.unsupported_markdown",
          `${entry.markdown} uses Markdown outside the subset these pages render: ${error instanceof Error ? error.message : String(error)}`,
          entry.markdown,
        ),
      );
      continue;
    }

    if (readFileSync(outputPath, "utf8") !== rendered) {
      issues.push(
        issue(
          "error",
          "generated_pages.drift",
          `${html} does not match a fresh render of ${entry.markdown}. Edit the Markdown source and re-run render:artifact-pages; the page is output, not a document.`,
          html,
        ),
      );
    }
  }

  reportAndExit("Generated pages", issues);
}
