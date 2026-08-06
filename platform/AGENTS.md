# Formation platform contributor contract

## Product boundary

`platform/` is founder-facing. Founder-visible language must use business vocabulary, not graph, lane, agent, gate, validator, provider, filesystem, or prompt vocabulary unless a founder is explicitly configuring automation.

The historical skill runtime is an internal engine. Do not make the web application read its generated Markdown or state files directly. Integration belongs behind a typed adapter and must preserve workspace authorization.

## State rules

- All durable mutations go through the server store transaction.
- Every workspace operation checks membership server-side.
- Never accept workspace ownership from the request body.
- Do not turn generated content into facts automatically.
- Artifact changes increment versions.
- Claims retain kind, confidence, status, and evidence.
- Decisions retain rationale and review date.

## UI rules

- Every page has one primary job.
- Prefer editorial hierarchy and decisive rows over card grids.
- Do not add decorative metrics.
- Keep controls visible near the work they change.
- Preserve keyboard focus, labels, semantic headings, and reduced-motion behavior.
- Empty states must explain the next useful action.

## Verification

Run before publishing:

```bash
node platform/run.mjs check
node platform/run.mjs test
node platform/run.mjs build
```

Add a domain test when changing readiness, contradiction, onboarding, generation, versioning, or authorization behavior. Add an API test for every new mutation route.
