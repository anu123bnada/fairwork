# ORYQEN — implementation and verification

Started October 15; verification continues October 16, 2026 (Asia/Colombo).
Deadline remains October 23, 19:00. **Not production-ready or Play Store-ready.**

Branding, profile UI, theme, truthful availability notices, security headers,
Android branding and local verification workflow are implemented. No hosted
changes, migrations, deployment, commit or push were performed.

## Implementation

- Customer-facing ORYQEN naming, pronunciation/build notice, title/description,
  Open Graph text, manifest, SVG/PNG icons, native icon/splash and offline copy.
  No unverified canonical URL or legal ownership claims. No service worker caches
  private APIs. Hosted Auth email templates remain external and unchanged.
- Warm paper/evergreen identity, local Manrope, light/dark/device appearance,
  wider tablet/desktop surfaces, focus indicators and reduced-motion handling.
  Original Figma assets and component/state architecture are preserved.
- Persistent profile editor uses existing PATCH RPC architecture, strict input,
  expected revision, idempotent retries, server-returned profile and honest errors.
  Unsaved notification switches now show unavailable status. No delivery fabricated.
- Replaced nonexistent Terms/Privacy acceptance claim with a development notice.
  Production policy/contact/retention still require approval.
- Added framing/plugin/base/form CSP restrictions, safe own-property error-code
  lookup, escaped HTML UUID patterns and Next 16.4 error retry behavior.
- Added local CI verification workflow (no deployment), release/recovery runbook
  and Android safety invariant checker. Remote CI and hosted recovery are unverified.

## Evidence boundaries

Browser journeys intercept HTTP with synthetic fixtures, except explicit unconfigured
API/security/error transport checks. They do not prove Supabase Auth or PostgreSQL
authorization. Native PostgreSQL runners use real tables/RLS/locks/concurrency with
synthetic Auth claim adapters. These are not hosted Auth/PostgREST tests. Embedded
PostgreSQL regression cases overlap native executions; counts must not be summed
as unique tests. Native device results cannot be inferred from Chromium emulation.

## Completed preliminary checks

- Production dependency audit: `npm audit --omit=dev --json`, zero advisories
  (info/low/moderate/high/critical all zero), `test-results/oryqen-dependency-audit.json`.
  This is an advisory-database result, not proof that dependencies have no defects.
- `node scripts/verify-android-poc.mjs`: PASS source invariants;
  `test-results/oryqen-android-guards.log`.
- Android doctor after sandbox retry: SDK 36/build-tools 35/JDK 21/ADB available;
  zero authorized devices. AVD `Medium_Phone_API_37.0` exists but hypervisor driver
  is missing. Exit 1 indicates device testing is blocked; not a build failure.
- `npx cap copy android` from `mobile/poc`: successful, existing project preserved.
- Earlier browser pass before final contrast fix: 56/56; retained at
  `test-results/oryqen-browser-before-contrast-fix.log`. Not the final code result.

## Failures retained and repaired

Initial browser startup was denied with sandbox `spawn EPERM` (54 could not launch,
2 HTTP tests passed); rerun outside sandbox. Initial new assertions selected both
the form alert and Next's route announcer, and expected a bottom bar on Settings
where the existing design uses Back. Fixed the selectors; no requirement removed.
Screenshot inspection then found disclosure contrast/padding defects; fixed in CSS.
The added contrast check initially selected an explicit submit type absent from the
semantic default-submit button (55 pass/1 timeout); corrected selector without
raising the timeout. Logs retain these failed runs separately from final passes.

## Final test evidence — October 16

| Command | Result | Evidence |
|---|---|---|
| `npm run test:e2e:isolated` | 56 PASS, 0 failed; includes 3 mobile Chromium tests | `test-results/oryqen-browser-final.log`; build/server companion logs |
| `npm test -- --reporter=default --reporter=json --outputFile=test-results/oryqen-regression-results.json` | 199 PASS, 14 native-only skips, 0 failed; 24 files | JSON report named in command |
| `node scripts/test-day4-postgres.mjs` | 13 PASS | `test-results/oryqen-native-day4.log`; `day4-postgres-1792097410468/tests.log` |
| `node scripts/test-day5-postgres.mjs` | 20 PASS | `test-results/oryqen-native-day5.log`; `day5-postgres-1792097430552/tests.log` |
| `node scripts/test-day6-postgres.mjs` | 18 PASS | `test-results/oryqen-native-day6.log`; `day6-postgres-1792097450888/tests.log` |
| `node scripts/test-day7-postgres.mjs` | 24 PASS | `test-results/oryqen-native-day7.log`; `day7-postgres-1792097472863/tests.log` |
| `npm run typecheck` | PASS | `test-results/oryqen-typecheck-final.log` |
| `npm run lint` | PASS, zero warnings | `test-results/oryqen-lint-final.log` |
| `npm run build` | PASS, normal `.next` production build; server APIs remain dynamic | `test-results/oryqen-production-build-final.log` |

75 native PostgreSQL 18.4 executions total, overlapping the embedded suite. All 14
native-only skipped cases have passing native evidence. All four disposable
clusters stopped successfully. Day 5–7 apply all ten migrations locally; Day 4
uses its original slice. No migration was created or changed during ORYQEN work.

