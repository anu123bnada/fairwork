# Android delivery decision and boundary audit

Date: 2026-10-13. Deadline: **2026-10-23 19:00 Asia/Colombo (13:30 UTC)**.
This adds Android delivery to the older roadmap; it does not authorize deployment,
hosted migrations, commits or pushes. See CONTINUE_HERE.md for measured results.

## Decision

Keep Next.js as a running server with the existing same-origin API and Supabase
security model. For the deadline, a **Trusted Web Activity (TWA)** over an
owner-controlled HTTPS deployment has the least application migration risk.
It packages the hosted browser experience as an Android application, preserves
the existing UI/router/cookies, and does not move authorization onto the phone.
It requires a verified domain, a signing identity, Digital Asset Links, supported
browser behavior, and real device verification. None is established by a browser
test or a generated Android directory. Hosting is currently unverified/unavailable.

The existing isolated **Capacitor 8.5.3 local POC** is a transport experiment,
not the production architecture. It loads the real Windows Next.js server through
`adb reverse tcp:3102 tcp:3102`. No backend is bundled or statically exported.
Its package ID is `org.fairwork.localpoc`; release variants are disabled.

| Option | Migration and security impact | Decision |
|---|---|---|
| TWA + hosted Next.js | Existing origin, SSR routes, cookies and Figma assets remain; needs HTTPS/domain/signing association; browser-managed lifecycle; limited native integration | Lowest migration risk for online Android release |
| Bundled Capacitor React client + hosted API | Reuse React styling, but replace Next routing/server dependencies and deliberately design mobile token lifecycle, CSRF/CORS, MFA, refresh, deep links and secure storage | Future option if native/offline capabilities justify migration |
| Capacitor `server.url` | Works as development/live-reload transport; remote page and native bridge share a trust boundary | Local debug POC only; official docs say it is not intended for production |
| Custom Android WebView wrapper | Requires maintained navigation, browser security, TLS errors, cookies, downloads and lifecycle behavior | More custom risk than TWA; not selected for release |
| React Native/Expo or native Kotlin | Rebuild UI and routing, new auth adapter, greatest Figma and regression risk | Defer beyond deadline |
| Browser-installed PWA | Smallest packaging effort; does not itself deliver an APK | Useful supplementary access, not the requested APK deliverable |

Commercial extension can retain the versioned API/RPC boundary. A later native
client must prove the same subject, authority, revision, MFA and replay checks.
Do not use service-role credentials, generic direct table access, client role
claims, permissive CORS or disabled CSRF to enable mobile access. Hosting,
distribution, privacy and commercial terms need their own release decisions;
this POC establishes none of those approvals.

## Actual boundary

| Existing source | Dependency / mobile consequence |
|---|---|
| `src/app/app/[screen]/page.tsx`, `src/app/intro/[screen]/page.tsx` | Async Next route params, request-time preview query, server rendering and Next routing; not a generic offline React bundle |
| `src/components/fairwork/product-app.tsx` | Client UI uses Next Link/router, state and same-origin API; sessionStorage remembers only an offer ID; restart must reload server truth |
| `src/components/fairwork/secure-sign-in-form.tsx` | Password sign-in POST, router replacement and refresh; successful routing alone is not proof of authenticated cookies |
| `src/features/authority/client.ts` | Relative `/api/v1/*` fetches with `credentials: same-origin` and no-store; a Capacitor local origin cannot just call a different hosted origin unchanged |
| `src/app/api/v1/**/route.ts` | Dynamic request parsing, cookies, authentication, strict schemas, idempotency and private/no-store responses require Next server runtime |
| `src/server/http.ts` | Exact `APP_ORIGIN` and Fetch Metadata checks; keep these unchanged; do not spoof Origin via a native HTTP bridge |
| `src/server/supabase.ts`, `src/proxy.ts` | SSR cookie adapter; SameSite Lax, Secure in production; `/api/v1/me` proxy refresh and route-level authentication; hosted HTTPS cookie lifecycle still needs real testing |
| `src/app/api/v1/auth/mfa/route.ts`, `src/server/authority.ts` | TOTP enrollment/challenge/verify through server; upgraded cookies; database checks AAL2 and protected capability independently |
| `src/server/offer.ts`, agreement read/command RPCs | Server identity plus database participant/authority/version/hash checks; must remain server-side and unchanged |
| `src/server/offer-store.ts` | Node filesystem demo ledger; existing production guard blocks it. Not a persistence solution for Android or deployment |
| `next.config.ts`, `src/instrumentation.ts` | Security headers, server environment checks and build configuration remain on server |
| `public/figma/**`, product/auth CSS | Original vector assets, typography and layouts preserved. Native launcher uses a derivative of the existing shield paths; no original asset replaced |

The installed Next 16.4 guides explicitly exclude request-dependent handlers,
cookies, proxy, headers and unenumerated dynamic routes from static export.
`output: export` was not enabled. Local guides read: static exports, server/client
components, manifest metadata, and distDir.

## Mobile gaps to retain as explicit gates

- Local POC defaults to blank public Supabase settings. Real API failure is
  expected; only test transport fixtures simulate successful login. No runtime
  fake authentication route was added. Live cookie refresh, expiry, MFA and
  two-party agreement recovery remain separate checks with approved accounts.
- Native back must traverse WebView history, dismiss the share route, close the
  keyboard first when applicable, and finish at an empty history. Test actual
  Android key/gesture behavior; desktop `goBack()` is only preliminary evidence.
- Onboarding slides are local React state; Android Back does not imply previous
  slide behavior. Deep links after sign-in still require reopening the saved
  participant path, as documented by the earlier repair.
- Work Record, Passport, sharing, settings and notifications include previews;
  Android packaging does not make them persistent or production-ready.
- The UI retains the Figma device-status decoration, fixed-width phone frame and
  existing copy. Check real keyboard insets, Android status/navigation bars,
  rotation, text scaling and 320–430px widths before asserting visual fidelity.
- No service worker or offline write queue was introduced. Agreements and
  evidence cannot be confirmed offline. The native connection-error page makes
  no claims about cached identity or successful writes.
- Release TWA must validate Digital Asset Links against the exact APK signing
  certificate (and Play signing certificate if used). A Custom Tab fallback with
  browser chrome is not verified fullscreen TWA operation. Do not bypass domain
  verification to declare release success.

## Sources checked

- [Capacitor configuration](https://capacitorjs.com/docs/config): development
  `server.url`, cleartext, mixed content and navigation settings.
- [Capacitor environment](https://capacitorjs.com/docs/getting-started/environment-setup):
  Android tooling; actual pinned source uses Java 21, AGP 8.13.0 and SDK 36.
- [TWA quick start](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start):
  APK packaging, domain/signing association and fallback behavior.
- [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md):
  later `init`, build and install workflow; never regenerate this POC with it.
- [Android network security](https://developer.android.com/privacy-and-security/security-config):
  domain-scoped network policy for the debug exception.
- [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html):
  Java 25 requires newer Gradle; retain this project's Gradle and use JDK 21.
- [Playwright Android](https://playwright.dev/docs/api/class-android): experimental
  WebView automation, distinct from desktop mobile emulation.
