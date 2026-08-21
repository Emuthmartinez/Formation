# Design Evidence Stack

Use this reference before you plan, create, revise, audit, or implement a user-facing surface. It routes a design question to the right evidence source. It does not require a tour of every source.

Complete this evidence pass during the **STATE** step of the Design Room loop. Record the result in `design/design.md` before the first mutation.

## Core Rule

Classify the decision before you search. Mark each source as `required`, `not applicable`, or `unavailable`. Give a reason for each status.

Record one change classification and one change scope in `design/design.md`. Use `small token-preserving correction`, `new or materially changed surface`, or `high-impact or high-risk surface`. Name the affected surface or decision in the scope. The validator uses this scope to apply the required source lanes even when the evidence table has no rows yet.

Use at least one relevant source for a new or materially changed user-facing surface. A small token-preserving correction can skip live research if the evidence table gives the reason.

Use at least two sources for a high-impact or high-risk surface. These surfaces include onboarding, a paywall, the core loop, an AI trust surface, and the first frames of a store listing. Use one source for behavior or structure and one source for craft or validation.

## Source Router

| Source | Use it for | Evidence to capture | Boundary |
| --- | --- | --- | --- |
| `60fps.design` | Motion, transitions, gestures, loading, success, and the magical moment | Two to four relevant examples; the trigger, timing, state change, interruption, and reduced-motion result | Transfer mechanics only. Do not copy brand, assets, copy, exact layout, or generated code without adapting it to the product and token system. |
| `catalogue.projectsbyif.com` | AI decisions, automation, trust, consent, sign-in, permissions, sensitive data, user control, and takeover or recovery | The pattern, its advantages, its limitations, and the reason for adoption or rejection | Prefer agency and clear limits. Keep attribution when an adapted artifact requires it. |
| `abtest.design` | Conversion, onboarding, paywall, checkout, engagement, retention, monetization awareness, and referral hypotheses | The tested change, audience and context, metric, cited source, counter-metric, and a local validation plan | Treat a result as a hypothesis seed. It is not transferable causal proof. Do not repeat a number or claim if its primary or cited source is unavailable. |
| `Design Spells` | Delight, personality, micro-interactions, empty states, success states, transitions, and small moments of surprise | The emotional principle, interaction mechanic, and why it fits this audience | Inspiration only. Do not copy a branded asset, exact composition, or exact interaction sequence. |
| `UXSnaps` | Journey teardown, information hierarchy, onboarding, dashboards, content discovery, and flow critique | The observed pattern, claimed rationale, applicability gap, and local evidence that is still needed | Treat the breakdown as critique, not authority or causal proof. |
| `UI Playbook` | Standard component selection and specification | Function, states, focus and keyboard behavior, accessibility semantics, collision behavior, and responsive behavior | Use it as a specification seed. Confirm implementation details in current official platform or WAI-ARIA guidance. |

When the 60fps MCP is connected, use `60fps_search_shots`, `60fps_get_shot`, `60fps_get_motion_breakdown`, and `60fps_get_related_shots`. If it is not connected, use the public catalog and the distilled recipes in `motion-craft-benchmarks.md`.

## Task Routing

| Design task | Required source lanes |
| --- | --- |
| Motion or gesture | 60fps.design; add UI Playbook when a standard component owns the interaction |
| AI, consent, authentication, permissions, or sensitive data | IF Design Patterns Catalogue; add UI Playbook for the component contract |
| Onboarding, paywall, checkout, retention, or referral | abtest.design plus UXSnaps; add 60fps.design only when motion affects comprehension or feedback |
| Core journey or information hierarchy | UXSnaps; add UI Playbook for each standard component that needs a full state contract |
| Brand delight, success, empty state, or a magical moment | Design Spells plus 60fps.design when the idea moves |
| Standard control, overlay, input, or notification | UI Playbook; add IF when the control changes trust, consent, or user agency |

The task decides the sources. Taste does not decide the sources.

## Evidence Pass

1. Define the user job, surface, decision, and risk.
2. Record the change classification and scope. Mark all six sources as `required`, `not applicable`, or `unavailable`. Give a reason.
3. Open only the required sources. Apply the untrusted-content rules in `knowledge/operations/frontier-agent-operations.md`.
4. Record two to four useful observations. Do not save a screenshot without analysis.
5. Adopt or reject each principle. Map an adopted principle to an exact state path, semantic token, surface, or component.
6. Define the test, metric, counter-metric, accessibility result, and fallback that apply.
7. Mutate state. Update `design/design.md`. Validate, version, and render through the Design Room loop.

If a source is unavailable, record that status and use Formation's distilled doctrine or current official platform guidance. Do not invent evidence. Do not block a low-risk design only because an inspiration site is unavailable.

## Evidence Contract

The `Reference Evidence` section of `design/design.md` has two tables.

The source-triage table uses these fields:

`Source | Status | Why | Query or pattern | Evidence date`

The adopted-evidence table uses these fields:

`Surface or decision | Source | Observation | Adopt or reject | Adaptation | State path | Validation`

Source use is not acceptance. Audience research, product constraints, accessibility, trust, and local validation can reject a popular pattern.

## Done Check

- All six sources have a triage status and a reason.
- Every required source has a query or named pattern and an evidence date.
- Every adopted principle has an adaptation, state path, and validation method.
- A high-impact or high-risk surface uses two complementary sources.
- A cited experiment is a hypothesis unless local evidence proves it.
- No row copies source branding, assets, copy, or an exact layout.
- The Design Room contract, state, tokens, version, and render agree.
