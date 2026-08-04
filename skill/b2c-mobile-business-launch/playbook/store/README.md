# App Store And Google Play

Everything between a finished build and an app a stranger can download.

Load the row whose trigger matches the work in front of you. Do not preload the set — each file is a full lane reference.

| Load when | Reference | Produces / gate |
| --- | --- | --- |
| before automating App Store Connect with the Rork `asc` CLI or CLI skill pack — app creation, metadata, screenshots, TestFlight, review status, RevenueCat catalog sync | [`app-store-connect-cli.md`](app-store-connect-cli.md) | If `asc` is installed, never report "cannot access ASC" — run the auth-recovery ladder (keychain profiles, account-level keys, `asc auth init/login`) and report any missing app record/cert/RevenueCat app as a founder-gated setup step with the next command · `check:asc-command-contract` |
| before listing packets, privacy questionnaires, pricing/subscription field maps, custom product pages, in-app events, promotion pages, localization matrices, App Icon/App Preview work, or App Store marketing material | [`app-store-listing-prep.md`](app-store-listing-prep.md) | `APP_STORE_LISTING.md`, `app-store-listing.html`, `app-privacy-questionnaire.html` |
| before ASC upload readiness on any iOS submission path | [`apple-signing-release.md`](apple-signing-release.md) | `store/APPLE_APP_STORE_REQUIREMENTS.md` reconciling `PrivacyInfo.xcprivacy`, required-reason API declarations, third-party SDK privacy manifests/signatures, App Privacy answers, protected-resource purpose strings, ATT, account deletion, review notes, and archive/upload warnings · `check:apple-requirements` |
| before App Store/Play metadata, screenshot planning, ASO audits, keyword research, Apple Search Ads, release/rejection handling, ratings/reviews, or post-launch monitoring | [`aso-store-ops.md`](aso-store-ops.md) | `STORE_OPS.md` · `check:aso-metadata` |
| Android is in scope (platforms include android, or an android bundle id exists); before Play Console setup, Data Safety answers, content rating, Play App Signing, release tracks, closed testing, or pre-launch report triage | [`google-play-release.md`](google-play-release.md) | `store/GOOGLE_PLAY_RELEASE.md` — Data Safety reconciled with the iOS privacy labels, and the personal-account closed-testing gate (12 testers / 14 days) planned into the launch calendar from day one · `check:google-play` |
| before App Store Connect or Play Console setup, privacy labels/Data safety, screenshot capture/upload, reviewer notes, account-deletion console work, or any "where do I click and what do I paste" handoff | [`store-console-workflow.md`](store-console-workflow.md) | `store/STORE_CONSOLE.md`, `store/store-console.html` · `check:store-console` |
