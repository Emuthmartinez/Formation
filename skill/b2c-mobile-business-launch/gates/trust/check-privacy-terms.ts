#!/usr/bin/env node
/**
 * check-privacy-terms.ts — content floor for the privacy_legal lane.
 *
 * PRIVACY.md and TERMS.md are the source drafts for the public policy pages
 * and store disclosures; the lane previously had no dedicated validator.
 * Structure follows the PRIVACY.md / TERMS.md contracts in
 * playbook/process/artifact-contracts.md. Founder/legal approval remains the final
 * gate — this validator enforces the structural floor, not legal adequacy.
 *
 * npm script: check:privacy-terms
 * Usage: tsx gates/trust/check-privacy-terms.ts --root <app-repo-root>
 */
import { asString, getPath, issue, loadProjectState, parseCliArgs, readText, reportAndExit } from "../../scripts/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

const laneStatus = state ? asString(getPath(state, "lanes.privacy_legal.status"))?.toLowerCase() : undefined;
const skip = laneStatus === "not_needed" || laneStatus === "deferred";
const done = laneStatus === "done";

const documents: Array<{ name: string; requiredPhrases: string[] }> = [
  {
    name: "PRIVACY.md",
    requiredPhrases: ["Effective date", "Privacy contact", "Data Inventory", "Retention And Deletion", "App Store Disclosure Mapping", "Deletion route"],
  },
  {
    name: "TERMS.md",
    requiredPhrases: ["Effective date", "not legal advice", "Subscriptions And Refunds", "Disclaimers And Liability", "Platform Terms", "governing law"],
  },
];

for (const document of documents) {
  const text = readText(args.root, document.name);
  const code = document.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  if (!text) {
    if (!skip) {
      issues.push(
        issue(
          "error",
          `privacy_terms.${code}.missing`,
          `${document.name} is required as the source draft for public policy pages and store disclosures. Seed it from business/${document.name}.`,
          document.name,
        ),
      );
    }
    continue;
  }

  for (const phrase of document.requiredPhrases) {
    if (!text.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(
        issue(
          done ? "error" : "warning",
          `privacy_terms.${code}.${phrase.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.missing`,
          `${document.name} should cover: ${phrase} (see its contract in artifact-contracts.md).`,
          document.name,
        ),
      );
    }
  }

  if (done && /\bYYYY-MM-DD\b|\breplace with\b|\b(TODO|TBD|placeholder)\b/i.test(text)) {
    issues.push(
      issue(
        "error",
        `privacy_terms.${code}.placeholder_complete`,
        `The privacy_legal lane cannot be done while template placeholders (YYYY-MM-DD, 'replace with', TODO/TBD) remain in ${document.name}.`,
        document.name,
      ),
    );
  }
}

reportAndExit("Privacy and terms check", issues);