The new three unit/API tests cover profile PATCH whitelisting, actor/capability
injection, origin checks, invalid time zones, required revisions, header idempotency
and no-store responses. Existing SQL identity tests verify actual profile persistence,
replay, stale revisions and isolation. New browser tests verify save/reload, invalid
input, conflicts/retry keys, theme persistence, metadata/icons, measured contrast,
responsive layout, labelled controls and reduced motion. The existing full offer,
question, agreement, work/integrity, Passport and case journeys remain green.

## Android artifact — generated, signed, NOT installed

New APK: `mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk`, **4,411,431
bytes**, label `ORYQEN Local POC`, package `org.fairwork.localpoc`, min SDK 24,
target/compile SDK 36. SHA-256:

`7FC3CD53BD4A45FBB7EE485D96CA2ED25BCD9014EE1EB4C4162A663D0D7BFDA8`

Build from `mobile/poc/android`:

```powershell
$env:JAVA_HOME = 'C:\Users\vehiv\Desktop\fairwork\.tmp\android-toolchain\jdk-21.0.12.1+1'
$env:ANDROID_HOME = 'C:\Users\vehiv\AppData\Local\Android\Sdk'
$env:GRADLE_USER_HOME = 'C:\Users\vehiv\Desktop\fairwork\.tmp\android-gradle'
.\gradlew.bat assembleDebug --offline --no-daemon --no-watch-fs --max-workers=1 --console=plain
& "$env:ANDROID_HOME\build-tools\35.0.0\apksigner.bat" verify --verbose --print-certs app/build/outputs/apk/debug/app-debug.apk
& "$env:ANDROID_HOME\build-tools\35.0.0\aapt.exe" dump badging app/build/outputs/apk/debug/app-debug.apk
```

`BUILD SUCCESSFUL`, 93 tasks (15 executed, 78 up-to-date). Signature verifies with
APK Signature Scheme v2 and the existing Android Debug certificate. This is not
release signing. Logs: `test-results/oryqen-android-build.log`,
`oryqen-android-signature.log`, `oryqen-android-badging.log`.

Also ran `aapt dump xmltree <apk> AndroidManifest.xml` and
`aapt dump xmltree <apk> res/xml/local_poc_network_security.xml` from repository
root. Packaged flags confirm backup disabled, cleartext disabled at the base and
only exact `localhost` allowed by debug configuration, with subdomains excluded.
Compiled evidence: `oryqen-android-packaged-manifest.log` and
`oryqen-android-packaged-network.log`. Internet is the only platform permission;
AndroidX also merges the application-scoped signature-protected
`org.fairwork.localpoc.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`.

Final `npm --prefix mobile/poc run doctor` exits 1 because no authorized device is
connected and AVD acceleration is missing. `oryqen-android-doctor-final.log`.
**No APK installation, native startup, login/MFA/session persistence, hardware Back,
lifecycle or offline/recovery test was executed.** Existing browser mobile/history
tests passed; they do not establish native compatibility. No release AAB generated;
release variant remains disabled and verified HTTPS hosting is unavailable.

Original APK remains intact in the rollback folder, SHA-256
`1076209E7B023D70A788A1071490269B91FCEEE102E1261B6FA8959BC14FBFB6`.

## Preservation result

`test-results/oryqen-preservation.json`: **273/301 pre-existing source files
byte-identical; 28 intentional changes; zero missing files.** All ten migrations
and nine source Figma assets in the manifest are hash-identical. The native back
handler, release guard and debug network policy are unchanged. Earlier security
work is retained and retested. The 28 changes are branding/metadata/native assets,
profile integration, client/markup/error handling, matching browser text assertions,
README and continuation. New components/docs/workflow/tests/assets are additive.
Generated visual-test filenames are refreshed by test execution; do not treat
their current ORYQEN images as frozen historical FAIRWORK appearance evidence.

## Outstanding release work

Authoritative module matrix: [discovery](ORYQEN_DISCOVERY.md). No defensible overall
product completion percentage exists for the broad international production brief.
The secure local trust workflow is implemented; broader P0A and production gates
remain incomplete. Historical Day 7 stays 13/14, with visual acceptance open.

Unfinished: typed authority-wide cases/assertions/appeals, named-recipient Passport
disclosure and revocation, tracked privacy fulfillment, bounded detail history/load
evidence, genuine independent reviewer/authority provisioning, production policies,
monitoring/edge abuse configuration, isolated backup restoration, hosted sessions
and native Android tests. Uploads/notifications/AI/discovery remain excluded future
scope rather than invented services.

Next engineering action: retain the Day 7 handoff's Day 8 ordering. Write the typed
authority/assertion/appeal contract and denial/concurrency tests first; inspect the
ten-migration sequence, then implement a forward migration only after the contract
is settled. Integrate the single authoritative eligibility path without weakening
withdrawal, correction, retraction or case suppression. Bound history; verify the
minimal UI and all denial suites. Follow with recipient disclosure and tracked
privacy operations before controlled hosted rehearsal. No Day 8 feature was
silently implemented during this brand pass.

Brand clearance and domain/handle availability remain unverified; see
[preliminary research](ORYQEN_BRAND_RESEARCH.md). Website hosting and Android
release remain blocked; exact gates and permitted local device commands are in
[release gates](ORYQEN_RELEASE_GATES.md).
