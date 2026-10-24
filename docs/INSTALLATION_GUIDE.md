# Installation — preview builds

No public release is available yet. Do not distribute untested artifacts as a
production release. See RELEASE_READINESS.md for current artifact status.

## Windows

Target: Windows 10/11 x64. Build from repository root:

```powershell
npm --prefix desktop ci
npm --prefix desktop test
npm --prefix desktop run build:windows
```

Expected output: `test-results/windows-artifacts/ORYQEN-Preview-0.1.0-x64-Setup.exe`.
The installer is unsigned; Windows SmartScreen may warn. Signing credentials
have not been invented. Verify the approved release's SHA-256 and provenance;
do not disable Windows protection globally. Install per-user through the wizard.
Uninstall through Windows Settings. Session data uses Electron's per-user profile.
Use ORYQEN account settings to sign out before sharing the Windows account.

The application needs internet. Use the ORYQEN menu to reconnect or go back.
Complete verification/recovery email links in the browser and then sign in inside
the app. This does not bypass email confirmation or organization approval.

## Android

The existing Capacitor app requires Android 7.0/API24 or later. Two variants exist;
neither is a public download.

- `debug` — local development transport (`adb reverse` + localhost).
- `online` — HTTPS-only preview that loads `https://oryqen.vercel.app/sign-in`
  with `usesCleartextTraffic=false`. This is the online-connected preview artifact.

Prerequisites (already provisioned on this machine): JDK 21 at
`.tmp/android-toolchain/jdk-21.0.12.1+1`, Android SDK platform 36 and
build-tools 36.0.0, and `sdk.dir` in `mobile/poc/android/local.properties`
(the file is git-ignored; use forward slashes, e.g.
`sdk.dir=C:/Users/vehiv/AppData/Local/Android/Sdk`).

```powershell
$env:JAVA_HOME='C:/Users/vehiv/Desktop/fairwork/.tmp/android-toolchain/jdk-21.0.12.1+1'
$env:GRADLE_USER_HOME='C:/Users/vehiv/Desktop/fairwork/.tmp/android-gradle'
npm --prefix mobile/poc run build:online
```

Output: `mobile/poc/android/app/build/outputs/apk/online/app-online.apk`
(`org.fairwork.localpoc.online`, versionName `1.0-online-preview`). The build is
signed with the Android **debug** certificate (APK Signature Scheme v2) and is an
internal testing artifact only. Verified structure, permissions, network policy
and checksum: RELEASE_MANIFEST.md.

Device installation requires an authorized ADB device. On this machine the
available emulator reports `unauthorized`, which needs the RSA prompt accepted on
the emulator window; no physical device was attached. No physical-device
acceptance is implied by compiling an APK. Release signing and production-device
acceptance remain separate gates.

## Current functional limits

Hosted clients expose the deployed commit, not un-deployed local changes.
New opportunity/guidance RPCs need approved migrations and app deployment.
Live AI is unavailable; text evidence import retains editable text, not original
files. Windows and Android use the same accounts but separate local sessions.
