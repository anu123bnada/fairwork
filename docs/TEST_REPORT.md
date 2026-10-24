# Master build test report — 24 October 2026

## V5 release-recovery batch (final state of the working tree)

This section supersedes every count below for the current tree.

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | PASS (`next typegen` + `tsc --noEmit`, zero errors) |
| Lint | `npm run lint` | PASS, zero warnings, whole repository |
| Unit + integration | `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=json --outputFile.json=test-results/v5/vitest-final2.json` | **422 passed, 0 failed, 17 skipped**, 61 files, 93 suites |
| Production build | inside `npm run test:e2e:isolated` | PASS (`✓ Compiled successfully`, TypeScript CLEAN) |
| Browser regression | `AUTH_REGISTRATION_ENABLED=true npm run test:e2e:isolated` | **157 passed, 0 failed, 0 skipped** |
| Desktop policy | `npm --prefix desktop test` | 2 passed, 0 failed |
| Desktop runtime smoke | `node scripts/test-desktop-shell.mjs` | launch, sandbox, resize, minimize, maximize, offline recovery PASS; session/login NOT TESTED |
| Android online build | `gradlew assembleOnline` | BUILD SUCCESSFUL in 2m43s, 71 tasks |
| Android APK inspection | `aapt2 dump badging`, `aapt2 dump xmltree`, `apksigner verify --print-certs`, `unzip` | package/version/permissions/cleartext/signature/config verified — see RELEASE_MANIFEST.md |
| Android device install | `adb install` on `Medium_Phone_API_37.0` | **BLOCKED**: `adb devices` reports `unauthorized` (needs the RSA prompt accepted on the emulator window) |

The 17 skips are the pre-existing native PostgreSQL concurrency/session cases; the
SQL integration suite ran on disposable PGlite.

### Defects found and fixed during this batch

1. `assembleOnline` failed with `SdkLocator ... IOException` — cause was a malformed
   escape in the git-ignored `mobile/poc/android/local.properties`, not source code.
   Fixed by writing `sdk.dir=C:/Users/vehiv/AppData/Local/Android/Sdk`.
2. `tests/unit/brand.test.ts` failed on `src/app/downloads/page.tsx`: that page did
   not reach the shared brand module. It now renders `AppBrandHeader` (which is
   intentionally empty until approved artwork exists). No assertion was relaxed.
3. The first full browser run after adding the landing page failed at build time:
   `framer-motion@12.23.24` resolved `motion-dom@12.43.0`, which no longer exports
   `activeAnimations`. Pinned `motion-dom@12.23.23` and `motion-utils@12.23.6`.
4. Landing page on `/` initially rendered no shared brand anchor; `Brand()` now goes
   through `BrandLogo` with the preserved V6 wordmark as its `existing` artwork.
5. Visual review of the integrated landing page found three real defects, all fixed
   and re-inspected at 320/390/430/1024/1280/1440:
   - the hero phone ignored its mobile scale because the motion animation overwrote
     the CSS `transform`; centring/scaling moved to the `translate`/`scale`
     properties so both compose,
   - `.oryqen-landing a{color:inherit}` outranked `.nav-cta{color:#fff}`, rendering
     "GET THE APP" navy-on-navy; base link/button rules now use zero-specificity
     `:where()`,
   - the fixed quick-nav trigger covered the hero call to action at every viewport
     height; it now reveals after the hero (Ctrl/Cmd+K still works).

### Test edits made in this batch

`tests/e2e/foundation.spec.ts` and `tests/e2e/android-browser.spec.ts` started at
`/` and expected the product splash. `/` is now the public cinematic landing page,
so both start at the product's existing `/intro/splash` route. The assertions after
that navigation are unchanged. New `tests/e2e/landing.spec.ts` covers the landing
entry point, truthful release controls, navigation to `/downloads` and `/sign-in`,
and the absence of horizontal overflow at nine widths.

## Continued core batch

These results supersede the earlier comparison-only counts below.

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, zero warnings, including the new APIs/components/tests.
- `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=test-results/master-core-vitest.json`:
  **422 passed, 0 failed, 17 skipped, 61 files passed**. Skips are existing
  native PostgreSQL concurrency/session cases; embedded native test tools were
  not installed for this run. SQL integration used disposable PGlite.
- Production build via `AUTH_REGISTRATION_ENABLED=true npm run test:e2e:isolated`:
  PASS, including TypeScript and static generation. Full browser results below.
- `node scripts/prepare-release-candidate.mjs`: PASS, all 32 migration hashes,
  full 12-/14-digit versions retained. Preparation only, no database connection.
- `node scripts/verify-android-poc.mjs`: PASS source invariants only.
- `node scripts/check-brand-assets.mjs`: exits successfully with PENDING;
  approved brand masters have not been supplied; existing identity preserved.

