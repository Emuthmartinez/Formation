# Your Accounts And Access

Nothing is set up yet. That is normal at this point, and it is my job rather than yours.

## Founder-Zero Promise

The agent runs setup and ongoing operations, one plain-language step at a time. You keep ownership, account recovery, 2FA, money, legal identity, and the final say on anything public or released. You should never have to manage a checklist or learn platform jargon before your business can move.

## One Next Action

**Right now I need one thing from you.** Tell me the working business or app name you want to use; I will explain and handle the rest one step at a time.

**Why this comes first.** Establish the founder-owned business identity that every account will use. It prevents scattered personal logins and makes later operator access revocable. This is a working-scope choice, not a legal or platform rule, so a rough answer is genuinely fine.

**Where this gets us.** Set the foundation. A clear working identity and the next safe setup step.

### Your options

**Choose a name (recommended).** The name remains provisional until collision and storefront checks are complete. Then I will: Inspect current repo and public identity state, then guide the first secure business account step. We can keep moving with a working name and change it later.

**Decide later.** Account creation and public naming remain blocked, but reversible product inspection continues. Then I will: Continue repo and product-state inspection without creating identity-bound accounts or public assets. Naming stays unfinished, so we cannot call this part done yet.

### If you are not ready

Say so and nothing breaks. A working name can be deferred because private, reversible discovery does not depend on it. Continue private product and repo discovery without creating identity-bound accounts. I will raise it again at the next point where it actually matters: Before creating public accounts, buying a domain, or locking store metadata.

While I wait: Continue read-only repo and product-state inspection; do not infer consent or create public identity assets.

### Definitions

No unfamiliar terms are needed for this decision. When one comes up, I define it here before I use it.

### After you answer

Inspect current repo and public identity state, then guide the first secure business account step. Once we have a working name, I move on to secure account setup, market research, your social profiles, content, support, analytics, store work, and launch, in that order.

We will know this worked when: Business identity and the next account are recorded in operations/BUSINESS_ACCESS.md and this ledger.

## Business Identity

| Item | Current value | Owner | Status | Next action |
| --- | --- | --- | --- | --- |
| Working business/app name | Pending | founder | not started | confirm one working name |
| Founder-owned business email | Pending | founder | not started | create or confirm before account sprawl |
| Recovery email/phone | private; never record value here | founder | not started | founder confirms it exists |
| Legal entity | unknown | founder | not evaluated | defer unless a provider or launch step needs it |
| Region/country | Pending | founder | not started | confirm when store, tax, or provider setup needs it |

## Doppler Setup

Doppler stores automation secrets such as API keys, OAuth tokens, service tokens, and webhook credentials. Browser passwords/passkeys stay in delegated platform access, the founder's password manager, or an authenticated browser session; never in chat or this repo.

| Check | Status | Safe evidence | Next action |
| --- | --- | --- | --- |
| Official docs and local CLI help refreshed | pending | date/version only | agent checks before commands |
| Founder/operator authentication | pending | safe account label only | founder completes browser login when prompted |
| Workspace ownership + recovery | pending | founder-owned label; no personal recovery values | agent verifies founder remains owner/recovery/MFA custodian |
| Durable operator identity + role | pending | safe identity label and exact role | agent prefers delegated role, service token, OIDC, or integration |
| Revocation path | pending | exact menu/integration route | agent verifies access can be removed without risking founder ownership |
| Business project and real configs | pending | project/config names | agent inventories or creates after login |
| Secret names routed | pending | `SECRETS.md` | agent records names, founder enters values securely |
| Safe injection smoke test | pending | command and pass/fail, no values | agent runs the `doppler run --` check |

## Account And Social Access

| Platform | Purpose | Exact account/asset | Owner | Operator identity + route/role | Granted scopes + action boundary | Recovery + 2FA owner | Revocation path | How it was verified | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Business email | ownership spine | pending | founder | pending | none observed; public action gated | founder | pending | pending | create or confirm first |
| Domain/DNS | public identity | pending | founder | pending | none observed; purchase/DNS gated | founder | pending | pending | evaluate after name |
| Apple/App Store Connect | iOS distribution | pending | founder | pending | none observed; submission/release gated | founder | pending | pending | inventory account |
| Google/Play Console | Android/YouTube identity | pending | founder | pending | none observed; submission/release gated | founder | pending | pending | inventory account |
| X | organic social/support | pending | founder | X Delegate preferred | none observed; publishing/reply gated | founder | pending | pending | inventory or create |
| Meta/Instagram | organic social/support/ads | pending | founder | Business Portfolio/task access preferred | none observed; publishing/reply/spend gated | founder | pending | pending | inventory or create |
| TikTok | organic social/ads | pending | founder | Business Center standard role preferred | none observed; publishing/reply/spend gated | founder | pending | pending | inventory or create |
| YouTube | demos/education/support | pending | founder | channel permissions preferred | none observed; publishing/reply gated | founder | pending | pending | inventory or create |

## Delegated Access First

Prefer platform roles, business portfolios, channel permissions, OAuth, or a dedicated business operator identity. Do not share a founder's personal login when a revocable route exists. If a founder-authenticated browser session is the only practical route, the founder signs in and retains recovery/2FA; the agent records the session capability without inspecting cookies or stored credentials.

## Recovery And 2FA

- Founder remains owner of record and controls recovery factors.
- Use unique credentials, passkeys or strong 2FA, and at least one founder-controlled recovery path.
- Do not store passwords, passkeys, 2FA codes, recovery codes, cookies, or browser sessions in Doppler, chat, screenshots, or repo artifacts.
- Doppler holds automation secrets; production uses config-scoped service tokens, integrations, or OIDC rather than a personal CLI token.

## Authorization Boundaries

Working access does not automatically authorize posting, replying publicly, spending, changing pricing, changing legal/business identity, managing payment methods, submitting an app, releasing, deleting, or widening permissions. Those actions use the exact approval envelope in `operations/agent-operations.json`.

## Operator Handoff

The agent owns the complete operating plan and always leaves:

- one plain-language founder action
- the agent's immediate next action
- exact account/access status
- how it was verified, or what is blocking it
- the next business operation after access is ready

Do not end with setup instructions alone. Continue into research, profile completion, content drafting, support, analytics, store work, or the next step of the launch as soon as the founder answers.
