# Onboarding Evidence And Research

Load from `onboarding-conversion.md` when `ONB-02` through `ONB-09` becomes ready. Return read-only evidence packets to the orchestrator; do not mutate canonical state or product decisions from a research worker.

## 6. ONB-02 through ONB-09: evidence formation

### Source hierarchy

Use, in order:

1. current platform policy and official provider documentation
2. current repository implementation and provider configuration
3. reliable product data and direct user research
4. current first-party app-store reviews and official support forums
5. quantitative reports with disclosed methods
6. direct observation of current product flows
7. original practitioner posts and talks, including current high-signal work from Ernesto Lopez, Kree8 Studio, Mau Baron, César Alvarez, Jake Mor, Sylvain Gauchet, Rosie Hoggmascall, David Barnard, and other demonstrably relevant practitioners
8. secondary commentary

For every recommendation classify it as:

- platform requirement
- evidence-backed recommendation
- quantitative benchmark
- direct user finding
- competitor pattern
- practitioner heuristic
- product hypothesis
- open question requiring an experiment

Record source, publication or capture date, access date, market, version, method, confidence, and product implication.

### Competitor review mining

Use direct and adjacent competitors. Prioritize recent one-, two-, and three-star written reviews, then read a smaller four- and five-star control sample to identify what users value.

Code complaints into at least:

- acquisition or expectation mismatch
- onboarding length, questions, account, back, skip, or resume friction
- permissions and privacy
- slow, failed, generic, inaccurate, or unactionable first value
- paywall surprise, trial ambiguity, unexpected charge, restore, cancellation, or entitlement failure
- product-quality failures that onboarding cannot solve
- excessive or irrelevant lifecycle messages
- accessibility, inclusion, localization, and trust

Classify each complaint as:

- directly solvable in onboarding
- partially addressable
- expectation-setting issue
- monetization issue
- identity or entitlement issue
- lifecycle issue
- core product defect
- support issue
- platform limitation
- not applicable
- insufficient evidence

Do not onboarding-wash a product defect. Better copy does not repair bad recommendations, lost purchases, slow generation, or missing editing.

The review matrix records sample size and frequency within the sample. It never presents sampled review frequency as the percentage of all users.

### Onbo Hub

Use Onbo Hub through authorized public, Pro, or API access. Never scrape, bypass locked content, or infer inaccessible screens.

For relevant flows record:

- app, category, platform, capture date, current-version confidence, and access level
- reported screen count and screens actually reviewed
- screenshots and video reviewed
- estimated revenue wording and confidence
- stage-by-stage sequence
- required taps, selections, typing, images, permissions, accounts, waits, and financial commitments
- first promise, demonstration, simulated preview, real personalized result, actionable result, and persistent result
- account, permission, paywall, trial, restore, close, and normal-product timing
- persuasion, trust, privacy, accessibility, and dark-pattern risks
- related negative and positive review evidence

Treat estimated revenue as an estimate, never causal proof. Pattern prevalence and pattern quality are separate fields.

Use Onbo Hub for complete-flow context. Use 60fps for focused interaction and motion detail.

### Internal guidance audit

Read the actual Formation and internal B2C references routed to onboarding, not a remembered summary.

For each rule record:

- source and section
- context
- evidence basis
- applicability
- pass, partial, fail, not applicable, or outdated
- conflict resolution
- required change

Resolve conflicts in this order:

1. current law and platform policy
2. safety, privacy, accessibility, and user trust
3. reliable product data
4. direct user research
5. systematic review evidence
6. high-quality external evidence
7. internal doctrine
8. practitioner heuristics
9. aesthetic preference

When internal guidance is outdated, update the doctrine instead of silently ignoring it.

### Provider and policy landscape

Refresh the full current capability surface for every provider that could replace custom infrastructure.

For subscription products, the RevenueCat review includes, where currently available:

- SDKs, products, packages, offerings, placements, entitlements, customer identity, restore, transfers, webhooks, and lifecycle state
- paywalls, editor, targeting, audiences, experiments, trials, offers, win-back, and Customer Center
- RevenueCat Funnels, branching, surveys, URL routing, analytics, experiments, domains, web purchasing, and handoff
- RevenueCat Web, Purchases.js, Web Paywalls, Web Purchase Links, Web Purchase Buttons, anonymous and identified purchases, Redemption Links, deep links, portals, and lifecycle email
- RevenueCat Billing, Stripe, Paddle, merchant-of-record or managed-payment options, tax, disputes, refunds, and regional limits
- analytics, exports, integrations, sandbox events, virtual currency, ad monetization, and any newer product exposed in current docs or dashboard

For each capability record status, platform, SDK or plan requirement, cost, limits, data ownership, current custom equivalent, adopt/build/omit decision, lock-in risk, policy implications, and code or configuration to delete.

Review current Apple and Google rules by platform and region. Separate technically possible, policy permitted, and recommended.

### 60fps motion research

Use the 60fps MCP deliberately. At minimum use the available equivalents of:

- `search_shots`
- `get_shot`
- `get_motion_breakdown`
- `get_related_shots`

Use `get_motion_code` when implementation-level timing helps.

Search by the specific interaction problem, not only by the word onboarding. Compare alternatives for strategic moments such as selection, image entry, real processing, result reveal, paywall presentation, success, and recovery.

Record shot ID, source, trigger, states, timing, easing, adopted principle, deliberate changes, target-framework translation, haptic behavior, interruptibility, reduced-motion behavior, and performance risk.

Do not copy another product's brand, copy, icons, illustrations, assets, or exact layout. SwiftUI snippets are references when the target is Flutter, React Native, web, or another stack. Translate the interaction, not the source code.

### Seven-principle activation audit

Audit the flow against the Kree8 Studio seven-principle framework supplied or refreshed for the run. Treat it as a practitioner framework to test against stronger evidence, not as universal law:

1. define the activation moment
2. show value before asking for disproportionate effort
3. ask only questions that change the experience
4. keep one dominant action per screen
5. use purposeful motion and interaction
6. make personalization visibly specific
7. end initial onboarding with a meaningful result and populated next state

Record pass, partial, fail, or not applicable for each principle, with evidence, product implication, screen or contract IDs, and required correction. Do not use a numerical score that implies false precision.

### Evidence join

`ONB-09` produces:

- evidence ledger
- competitor review matrix
- Onbo Hub pattern atlas
- 60fps motion register
- provider capability matrix
- policy matrix
- internal-guidance audit
- seven-principle activation audit
- complaint-to-design traceability
- adopted, test, rejected, and investigate pattern register

Every material complaint and recommendation receives an explicit disposition.
