# ORYQEN dual-app release plan — V4

## Preserved baseline

Non-destructive tracked and untracked source checkpoint:
`test-results/v4-checkpoint-20261024-112703/manifest.txt`.
No reset, clean, migration deletion or hosted change was performed.
V3 verification: 422 unit/integration tests passed, 17 native-only skipped.
The completed first full browser run was 144 passed / 1 failed due to a document
test locator. Corrected document regression passed separately; 19 focused new
screen tests passed. V4 reruns are recorded in TEST_REPORT.md.

## Architecture

The Next.js 16 application retains all server routes, authentication and shared
Supabase authorization. It is not statically exported. Windows uses an Electron
HTTPS shell at the exact production origin. Android reuses the existing Capacitor
project; no Flutter project was found in this repository. Both require internet.
Neither contains service-role credentials or a duplicate database.

Electron was selected because it can build a Windows NSIS installer locally,
retain the existing browser APIs and cookies and use the existing hosted server
routes. Tauri would add Rust/WebView2 packaging/toolchain work without removing
the requirement for the hosted Next.js backend.

Windows remote content has Node disabled, context isolation, renderer sandbox,
web security, no preload/IPC bridge and denied device permissions. Navigation
stays on the exact HTTPS origin; new external HTTPS windows require confirmation
and open in the system browser. Untrusted schemes are rejected. Downloads from
remote content are blocked in this preview. No auto-updater is configured.
See https://www.electronjs.org/docs/latest/tutorial/security and
https://www.electron.build/docs/nsis/ for packaging/security references.

Verification/recovery emails complete in the system browser. The user then signs
in in the app; browser and app cookie jars are separate. No token forwarding,
custom protocol or invented deep-link verification is claimed. Production
callback/session acceptance remains unverified and no new emails are authorized.

## Landing page

The original `ORYQEN-V6-Cinematic.zip` was found in Downloads. Its entries were
inspected and source was copied safely into `landing/v6`; the existing Next app
root remains unchanged. The cinematic design is preserved as a separate project.
Its download area now links to the planned product `/downloads` route. That route
has truthful pending Windows/Android controls and no fake downloadable files.
The external V6 project has its own dependency/build scope; it is excluded from
the main application's ESLint scope and requires separate build acceptance.

## V5 execution results — 24 October 2026

- **Windows installer built and inspected before rebuilding.** The existing
  `ORYQEN-Preview-0.1.0-x64-Setup.exe` (121,260,491 bytes) was opened with
  `@electron/asar`; `main.cjs`, `policy.cjs` and `offline.html` inside `app.asar`
  are byte-identical to `desktop/`, so the artifact matches current source and was
  not rebuilt. It is unsigned (`NotSigned`).
- **Windows runtime acceptance passed** via `scripts/test-desktop-shell.mjs`:
  launch, renderer sandbox/preferences, resize, minimize, maximize and synthetic
  network-loss recovery to the offline page. Real sign-in and session persistence
  were not exercised (no authorized test account).
- **Android online APK built.** `assembleOnline` now succeeds after correcting a
  malformed `sdk.dir` escape in the git-ignored `local.properties` (the earlier
  failure was `SdkLocator` rejecting the path, not a source defect). Output:
  `mobile/poc/android/app/build/outputs/apk/online/app-online.apk`, 4,121,000
  bytes, debug-signed, `usesCleartextTraffic=false`, `server.url` on the exact
  HTTPS origin. `npm --prefix mobile/poc run build:online` added for repeatability.
- **Device acceptance blocked.** The available AVD (`Medium_Phone_API_37.0`) boots
  but reports `adb devices` -> `unauthorized`; accepting the RSA prompt requires
  interaction with the emulator window. No physical device was attached. This is
  recorded as unverified, not as passing.
- **Responsive layout verified** at 320/375/390/430/768/1024/1280/1440/1920 with
  assertions on canvas width, sidebar geometry and absence of horizontal overflow.
- **Landing page integrated.** See the section below; it is no longer only archived.

## Landing page integration

The preserved `landing/v6` project remains untouched as the reference source. The
cinematic page is served at `/` from the main application:

- `src/app/page.tsx` — the V6 page, restructured into readable TypeScript, with
  index accesses made strict-safe for `noUncheckedIndexedAccess`.
- `src/app/landing.css` — the V6 stylesheet with `:root`, `body`, `*`, `a`, `button`
  and `html` rules scoped under `.oryqen-landing` (or `html:has(.oryqen-landing)`),
  so app routes keep their own typography and link colours.
- `src/components/oryqen/cinematic-core.tsx` — the lazy Three.js core, unchanged
  in behaviour, with a CSS sculpture fallback and reduced-motion support.
- Fonts now come from `@fontsource/dm-sans` and `@fontsource/space-grotesk`
  instead of a runtime Google Fonts import, matching the existing Manrope setup.
- `framer-motion`, `lucide-react` and `three` are the libraries the V6 project
  already declared. `motion-dom@12.23.23` and `motion-utils@12.23.6` are pinned
  because a floating `motion-dom` resolved to a version whose exports framer-motion
  12.23.24 does not use, which broke the production build.
- The product splash moved from `/` to its existing `/intro/splash` route; the two
  browser tests that started at `/` now start there, with the same assertions.
- Downloads route keeps truthful disabled controls; the landing links to
  `/downloads`, `/sign-in` and `/register` and exposes no binary URLs.

## Approval boundary

Local source changes and builds only. Public URLs remain pending until approved
artifact hosting exists. Before launch: approve backend backup/restore and exact
migrations, deploy tested application, validate real cross-platform account and
record journey, sign artifacts or explicitly approve unsigned preview distribution,
then approve uploads/releases and landing deployment. Nothing is uploaded by the
packaging command (`--publish never`).
