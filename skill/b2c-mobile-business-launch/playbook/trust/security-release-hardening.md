# Security Release Hardening

Use this before app architecture is frozen, before beta/TestFlight/store submission, before provider webhooks mutate state, or when the user asks about security hardening, Claude Security, Codex Security, OWASP MASVS, MobSF, Sentry, app integrity, threat modeling, or release readiness.

Security is a launch lane, not a cleanup pass. Create or refresh `SECURITY.md` early enough to influence `TECH_SPEC.md`, `ENGINEERING_PLAN.md`, `PRIVACY.md`, `ANALYTICS.md`, `REVENUE_OPS.md`, `APPLE_SIGNING.md`, `STORE_CONSOLE.md`, and `PRODUCTION_READINESS.md`.

## Default Output

- `SECURITY.md`: canonical threat model, controls, tool routing, accepted risks, and release proof.
- `security-review.html`: founder-visible rendered board showing risk, proof, and gates.
- `PROJECT_STATE.yaml`: `lanes.security`, `tools.security_review`, evidence, blockers, and failure cards.
- Optional `.well-known/security.txt` or equivalent public vulnerability route when the web/app handles accounts, payments, user content, or sensitive data.
- Optional security findings in `FAILURE_CARDS.md` when risks are open.

## Source Basis

Refresh current docs at runtime before writing commands, claims, or setup paths:

- OWASP MASVS and MASTG for mobile app controls and tests.
- OWASP ASVS for backend/API/web funnel controls.
- Apple Platform Security, Keychain data protection, App Transport Security, DeviceCheck, and App Attest for iOS.
- Android security best practices, Android Keystore, Network Security Config, and Play Integrity API for Android.
- Anthropic Claude Security and Claude Code `/security-review` docs when the user has access.
- OpenAI Codex Security docs when the user has access.
- MobSF docs and release notes when using local or hosted mobile scanning.
- Sentry docs for mobile/web crash, performance, replay, PII scrubbing, release health, and alerts.

Record source URLs and checked dates in `SECURITY.md` and `PROJECT_STATE.yaml.tools.security_review.docs_checked_at` when the route changes.

## Skill And Tool Routing

Use available local skills before inventing a security process:

- `security-threat-model`: repository-grounded threat model, trust boundaries, assets, attacker capabilities, abuse paths, and mitigations.
- `security-best-practices`: language/framework secure-default review for TypeScript/JavaScript, Python, and Go where supported.
- `security-ownership-map`: sensitive-code ownership and bus-factor review when the repo has meaningful git history.
- Sentry SDK skills: platform-specific setup for release health, crash, tracing, replay, and alert proof.

Do not treat Sentry as a substitute for hardening. Sentry is monitoring and incident response; it does not prove authorization, webhook, entitlement, storage, or app-integrity controls.

## Paid Tool Routing

Paid or account-gated security routes require founder confirmation before fallback work:

| Paid/account route | Use | Free or local fallback |
| --- | --- | --- |
| Claude Security | semantic security review, scheduled scans, targeted patch PRs | `security-threat-model`, `security-best-practices`, manual abuse-path review |
| Codex Security | threat-model-backed vulnerability scan, validation, patch PR | local threat model, tests, manual code review |
| GitHub Advanced Security | secret scanning, code scanning, dependency review | `gitleaks`, `trufflehog`, `semgrep`, `osv-scanner`, package-manager audits |
| Snyk / Semgrep Cloud / Socket | dependency, SAST, supply-chain, malicious-package checks | Semgrep community rules, `npm audit`, `osv-scanner`, lockfile review |
| MobSF Cloud or commercial mobile pentest | APK/IPA/source static and dynamic mobile analysis | local Docker MobSF, platform static analyzer, manual MASTG checks |
| Approov / Guardsquare / commercial app integrity | anti-tamper, attestation, runtime protection | App Attest, DeviceCheck, Play Integrity, rate limits, backend risk scoring |

Missing runtime access is not approval to use the fallback. Ask or record the blocked route in `TOOL_DECISIONS.md` and `PROJECT_STATE.yaml`.

## SECURITY.md Contract

`SECURITY.md` must include these sections:

- Source Basis with current docs and checked dates.
- Security Review Tool Routing with paid/account route, founder gate, selected fallback, and limitations.
- Threat Model with assets, trust boundaries, attacker capabilities, abuse paths, and non-capabilities.
- Data Classification with storage and logging rules.
- Mobile Hardening for iOS and Android, marking not-applicable platform sections explicitly.
- Authentication and Authorization, including anonymous, signed-in, subscriber, admin/support, deleted-account states.
- Backend and API Controls: validation, authz, RLS/policies, rate limits, idempotency, retries, admin access, audit logs.
- Revenue, Entitlements, and Abuse: RevenueCat, Stripe, app-store purchases, restores, refunds, promo grants, and webhook verification.
- Privacy and Analytics: PostHog, session replay, survey posture, PII scrubbing, self-reported attribution, and store disclosure alignment.
- Email and Domain Security: Resend, SPF, DKIM, DMARC, unsubscribe, inbound/reply, security alias, and webhook signing.
- Supply Chain and Build Security: dependencies, SDK inventory, lockfiles, secret scans, signing material, CI, and generated code.
- Monitoring and Incident Response: Sentry/release health, alerts, rollback, support escalation, store crash reports, public contact path.
- Release Proof: command results, scanner evidence or blocked route, mobile/backend/provider proof, and accepted risks.
- Founder Approval Gates.

