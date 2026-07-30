# B2C Mobile Business Launch Skill

An agent skill that takes a consumer mobile app from idea, transcript, or half-built repo to a launched business, with deterministic validators standing between every claim and "done".

[![audit:ci](https://img.shields.io/github/actions/workflow/status/Emuthmartinez/b2c-mobile-business-launch-skill/source-freshness.yml?branch=main&label=audit%3Aci)](https://github.com/Emuthmartinez/b2c-mobile-business-launch-skill/actions/workflows/source-freshness.yml)
[![skill version](https://img.shields.io/github/package-json/v/Emuthmartinez/b2c-mobile-business-launch-skill?label=skill)](skill/b2c-mobile-business-launch/skill-version.json)
[![node 22](https://img.shields.io/badge/node-22-informational)](CONTRIBUTING.md)
[![license MIT](https://img.shields.io/github/license/Emuthmartinez/b2c-mobile-business-launch-skill)](LICENSE)

You install this into [Claude Code](https://claude.com/claude-code) or Codex and then talk to your agent normally. It is a set of markdown playbooks plus 60+ TypeScript validators that the agent reads and runs, so there is no app here to start and no server to boot.

## What it does

Give the agent one broad request and it works through the launch instead of handing you a checklist:

> "Take this transcript and turn it into a business I can launch."

> "I have a half-built B2C app. Get it launch-ready and stop only for real approval or access blockers."

> "Get this iOS app ready for TestFlight, App Store Connect, RevenueCat, PostHog, Resend, and launch."

Two layers make that repeatable. The playbooks under [`references/`](skill/b2c-mobile-business-launch/references/) hold the launch process a human can read. `PROJECT_STATE.yaml` holds the same process as machine-checkable state, which the validators grade and `launch-cockpit.html` renders as a dashboard written in founder language rather than internal status codes. Future agents inspect state and run checks rather than remembering what happened.

The skill pauses for founder-only decisions: credentials, spend, legal and pricing approval, public posting, destructive actions, and final submission.

## Who it's for

Built for **subscription and freemium consumer apps**. It does not cover one-time purchases, and it does not yet cover ad-based monetization. The opinions are deliberate, so a mismatched product will feel the friction early.

You need:

- **An agent that supports skills.** Claude Code or Codex.
- **Node.js 22** for the validators, matching CI.
- *(Optional)* accounts for the providers the playbooks reference, such as RevenueCat, Doppler, PostHog, Stripe, Resend, App Store Connect, and Google Play. Most have free tiers. None are required to read the playbooks or run the validators, and the skill routes an explicit fallback whenever a paid tool is unavailable.

Maintaining or contributing instead of using? Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), then [`AGENTS.md`](AGENTS.md).

## Quickstart

Install the skill into your agent's skills directory:

```bash
git clone https://github.com/Emuthmartinez/b2c-mobile-business-launch-skill
cd b2c-mobile-business-launch-skill

mkdir -p ~/.claude/skills
rsync -a --delete --exclude node_modules \
  skill/b2c-mobile-business-launch/ \
  ~/.claude/skills/b2c-mobile-business-launch/

npm install --prefix ~/.claude/skills/b2c-mobile-business-launch
```

Then open your agent in the app repo you want to launch and ask for what you want:

```text
Read my transcript at notes/idea.md and turn it into a business I can launch.
```

Running both Claude Code and Codex? Install once into `~/.codex/skills/` and symlink `~/.claude/skills/` and `~/.agents/skills/` at it, so the freshness check compares source against a real runtime copy instead of against a symlink to itself:

```bash
rsync -a --delete --exclude node_modules \
  skill/b2c-mobile-business-launch/ ~/.codex/skills/b2c-mobile-business-launch/
npm install --prefix ~/.codex/skills/b2c-mobile-business-launch

ln -sfn ~/.codex/skills/b2c-mobile-business-launch ~/.claude/skills/b2c-mobile-business-launch
ln -sfn ~/.codex/skills/b2c-mobile-business-launch ~/.agents/skills/b2c-mobile-business-launch
```

## What you get

Artifacts land in your app repo, not in this one.

| Area | What lands in your repo |
| --- | --- |
| **State and cockpit** | `PROJECT_STATE.yaml` plus `launch-cockpit.html`, the founder-readable dashboard over it |
| **Founder-zero operator** | `BUSINESS_ACCESS.md`, business identity, Doppler access, one plain-language decision at a time |
| **Research and positioning** | Competitor, review-mining, ASO and GEO/SEO evidence, traced through `LAUNCH_TRACE.md` |
| **Product and experience** | `SPEC.md`, `TECH_SPEC.md`, `11_STAR_EXPERIENCE.md`, scope locks and acceptance criteria |
| **Design** | `DESIGN.md`, tokenized theme, Design Room versions, baselines, and rendered HTML proofs |
| **Security and legal** | `SECURITY.md`, threat model, scanner proof, `PRIVACY.md`, `TERMS.md`, accepted risks |
| **Revenue and growth** | RevenueCat and Stripe wiring, `PAID_UA.md`, `VIRAL_GROWTH.md`, lifecycle email through Resend |
| **Store operations** | App Store Connect and Play packets, Apple signing, screenshots, ASO metadata, review notes |
| **Analytics and copy** | PostHog event catalog, attribution contract, and a writing gate over every word shipped |
| **Engineering and proof** | Business-repo `AGENTS.md`, device tests, orchestration plan, `PRODUCTION_READINESS.md` |

Each area routes through its own reference and its own validator. [`docs/VALIDATORS.md`](docs/VALIDATORS.md) maps every gate to what it checks.

## How it stays honest

The full contracts live in [`SKILL.md`](skill/b2c-mobile-business-launch/SKILL.md). The six that shape everything else:

- **State is the contract.** `PROJECT_STATE.yaml` carries phase, autonomy, lane status, provider setup, proof, blockers, and failure cards. Prose alone never marks a lane done.
- **Research has to reach the product.** Findings must flow into spec, brand, design, store copy, revenue, privacy, and verification through `LAUNCH_TRACE.md`.
- **Founder gates are never inferred.** Credentials, spend, pricing, legal, public posting, and release stay with the founder, and account access is never blanket authorization.
- **Secrets route through Doppler.** `SECRETS.md`, `doppler run --`, names-only `.env.example`, and a production service-token gate. No secret values in state, templates, or cockpits.
- **Security is a release lane.** Threat model, tool routing, mobile and backend hardening, scanner proof, incident response, and accepted risks, all before release.
- **Readiness claims run the validators.** A launch-ready lane that cannot produce evidence fails its gate, and LaunchBench covers the failure modes that have already bitten once.

Writing quality is gated too. [`playbook/words/no-slop-writing.md`](skill/b2c-mobile-business-launch/playbook/words/no-slop-writing.md) governs the copy this skill writes and the copy it generates for your business: store listings, paywall and onboarding copy, lifecycle email, launch posts, ad headlines, and UGC scripts. `check:no-slop` parses its rule table straight out of that reference, so the doc an agent reads and the gate that fails the build cannot drift apart. Rules adapted from [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) (MIT). Your brand voice from `BRAND.md` sets the target; the rules only remove what an AI defaults to when nobody set one.

## Validators

Every gate runs through one orchestrator: typecheck first, then each check, with independent steps sharing a small concurrency pool.

```bash
npm install
npm run audit                  # full local pipeline
npm run audit:ci               # exactly what CI runs
npm run audit -- --list        # print the resolved plan
npm run audit -- --only check:secrets

npm run validate:launch-state -- --root /path/to/app
npm run launchbench            # known failure-mode scenarios
```

`check:package-parity` fails when a `check:*` or `validate:*` script is neither an audit step nor explicitly excluded with a reason, so gates cannot be quietly dropped from the pipeline. The full command and script reference is in [`docs/VALIDATORS.md`](docs/VALIDATORS.md).

Before broad launch or design work, compare the installed runtime against source:

```bash
npm run check:skill-version -- \
  --source skill/b2c-mobile-business-launch \
  --installed ~/.codex/skills/b2c-mobile-business-launch
```

## Archetypes and LaunchBench

Four **app archetype packs** cover the B2C product shapes this skill sees most: [social and community](skill/b2c-mobile-business-launch/references/social-network-lane.md), [AI chat and companion](skill/b2c-mobile-business-launch/references/ai-chat-companion-lane.md), [habit tracker and utility](skill/b2c-mobile-business-launch/references/habit-tracker-lane.md), and [photo and AI media](skill/b2c-mobile-business-launch/references/photo-ai-media-lane.md). Each ships a runnable starter scaffold, not just prompts: Next.js and Supabase with tested RLS policies, Stripe and RevenueCat stubs, a PostHog event catalog, names-only env, and CI. `check:archetype-starter` verifies the scaffold still builds the shape it advertises.

**LaunchBench** holds the regression scenarios under [`evals/launchbench/`](skill/b2c-mobile-business-launch/evals/launchbench/), one per launch failure mode worth never repeating. `npm run launchbench` lints the definitions and runs the deterministic validator fixtures. A separate opt-in layer, `npm run evals:behavioral`, grades flagged scenarios against a live agent and stays outside the PR gate on purpose, because live runs cost money and carry model variance.

## Repo layout

```text
skill/b2c-mobile-business-launch/
  SKILL.md              # entrypoint and lane routing
  skill-version.json    # runtime freshness manifest
  references/           # launch playbooks, one per lane
  templates/            # artifacts copied into your app repo
  scripts/              # validators, renderers, LaunchBench runner
  evals/                # LaunchBench, agent-behavior, triggering
  state/                # Design Room seed state and schema
  render/               # React/Vite Design Room renderer
docs/VALIDATORS.md      # full validator reference
AGENTS.md               # maintainer guide and repo map
```

## Contributing

Contributions from humans and agents are welcome, held to the same gates. [`CONTRIBUTING.md`](CONTRIBUTING.md) covers setup, the `npm run audit:ci` gate, versioning and source-freshness rules, and what a reviewable PR looks like. [`AGENTS.md`](AGENTS.md) is the deeper maintainer map behind it.

The house rule: when a mistake can recur, tighten a validator or add a LaunchBench eval rather than writing a longer paragraph of instructions.

## Security, conduct, and license

Report a vulnerability in this repo's validators, CI, or supply chain through [`SECURITY.md`](SECURITY.md). Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Licensed under [MIT](LICENSE).
