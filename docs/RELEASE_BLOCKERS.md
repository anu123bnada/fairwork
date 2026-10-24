# Release blockers — 24 October 2026 (V5)

**NO-GO for public launch.** A local release candidate exists; authorization,
signing and hosted deployment do not. Evidence: TEST_REPORT.md, RELEASE_MANIFEST.md.

## Closed in this batch

- **Android online APK did not exist.** `assembleOnline` now builds successfully and
  the artifact was inspected (package, minSdk 24 / targetSdk 36, INTERNET-only
  permissions, `usesCleartextTraffic=false`, debug v2 signature, bundled
  `capacitor.config.json` on the exact HTTPS origin, bundled offline page).
- **Windows artifact was unverified.** The installer's `app.asar` payload is
  byte-identical to `desktop/` source and the runtime smoke passes: launch,
  sandbox, resize, minimize, maximize, synthetic network loss → offline page.
- **Landing page was archived, not integrated.** It is now the public entry point
  at `/`, with global CSS scoped so product routes are unaffected, and three
  Playwright specs across nine widths.
- **Desktop layout was unverified since the phone-frame removal.** Nine widths
  320→1920 asserted plus visual review; the fixed quick-nav overlay and the
  invisible nav CTA were found by that review and fixed.

## Open blockers

1. **Signing custody.** Windows installer unsigned (`Get-AuthenticodeSignature` →
   `NotSigned`); APK signed with the Android debug certificate only. No certificate
   or keystore has been created or supplied. SmartScreen warnings cannot be
   eliminated for an unsigned build.
2. **No approved binary hosting.** Both `/downloads` controls remain disabled and
   no fake URL exists. Publishing requires approved release storage.
3. **Deployed application is behind this tree.** Both apps load
   `https://oryqen.vercel.app`, which does not contain the landing page, comparison,
   discovery/guidance or document-import work.
4. **Two local migrations are unapplied**:
   `20261024052407_opportunity_discovery.sql` and
   `20261024053156_private_guidance_history.sql`. The new APIs depend on them.
   Disposable PGlite tests do not certify hosted RLS.
5. **No device acceptance.** The available AVD boots but `adb devices` reports
   `unauthorized` (the RSA prompt needs a click in the emulator window); no
   physical device was attached. APK installation, back-button behaviour on device,
   and in-app session persistence are therefore UNVERIFIED.
6. **No account acceptance.** Windows sign-in, logout, session persistence and the
   two-device workflow are UNVERIFIED — no authorized test account was provided.
7. **Android identity.** applicationId remains `org.fairwork.localpoc.online` in the
   legacy namespace; the visible label is `ORYQEN Online Preview`.
8. **Product-scope gaps unchanged.** Live AI guidance, original-file storage with
   malware scanning, external opportunity ingestion/application submission,
   legitimate company evidence sources, production email-to-session roundtrip, and
   operational retention/deletion policy remain incomplete or unverified.

## Not blockers (previously listed, now settled)

- Desktop "phone frame" layout: gone; the product renders a full-width canvas with
  a desktop sidebar and mobile bottom navigation.
- Comparison table column overflow: fixed and asserted.
- Brand-gate unit failure on the downloads page: fixed by wiring the shared brand
  header, not by relaxing the assertion.

No production database change, push, merge, deployment, upload or publication has
occurred.

Existing detail: PRODUCTION_READINESS_20261023.md, SECURITY.md,
ORYQEN_RELEASE_GATES.md, ORYQEN_HOSTED_ACTIVATION_PLAN.md, STAGE9_RELEASE_CANDIDATE.md
and ANDROID_POC_20261013.md.
