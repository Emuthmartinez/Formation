# {{APP_NAME}} Apple Signing Packet

Status: scaffold

This packet records distribution readiness for iOS. Keep it aligned with the Xcode project, App Store Connect app record, CI signing setup, `store/APPLE_APP_STORE_REQUIREMENTS.md`, and founder approval before TestFlight or App Store submission.

Native iOS proof from the in-app iOS Simulator (Claude Code Desktop pane, Claude Code CLI `computer-use`, or Codex `build-ios-apps`), Codex Desktop, XcodeBuildMCP, SnapshotPreviews, serve-sim, MobAI, or simulator/device screenshots supports implementation, screenshot, and app-preview evidence in `engineering/PRODUCTION_READINESS.md` and `SCREENSHOTS.md`. It does not satisfy this distribution packet unless archive/export/upload/TestFlight gates below are also proven. The in-app simulator in particular drives simulated devices only and cannot control a physical iPhone or iPad, so the release-device row and every gate in this packet stay outside its reach.

## Account And Identifiers

| Gate | Value | Proof |
| --- | --- | --- |
| Apple Developer account | {{APPLE_DEVELOPER_ACCOUNT}} | membership screenshot or account note kept outside git |
| Team ID | {{APPLE_TEAM_ID}} | Apple Developer Membership page |
| DEVELOPMENT_TEAM | {{DEVELOPMENT_TEAM}} | Xcode build setting or CI variable name |
| Bundle ID | {{IOS_BUNDLE_ID}} | Xcode target and Apple Developer identifier |
| App ID | {{APPLE_APP_ID}} | Apple Developer identifier record |
| App Store Connect app record | {{ASC_APP_RECORD_URL}} | App Information URL |
| ASC CLI auth status | Pending | `asc auth status --validate` or blocked reason without secrets |

## App Record Creation Preflight

- Confirm name, SKU, primary locale, bundle ID, category, privacy URL, support URL, and ownership before creating or editing the App Store Connect app record.
- Record the ASC CLI or skill-pack app creation route (`asc-app-create-ui` when browser automation is required) before falling back to manual-only instructions.
- Stop for founder approval before any App Store Connect mutation, app record creation, SKU change, bundle ID change, capability change, or signing account change.

## Signing Assets

| Asset | Source | Proof |
| --- | --- | --- |
| Distribution certificate | Apple Developer Certificates | certificate common name and expiry recorded here |
| Provisioning profile | Apple Developer Profiles or Xcode managed signing | profile name, bundle ID, Team ID, and expiry recorded here |
| Capabilities and entitlements | Xcode target and Apple Developer App ID | entitlement diff recorded here |
| CI export method | ExportOptions.plist or CI workflow | archive, export, upload, and TestFlight command proof recorded here |

## Apple App Store Requirements Gate

`store/APPLE_APP_STORE_REQUIREMENTS.md` must be ready before a build is pushed into App Store Connect. Record:

- bundled `PrivacyInfo.xcprivacy` path and target-resource proof
- required reason API categories/reasons and `NSPrivacyAccessedAPITypeReasons`
- third-party SDK privacy manifest/signature status
- Xcode privacy report status and App Privacy label reconciliation
- `Info.plist` purpose strings, `NSUserTrackingUsageDescription`, and ATT route when tracking is in scope
- account deletion, review notes, privacy URLs, archive/upload warnings, and founder approval

## Pre-Archive/Export/Upload Preflight Sign-Off

Record all five items below before running `xcodebuild archive`. Each item must read `pass` or `ready` before proceeding; if any item cannot pass, replace the line with `<item>: blocked — <reason>` and stop until it is resolved (that unresolved state opens the `apple-pre-upload-preflight-skipped` failure card).

```text
Pre-archive/export/upload preflight (sign-off recorded on the archive date):
1. SDK keys in Info.plist (RevenueCat, PostHog, Supabase) verified with plutil -p on the compiled archive: pass.
2. plutil -lint PrivacyInfo.xcprivacy (valid plist, not JSON): ok.
3. NSPrivacyAccessedAPITypes coverage audited against actual API usage: pass.
4. exportArchive API key auth flags (-authenticationKeyPath, -authenticationKeyID, -authenticationKeyIssuerID): ready.
5. Screenshot dimension floor (raw captures meet device-well minimum, no upscaling): pass.
```

See the "Pre-Archive/Export/Upload Preflight Checklist" section in `apple-signing-release.md` for commands and acceptance criteria for each item.

## Release Proof

- Archive proof records Xcode version, scheme, configuration, archive path, and signing identity.
- Export proof records export method, provisioning profile mapping, output IPA path, and `-authenticationKeyPath`/`-authenticationKeyID`/`-authenticationKeyIssuerID` flags used.
- Upload proof records Transporter, Xcode organizer, Fastlane, or App Store Connect API command output.
- TestFlight proof records build number, processing status, tester group route, and review notes route.
- A simulator build alone is not distribution readiness.

## Founder Approval

Founder approval is required before paid account changes, certificate replacement, provisioning profile replacement, App Store Connect app record mutation, TestFlight external testing, App Store submission, phased release, or manual release.
