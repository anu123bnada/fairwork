# ORYQEN release signing and production builds

Status 26 Oct 2026: **no production signing material exists and none was created.**
Debug-signed and unsigned artifacts must not be distributed as production releases.
This document lists exactly what the owner must decide or supply, and the commands to
run afterwards. Nothing here has been run with real credentials.

## Decisions only the owner can make

| Decision | Why it is one-way | Needed by |
|---|---|---|
| Android application ID (for example `app.oryqen.mobile`) | Cannot change after the first store upload or install base | Android release build |
| Production HTTPS origin / domain (currently the preview deployment `https://oryqen.vercel.app`) | Compiled into the Android config and the Windows policy (`desktop/policy.cjs`) | Both |
| Approved logo master and icon set | `public/oryqen/approved/README.md`: no approved artwork supplied; placeholders are forbidden | Both (launcher icon, installer icon) |
| Code-signing certificate (Windows) | Identity shown to users and SmartScreen | Windows release |
| Upload/release keystore custody (Android) | Losing it can block updates | Android release |
| Hosted deployment of the current branch | The deployed site is older than the branch (see below) | Everything that talks to the backend |

## Android

Current state: debug and "online preview" builds exist, signed with a debug certificate,
package `org.fairwork.localpoc.online`. A guarded `release` variant now exists:

- It is **disabled unless** you pass an application ID (not starting with `org.fairwork.`)
  and an `https://` origin as build parameters.
- Signing is read from environment variables only; with no keystore the result is
  `app-release-unsigned.apk`, which cannot be installed (verified: `apksigner` reports no
  signature).
- Pipeline verified 26 Oct with a throwaway ID `app.oryqen.releasecheck` against the
  preview origin: BUILD SUCCESSFUL; the APK has no `debuggable` flag, `allowBackup=false`,
  `usesCleartextTraffic=false`, an `https://.../sign-in` start URL and no `localhost` or
  `http://` strings. That APK was a pipeline check only and is not a release.

### 1. Create the keystore (owner, once, on a trusted machine)

```powershell
keytool -genkeypair -v -keystore oryqen-upload.jks -alias oryqen-upload `
  -keyalg RSA -keysize 4096 -validity 9125
```

Store the file and passwords in the owner's password manager and keep an offline backup.
Never commit it (`*.jks` and `*.keystore` are git-ignored). Prefer Google Play App Signing,
using this key only as the upload key.

### 2. Build (PowerShell; quote every `-P` argument or PowerShell cuts it at the first dot)

```powershell
$env:JAVA_HOME = "C:\Users\vehiv\Desktop\fairwork\.tmp\android-toolchain\jdk-21.0.12.1+1"
$env:ANDROID_HOME = "C:\Users\vehiv\AppData\Local\Android\Sdk"
$env:ORYQEN_ANDROID_KEYSTORE_PATH = "<path to oryqen-upload.jks>"
$env:ORYQEN_ANDROID_KEYSTORE_PASSWORD = "<store password>"
$env:ORYQEN_ANDROID_KEY_ALIAS = "oryqen-upload"
$env:ORYQEN_ANDROID_KEY_PASSWORD = "<key password>"
cd mobile\poc\android
.\gradlew.bat :app:assembleRelease '-PoryqenReleaseAppId=<approved id>' `
  '-PoryqenReleaseOrigin=https://<approved domain>' '-PoryqenVersionCode=1' '-PoryqenVersionName=1.0.0' `
  --no-daemon --no-watch-fs --max-workers=1 --console=plain
```

Output: `mobile/poc/android/app/build/outputs/apk/release/app-release.apk`. Increase
`PoryqenVersionCode` for every update. For Play Store use an Android App Bundle
(`bundleRelease`) instead of an APK.

### 3. Verify before distributing

`apksigner verify --print-certs <apk>` shows the owner certificate (not "Android Debug");
`aapt2 dump badging` shows the approved ID; install on a physical device and run the
two-account acceptance against the HTTPS origin. Publish the SHA-256 in
`src/features/releases/releases.ts` and `docs/RELEASE_MANIFEST.md`, then set
`NEXT_PUBLIC_APK_URL` so the landing card becomes a link.

Launcher and splash icons in the project still come from the earlier restored artwork;
replace them with the approved set before release.

## Windows

Current state: `test-results/windows-artifacts/ORYQEN-Preview-0.1.0-x64-Setup.exe`,
Electron 45, unsigned, product name "ORYQEN Preview", built with
`signAndEditExecutable: false` (so no icon or version metadata is embedded).

A separate production configuration, `desktop/electron-builder.release.cjs`, now exists.
It **refuses to build** unless all of the following are present (verified: running it
without them stops with a clear error):

```powershell
$env:CSC_LINK = "<path or https URL of the .pfx/.p12 certificate>"
$env:CSC_KEY_PASSWORD = "<password>"
$env:ORYQEN_WINDOWS_ICON = "<owner-approved .ico, or .png of at least 512 px>"
npm --prefix desktop run build:windows:release
```

Output: `test-results/windows-release/ORYQEN-<version>-x64-Setup.exe`, product name
"ORYQEN". Certificate options: an OV/EV Authenticode certificate from a public CA, or
Azure Trusted Signing. EV or managed signing builds SmartScreen reputation fastest.
Not tested with a real certificate; the first signed build needs `Get-AuthenticodeSignature`
to report `Valid`. If winCodeSign extraction fails on Windows for lack of symlink
privilege, enable Developer Mode or run the build in an elevated shell.

The shell pins `https://oryqen.vercel.app` in `desktop/policy.cjs`. Change it (and its
test) to the production domain before the release build.

## Backend the clients use

Both apps load the hosted site; they contain no API secrets. On 26 Oct a read-only
probe showed the deployment at `https://oryqen.vercel.app` is **older than this branch**:
`/downloads` returns 404 and the landing page has no release cards. The new migrations
(`202610250001_offer_lifecycle`, `20261025100610_private_offer_drafts`,
`20261025140000_private_employment_history`, `20261026100000_guidance_thread_deletion`)
are not on hosted Supabase. Deploying the branch and applying those migrations needs the
owner's approval; until then the Windows and Android apps exercise the older hosted code.
