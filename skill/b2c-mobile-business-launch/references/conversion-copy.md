# Conversion Copywriting And Copy Editing

Use this before writing or editing any conversion-critical words: landing hero/subhead/CTA, App Store title/subtitle/keywords/description/promo text, paywall headline and plan copy, onboarding question and value-reveal strings, push/email subject and body, screenshot captions, and ad hooks. Copy is the one input shared by almost every B2C surface, so it gets a craft contract instead of being improvised per screen.

This reference governs the *words*. Load [`cro-landing.md`](cro-landing.md) for landing-page *structure* (above-the-fold layout, CTA hierarchy, trust blocks, friction audit). Load [`onboarding-conversion.md`](onboarding-conversion.md) for in-app flow sequencing and paywall timing, [`aso-store-ops.md`](aso-store-ops.md) and [`app-store-listing-prep.md`](app-store-listing-prep.md) for store-field character limits and metadata rules, [`resend-email-ops.md`](resend-email-ops.md) for lifecycle email mechanics, [`geo-seo.md`](geo-seo.md) before editing any public page copy, and [`emotional-design-system.md`](emotional-design-system.md) when copy carries an Experience Card moment. Do not duplicate those contracts here; this file decides whether the sentence converts.

> Adapted from Corey Haines' marketingskills (`https://github.com/coreyhaines31/marketingskills`, MIT License, © Corey Haines 2025): the conversion-copy craft, voice-of-customer mining, and copy-QA discipline. Reframed for B2C mobile surfaces and wired into this skill's artifact/traceability contracts.

## Contents

- Sources To Refresh
- Required Artifacts
- Voice-Of-Customer Mining
- Copy Craft Rules
- Surface Recipes
- Copy QA Checklist
- Analytics Events
- Gates Before Handoff

## Sources To Refresh

Refresh current craft and platform-constraint sources before locking copy:
- Corey Haines marketingskills `copywriting` and `copy-editing` skills (MIT): `https://github.com/coreyhaines31/marketingskills`
- Apple App Store product page character limits and editorial guidelines: `https://developer.apple.com/app-store/product-page/`
- Apple App Store Review Guidelines (metadata, claims, pricing language): `https://developer.apple.com/app-store/review/guidelines/`
- Google Play listing policy and metadata rules: `https://support.google.com/googleplay/android-developer/answer/9859455`
- The project's own `RESEARCH.md` review-mining and `11_STAR_EXPERIENCE.md` north-star language as the primary voice-of-customer source (prefer real user words over invented ones)

## Required Artifacts

Create or update `COPY_BRIEF.md` when a launch ships any landing page, App Store listing, paywall, lifecycle email, or onboarding copy that conversion depends on. It is the single source of truth for the product's words, so the same promise appears on every surface.

Load [`flow-traceability.md`](flow-traceability.md) before locking copy: every headline claim must trace to evidence in `RESEARCH.md` or `11_STAR_EXPERIENCE.md`, not to taste. Load [`analytics-attribution.md`](analytics-attribution.md) before naming copy-test events so variants implement the approved catalog. Load [`change-cascade.md`](change-cascade.md) whenever a core promise, name, or price changes — copy lives on many surfaces and must be reconciled, not patched on one screen.

`COPY_BRIEF.md` must include:
- the one-sentence value proposition (the promise the whole product makes) traced to evidence
- the message hierarchy: primary promise, 2-3 supporting benefits, the proof for each
- voice and tone rules (3-5 lines): reading level, person/POV, words to use, words banned
- the voice-of-customer phrase bank: exact words from reviews/interviews to mirror back
- per-surface copy blocks (landing hero, ASO fields, paywall, key emails, onboarding value-reveal, screenshot captions) with the variant under test marked
- the claims ledger: every quantified or comparative claim and its substantiation (or a note that it is removed)

## Voice-Of-Customer Mining

