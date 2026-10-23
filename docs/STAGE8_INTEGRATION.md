# Stage 8 integration and release evidence

October 19, 2026, Asia/Colombo. Deadline October 23 at 19:00.
Status: IN PROGRESS; not production-ready. This audit supersedes assumptions that
the brand masters, hosted activation or Android installation were already complete.

Status meanings: IMPLEMENTED = present in source; VERIFIED = exercised with the
specified evidence; PARTIAL = meaningful working subset with listed limitations;
BLOCKED = explicit missing external prerequisite; MISSING = no implementation.
Local synthetic identities authenticate through real services; they do not prove
independent humans or commercial employer identity. Fixture tests are separate.

## Feature matrix from source and execution

| Requirement | Status | Evidence / remaining gap |
|---|---|---|
| Registration, delivered email confirmation, login/logout, profile | VERIFIED locally | `registration.ts`, `identity.ts`, real four-account journey; local mailbox, no hosted email claim |
| Password recovery, MFA, refresh-session revocation | VERIFIED locally within stated limits | Six fresh recovery checks: real email, explicit confirmation, MFA retained, token replay denied, password replacement and old-password denial. Access JWTs retain provider expiry; deactivation additionally blocks application/RLS access |
| Persistent database | VERIFIED locally | 22 pinned migrations; local real journey checks migration inventory and restricted deferred triggers; no migration edits |
| Worker offer creation, revision, questions | VERIFIED locally / integration repair | Real offer save/question checks. Reproduced wrong offer shown after saved-list client navigation; fixed by isolating explicit selection state. Added explicit separate-offer action |
| Offer history | PARTIAL | Immutable revision storage and current revision changes exist; arbitrary historical revision browsing is not an integrated product screen |
| Explainable salary/hours/overtime/benefits/contract review | PARTIAL | Typed terms, missing questions and deterministic source-backed rules; no salary-market benchmark or legal/fraud verdict |
| Company information | PARTIAL | Persistent attributed unverified representative claims/revisions; external registry provenance/verification source absent |
| Independent agreements | VERIFIED locally | Effective agreement requires separate designated participant confirmations; exact hash/revision, unanswered items and stale revision protections |
| Work Records and private Passport | VERIFIED locally | Independent work verification, persistent eligibility, owner-only history, correction/withdrawal/retraction/case suppression |
| Sharing and export | VERIFIED locally | Named recipients, frozen field selection, current eligibility, revocation/expiry, private download excludes internal identifiers; download copies cannot be recalled |
| Disputes/cases and corrections | VERIFIED locally | Assigned independent reviewers, evidence limits, revocation, conflicting concurrent decisions and immutable history in real journey |
| Notifications/activity | PARTIAL | Persistent authorized offer/organization events + read receipts; no email/push, not every domain event is in the feed |
| Settings/security/account | PARTIAL | Profile update, TOTP, self-deactivation and privacy request/review tracking; approved retention, actual data export/deletion fulfillment remain operational gates |
| Employer onboarding/organization | PARTIAL | Independent request approval and scoped membership verified; bootstrap is explicitly synthetic `demo-authority.v1`, not commercial organization assurance |
| Employer offers/work/cases | VERIFIED locally | Current representative authority, assigned offers/records, unrelated account denial and immediate membership revocation checks |
| Cross-account/API/RLS security | VERIFIED within tested scope | Server `getUser`, strict schemas, same-origin writes, private/no-store, narrow RPCs, immutable audits and SQL quotas. Broader production abuse/telemetry controls unproven |
| Gemini live AI | BLOCKED | Server adapter/consent/redaction/quotas/schema/timeouts exist. Actual account/product region/retention approval and local key absent. No real-data calls allowed |
| Brand system | PARTIAL / BLOCKED | Shared inactive components verified; approved full lockup and symbol absent. Old shield only in existing positions; rejected green Q unused |
| Responsive/deep links | VERIFIED within browser scope / brand PARTIAL | 73 browser tests pass; confirmed offer selection defect repaired with failing-then-passing tests. Future approved brand activation needs separate visual check |
| Android debug build | VERIFIED | Existing Capacitor project rebuilt: 93 tasks, 27 executed; APK v2 signature verified. Release variants intentionally disabled |
| Android installation/runtime | VERIFIED for tested local emulator scope | 11 real installed-APK checks passed, including email/password Auth, native Back, process restart and broken/restored tunnel. Physical device, hosted transport and signed release untested |
| Windows installable app | VERIFIED locally / release PARTIAL | Nine fresh checks: install, standalone launch, real Auth/profile, offline recovery, sign-in, restart, Back, isolated uninstall and reinstall. PWA, not EXE/MSIX; hosted distribution and approved icon pending |
| Offline behavior | PARTIAL | Safe API errors and packaged Android retry page; no offline mutation queue or cached private records |
| Screenshot/OCR input | MISSING | UI truthfully states image review is disconnected; no secure upload pipeline implemented |
| Hosted release | BLOCKED | Historical four hosted migrations vs 22 local; fresh history/backup/restore/HTTPS/SMTP/authority/privacy/owner approval required |