New regression coverage: publisher authorization and revocation, actor-private
preferences/choices/history, field-match explanations, pagination, closed/expired
listing suppression, immutable receipts, stale revisions and exact retries;
guidance schema/output validation and existing-offer context authorization;
text import UTF-8/type/size/binary checks and reviewed private-draft persistence.

The document browser regression initially used text-content assertions and then
an exact label locator that no longer matched a populated wrapped textarea.
The final assertion uses its accessible textbox role/name and value. The focused
rerun passed the entire import, save and reload flow. Product authorization or
validation was not relaxed to make this test pass.

Browser fixtures are synthetic and intercept API transport. They do not prove
hosted availability, original-file uploads, real AI generation or email delivery.
The two new migrations have not been applied to a persistent/hosted environment.
No live provider or email requests, push or deployment occurred.

## Commands and evidence

| Check | Result | Scope |
|---|---|---|
| `npm run lint` | PASS, zero warnings | Whole repository; final changed-file lint also passed after the table-fit test addition |
| `npm run typecheck` | PASS on final standalone rerun; initial unchecked array index corrected | Both subsequent isolated builds also passed TypeScript |
| `node node_modules/vitest/vitest.mjs run tests/unit/offer-comparison.test.ts --maxWorkers=1` | 3 PASS, 0 FAIL, 0 SKIP | Comparison values and response identity |
| `AUTH_REGISTRATION_ENABLED=true npm run test:e2e:isolated -- tests/e2e/offer-comparison.spec.ts` | Final build PASS; 9 PASS, 0 FAIL, 0 SKIP | All requested widths; table-fit assertion; denial/retry; fixtures |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=test-results/master-build-vitest.json` | Initial run FAIL: 36 suites could not load sandbox temporary modules; 147 executed tests PASS, 5 SKIP | Windows sandbox ENOENT; does not establish suite success |
| Full Vitest retry outside sandbox | PASS: 402 passed, 0 failed, 17 skipped; 56 files | Output: master-build-vitest-final.json; skipped cases require native PostgreSQL sessions/concurrency |
| `AUTH_REGISTRATION_ENABLED=true npm run test:e2e:isolated` | PASS: 125 passed, 0 failed, 0 skipped; production build/TypeScript PASS | test-results/master-build-full-browser.log and master-build-full-build.log |
| `node scripts/verify-android-poc.mjs` | PASS | Source invariants only, no APK/device execution |
| `node mobile/poc/scripts/release-preflight.mjs` | BLOCKED / NO-GO | Debug transport, signing and device acceptance missing |

Browser environment uses blank public Supabase configuration, synthetic mode,
registration enabled and installed Playwright Chromium. The runner owns port
3101 only and restores generated TypeScript configuration. User server3102 is
not stopped. Initial sandbox build failed to create a Turbopack junction;
approved retry passed. No security or test assertions were disabled.

Visual inspection after the first comparison pass found that the narrow content
area required horizontal scrolling to see the second offer. The final CSS uses
fixed table columns with wrapping; the focused browser suite now also asserts
that both columns fit the table viewport. Final rebuild and all nine focused
tests passed. Mobile390 and desktop1440 captures were inspected after the fix.
Final focused logs: test-results/day2-browser.log and day2-browser-build.log.
The full 125-test suite preceded this final scoped CSS correction; the nine
focused checks verify that correction against a fresh production build.

The comparison tests intercept HTTP transport. Existing database tests use
disposable PGlite unless a native runner is explicitly identified. Neither
proves production delivery, hosted sessions, production RLS catalog or native
Android acceptance. No emails or live provider requests were sent.

## Acceptance boundaries

- PASS: implemented comparison at nine requested widths, correct missing-value
  display, no pay conversion/ranking, denied-read recovery, existing API reuse.
- PASS: final standalone TypeScript, lint, production build and `git diff --check`.
- NOT TESTED: new feature in production, physical Android, production load,
  full assistive-technology audit, new live AI/provider acceptance.
- BLOCKED: signed production Android and full hosted release acceptance.
- FAIL / incomplete scope: the complete master-build directive still has missing
  internal product implementations listed in FEATURE_COMPLETENESS_MATRIX.md.

## Security review of this batch

Comparison calls existing same-origin, no-store agreement reads with normal
credentials; it adds no client-selected identity, role, grant or bypass key.
Each response is schema-validated and matched to its requested offer ID. Partial
success is not displayed if another read fails. React escapes recorded terms.
No raw HTML, provider requests, local persistence of terms, new SQL or upload
surface was introduced. Existing Supabase authentication and RPC authorization
remain responsible for access. A displayed snapshot is not a live revocation
subscription; reload revalidates every selected offer.

Existing security review: SECURITY.md. Existing deployment/runbook material:
STAGE9_RELEASE_CANDIDATE.md and ORYQEN_HOSTED_ACTIVATION_PLAN.md. Existing
production audit: PRODUCTION_READINESS_20261023.md. Current gaps and demo limits:
FEATURE_COMPLETENESS_MATRIX.md and RELEASE_BLOCKERS.md.
