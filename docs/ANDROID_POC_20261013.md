# Local Android POC verification record

Resumed 2026-10-13 from the existing Capacitor 8.5.3 worktree. No project
regeneration, hosted Supabase mutation, migration, deployment, commit or push.
Final artifact/build status is recorded in CONTINUE_HERE.md: **debug APK built and
signature verified; not installed; native runtime compatibility unverified**.

## Review and repairs

Reviewed the prior authored POC changes and their generated Android wiring:
root ignore rules and `next.config.ts`; local backend script; mobile browser
tests; isolated mobile package and lock; Capacitor config; doctor; bundled index
and offline page; main activity; main/debug manifests; debug network policy;
app Gradle release guard; root Gradle/settings/wrapper/variables, copied config,
native styles, generated sample tests and plugin wiring. No `cap add`/project
replacement was run during the resume. `cap copy android` copied the existing
webDir/config only after the offline copy changed.

Incomplete work addressed:

- Doctor now detects `Android Studio1`, portable JDK 21, SDK 36, Build Tools 35,
  emulator acceleration and unknown device state when ADB is inaccessible. It
  separates `buildReady`, `deviceTestingReady`, APK presence and unchecked
  installation; the previous hardcoded `apkGenerated:false` was not a build probe.
- Local server restores generated `tsconfig.json` and `next-env.d.ts` edits when
  stopped normally. Ctrl+C was exercised and originals were compared afterward.
- Native Back callback handles the no-WebView branch without dereferencing null.
  Its history/finish behavior compiled, but compilation is not runtime proof.
- Native launch icon/splash now references a vector using the original Figma
  shield paths; original SVGs and web design source remain unchanged.
- Generated instrumentation test expected Capacitor's sample package. Corrected
  it to the POC ID and added runtime network-policy assertions for exact localhost
  allow plus lookalike/LAN/emulator-alias denial. Not executed without a device.
- Offline copy now tells the user to reload to determine whether changes saved,
  instead of incorrectly promising that a lost connection means no server write.
- ESLint excludes downloaded `.tmp` toolchain caches and generated Android files;
  application/test/POC JavaScript still runs through the normal checks. Prior
  traversal of changing Gradle caches produced an ENOENT, not an app lint defect.
- Added exact-local-origin Playwright configuration with a dev-only 15-second
  assertion timeout for cold route compilation; assertions/security checks were
  retained. Added offline API denial coverage.

## Preserved boundary

`server.url` remains exactly `http://localhost:3102`; no invented HTTPS host,
LAN exposure, `10.0.2.2` shortcut or static export. The phone requires an explicit
ADB reverse tunnel. Native HTTP and cookie bridges are disabled, mixed content
is disabled and release variants are disabled. The debug-only Network Security
Config permits HTTP only for exact `localhost`; all other hosts remain denied.
The built merged debug manifest was inspected for `allowBackup=false`,
`usesCleartextTraffic=false`, the debug network config and debug flag.

Existing server origin checks, Supabase cookies/authentication, MFA routes,
participant/version/hash rules, RPC authorization, RLS and six migration files
were not edited. `public/figma/**`, existing React components and CSS were not
edited. Original root package files also retain their hashes. The 136-file
pre-Android source snapshot remains at `test-results/android-preservation-20261012`;
it excludes credentials/account state. New native files and documentation are
additional uncommitted work. The existing README change is the user's prior work.

## Measured web results

| Command / scope | Result |
|---|---|
| `npm test` | PASS: 106 tests, 14 files; local SQL/security regressions included |
| `npm run test:e2e:isolated` | PASS: normal Next 16.4 Turbopack production build and 26 Chromium tests, one worker |
| `node scripts/android-local-server.mjs` | Started real Next backend on loopback port 3102; stopped with Ctrl+C |
| `node node_modules/@playwright/test/cli.js test --config=playwright.android-local.config.ts` | PASS: 3 tests on exact POC origin, including newly added offline denial |
| `npm run lint`, `npm run typecheck` | PASS |

The 26-test complete run predates addition of the third offline mobile test;
the later 3-test local-origin run covers all three mobile tests. These are not
29 distinct tests. Existing foundation tests cover the web splash/onboarding.
Successful sign-in/navigation/logout tests use explicit synthetic Playwright
transport fixtures. Real `/api/v1/me` requests reach Next and return expected
503 `SERVICE_UNAVAILABLE` with `private, no-store` while Supabase is unconfigured.
Network-aborted requests hide private actions. No live login or MFA claim follows.