## Confirmed repair

An offer selected from Home could update the URL while continuing to show the
previous offer's terms. Reproduction failed expecting Second saved role but
received First saved role. `ProductRouteProvider` now keys state by explicit offer
selection and remounts before rendering the new screen. Invalid/duplicate IDs do
not fall back to a remembered record. No authorization logic or schema changed.
The existing Add Offer screen now explains when it edits a saved revision and
offers Start a separate offer, clearing only in-memory draft/selection state.
Original records and history are not removed.

Focused production build + browser tests: 12 passed (offer-selection,
day3-revision-regression, agreement-recovery). Tests explicitly use API fixtures;
real backend confirmation of the repair is a separate gate. The original failing
run is not counted as a pass. Full-suite results will be appended after execution.

Stage 8 real journey evidence: `test-results/local-real-1792349121357/results.json`:
121 PASS / 0 FAIL, including actual app restart and separate account sessions.
The earlier 115-check run is retained, but superseded by this fresh restart run.

## Fresh verification ledger

| Command | Actual outcome / retained evidence |
|---|---|
| `node scripts/test-local-real-workflows.mjs --manage-app` | 121 passed; `test-results/local-real-1792349121357/results.json`; real local Auth/mail/PostgreSQL, independent synthetic account contexts |
| `node scripts/test-local-recovery.mjs` | 6 passed; `test-results/recovery-real-1792351601946/results.json` |
| `node scripts/test-windows-pwa.mjs --rehearsal` | 9 passed; `test-results/windows-pwa-1792351939823/results.json`; new profile only, founder installation unchanged |
| `node node_modules/vitest/vitest.mjs run --reporter=default --reporter=json --outputFile.json=test-results/stage8-vitest-final.json` | 277 passed, 14 skipped, 39 files; clean final run |
| `node scripts/test-day4-postgres.mjs` | 13 passed; `test-results/day4-postgres-1792350744289` |
| `node scripts/test-day5-postgres.mjs` | 20 passed; `test-results/day5-postgres-1792351960811` |
| `node scripts/test-day6-postgres.mjs` | 18 passed; `test-results/day6-postgres-1792350920575` |
| `node scripts/test-day7-postgres.mjs --extended-setup` | 33 passed; `test-results/day7-postgres-1792351460634` |
| `$env:AUTH_REGISTRATION_ENABLED='true'; node scripts/test-browser.mjs` | Production build and 73 browser tests passed; `test-results/day2-browser.log` and `day2-browser-build.log`. Browser journeys use fixtures, not hosted evidence |
| `node node_modules/typescript/bin/tsc --noEmit` | Passed |
| `node node_modules/eslint/bin/eslint.js . --max-warnings=0` | Passed |
| `node scripts/verify-android-poc.mjs` | Source guards passed; not a substitute for installed-device tests |

All 14 conditional database skips are exercised by the four real PostgreSQL runs
above (84 total executions). They create separate loopback-only fixture clusters,
stop those clusters afterward and retain their evidence; no hosted migration runs.
Earlier failures remain recorded: first full browser run 72/73 (profile loading
timeout), initial Vitest worker-process crashes, recovery interrupted by repeated
dev reloads, and Chrome install-info fetch failures. Assertions were not weakened.
The unchanged full browser suite and regression suite subsequently passed.

The two Next dev servers share `next-env.d.ts` despite separate output directories.
Concurrent servers were observed to produce repeated Fast Refresh navigations,
resetting recovery forms. Restarting the sole server restored stable operation.
Both local launchers now refuse to run while the other local dev port responds.
Stop the app process only when switching ports; keep database services running.

Chrome reported no installability errors but its first CDP install attempt failed.
The test now retries that exact fetch error once, matching the
[Chrome DevTools implementation](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/src/McpContext.ts).
The second command actually installed the PWA; OS registration and standalone
launch were checked. Rehearsal uninstall/reinstall affects only its fresh profile.
Updates load current application code from the server; Chrome manages its browser
updates. No private API offline cache, native installer or production updater exists.

Representative fresh screenshots inspected: Windows `reopened.png` in the evidence
directory above and `test-results/oryqen-restored-browser/1440-light-_app_settings.png`.
Existing centered mobile composition, gradients and controls are preserved. These
checks do not establish approved ORYQEN logo parity: master files are still absent.

