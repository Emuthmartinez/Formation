# Onboarding Design And Delivery

Load from `onboarding-conversion.md` when `ONB-15` through `ONB-22` becomes ready. These nodes select the architecture, specify and design every user-visible state, route through Compound Engineering, cut over, and prove zero legacy.

## 12. ONB-15 and ONB-16: architecture and journey

Compare at least:

- native-first
- hosted-funnel-first
- hybrid product activation plus hosted acquisition and monetization
- web-first acquisition and purchase
- another evidence-backed model when appropriate

Evaluate conversion, retention, first-value fidelity, image or file needs, resume, identity, experiments, analytics, policy, economics, accessibility, localization, latency, offline behavior, operational burden, and lock-in.

Different acquisition channels may enter through different renderers, but all converge on one semantic state graph.

The recommended journey names every step and branch, including:

- user job and business job
- required inputs
- owner and renderer
- state transition
- event
- back, skip, close, and resume
- permission
- failure and recovery
- acquisition continuity
- first value
- engagement
- account
- paywall
- purchase
- activation
- entry into a populated normal product experience

Create an interruption budget. Do not stack first value, paywall, account creation, push permission, review request, and referral prompts as a modal ambush.

## 13. ONB-17 and ONB-18: complete design contract

Every screen receives a stable semantic ID. Every control receives a stable control ID.

For each screen specify:

- purpose and evidence trace
- exact production copy and dynamic tokens
- layout, hierarchy, scroll, keyboard, safe-area, device, and localization behavior
- visual assets and trust cues
- entry data, local state, canonical state, resume, back, skip, close, and deep-link behavior
- initial, selected, disabled, loading, slow, success, empty, error, offline, permission, subscriber, trial, purchase, restore, returning, large-text, screen-reader, and reduced-motion states
- analytics and exposure semantics
- accessibility reading order, labels, focus, announcements, contrast, and touch targets
- motion reference and target-framework implementation

For each control specify:

- visible and accessibility labels
- enabled and disabled conditions
- validation
- local and canonical mutations
- API or provider action
- idempotency
- event or explicit `none`
- navigation
- loading, repeated tap, error, retry, offline, interruption, haptic, motion, and tests

`Continue` is not a sufficient action specification.

Produce actual visual proof and an interactive primary-journey prototype. `product/onboarding.html` is the rendered contract, not a substitute for screen design. The inspectable design lives in the Design Room or another declared prototype artifact.

The paywall design covers trial eligible and ineligible, packages, restore, existing subscriber, unavailable product, offline, pending, canceled, failed, success, delayed entitlement, web handoff, and regional variants. The renderer must be able to implement the design.

Motion clarifies state, continuity, feedback, progress, reveal, success, and recovery. It does not disguise latency or delay the user for decoration. Reduced motion is first class.

## 14. ONB-19 and ONB-20: build contracts and adversarial QA

Define behavior for termination, network loss, slow backend, malformed or rejected AI output, upload failure, analytics outage, remote-config outage, provider outage, purchase pending, duplicate or delayed webhook, restore failure, deep-link failure, redemption failure, identity collision, unsupported app version, and review API unavailability.

Define measurable performance budgets and operational signals for startup, time to interactive, first-value latency, paywall, checkout, entitlement, analytics overhead, and cross-surface handoff.

Before planning implementation, generate synthetic one-star pre-mortem scenarios across privacy, denied permissions, poor result, slow network, trial ineligibility, existing subscriber, restore, accessibility, account collision, web purchase, and subscription aversion. Label them synthetic. Fix preventable risks.

Run design QA, accessibility review, policy review, analytics sequence review, and provider-realism review.

## 15. ONB-21 and ONB-22: plan, execute, and prove

The implementation plan maps every screen, control, state, event, provider configuration, test, and legacy item to an executable task.

Each task includes:

- outcome
- repository and paths
- dependencies
- contracts and data changes
- analytics and provider changes
- tests
- deletion performed
- acceptance criteria
- rollback or roll-forward behavior
- parallel safety
- owner

Replacement mode uses a hard cutover:

1. freeze legacy onboarding changes
2. complete target contracts and implementation
3. rehearse one-time durable-data transformation
4. verify accounts, entitlements, user-created value, identity, analytics, and provider configuration
5. publish surfaces in controlled order
6. enforce a new minimum supported client when old contracts are incompatible
7. cut traffic to the target system
8. verify production
9. delete legacy runtime code, routes, state, data structures, flags, jobs, secrets, provider configuration, dashboards, alerts, tests, and documents
10. delete transformation tooling
11. run a repository-wide zero-legacy search
12. roll forward on defects; do not keep the old runtime as a standing fallback

A version gate that tells unsupported clients to update is acceptable. Reimplementing old onboarding behind that gate is not.

## 16. Required `product/ONBOARDING.md` contract

The artifact is the canonical onboarding decision and execution record. It contains:

- execution mode and graph run
- source map and current-state trace
- evidence ledger
- competitor review matrix
- Onbo Hub pattern atlas
- internal-guidance audit
- seven-principle activation audit
- provider capability and policy matrices
- 60fps motion register
- evidence decision and complaint traceability
- first value and activation
- effort-before-value and question usefulness
- personalization proof
- canonical state, identity, entitlement, and transitions
- architecture decision
- journey graph and branch table
- screen inventory
- control and action contract
- paywall contract
- review-request contract
- analytics and expected event sequences
- experiments
- permissions and lifecycle
- failure and recovery
- accessibility and localization
- privacy and security
- performance and observability
- prototype and design proof
- synthetic pre-mortem
- implementation and zero-legacy cutover
- verification and Definition of Done

Do not duplicate the entire artifact in repository-specific documents. Local documents point to the canonical contract and contain only local implementation details.

## 17. Acceptance standard

The onboarding lane is not done until:

- evidence is current, classified, and traceable
- the target architecture is selected rather than left as options
- first value, engagement, activation, retention, monetization, and review eligibility are distinct
- every required question changes the experience
- first value is real and survives account, purchase, app termination, and identity linking
- the normal product opens populated with the user's work
- state, identity, entitlement, analytics, and experiments have authoritative owners
- review eligibility is earned early but the native request occurs outside first-run onboarding
- every screen, control, state, error, paywall, and branch is specified
- actual design and prototype proof exist
- analytics are typed, deduplicated, privacy-reviewed, and sequence-tested
- provider and regional policy behavior is current
- accessibility, localization, privacy, security, reliability, and observability pass
- the implementation plan includes deletion
- replacement mode leaves no legacy runtime, compatibility layer, old event, stale configuration, or obsolete document
- the Formation onboarding graph validator passes