The first local-origin test attempt failed its five-second onboarding URL wait
during development compilation; one of two passed. The isolated production suite
had already passed. After using an explicit dev compilation allowance, all three
local tests passed. Earlier sandbox memory/path/temp-file failures were not counted
as passing runs; normal local checks required approved execution outside sandbox.

## Native toolchain and failed attempts

At initial inspection only Java 8 and no standard SDK location were visible.
On resume, Android Studio was found at
`C:\Program Files\Android\Android Studio1`; its bundled Java is 25.0.3.
The existing wrapper is Gradle 8.14.3 and the Capacitor project compiles Java 21.
A portable Temurin JDK 21.0.12.1+1 was downloaded from the official Adoptium API
to ignored `.tmp/android-toolchain`, checksum verified before extraction:
`f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e`.
No global Java/PATH setting was changed. Gradle installed SDK 36 revision 2 and
Build Tools 35 using the SDK's already-accepted licenses. The existing API 37
platform/AVD was preserved.

The first log command used a wrong relative output path and did not provide a
valid result. Its Java build survived the pipeline failure; the duplicate task
daemon was identified by its workspace JDK path and stopped. The current build
was retained. Two builds failed on Windows immutable-transform cache moves,
including a single-build retry at `:app:checkDebugAarMetadata` with
`java.nio.file.AccessDeniedException`. No antivirus/OS security setting was disabled.
The targeted retry uses `--no-watch-fs` and passed: BUILD SUCCESSFUL in 5m 16s,
93 tasks. APK size 4,120,514 bytes, SHA-256
`1076209E7B023D70A788A1071490269B91FCEEE102E1261B6FA8959BC14FBFB6`.
APK v2 signature verification passed; packaged manifest and network policy were
inspected with aapt2. Release-task dry run failed as expected because the app's
`assembleRelease` task does not exist. This verifies the build guard, not runtime
network enforcement. See final logs/result in CONTINUE_HERE.
This error family is tracked by [Gradle](https://github.com/gradle/gradle/issues/31438).

ADB is available outside the sandbox and reports an empty device list. Sandboxed
ADB could not query the daemon; its null device count must not be read as proof
that the physical phone is absent. The non-sandbox query found zero authorized
devices. Existing AVD: `Medium_Phone_API_37.0` (x86_64).

An actual headless emulator launch was attempted with `-memory 2048 -cores 2
-no-window -no-audio -no-boot-anim -no-snapshot-save -gpu swiftshader`.
It exited with **x86_64 emulation currently requires hardware acceleration**.
`emulator -accel-check` reports code 6: Android Emulator hypervisor driver is not
installed. There is no booted Android environment, so installation, runtime
network-policy tests, real Android Back/gesture/keyboard, native offline fallback,
native splash and native cookie persistence are **BLOCKED / NOT VERIFIED**.

Resolve by owner-enabled supported virtualization/hypervisor and any required
reboot, or by connecting an authorized physical Android phone. No BIOS, Windows
feature, driver or reboot change was made. See the
[Android acceleration guide](https://developer.android.com/studio/run/emulator-acceleration#vm-windows).

## Evidence locations and next execution

- `test-results/day2-browser-build.log`, `day2-browser.log`: complete isolated run.
- `test-results/android-mobile-home.png`: desktop Chromium mobile viewport only.
- `test-results/android-local-browser/`: exact-local-origin browser output.
- `test-results/android-build-20261013.log`: first logged cache failure.
- `test-results/android-build-retry-20261013.log`: second failure with stack trace.
- `test-results/android-build-no-watch-20261013.log`: targeted final build attempt.
- `test-results/android-emulator.log`, `android-emulator-error.log`: failed boot.
- `test-results/android-doctor-20261013.json`: most recent recorded tool inventory.

Use [the POC runbook](../mobile/poc/README.md) for exact setup, build, ADB reverse,
install and native test commands. Read [the boundary audit](ANDROID_ARCHITECTURE_20261013.md)
before selecting a release architecture, and [the dated sprint](NEXT_SPRINT_20261013.md)
for persistent Work Record and Work Passport. Do not ship this local URL wrapper
or claim full Android compatibility until a build succeeds and actual device
tests pass. Production HTTPS, live auth/MFA/agreements and persistent work/passport
are still independent release gates.
