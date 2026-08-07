import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, skillRoot, type Harness } from "./_harness.js";
import { resolveTsxBin } from "../../tooling/lib/tsx-bin.js";
import { describeLaunchRepository, readTraceTable, splitMarkdownSections, type ImportBoundaryReport } from "../../core/adapters/platform-import.js";

/**
 * Fixtures for the existing-launch-repository importer (core/adapters/platform-import.ts).
 *
 * The three properties worth spending a suite on, because breaking any one of them turns a
 * migration tool into a liability:
 *
 * 1. **It never writes.** Every case that reads a workspace also proves the workspace is
 *    byte-for-byte unchanged afterwards. "Never deletes or rewrites the source repository" is the
 *    promise that lets a founder try an import on a live launch repository without a backup.
 * 2. **Import keys are content-derived and stable.** Idempotency on the platform side is only as
 *    good as the keys it matches on, so keys are asserted equal across two runs and asserted
 *    unchanged when the workspace reorders its own lists.
 * 3. **Contradictions surface rather than resolve.** A lane recorded finished whose evidence is
 *    missing must still produce its claim *and* the contradiction against it. Dropping either
 *    would be the importer quietly deciding something the founder should decide.
 */

const tsxBin = resolveTsxBin(skillRoot);
const importCliPath = path.join(skillRoot, "core/adapters/platform-import.ts");

function runImportCli(args: string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(tsxBin, [importCliPath, ...args], { cwd: skillRoot, encoding: "utf8" });
  return { code: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function write(root: string, relativePath: string, contents: string): void {
  const absolute = path.join(root, relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents, "utf8");
}

/** Every file under a root with its size and modification time — the no-write proof's before/after. */
function snapshotTree(root: string): string {
  const entries: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const stats = statSync(absolute);
      entries.push(`${path.relative(root, absolute)}:${stats.size}:${stats.mtimeMs}`);
    }
  };
  walk(root);
  return entries.join("\n");
}

const FILLED_STATE = `schema_version: "1"
updated_at: "2026-07-30"
project:
  name: "Ocho"
  slug: "ocho"
  owner: "Eduardo"
  phase: "phase_6_launch"
  launch_scope: "essentials"
  platforms:
    - ios
  bundle_ids:
    ios: "com.example.app"
  public_urls:
    landing: "https://ocho.example"
business_operator:
  next_founder_action: "Approve the store submission so the release can go out."
continuity:
  last_state_review: "not_reviewed"
orchestration:
  state_reconciled: false
lanes:
  research:
    status: "done"
    evidence:
      - "strategy/RESEARCH.md"
    blockers: []
    go_pivot_kill_decision: "go"
    go_pivot_kill_decided_at: "2026-05-01"
  product:
    status: "partial"
    evidence:
      - "product/SPEC.md"
    blockers: []
  design:
    status: "done"
    evidence:
      - "design/DESIGN.md"
    blockers: []
  engineering:
    status: "blocked"
    evidence: []
    blockers:
      - "The signing certificate expired and needs renewal."
  post_launch_ops:
    status: "not_started"
    evidence: []
    blockers: []
    live_since: "2026-05-29"
    kill_or_scale_decision: "scale"
    kill_or_scale_decided_at: "2026-07-01"
open_questions:
  - owner: "founder"
    question: "Do we keep the free tier after launch?"
    blocks:
      - "pricing"
failure_cards:
  active:
    - id: "docs-stale"
      severity: "medium"
      status: "open"
      next_action: "Refresh the credential tool docs before writing setup commands."
  resolved: []
`;

const FILLED_BUSINESS = `{
  "schemaVersion": "1.0.0",
  "business": {
    "name": "Ocho",
    "slug": "ocho",
    "stage": "live",
    "positioning": "A domino game you can actually play with your family.",
    "targetAudience": "Families who already play dominoes together."
  }
}
`;

const FILLED_TRACE = `# Launch Trace

## Rejected Decisions

| Rejected decision | Why rejected |
| --- | --- |
| replace with a rejected route | evidence pointed elsewhere |
| Ship an Android version first | The audience is overwhelmingly on iPhone. |

## Founder-Only Decisions

| Decision | Status |
| --- | --- |
| Approve the launch price | approved |
| Approve connecting the ad account | pending |

## Blockers

| Blocker |
| --- |
| The signing certificate must be renewed before the next build. |
`;

