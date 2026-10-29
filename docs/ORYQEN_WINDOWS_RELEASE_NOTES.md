## ORYQEN Preview 0.1.0 for Windows (testing build)

This is a **competition preview**, not a production release.

**Read before installing**
- **Unsigned.** There is no code-signing certificate, so Windows SmartScreen will warn ("Windows protected your PC"). Choose "More info", then "Run anyway", only if you trust this source.
- **Default Electron icon** and the product name "ORYQEN Preview". No branded icon yet.
- **Requires an internet connection.** The app is a wrapper that opens the ORYQEN staging site (`https://oryqen-staging.vercel.app`). There is no offline mode and no separate native functionality; only an offline notice page is shown when the network is down.
- The staging site uses **synthetic test data only**. Do not enter real personal or employment data.
- Per-user install, 64-bit Windows, installer size 121,261,243 bytes.

**Integrity**
SHA-256: `bd27ed2fec1c6c15e32929de57db89bac6f758c73d6da3f318c206e02eb393e3`

Verify with: `Get-FileHash .\ORYQEN-Preview-0.1.0-x64-Setup.exe -Algorithm SHA256`

**Tested:** silent install, launch (staging sign-in page loads, external links are not opened inside the window), uninstall, on Windows 11. Real sign-in inside the packaged app and a clean second machine were not tested.

**Android:** a separate debug-signed preview APK is offered on the ORYQEN site. It is not a release build and has only been tested on an emulator.
