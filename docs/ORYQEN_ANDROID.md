# ORYQEN Android

Detail: `ANDROID_ARCHITECTURE_20261013.md`, `ORYQEN_RELEASE_SIGNING.md`, `ORYQEN_RELEASE_GATES.md`; project in `mobile/poc`.

## Status (honest)
- A Capacitor-based preview APK is tracked at `public/downloads/*.apk` and linked by `NEXT_PUBLIC_APK_URL`. It is debug-signed: it is a preview, not a production-signed release.
- Release preflight is NO-GO: no owner-authorized signing key exists, and no physical-device acceptance run is recorded.
- Android review of permissions and secure session storage has not been re-run in this session.

## Owner actions
1. Authorize creation of a release keystore; store it offline with a backup, never in git (`*.jks`/`*.pfx` are ignored).
2. Provide it to the build only through local environment, never logs.
3. Test the signed build on a physical device against staging: login, list/refresh a record, relaunch with session kept.
4. Only then approve public distribution.

## Build checks
Use the scripts under `scripts/` named `android-*` and `playwright.android-local.config.ts`; read `ORYQEN_RELEASE_VERIFICATION.md` first. Emulator runs need roughly 8 GB free RAM.

## Local build, 1 Nov 2026 (debug and online variants BUILD, release not attempted)
Toolchain installed with owner approval (winget, hash verified): Eclipse Temurin JDK 17.0.20 and JDK 21.0.13 under `C:\Program Files\Eclipse Adoptium`. Android Studio's bundled `jbr` is incomplete and unused. Capacitor 8 needs **Java 21** (JDK 17 failed with `invalid source release: 21`).
```bash
cd mobile/poc/android
JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot" ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"   ./gradlew.bat assembleDebug assembleOnline -PoryqenOnlineOrigin=https://oryqen-staging.vercel.app --no-daemon --no-watch-fs --max-workers=1 --console=plain
```
Result: `BUILD SUCCESSFUL in 1m`, exit 0 (128 tasks, 1 executed, 127 up to date). Gradle reported the APK outputs as up to date, so the files are the earlier 26 and 28 Oct builds, not new ones: `app-debug.apk` (4,121,524 bytes, sha256 starts `8cbadc1c`) and `app-online.apk` (4,121,028 bytes, sha256 starts `8d4a1e1b`). The `online` variant needs `-PoryqenOnlineOrigin=https://<host>` (https, no path).
What this proves: the toolchain compiles the project on this machine. What it does not prove: a fresh artifact, installation, login or any device behaviour. Both APKs are debug-signed. The release variant stays disabled by design (needs `-PoryqenReleaseAppId`, an https `-PoryqenReleaseOrigin` and the owner's keystore variables); no key was created or used.
Still needed: install on a physical device or emulator and run the login and record journey against staging; owner decision on a release keystore.

## Emulator run, 1 Nov 2026 (BLOCKED: no journey check passed)
Owner approved an emulator run. AVD `Medium_Phone_API_37.0` booted; adb showed `unauthorized` until the owner allowed debugging (restarting the adb server re-sent the prompt; nothing was bypassed). With the local Docker stack and `node scripts/android-local-server.mjs --real-local` (port 3102) up, `node scripts/test-android-real.mjs` ran twice:
- PASS: debug APK installed on the emulator without clearing data (`app-debug.apk`, existing 26 Oct build).
- FAIL (both runs): "startup and onboarding: Timed out waiting for the real UI or device". The server log shows the WebView did request `/` (200), so the app loaded something, but the onboarding heading was not seen within the timeout.
- Context: host free RAM was about 350 MB of 16 GB with the emulator running (this doc already asks for ~8 GB free), and the first run left a System UI "Not Responding" dialog. Resource starvation is the likely, **unconfirmed**, cause; a product defect is not excluded.
- Not run: registration, sign-in, relaunch session persistence, any record journey. Emulator and server were stopped afterwards. Evidence: `test-results/android-real-1793536160575` and `-1793536479630` (git-ignored).
Next: rerun with at least 8 GB free RAM (close other apps, stop Docker extras), ideally on a physical device.

## Emulator retry, 3 Nov 2026 (BLOCKED: emulator never booted)
Retried with `Medium_Phone_API_37.0` started headless (`-no-window -no-audio -no-snapshot -memory 1536 -gpu swiftshader_indirect`) because only ~1.25 GB of the host's 16 GB was free (the AVD itself warns it wants 16 GB). adb listed the device as `offline` for about 10 minutes and `sys.boot_completed` never became 1 (qemu resident ~374 MB, stalled). No APK install and no journey was attempted; the Android evidence remains the 1 Nov result (install PASS, startup journey FAIL twice). Emulator processes stopped afterwards.
Needs one of: more free RAM (close the other applications; a clean reboot first helps), a lighter AVD (smaller API level image, 2 GB RAM, no Play Store image), or a physical device with USB debugging authorized by the owner.