The strongest conversion copy is not written — it is found. Mine the words real users already use:
- pull verbatim phrases from App Store/Play reviews of the product and 2-3 competitors (their words for the problem, the relief, the objection)
- pull from any interview notes, support threads, or social-language research already in `RESEARCH.md`
- cluster phrases into: the problem in their words, the desired outcome in their words, the objection/risk in their words
- write headlines and CTAs from that bank. Mirroring the user's own language outperforms clever copy because it resolves the "this is for me" question instantly.

## Copy Craft Rules

- **Lead with the outcome, not the feature.** The user buys the after-state. Name it concretely.
- **Specific beats clever.** A concrete number, timeframe, or named outcome converts better than a pun. Cut adjectives that survive deletion without changing meaning.
- **One idea per block.** A headline makes one promise; a CTA asks for one action. Stacked promises dilute.
- **Match message to awareness.** Cold traffic needs the problem named; warm traffic needs the differentiator; ready traffic needs the offer. Do not pitch the offer to someone who does not yet feel the problem.
- **Earn every claim.** Every quantified, comparative, health, earnings, or urgency claim is a liability — substantiate it in the claims ledger or remove it. This is a hard line, not a style note (see [`privacy-terms.md`](privacy-terms.md) and the skill's public-claims posture).
- **Write the CTA as a verb the user wants to take**, describing the value received, not the system action ("Get my plan", not "Submit").
- **Read it aloud.** If it sounds like a brochure, it will read like one. Cut to the spoken version.

## Surface Recipes

- **Landing hero:** outcome headline (user's words) → one-line subhead naming who it is for and the differentiator → single primary CTA → one proof element near the fold. Structure and placement live in [`cro-landing.md`](cro-landing.md).
- **App Store:** title carries the brand + primary value; subtitle carries the differentiator and a keyword; first 1-2 description lines carry the promise (most users never tap "more"). Honor field limits from [`aso-store-ops.md`](aso-store-ops.md); never keyword-stuff at the cost of readability.
- **Paywall:** restate the value the user just felt (tie to the emotional peak), make the plan choice obvious, name what they get — not what they pay. Timing belongs to [`onboarding-conversion.md`](onboarding-conversion.md).
- **Lifecycle email:** subject earns the open with curiosity or value; first line delivers it; one CTA. Mechanics belong to [`resend-email-ops.md`](resend-email-ops.md).
- **Screenshot captions:** each caption sells one benefit in 3-5 words; the sequence tells the value story. Production belongs to [`app-store-listing-prep.md`](app-store-listing-prep.md).

## Analytics Events

When copy is under test, declare events in `ANALYTICS.md` first (do not invent here):
- `copy_variant_viewed` (surface, variant_id)
- `copy_cta_clicked` (surface, variant_id)
- downstream conversion event already owned by the surface's funnel (install, trial_start, purchase)
Tie any A/B copy test to the experiment discipline in [`analytics-attribution.md`](analytics-attribution.md) — a copy test is still an experiment and needs a hypothesis, sample size, and stop rule.

## Copy QA Checklist

Before copy is called ready:
- the value proposition is one sentence and traces to evidence
- the same primary promise appears on landing, store, and paywall (no drift)
- every claim is in the claims ledger with substantiation or removed
- headlines use voice-of-customer language, not invented jargon
- each CTA is a single value-named verb
- reading level and tone match the `COPY_BRIEF.md` rules
- store fields respect platform character limits and policy
- public-page copy was routed through [`geo-seo.md`](geo-seo.md) before the edit

## Gates Before Handoff

- `COPY_BRIEF.md` exists for any launch with a landing page, store listing, paywall, or lifecycle email
- claims ledger has no unsubstantiated quantified/comparative/health/earnings claim
- the primary promise is reconciled across surfaces via [`change-cascade.md`](change-cascade.md)
- any copy test is registered as an experiment with a hypothesis and stop rule
- `LAUNCH_TRACE.md` links the copy promise back to its evidence
