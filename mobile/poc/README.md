# ORYQEN local Android transport POC

This is the existing Capacitor **8.5.3** project. Do not run `cap add android`
again. `cap copy android` refreshes only generated web assets/configuration;
it does not regenerate the native project. Dependencies are isolated here.

The app loads **http://localhost:3102** through an explicit `adb reverse` mapping
to the Windows Next.js server. It contains no static export of Next.js, no
Supabase credentials, no service-role key and no native HTTP/cookie override.
The root project and its package lock remain independent.

Read [CONTINUE_HERE](../../CONTINUE_HERE.md) for the latest results and blockers.
Do not infer Android compatibility from this directory or from Chromium tests.

## Safety and native behavior

- Main manifest disables cleartext and backup. Only the **debug** source set adds
  `local_poc_network_security.xml`: base cleartext denied, exact `localhost`
  permitted, subdomains denied. No LAN, `10.0.2.2`, arbitrary HTTP or mixed-content
  exception. This policy is not a hostname security boundary for a shipped app;
  the entire remote-URL wrapper is local-only and has no release variant.
- `app/build.gradle` disables release variants through `androidComponents`.
  `:app:assembleRelease --dry-run` must fail with missing task, not produce an APK.
  Never remove this guard to ship the development URL.
- Back dispatch delegates to WebView history, then finishes the activity at root.
  There is no JavaScript back listener or third-party native plugin changing it.
  The missing-WebView branch retains Capacitor's error screen.
- Network navigation errors load bundled `offline.html`. It contains a retry link
  but no cached personal data or successful-operation claim. A lost response may
  still represent a completed server action; reconnect and reload server truth.
- The native launcher/splash shield uses the original Figma shield paths. The
  original application assets, CSS, layout, auth and agreement code are unchanged.

## Reproduce locally (PowerShell)

Use separate terminals for backend and build/device operations. Commands below
are local only. Run from the stated directories, check every exit code, and use
the serial reported by ADB; never guess one or use `-a` to expose ADB to the LAN.

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
# Stop the existing port 3100 Next dev server first; preserve local database services.
node scripts/android-local-server.mjs --real-local
```

This backend binds `127.0.0.1:3102`, sets `APP_ORIGIN=http://localhost:3102`, and
uses the guarded, already running local Supabase services. Authentication and
records are real and persistent; use synthetic test identities. No hosted
credentials are selected. Stop with Ctrl+C; the script restores Next-generated
TypeScript includes on normal shutdown. Do not run a second Next dev server.

Omitting `--real-local` intentionally blanks backend configuration and returns
503 for protected APIs. That mode only checks fail-closed behavior; it cannot
verify successful authentication or persistence.

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
node node_modules/@playwright/test/cli.js test --config=playwright.android-local.config.ts
```

Build tooling used in this session (portable JDK path is machine-specific):

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork\mobile\poc'
npm ci --ignore-scripts
$env:JAVA_HOME='C:\Users\vehiv\Desktop\fairwork\.tmp\android-toolchain\jdk-21.0.12.1+1'
$env:ANDROID_HOME='C:\Users\vehiv\AppData\Local\Android\Sdk'
$env:GRADLE_USER_HOME='C:\Users\vehiv\Desktop\fairwork\.tmp\android-gradle'
node scripts/doctor.mjs
# Doctor exits 1 if either build prerequisites or an authorized test device is missing.
node node_modules/@capacitor/cli/bin/capacitor copy android
Set-Location android
.\gradlew.bat assembleDebug --no-daemon --no-watch-fs --max-workers=1 --console=plain
# Only after BUILD SUCCESSFUL and actual output inspection:
Get-FileHash app/build/outputs/apk/debug/app-debug.apk -Algorithm SHA256
```

Do not replace Gradle or lower SDK/security checks to conceal a build failure.
The existing wrapper is Gradle 8.14.3; Java 21–24 is compatible with this project,
whereas the installed Studio Java 25 is too new. SDK 36 and Build Tools 35 are
needed. Toolchain caches live under ignored `.tmp`; no system Java setting was
changed. A fresh environment needs the JDK installed/downloaded separately.

## Installation and native checks — conditional on a working device

```powershell
$adb = 'C:\Users\vehiv\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb devices -l
$serial = '<exact authorized serial from the preceding command>'
& $adb -s $serial reverse tcp:3102 tcp:3102
& $adb -s $serial reverse --list
& $adb -s $serial install -r 'C:\Users\vehiv\Desktop\fairwork\mobile\poc\android\app\build\outputs\apk\debug\app-debug.apk'
& $adb -s $serial shell am start -W -n org.fairwork.localpoc/.MainActivity
# Exercise actual Android back, not a browser history substitute:
& $adb -s $serial shell input keyevent KEYCODE_BACK
# Runtime network-policy assertions, when the emulator/device is available:
.\gradlew.bat connectedDebugAndroidTest --no-daemon --max-workers=1 --console=plain
# Remove only this POC's forwarding rule when finished:
& $adb -s $serial reverse --remove tcp:3102
```

Require `device` state; `unauthorized`, `offline` or an empty list is not a usable
device. Have the owner authorize a phone; do not bypass authorization. An emulator
must boot fully (`getprop sys.boot_completed` = 1). This machine's existing x86_64
AVD now boots with WHPX (Stage 11). No Windows feature, BIOS setting, driver or
reboot was changed during Stage 11. See the current handoff for actual results.

Record actual results for: launcher and web splash; onboarding; language/welcome;
failed real sign-in and protected API denial; browser-fixture-only successful
routing clearly labelled; hardware and gesture Back across routes/share/keyboard;
root Back exits; reopen; rotation; disconnect forwarding → native offline page;
restore forwarding → retry; no API actions reported as confirmed offline.
Run the network-policy instrumentation test to verify actual Android enforcement,
not just source text. Capture Android/API/WebView versions and exact APK hash.

Run `node scripts/test-android-real.mjs` with the real local server and fully
booted `emulator-5554` to install the debug APK and exercise registration, local
email confirmation, sessions, native Back and API failure/recovery. It retains
its synthetic account and all existing data. Test results distinguish these
checks from untested TOTP/expiry and full two-party agreement workflows.

This APK requires the PC server, local Supabase and `adb reverse` connection.
It is not an independently usable hosted release; physical-device testing and
an approved HTTPS backend remain separate gates. Release builds remain disabled.
