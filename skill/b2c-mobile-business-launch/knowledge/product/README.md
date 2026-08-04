# What You're Building

What the app does, who it is for, and whether a competitor could copy it in a week.

Load the row whose trigger matches the work in front of you. Do not preload the set — each file is a full lane reference.

| Load when | Reference | Produces / gate |
| --- | --- | --- |
| "an AI assistant", "a chatbot for \<domain\>", "an AI companion/character", a coach/tutor chat app; before specing conversation schema, model integration, memory, usage metering, or the safety layer | [`ai-chat-companion.md`](./ai-chat-companion.md) | Claude API key stays server-side; current model IDs come from the `claude-api` skill, never memory; safety/moderation is a launch gate |
| "a habit tracker", "a streak app", a daily routine or wellness/productivity utility; before specing habits, check-ins, streaks, reminders, or insights | [`habit-tracker.md`](./habit-tracker.md) | Streaks are a HIGH-risk mechanic — the Streak/Loss-Aversion ethics contract applies (escape hatch, counter-metric, truthfulness, no guilt copy); timezone-correct streak computation is the classic bug trap |
| AI headshots/avatars, photo enhancer/restorer, AI art studio, "an app that turns photos into \<X\>"; before specing media storage, the generation pipeline, credits/metering, sharing, or safety | [`photo-ai-media.md`](./photo-ai-media.md) | Generation provider is founder-gated via `paid-tool-routing.md` (key server-side as `MEDIA_GENERATION_API_KEY`); content safety/rights is a launch gate; the reveal carries the Variable Reward HIGH-risk ethics contract |
| before `product/SPEC.md`, `design/DESIGN.md`, onboarding, ads, store screenshots, content assets, or engineering plans are treated as ready. **Also on "11-star run"/"11-star pass" or equivalent — follow the reference's "11-Star Run Protocol" before any other output.** | [`product-moat.md`](./product-moat.md) | `11_STAR_EXPERIENCE.md`, `11-star-experience.html`; 1/2/5/6/7/10/11-star ladder, the line between what ships now and what waits, V1 scalable slice, one idea carried into every screen · `check:11-star` |
| "build a social network", an X/Instagram/TikTok clone, "a community app for \<niche\>"; before specing schema, auth, feed, profiles, search, DMs, monetization, or invites | [`social-network.md`](./social-network.md) | — |
