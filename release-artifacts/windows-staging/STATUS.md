# ORYQEN Windows testing installer (staging)

| Field | Value |
|---|---|
| File | `ORYQEN-Preview-0.1.0-x64-Setup.exe` (121,261,243 bytes) |
| SHA-256 | `bd27ed2fec1c6c15e32929de57db89bac6f758c73d6da3f318c206e02eb393e3` |
| Version / app id | 0.1.0 / `app.oryqen.desktop`, product name "ORYQEN Preview" |
| Backend origin | `https://oryqen-staging.vercel.app`, written at build time from `ORYQEN_DESKTOP_ORIGIN` into `app-config.json` inside the package; no runtime override |
| Built from | the working tree on top of commit `ce9d523` plus the uncommitted desktop configuration change (see the commit that follows it) |
| Signing | **UNSIGNED.** No code-signing certificate exists; Windows SmartScreen will warn. Default Electron icon. This is a testing build, not a trusted release |
| Published | **No.** Not uploaded anywhere; no download link exists |

## Test status (28 Oct 2026, this machine, Windows 11)
| Check | Result |
|---|---|
| Unit tests of the navigation policy (`desktop/policy.test.cjs`) | 6 of 6 pass |
| Unpacked app launched (Playwright Electron) | 5 of 5 pass |
| **Silent per-user install** (`/S /D=<temp folder>`) | exit 0, files present, `resources/app.asar` present |
| **Installed copy launched** | 5 of 5 pass: window titled "ORYQEN Preview (oryqen-staging.vercel.app)"; navigated to `https://oryqen-staging.vercel.app/sign-in` and showed the sign-in form; a wrong synthetic password got the plain "Sign in to continue." answer from the real staging auth service; an external link was not opened inside the window; create-account and forgot-password pages opened inside the app |
| **Uninstall** (`/S`) | exit 0; no "ORYQEN Preview" uninstall entry in the registry afterwards (an existing "ORYQEN" entry published by Google\Chrome is a Chrome app, not this installer, and was left alone); the temporary install folder was removed |
| Real sign-in with an account, session persistence across restart, file download | **NOT TESTED** (needs your staging account) |
| Clean second machine / VM | **NOT TESTED** |

## Re-test 28 Oct 2026 (evening), against the current staging deployment
Checksum re-verified (`sha256sum -c`: OK). Silent per-user install exit 0; installed copy launched, 5 of 5 checks pass (window title shows the staging host; staging sign-in form; wrong synthetic credentials show the current "email and password do not match" message from the real staging auth service; external link not opened inside the window; register and forgot-password pages open); silent uninstall exit 0, app files and registry entry gone. Real sign-in with an account, session persistence across restart and file download remain NOT TESTED. Script: `scripts/test-windows-app.mjs`.
