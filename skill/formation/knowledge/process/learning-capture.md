# Learning Capture

This contract makes the knowledge matrix self-feeding. A solved problem becomes a learning document that future runs load through the catalog. Without capture, each lesson lives only in one session and the next run repeats the work.

## When to capture

Capture a learning when all three hold:

- The problem is solved and verified, not merely diagnosed.
- The lesson applies to future work, not only to one business or one incident.
- The lesson is not already derivable from an existing gate, reference, or contract.

Do not capture session-local trivia, unverified hunches, or facts a validator already enforces. One learning per capture. Batching several lessons into one document blurs evidence and blocks clean refresh verdicts later.

## Where learnings live

A learning is an ordinary knowledge package:

- Document: `knowledge/<domain>/learnings/<slug>.md`
- Manifest: `catalog/knowledge/<domain>/learning-<slug>.yaml`

Scaffold both with `npm run knowledge:capture -- --id reference.<domain>.learnings.<slug> --title "..." --domain domain.<domain>`. The manifest starts as `lifecycle: draft`. While the manifest stays draft, the gate reports content gaps as warnings, so a fresh scaffold never breaks the audit. Promote it to `active` only after the evidence verifies and `check:learning-grounding` passes with no warnings for the document. Bind the package to the workflow nodes that would have needed the lesson.

## Document contract

Each learning document carries four sections. `check:learning-grounding` enforces this shape.

### Learning

State the lesson as an instruction for the next run. Say what to do, not what happened.

### Evidence

Ground every claim. Write the section as a table with one row per claim: `| Claim | Citation |`. Each row needs at least one citation in backticks: a repo-relative path, or a path with a line number, for example `tooling/lib/audit-plan.ts:44`. The gate fails when a row has no citation, a cited file is missing, a cited line is outside the file, or a cited line is blank. Claims about code behavior need a code citation, never conversation memory alone. External URLs must also hold a row in `validation/repository/source-registry.yaml`.

### Captured

One line: the capture date as YYYY-MM-DD and the origin. The origin names the run, audit, or incident that produced the lesson.

### Refresh

One line: `Last reviewed: YYYY-MM-DD. Verdict: kept.` The verdict is one of:

- `kept` — the lesson still matches reality; citations still resolve.
- `updated` — the document changed to match current reality.
- `consolidated` — the lesson merged into another document; this one now points there.
- `replaced` — a successor package supersedes this one; set the manifest lifecycle to `deprecated` with `replacement_ids`.
- `retired` — the lesson no longer applies and has no successor; set the manifest lifecycle to `deprecated` and add `retired: true`. The `retired` flag exempts the package from the replacement requirement that deprecation otherwise carries.

## Refresh discipline

The learning-corpus-refresh node audits every learning against current repository reality. Rules:

- Match the document to reality, never reality to the document.
- When evidence is ambiguous, keep the learning and record the doubt in the document. Never delete on a guess.
- `replaced` and `retired` require the deprecated lifecycle in the manifest. The gate enforces this pairing.
- A learning reviewed more than 180 days ago raises a `learning_grounding.review_overdue` warning. The refresh node works these warnings down to zero.

## Boundary

This contract covers maintainer learnings inside this repository. Business workspaces never merge learning documents into this repository. A lesson from a live business enters here only as a rewritten, repo-grounded learning with its own evidence.
