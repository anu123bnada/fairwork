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
