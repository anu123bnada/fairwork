# ORYQEN release manifest — 24 October 2026

Local preview artifacts only. Nothing here is published, uploaded or hosted.
Every value below was produced by a command in this session; none is estimated.

## Artifacts

### Windows desktop installer

| Field | Value |
|---|---|
| Path | `test-results/windows-artifacts/ORYQEN-Preview-0.1.0-x64-Setup.exe` |
| Type | NSIS per-user installer, Windows 10/11 x64 (unsigned preview) |
| Version | 0.1.0 (`ORYQEN Preview`) |
| Size | 121,261,243 bytes (115.6 MiB) |
| SHA-256 | `bd27ed2fec1c6c15e32929de57db89bac6f758c73d6da3f318c206e02eb393e3` |
| Built | Rebuilt 2026-10-26 by an earlier `release:verify:full` run via `npm --prefix desktop run build:windows`; the 24 Oct build (SHA-256 `64925b35...fae7`, 121,260,491 bytes) was overwritten. Electron builds are not byte-reproducible, so the hash differs for identical source. `release:verify` now builds into `test-results/windows-verify` so it can no longer overwrite this file |
| Signing | **Not signed.** `Get-AuthenticodeSignature` reports `NotSigned`; SmartScreen will warn |
| Shell | Electron 45.0.0, `app.enableSandbox()`, context isolation on, node integration off, no preload bridge |
| Contents | `app.asar` with exactly `main.cjs`, `policy.cjs`, `offline.html`, `package.json` |
| Integrity | Packaged `main.cjs`, `policy.cjs`, `offline.html` byte-identical to `desktop/` source (re-checked on the 26 Oct rebuild by searching the unpacked `app.asar` for the exact bytes) |
| Secrets | No `service_role`, `SUPABASE_SERVICE`, `GEMINI_API_KEY` or credential-signing names in `app.asar` (re-checked on the 26 Oct rebuild) |
| Backend | Remote `https://oryqen.vercel.app` (hosted deployment, not a local bundle) |

Unpacked runtime used for smoke acceptance: `test-results/windows-artifacts/win-unpacked/ORYQEN Preview.exe`.

### Android preview APK (online-connected)

| Field | Value |
|---|---|
| Path (deliverable copy) | `test-results/android-artifacts/ORYQEN-Online-Preview-1.0-universal.apk` |
| Path (build output) | `mobile/poc/android/app/build/outputs/apk/online/app-online.apk` |
| Type | Capacitor 8.5.3 WebView shell, single universal APK |
| Application ID | `org.fairwork.localpoc.online` |
| Version | versionCode 1, versionName `1.0-online-preview` |
| Label | `ORYQEN Online Preview` |
| Size | 4,121,028 bytes (3.9 MiB) |
| SHA-256 | `8d4a1e1bda942d74940824695d4ab85629813dc3b7def6974cd586057053cc8f` |
| Built | 2026-10-24 13:35 (+05:30) via `gradlew assembleOnline` |
| SDK | minSdk 24 (Android 7.0), targetSdk 36, compileSdk 36, build-tools 36.0.0, JDK 21 |
| Signing | **Debug certificate only** (`CN=Android Debug`, APK Signature Scheme v2). Internal testing artifact; not a production-signed release |
| Permissions | `android.permission.INTERNET` plus Capacitor's non-exported dynamic-receiver permission. No camera, location, storage or SMS permission |
| Transport | `usesCleartextTraffic=false`, `allowMixedContent=false`, `server.url=https://oryqen.vercel.app/sign-in`, `CapacitorHttp`/`CapacitorCookies` disabled |
| Offline | `assets/public/offline.html` bundled as `errorPath` |
| Secrets | No `localhost`, no `http://` endpoint, no service-role string in the packaged config/native bridge |
| Backend | Remote `https://oryqen.vercel.app` — the same hosted Supabase-backed application as the browser and Windows builds |

### Cinematic landing page

| Field | Value |
|---|---|
| Original source (preserved, unchanged) | `landing/v6/` |
| Integrated route | `/` → `src/app/page.tsx`, styles `src/app/landing.css`, WebGL core `src/components/oryqen/cinematic-core.tsx` |
| Design | V6 cinematic layout, typography, colour and motion preserved; global selectors scoped under `.oryqen-landing` |
| Downloads | Landing `#download` section and `/downloads` both read `src/features/releases/releases.ts` (checked against this manifest and the built files by `tests/unit/release-data.test.ts`). Controls stay disabled until `NEXT_PUBLIC_WINDOWS_URL` / `NEXT_PUBLIC_APK_URL` are valid https URLs |
| Deployed | **No.** Not built into any hosted environment; public URLs remain pending approval |

## Backend target

One shared backend for all three clients: the hosted Next.js deployment plus Supabase
authentication/RLS. No separate database, no duplicate authorization and no
service-role credential ships in any artifact above.

## Verification summary (this session)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 warnings |
| Vitest (unit + integration) | 422 passed, 0 failed, 17 skipped (native PostgreSQL cases) |
| Playwright (production build) | 157 passed, 0 failed, 0 skipped |
| Desktop policy tests | 2 passed |
| Desktop runtime smoke | launch, sandbox, resize, minimize, maximize, offline recovery PASS |
| Android `assembleOnline` | BUILD SUCCESSFUL; manifest/config/signature inspected |

## Known issues

1. Both binaries are preview-quality: unsigned installer, debug-signed APK.
2. Android device acceptance is **not** performed: the available emulator reports
   the ADB device as `unauthorized`, which requires accepting the RSA prompt on
   the emulator window. No physical device was attached.
3. Android application ID still uses the legacy `org.fairwork` namespace.
4. The hosted deployment does not contain this session's local UI work
   (landing page, discovery/guidance APIs, comparison). Both desktop and Android
   load the hosted origin, so they show the deployed build, not localhost.
5. Two migrations (`20261024052407_opportunity_discovery.sql`,
   `20261024053156_private_guidance_history.sql`) remain local.
6. Windows authenticode signing and Android release keystore custody are unowned.

## Approval-dependent actions

Pushing commits, deploying the application, applying hosted migrations, uploading
either binary to public storage, publishing release links, and creating signing
credentials all require explicit approval. Nothing above was performed.
