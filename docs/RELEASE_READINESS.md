# Release readiness — V5 (24 October 2026)

Deadline: 27 October 2026, evening, Asia/Colombo.

## October 24 engineering correction

The historical V5 summary below is not a completion certificate. Remaining work
includes implementation and real acceptance: AI generation still fails, generated
analysis is not persisted, guidance is rules-only, and original-document storage
remains incomplete. See REAL_RUNTIME_FAILURES.md for current evidence. No full
14-module or cross-device acceptance has passed. Opportunity/guidance migrations
are now applied only to isolated local Supabase; hosted versions remain missing.

## Verdict

**A locally verifiable release candidate exists; public release is still NO-GO.**

Every artifact the directive asks for now exists locally and has been inspected:
a Windows installer, an online-connected Android APK, an integrated cinematic
landing page, and one shared hosted backend. Remaining work includes development,
real user acceptance, signing, binary hosting, deployment and separately approved
hosted migrations.

Evidence for every claim below: TEST_REPORT.md and RELEASE_MANIFEST.md.

## What changed in this batch

| Area | Before | Now |
|---|---|---|
| Android | Debug-only APK (Oct 19), online variant never built | `assembleOnline` succeeds; APK verified (package, sdk levels, permissions, `usesCleartextTraffic=false`, debug signature, bundled config) |
| Windows | Installer reported as built, unverified | Installer exists, payload byte-identical to source, unsigned, runtime smoke passes |
| Layout | Full-width canvas claimed, not re-checked | Nine widths asserted (320→1920) plus visual review at 320/390/430/1024/1280/1440 |
| Landing | Preserved-but-archived V6 project | Served at `/` from the main app, scoped styles, brand gate wired, downloads truthful |
| Tests | Interrupted runs | Typecheck, lint, 422 unit/integration, 157 browser, 2 desktop policy, desktop smoke all pass |

## Deliverable status

- **Windows installer** — built, unsigned. `test-results/windows-artifacts/ORYQEN-Preview-0.1.0-x64-Setup.exe`.
  Real sign-in, session persistence and cross-device sync were not exercised (no
  authorized test account). It loads the *hosted* origin, so it shows the deployed
  build, not this tree.
- **Android APK** — built, debug-signed, online transport. Device installation is
  blocked: the only available emulator reports `unauthorized`; no physical device
  was attached.
- **Landing page** — integrated at `/`, verified at nine widths. Not deployed.
- **Shared backend** — one hosted Next.js + Supabase application serves all three
  clients; both binaries point at the same HTTPS origin and carry no service-role
  credential.

## Remaining release blockers

1. **Signing.** Installer unsigned (SmartScreen will warn); APK debug-signed only.
   No keystore or code-signing certificate exists and none was invented.
2. **Distribution.** No approved binary host. `/downloads` therefore keeps both
   controls disabled; no URL was fabricated.
3. **Deployment.** The hosted application predates this tree. The landing page,
   comparison, discovery/guidance and evidence-import work are not live.
4. **Hosted migrations.** Two migrations remain local; the new opportunity/guidance
   APIs cannot work against the hosted database until applied.
5. **Device acceptance.** No physical Android device; emulator ADB unauthorized.
6. **Account acceptance.** No authorized test account, so Windows login, logout,
   session persistence and the two-device roundtrip are unverified.
7. **Identity.** Android application ID is still `org.fairwork.localpoc.online`.

## Safe release-candidate path (all requiring approval)

1. Approve the two migrations and back up the hosted database.
2. Deploy this tree to the existing hosting target.
3. Obtain signing credentials (Windows certificate, Android upload keystore).
4. Rebuild signed artifacts from the deployed commit and record new hashes.
5. Approve a release-storage location, upload, and only then enable the two
   `/downloads` controls with real URLs and checksums.
6. Deploy the landing page and re-run the browser suite against the deployed origin.

Steps 1-6 are roughly a day of work *if* credentials and approvals arrive; the
code side is ready. Without approvals, the honest status stays NO-GO.

## Unchanged external blockers

Production email-to-session roundtrip, live AI provider acceptance, original-file
storage with malware scanning, external opportunity ingestion, and legitimate
company evidence sources remain outside this batch.
