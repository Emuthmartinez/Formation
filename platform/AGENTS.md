# Formation platform contributor contract

## Product boundary

`platform/` is founder-facing. Founder-visible language must use business vocabulary, not graph, lane, agent, gate, validator, provider, filesystem, or prompt vocabulary unless a founder is explicitly configuring automation.

The historical skill runtime is an internal engine. Do not make the web application read its generated Markdown or state files directly. Integration belongs behind a typed adapter and must preserve workspace authorization.

## State rules

- All durable mutations go through the server store transaction.
- Every workspace operation checks membership server-side, by naming the capability it needs. `requireWorkspace(database, workspaceId, userId, capability)` in `server/routes/shared.mjs` and `requireMembership(...)` in `server/execution.mjs` both take the capability as a required argument; the ladder itself lives in `server/domain/capabilities.mjs`. A route that does not say what it is doing cannot look a membership up at all.
- Never accept workspace ownership from the request body.
- Do not turn generated content into facts automatically.
- Artifact changes increment versions.
- Claims retain kind, confidence, status, and evidence.
- Decisions retain rationale and review date.

## UI rules

- Engine- or system-authored text reaches founders only through `server/domain/presentation.mjs`: board language on top, the original wording preserved for technical disclosure. Founder-authored words are never rewritten.
- Every page has one primary job.
- Prefer editorial hierarchy and decisive rows over card grids.
- Do not add decorative metrics.
- Keep controls visible near the work they change.
- Preserve keyboard focus, labels, semantic headings, and reduced-motion behavior.
- Empty states must explain the next useful action.
- Gate controls on `snapshot.capabilities`, never on a client-side copy of the role rules. State what a member cannot do once, in plain words, instead of showing a disabled control beside every action.

## Verification

Run before publishing:

```bash
node platform/run.mjs check
node platform/run.mjs test
node platform/run.mjs build
```

Add a domain test when changing readiness, contradiction, onboarding, generation, versioning, or authorization behavior. Add an API test for every new mutation route.

A new route must also be declared in `server/test/capabilities.test.mjs` — `WORKSPACE_SURFACES` with the capability that guards it, or `UNSCOPED_ROUTES` with a reason. That test fails on any undeclared route and then calls every declared one as a member of each role, so a forgotten check is caught by the suite rather than by a customer.