function buildFilledWorkspace(harness: Harness, name: string): string {
  const root = harness.makeTempDir(name);
  write(root, "state/PROJECT_STATE.yaml", FILLED_STATE);
  write(root, "state/business.json", FILLED_BUSINESS);
  write(root, "state/LAUNCH_TRACE.md", FILLED_TRACE);
  write(root, "strategy/RESEARCH.md", "# Market research\n\n## What we learned\n\nFamilies play weekly.\n\n## What we do not know\n\nWhether they will pay.\n");
  write(root, "product/SPEC.md", "# Product spec\n\nThe app is a domino game.\n");
  return root;
}

function describeUnchanged(root: string): ImportBoundaryReport {
  const before = snapshotTree(root);
  const report = describeLaunchRepository(root, { now: "2026-08-07T00:00:00.000Z" });
  assert(snapshotTree(root) === before, "the importer must not write to, delete from, or touch the launch workspace it reads");
  return report;
}

export function register(harness: Harness): void {
  // --- honest "nothing here" answers, which are answers rather than failures -------------------

  harness.check("import: a directory with no PROJECT_STATE.yaml answers 'not a launch workspace' rather than crashing", () => {
    const root = harness.makeTempDir("import-empty");
    const report = describeUnchanged(root);
    assert(report.workspaceReady === false, "expected workspaceReady false for a directory that is not a launch workspace");
    assert(/no state\/PROJECT_STATE\.yaml/.test(report.reason ?? ""), `expected the reason to name the missing state file, got: ${report.reason}`);
    assert(report.company === undefined, "a not-ready report must not carry a company");
  });

  harness.check("import: the untouched skill template reports that there is no business in it yet", () => {
    const report = describeUnchanged(path.join(skillRoot, "workspace/business"));
    assert(report.workspaceReady === false, "expected the shipped template workspace to be reported as having nothing to import");
    assert(/untouched template/.test(report.reason ?? ""), `expected the reason to name the template, got: ${report.reason}`);
  });

  harness.check("import: an unparseable state file is reported as unreadable, never as an empty business", () => {
    const root = harness.makeTempDir("import-bad-yaml");
    write(root, "state/PROJECT_STATE.yaml", "project:\n  name: \"Ocho\"\n   bad indentation: [\n");
    const report = describeUnchanged(root);
    assert(report.workspaceReady === false, "expected workspaceReady false for an unparseable state file");
    assert(report.claims === undefined && report.deliverables === undefined, "an unreadable workspace must not report zero claims as if it had been read");
  });

  // --- company mapping ------------------------------------------------------------------------

  harness.check("import: company fields come from the launch workspace, with the live stage winning over the phase", () => {
    const root = buildFilledWorkspace(harness, "import-company");
    const report = describeUnchanged(root);
    assert(report.workspaceReady === true, `expected a ready report, got: ${report.reason}`);
    const company = report.company!;
    assert(company.name === "Ocho", `expected the project name, got ${company.name}`);
    assert(company.founderName === "Eduardo", `expected the recorded owner as founder, got ${company.founderName}`);
    assert(company.stage === "growth", `a business recorded live is past launch, expected stage "growth", got ${company.stage}`);
    assert(company.oneLiner.startsWith("A domino game"), `expected the positioning as the one-liner, got ${company.oneLiner}`);
    assert(company.enginePhase === "phase_6_launch", "the engine's own phase must travel as provenance");
    assert(company.liveSince === "2026-05-29", "the recorded go-live date must be carried across");
  });

  harness.check("import: a workspace with no business.json still imports, with the missing promise stated rather than invented", () => {
    const root = harness.makeTempDir("import-no-business-json");
    write(root, "state/PROJECT_STATE.yaml", FILLED_STATE);
    const report = describeUnchanged(root);
    assert(report.workspaceReady === true, `expected a ready report, got: ${report.reason}`);
    assert(/brought across from an existing launch workspace/.test(report.company!.oneLiner), `expected an honest placeholder one-liner, got: ${report.company!.oneLiner}`);
    assert(/has not named a primary customer/.test(report.company!.targetCustomer), `expected an honest missing-customer sentence, got: ${report.company!.targetCustomer}`);
  });

  // --- classification -------------------------------------------------------------------------

  harness.check("import: a finished lane becomes a recommendation to review, never a fact", () => {
    const report = describeUnchanged(buildFilledWorkspace(harness, "import-claims"));
    const research = report.claims!.find((claim) => claim.importKey === "lane:research:done");
    assert(research !== undefined, "expected a claim for the finished research lane");
    assert(research!.kind === "recommendation", `an imported lane completion must be a recommendation, got ${research!.kind}`);
    assert(research!.evidence.includes("strategy/RESEARCH.md"), "the claim must carry the evidence path the lane named");
    assert(report.claims!.every((claim) => claim.kind !== "assumption" || claim.statement.length > 0), "every claim must carry a statement");
    assert(
      report.claims!.every((claim) => (claim.kind as string) !== "fact"),
      "nothing read out of a launch workspace may import as a fact",
    );
  });

  harness.check("import: an open question with a founder owner imports as a question", () => {
    const report = describeUnchanged(buildFilledWorkspace(harness, "import-questions"));
    const question = report.claims!.find((claim) => claim.kind === "question");
    assert(question !== undefined, "expected the open question to import");
    assert(question!.statement === "Do we keep the free tier after launch?", `expected the question text, got ${question!.statement}`);
  });

  harness.check("import: both recorded founder verdicts import as decided decisions with their dates", () => {
    const report = describeUnchanged(buildFilledWorkspace(harness, "import-verdicts"));
    const go = report.decisions!.find((decision) => decision.importKey === "decision:go-pivot-kill");
    const scale = report.decisions!.find((decision) => decision.importKey === "decision:kill-or-scale");
    assert(go?.status === "decided" && go.decidedAt === "2026-05-01", `expected the go verdict decided on its recorded date, got ${JSON.stringify(go)}`);
    assert(scale?.status === "decided" && scale.decidedAt === "2026-07-01", `expected the scale verdict decided on its recorded date, got ${JSON.stringify(scale)}`);
    assert(!/\bgo\b|\bpivot\b|\bkill\b/i.test(go!.decision) || go!.decision.includes("Continue"), "the verdict must be restated in words, not left as a code");
  });

  harness.check("import: the launch trace's rejected routes and pending founder gates both come across, template rows do not", () => {
    const report = describeUnchanged(buildFilledWorkspace(harness, "import-trace"));
    const rejected = report.decisions!.filter((decision) => decision.status === "superseded");
    assert(rejected.length === 1, `expected exactly the one real rejected decision, got ${rejected.length}: ${rejected.map((entry) => entry.title).join(", ")}`);
    assert(rejected[0]!.title.includes("Android"), `expected the real rejected route, got ${rejected[0]!.title}`);
    const pending = report.decisions!.find((decision) => decision.status === "proposed");
    assert(pending?.title === "Approve connecting the ad account", `expected the pending founder gate, got ${JSON.stringify(pending)}`);
    const approved = report.decisions!.find((decision) => decision.title === "Approve the launch price");
    assert(approved?.status === "decided", "an approved founder gate must import as decided, not as still waiting");
  });

  harness.check("import: blockers, part-done lanes, and the next founder action all become work", () => {
    const report = describeUnchanged(buildFilledWorkspace(harness, "import-tasks"));
    const keys = report.tasks!.map((task) => task.importKey);
    assert(keys.includes("task:lane:product"), "a part-done lane must become work to finish");
    assert(keys.includes("task:lane:engineering"), "a stuck lane must become work");
    assert(
      report.tasks!.some((task) => task.urgency === "critical" && task.title.includes("store submission")),
      "the next founder action must import as the most urgent task",
    );
    assert(
      report.tasks!.some((task) => task.title.includes("credential tool docs")),
      "an open failure card must import as work",
    );
    assert(report.tasks!.filter((task) => task.blocked).length >= 3, "blocked work must be marked blocked, not merely queued");
  });

  harness.check("import: every Markdown file a lane cites becomes a deliverable, split on its own headings", () => {
    const report = describeUnchanged(buildFilledWorkspace(harness, "import-deliverables"));
    const research = report.deliverables!.find((entry) => entry.importKey === "deliverable:strategy/RESEARCH.md");
    assert(research !== undefined, "expected the research document to import");
    assert(research!.title === "Market research", `expected the document's own H1 as the title, got ${research!.title}`);
    assert(research!.sections.length === 2, `expected one section per H2, got ${research!.sections.length}`);
    assert(research!.fingerprint.length === 64, "a deliverable must carry a content fingerprint so a re-import can tell whether it changed");
    const missing = report.deliverables!.find((entry) => entry.importKey === "deliverable:design/DESIGN.md");
    assert(missing === undefined, "a document a lane names but that is not on disk must not be invented");
  });

  // --- contradictions -------------------------------------------------------------------------

  harness.check("import: a finished lane whose evidence is missing produces both the claim and the contradiction against it", () => {
    const report = describeUnchanged(buildFilledWorkspace(harness, "import-contradiction"));
    const claim = report.claims!.find((entry) => entry.importKey === "lane:design:done");
    assert(claim !== undefined, "the claim must still be reported — dropping it would hide the disagreement rather than surface it");
    const contradiction = report.contradictions!.find((entry) => entry.code === "lane_evidence_missing");
    assert(contradiction !== undefined, "expected a contradiction for the missing evidence file");
    assert(contradiction!.severity === "blocking", "missing evidence behind a finished lane is blocking, not advisory");
    assert(contradiction!.relatesTo === "lane:design:done", "a contradiction must name the record it undermines");
  });

  harness.check("import: finishing a lane over an unfinished dependency is flagged, and a dated override silences it", () => {
    const root = buildFilledWorkspace(harness, "import-dependency");
    const flagged = describeUnchanged(root).contradictions!.filter((entry) => entry.code === "lane_dependency_unmet");
    assert(flagged.length === 1, `expected design-over-product to be flagged once, got ${flagged.length}`);
    assert(flagged[0]!.message.includes("Product"), `expected the unmet dependency named, got ${flagged[0]!.message}`);

    write(root, "state/PROJECT_STATE.yaml", FILLED_STATE.replace('  design:\n    status: "done"', '  design:\n    dependency_override: "2026-07-01 the design was locked before the spec was finished"\n    status: "done"'));
    const overridden = describeUnchanged(root).contradictions!.filter((entry) => entry.code === "lane_dependency_unmet");
    assert(overridden.length === 0, "a workspace that recorded its reason in a dated override must not be asked the same question again");
  });

  harness.check("import: a workspace that says its own state is unreconciled says so alongside what it claims is finished", () => {
    const report = describeUnchanged(buildFilledWorkspace(harness, "import-reconciled"));
    const contradiction = report.contradictions!.find((entry) => entry.code === "state_not_reconciled");
    assert(contradiction !== undefined, "expected the unreconciled-state doubt to be carried across");
    assert(/2 finished areas/.test(contradiction!.message), `expected the count of affected areas, got: ${contradiction!.message}`);
  });

  harness.check("import: template example values are flagged as never answered rather than imported as answers", () => {
    const report = describeUnchanged(buildFilledWorkspace(harness, "import-placeholder"));
    const placeholder = report.contradictions!.find((entry) => entry.code === "placeholder_value");
    assert(placeholder !== undefined, "expected the example bundle identifier to be flagged");
    assert(placeholder!.message.includes("com.example.app"), `expected the placeholder value quoted, got: ${placeholder!.message}`);
  });

  harness.check("import: a lane status the engine does not define is reported rather than silently classified", () => {
    const root = harness.makeTempDir("import-unknown-status");
    write(root, "state/PROJECT_STATE.yaml", FILLED_STATE.replace('  product:\n    status: "partial"', '  product:\n    status: "mostly-fine"'));
    const report = describeUnchanged(root);
    const contradiction = report.contradictions!.find((entry) => entry.code === "lane_status_unrecognised");
    assert(contradiction !== undefined, "expected an unrecognised lane status to be flagged");
    assert(report.tasks!.every((task) => task.importKey !== "task:lane:product"), "an unclassifiable status must not be guessed into work");
  });

  // --- idempotency preconditions --------------------------------------------------------------

  harness.check("import: import keys are identical across two reads of the same workspace", () => {
    const root = buildFilledWorkspace(harness, "import-stable-keys");
    const first = describeUnchanged(root);
    const second = describeLaunchRepository(root, { now: "2026-09-01T00:00:00.000Z" });
    const keys = (report: ImportBoundaryReport) =>
      [
        ...report.claims!.map((entry) => entry.importKey),
        ...report.decisions!.map((entry) => entry.importKey),
        ...report.tasks!.map((entry) => entry.importKey),
        ...report.deliverables!.map((entry) => entry.importKey),
      ].sort();
    assert(JSON.stringify(keys(first)) === JSON.stringify(keys(second)), "import keys must not depend on when the import runs");
  });

  harness.check("import: reordering the workspace's own lists does not change any import key", () => {
    const ordered = buildFilledWorkspace(harness, "import-order-a");
    const reordered = buildFilledWorkspace(harness, "import-order-b");
    write(
      reordered,
      "state/LAUNCH_TRACE.md",
      FILLED_TRACE.replace(
        "| Approve the launch price | approved |\n| Approve connecting the ad account | pending |",
        "| Approve connecting the ad account | pending |\n| Approve the launch price | approved |",
      ),
    );
    const keysOf = (root: string) =>
      describeUnchanged(root)
        .decisions!.map((entry) => entry.importKey)
        .sort();
    assert(JSON.stringify(keysOf(ordered)) === JSON.stringify(keysOf(reordered)), "import keys must be derived from content, never from list position");
  });

  harness.check("import: editing a document changes its fingerprint but not its import key", () => {
    const root = buildFilledWorkspace(harness, "import-fingerprint");
    const before = describeUnchanged(root).deliverables!.find((entry) => entry.importKey === "deliverable:product/SPEC.md")!;
    write(root, "product/SPEC.md", "# Product spec\n\nThe app is a domino game for four players.\n");
    const after = describeUnchanged(root).deliverables!.find((entry) => entry.importKey === "deliverable:product/SPEC.md")!;
    assert(after.importKey === before.importKey, "a re-import must recognise the same document, so its key cannot move when its text does");
    assert(after.fingerprint !== before.fingerprint, "the fingerprint must move when the text does, or a re-import cannot tell it changed");
  });

  // --- pure helpers ---------------------------------------------------------------------------

  harness.check("import: a Markdown document with no headings still imports as one readable section", () => {
    const { title, sections } = splitMarkdownSections("Just a paragraph of notes.\n");
    assert(title === undefined, "expected no title where the document names none");
    assert(sections.length === 1 && sections[0]!.body.includes("Just a paragraph"), `expected one fallback section, got ${JSON.stringify(sections)}`);
  });

  harness.check("import: reading a trace table tolerates a missing section, a header-only table, and stray text", () => {
    assert(readTraceTable("# Trace\n", "Blockers").length === 0, "a missing section reads as no rows, not as an error");
    assert(readTraceTable("## Blockers\n\n| Blocker |\n| --- |\n", "Blockers").length === 0, "a header-only table reads as no rows");
    assert(readTraceTable("## Blockers\n\nsome prose\n\n| Blocker |\n| --- |\n| a real one |\n", "Blockers").length === 1, "prose above a table must not stop it being read");
  });

  // --- CLI contract ---------------------------------------------------------------------------

  harness.check("import CLI: --workspace is required, and its absence is an error the caller can see", () => {
    const result = runImportCli([]);
    assert(result.code === 1, `expected exit 1, got ${result.code}: ${result.stderr}`);
    assert(result.stderr.includes("--workspace is required"), `expected a named argument error, got: ${result.stderr}`);
  });

  harness.check("import CLI: a workspace with nothing to import still exits 0 with a parseable answer", () => {
    const root = harness.makeTempDir("import-cli-empty");
    const result = runImportCli(["--workspace", root, "--now", "2026-08-07T00:00:00.000Z"]);
    assert(result.code === 0, `an answered question must exit 0 even when the answer is "nothing here", got ${result.code}: ${result.stderr}`);
    const report = JSON.parse(result.stdout) as ImportBoundaryReport;
    assert(report.workspaceReady === false, "expected the parseable answer to say the workspace is not ready");
  });

  harness.check("import CLI: stdout is the report and nothing else, so a caller can parse it directly", () => {
    const root = buildFilledWorkspace(harness, "import-cli-filled");
    const before = snapshotTree(root);
    const result = runImportCli(["--workspace", root, "--now", "2026-08-07T00:00:00.000Z"]);
    assert(result.code === 0, `expected exit 0, got ${result.code}: ${result.stderr}`);
    const report = JSON.parse(result.stdout) as ImportBoundaryReport;
    assert(report.workspaceReady === true && report.company?.name === "Ocho", `expected the filled workspace's company, got ${result.stdout.slice(0, 200)}`);
    assert(snapshotTree(root) === before, "running the CLI must leave the launch workspace untouched");
  });
}