## Platform and release gates

Android emulator startup used the existing `Medium_Phone_API_37.0` with
`-no-snapshot -no-window -no-audio`. No wipe, new AVD, key deletion, auth bypass or
snapshot overwrite. These options follow the [Android emulator command-line guide](https://developer.android.com/studio/run/emulator-commandline).
After overnight interruption Docker and the emulator were safely restarted.
`scripts/test-android-real.mjs` installs the debug APK with `adb install -r`, uses
`adb reverse tcp:3102 tcp:3102`, real local email/password sessions and a synthetic
account, checks native Back/lifecycle/offline, and writes redacted evidence.
No physical-device result is implied by emulator tests.

**Final Android result: 11 PASS / 0 FAIL**, in
`test-results/android-real-1792352583553/results.json`. The APK was actually
installed with `adb install -r` on API 37 `emulator-5554`. Startup/onboarding,
registration/local email confirmation/profile, native Back, worker Passport,
unassigned employer denial/empty state, background/resume, process restart,
removed/restored reverse tunnel and sign-out/fresh sign-in all passed through real
local services. This is not a full two-party agreement journey on Android; that
complete journey is verified separately in real desktop browser/API tests.

Artifact: `mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk`,
4,411,431 bytes, SHA-256
`9DA7AFE8B17AA856432652842AEABD7D16F2C917FC071DB5A8311BA8C0FD13FB`.
`apksigner verify --verbose` verified APK Signature Scheme v2. This is debug-signed,
loopback-dependent and intentionally cannot produce a release variant.

The only native configuration change selects Capacitor SystemBars **native**
insets handling. This retains native viewport/keyboard padding without injecting
HTML style attributes before React hydration. The original Back implementation is
unchanged. Debug-only HTTP permits exact localhost; main cleartext and mixed
content remain off, permission remains Internet only, backup remains disabled.

Build commands (PowerShell, repository root):

```powershell
$env:JAVA_HOME=Join-Path (Get-Location) '.tmp/android-toolchain/jdk-21.0.12.1+1'
$env:ANDROID_HOME="$env:USERPROFILE\AppData\Local\Android\Sdk"
$env:GRADLE_USER_HOME=Join-Path (Get-Location) '.tmp/android-gradle'
node scripts/verify-android-poc.mjs
& .\mobile\poc\android\gradlew.bat -p mobile/poc/android assembleDebug --no-daemon --max-workers=1 '-Dorg.gradle.jvmargs=-Xmx768m' '-Dorg.gradle.vfs.watch=false'
# Stop port 3100's app process before starting this alternative dev server.
node scripts/android-local-server.mjs --real-local
# Separate terminal, authorized fully booted emulator required:
node mobile/poc/scripts/doctor.mjs
node scripts/test-android-real.mjs
```

Doctor evidence `test-results/stage8-android-doctor.json`: JDK 21, SDK platform 36,
build tools 35, ADB, emulator, WHPX and one authorized emulator were available.
Earlier runs failed during ANR dialogs (System UI/Pixel Launcher/app) with roughly
500 MB free host memory. No data was wiped. Native Back passed once input was no
longer intercepted. A later test failure was the driver's cached debugging socket
after app force-stop; it now reconnects and verifies the actual retained session.
Those failed artifacts remain under `test-results/android-real-*`.
WebView full-page screenshot stitching is not sufficient evidence of native visual
parity. Functional checks passed; approved branding, full native visual review,
physical hardware and release transport/signing remain separate gates.

After testing, the Android test server was stopped and the normal founder app was
restored on port 3100. Local PostgreSQL data and synthetic audit accounts remain.

Production remains intentionally synthetic-only (`src/lib/env.ts`). Do not flip
that restriction merely to label the app production-ready. Required owner inputs:

1. Approved brand master files and light/dark/clear-space usage rules.
2. Gemini account/product, processing region and retention/data-use approval; local
   server key and explicit synthetic live-call authorization. No purchase/billing.
3. Commercial organization verification evidence, responsible independent operators,
   privacy/retention/fulfillment rules and support contacts.
4. Encrypted backup destination/scope approval and isolated restore rehearsal,
   reconciled current migration package, HTTPS origin, SMTP/Auth redirects and
   owner-approved deployment. All hosted operations remain stopped.
5. Release signing/distribution decisions and authorized physical Android testing.

Backup planning exists in ORYQEN_BACKUP_RESTORE_EXECUTION.md and activation docs;
it is not a successfully tested export/restore. Recovery must not resurrect revoked
grants, withdrawn records or disabled accounts. No hosted exports or restores ran.
