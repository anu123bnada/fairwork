# Landing page download handoff (verified 30 Oct 2026)

| | Windows | Android |
|---|---|---|
| Direct URL | `https://github.com/anu123bnada/fairwork/releases/download/oryqen-preview-v0.1.0/ORYQEN-Preview-0.1.0-x64-Setup.exe` | `https://oryqen-staging.vercel.app/downloads/ORYQEN-Online-Preview-1.0.0-staging-debug.apk` |
| Release page | `https://github.com/anu123bnada/fairwork/releases/tag/oryqen-preview-v0.1.0` (pre-release, tag on `main`; no files on `main` changed) | n/a |
| Version label | ORYQEN Preview 0.1.0 (x64) | ORYQEN Online Preview 1.0.0-online-preview (versionCode 1) |
| Size | 121,261,243 bytes | 4,121,028 bytes |
| SHA-256 | `bd27ed2fec1c6c15e32929de57db89bac6f758c73d6da3f318c206e02eb393e3` | `8d4a1e1bda942d74940824695d4ab85629813dc3b7def6974cd586057053cc8f` |
| Verified | Public asset downloaded back over HTTPS: HTTP 200, exact size and SHA-256 match; GitHub reports the same digest. Same bytes installed, launched (staging sign-in page, 5/5) and uninstalled cleanly | HTTP 200, exact size and SHA-256 match; installed and launched on an emulator (28 Oct, re-confirmed 29 Oct with a rebuild of the same configuration) |

## Disclosures the page must show
- **Windows:** unsigned (SmartScreen warns), default Electron icon, "Preview" product name, requires an internet connection (wrapper of the staging site, no offline mode), synthetic test data only.
- **Android:** debug-signed and debuggable, development package id `org.fairwork.localpoc.online`, tested on an emulator only (no physical device), requires internet, synthetic test data only; "install from unknown sources" is needed.
- Neither is a production release. Signed, branded production builds need the owner's certificate, icon and keystore (`docs/ORYQEN_RELEASE_SIGNING.md`).
