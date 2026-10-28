# ORYQEN Android online testing APK (staging)

| Field | Value |
|---|---|
| File | `ORYQEN-Online-Preview-1.0.0-staging-debug.apk` (4,121,028 bytes) |
| SHA-256 | `8d4a1e1bda942d74940824695d4ab85629813dc3b7def6974cd586057053cc8f` |
| Package / version | `org.fairwork.localpoc.online`, versionName `1.0.0-online-preview`, versionCode 1 |
| SDK | minSdk 24, targetSdk 36, compileSdk 36 |
| Backend origin | `https://oryqen-staging.vercel.app/sign-in`, generated at build time from `-PoryqenOnlineOrigin` into the app's Capacitor config (embedded in the APK, `cleartext: false`) |
| Permissions | `INTERNET` only (plus the app's own internal receiver permission) |
| Signing | **DEBUG-signed** (certificate "Android Debug", SHA-256 `c7015c75fb0f1a9b6a930c668e63a41502134fe40ab7f892ce2fd84048c140e6`). **Not a release build**, not Play-Store signed, debuggable. The package id still carries the development prefix `org.fairwork.localpoc`; a production id and keystore are owner decisions |
| Published | **No.** Not uploaded; no download link |

## Test status (28 Oct 2026)
| Check | Result |
|---|---|
| Build (`assembleOnline -PoryqenOnlineOrigin=https://oryqen-staging.vercel.app`) | BUILD SUCCESSFUL (3m 31s); the old localhost proof-of-concept APK is NOT used |
| Package identity, version, SDK levels, permissions, embedded origin, signing certificate | read from the APK with aapt2, apksigner and unzip: as in the table above |
| **Installed on a real Android system image**: Google emulator `Medium_Phone_API_37.0` (Android 17, API 37, x86_64, WHPX-accelerated) | `adb install`: Success. The installed record matches the table (DEBUGGABLE, INTERNET granted) |
| **Launched** | the activity resumed; process running |
| In-app checks through the app's WebView (DevTools connection) | 3 of 3 pass: it shows `https://oryqen-staging.vercel.app/sign-in`; a wrong synthetic password got the plain "Sign in to continue." answer from the real staging auth service; the create-account page opened inside the app |
| Uninstall | `adb uninstall` Success; emulator shut down afterwards |
| Real sign-in with an account, session persistence after app restart, file upload and download, authentication redirects from an email link, a physical device | **NOT TESTED** |