Do not mark security done from prose. Security is done only when `SECURITY.md`, `security-review.html`, relevant scanner/review evidence, secret routing, production-readiness proof, and remaining accepted risks are all current.

## Mobile Hardening Checklist

For iOS:

- Keychain storage for tokens and sensitive per-user values, with accessibility class chosen deliberately.
- App Transport Security enabled; exceptions documented with owner, domain, reason, and review date.
- App Attest or DeviceCheck considered for high-value backend actions, entitlement/reward abuse, or fraud-heavy flows.
- Entitlements reviewed: associated domains, URL schemes, app groups, keychain access groups, push, iCloud, HealthKit, camera, location, photos, Bluetooth, contacts, notifications.
- Deep links and universal links validate input and route only to allowed states.
- `APPLE_SIGNING.md` proves Team ID, bundle ID/App ID, app record, signing, archive/export/upload/TestFlight when distribution is in scope.

For Android:

- Android Keystore or platform encrypted storage for tokens and sensitive values.
- Network Security Config disallows cleartext production traffic unless a documented debug/local exception exists.
- Play Integrity considered for high-value backend actions and enabled in observe-first mode before blocking users.
- Exported activities/services/receivers/providers reviewed and minimized.
- Intent/deep-link input validation and safe file/provider sharing.
- Backup rules, signing config, ProGuard/R8/obfuscation posture, and Play Console declarations reviewed.

## Revenue And Entitlement Abuse

Any monetized app must prove:

- RevenueCat offering/product/entitlement IDs match app-store products and `REVENUE_OPS.md`.
- App access is granted from backend/provider truth, not client-only events.
- Stripe web checkout maps to the same entitlement as app-store purchases.
- Webhooks verify signatures and use idempotency/replay protection before mutating entitlements.
- Restore purchases is tested end to end.
- Refund/cancel/grace-period states are reflected in app access.
- Support-granted entitlements record owner, reason, expiry, and rollback path.

## Privacy, Analytics, And Store Alignment

Security and privacy docs must agree:

- `SECURITY.md`, `PRIVACY.md`, `ANALYTICS.md`, App Privacy answers, Google Play Data safety, and `STORE_CONSOLE.md` use the same SDK/data inventory.
- Session replay and surveys include masking, sampling, consent/opt-out posture, and disclosure notes.
- Self-reported attribution is persisted with stable keys and does not store raw sensitive data beyond the approved free-text field.
- Sentry and analytics scrub PII where supported and do not capture raw secrets, receipts, passwords, private messages, or unsupported health/child data.

## Public Security Route

If the launch has accounts, payments, user content, sensitive data, or a public web funnel, include a public reporting route:

- preferred: `public/.well-known/security.txt` or hosting equivalent
- alternate: public support/security contact in privacy/support pages
- must include contact, policy/disclosure statement, preferred language, and canonical URL when feasible
- must not promise bug bounty, SLA, or legal terms unless the founder approved them

## Validator

Run:

```bash
npm run check:security -- --root /path/to/app
```

The validator checks that `SECURITY.md` includes the minimum security contract, platform-specific hardening, tool-routing fallback language, revenue/webhook controls, privacy/analytics controls, email/domain security, supply-chain controls, monitoring/incident response, and founder gates. It is not a vulnerability scanner. Use it to prevent launch-package gaps, then use scanners and reviews for actual code findings.

## LaunchBench Failure Mode

When an agent claims an app is launch-ready without `SECURITY.md`, scanner/review route, app-integrity decision, entitlement abuse controls, or incident response, add or activate a failure card:

```yaml
id: "security-release-lane-missing"
severity: "high"
owner: "security-architect"
status: "open"
next_action: "Create SECURITY.md, render security-review.html, run check:security, and attach scanner/review proof or founder-approved blocked route."
validator: "npm run check:security -- --root ."
```

## Acceptance

- Security lane exists in `PROJECT_STATE.yaml`.
- `SECURITY.md` is specific to the app, not generic boilerplate.
- `security-review.html` renders the security plan for founder review.
- Paid security tools are used, blocked, or founder-approved for fallback.
- Platform controls are considered for the actual platforms.
- Monetization, backend, email, analytics, and store disclosures are covered.
- Remaining risks have owner, reason, expiry/revisit date, and compensating control.
- Security validator and relevant scans/reviews are recorded in `PRODUCTION_READINESS.md`.
