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
- A company always keeps at least one owner. Anything that could remove the last one is refused, not repaired afterwards.
- Access changes — invited, joined, role changed, removed, left — are recorded in the company's activity, not a separate log.
- One account may be signed in on several devices, up to a bound. Signing in signs nothing else out until that bound is reached, and then only the device that has gone longest unused. Otherwise a session ends because the person ended it, a password changed, or it went unused past its window.
- Store a coarse device label, never the raw user-agent. A browser build string is a fingerprint.
- Anything reachable without a session is a projection built by naming the fields that may leave — never a record with fields removed. See `server/domain/sharing.mjs`.
- A probe that cannot report failure is not a probe. `GET /api/health` fails only on the store, because that is the one dependency every request needs; a capability a deployment does not have is `not-configured`, never a fault. It answers before authentication, so it carries no path, no environment value, and no error text from inside the process.
- A figure that follows from other fields is computed on read, never stored. A stored derivation is a second copy of the truth. When an input is missing the figure is absent and names the input — never zero.
- A mutation route that changes an existing record accepts the version or timestamp the caller read (`assertUnchanged` in `routes/shared.mjs`) and records who changed it. The check is opt-in by the caller; the refusal names who moved it. A client that refuses a save must keep the unsaved text.
- Conversation and review requests sit beside the record and are never part of it. Nothing computes off them: not readiness, not contradictions, not a provider request, not a shared link. Approving a review promotes nothing — a review is an opinion, and acting on it is a separate act by whoever holds the capability to act.
- Anything sent to a model provider follows the same rule and is built in `server/domain/prompts.mjs`. Never serialise a record, a workspace, or a gathered context object into a provider request.
- A provider that cannot answer is reported as that, in four distinguishable outcomes, and never papered over with the built-in deterministic draft. `server/provider.mjs` owns the call, its budget, and its retry rules; nothing else calls a provider directly.
- Words that did not come from a member of the company are untrusted. `server/domain/trust.mjs` decides which those are, and screens them for text that reads as an instruction rather than a description. Untrusted text is withheld from a provider request and reported — never edited, never dropped from the founder's own record.

## UI rules

- Engine- or system-authored text reaches founders only through `server/domain/presentation.mjs`: board language on top, the original wording preserved for technical disclosure. Founder-authored words are never rewritten.
- Every page has one primary job.
- Prefer editorial hierarchy and decisive rows over card grids.
- Do not add decorative metrics.
- Keep controls visible near the work they change.
- Preserve keyboard focus, labels, semantic headings, and reduced-motion behavior.
- Empty states must explain the next useful action.
- Avoid the vibecoded defaults named in `../skill/b2c-mobile-business-launch/knowledge/design/vibecoded-tells.md`: no default icon packs, sparkle-AI garnish, indigo-purple gradients, glass panels, decorative orbs, or emoji as icons without a recorded design decision. Async surfaces keep designed loading, empty, and error states. After building or restyling founder-facing UI, run the vibecode audit pass that file defines.
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
