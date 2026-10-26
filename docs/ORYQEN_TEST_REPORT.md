# ORYQEN test report (25 October 2026)

All numbers below come from commands run in this session on the local machine.
Nothing was run against hosted systems.

## Commands and results

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | passed |
| Lint | `npm run lint` | passed, 0 warnings |
| Unit, integration and SQL | `npx vitest run` | 70 files; **480 passed, 17 skipped, 0 failed** (after the `zod` 4.6.7 upgrade) |
| Dependency audit | `npm audit --omit=dev` | 0 vulnerabilities (was 1 high in `zod`) |
| Production build | built by the isolated browser runner (`next build`) | succeeded in each run below; no separate `npm run build` was run |
| Browser, first full run | `AUTH_REGISTRATION_ENABLED=true node scripts/test-browser.mjs` | 158 passed, **6 failed** (9.9 min) |
| Browser, second full run | same command, after fixes | 163 passed, **1 failed** (1.1 h; see below) |
| Browser, failed spec rerun | `... tests/e2e/android-browser.spec.ts` | 3 passed |
| **Browser, final full run** (after runner hardening and employment-card styling) | `AUTH_REGISTRATION_ENABLED=true node scripts/test-browser.mjs` | **164 passed, 0 failed, 0 skipped, exit 0 (9.4 min)**; `next-env.d.ts` and `tsconfig.json` left clean |
| Vitest rerun after the same changes | `npx vitest run` | 70 files; 480 passed, 17 skipped (the 17 pass via the PostgreSQL scripts below) |

The earlier runs above are kept as history. The final full run is the first single run in
which all 164 browser tests passed. The 1.1-hour run coincided with about 1.5 GB of free
RAM on a 16 GB machine; the final run completed in 9.4 minutes.

## Browser failures and what they were

1. `day5-work` x2: my new employment form used the label "Role", which collided with the
   existing work-record "Role" field. **Caused by this sprint's Module I.** Fixed by
   renaming the label to "Job title"; both pass.
2. `product-app:28`, `stage9-local-completion:39`: the earlier-sprint offer-drafts panel
   added an unmocked request (alert shown) and a required field inside a form the test
   checked for validity. Test fixtures were updated (mock the drafts endpoint; exclude the
   separate drafts form from the invalid-field check). Product code unchanged.
3. `product-app:128`, `workspace-access:2`: the earlier-sprint saved-offers list now
   requests `&view=active` and adds labels that repeat the offer name. Mocked URLs were
   updated and one text locator made exact. Product code unchanged.
4. `android-browser:27`: took 5.5 minutes in the second full run (whole run 1.1 h, about
   7x slower than the first), then passed in 9.9 s alone. Treated as a machine stall,
   not proven; if it recurs, investigate.

Test edits changed fixtures and locators only; no assertion about product behavior was
weakened or removed, and no test was deleted.

## New tests this sprint

- `tests/integration/employment-history-db.test.ts` (3): revisions, idempotency,
  isolation, rejected payloads including forged verification, forced RLS, no direct
  grant, immutability.
- `tests/unit/employment-history-api.test.ts` (3): auth, private caching, origin check,
  strict validation.
- `tests/integration/demo-seed-db.test.ts` (3): demo data labeling, validity against real
  schemas and database functions, idempotent replay.
- `tests/e2e/employment-history.spec.ts` (2): save, reload, edit to revision 2, never
  shown as verified; invalid dates refused with no request.

## Skipped tests (17), not counted as passed

All 17 are real-PostgreSQL concurrency/persistence tests that skip unless
`FAIRWORK_LOCAL_POSTGRES_PORT` is set: 5 in `day7-case-db`, 4 in `day6-integrity-db`,
3 in `day5-work-db`, 2 in `day4-agreement-db`, 3 in `admin-db` (confirmed with the
verbose Vitest listing). They are skipped in the plain `npx vitest run`, but **were run**
via the project's disposable embedded-PostgreSQL scripts (below). The browser specs gated by
`AUTH_REGISTRATION_ENABLED` are outside Vitest and ran in the browser runs above.

## Real PostgreSQL concurrency runs (25 Oct)

Each script starts a throwaway embedded PostgreSQL on a random loopback port, runs the
matching test file with `FAIRWORK_LOCAL_POSTGRES_PORT` set, and stops it. The local
Supabase database (with real accounts and demo data) was not used.

| Script | Result (all tests in file, including the formerly skipped ones) |
|---|---|
| `node scripts/test-day4-postgres.mjs` | 13 passed |
| `node scripts/test-day5-postgres.mjs` | 20 passed |
| `node scripts/test-day6-postgres.mjs` | 18 passed |
| `node scripts/test-day7-postgres.mjs` | 33 passed |
| `node scripts/test-admin-postgres.mjs` | 21 passed |

Total 105 passed, 0 failed, 0 skipped, which covers all 17 tests that skip in the default
run. Evidence folders are under `test-results/` (git-ignored). The new employment-history
and offer-draft tests were not part of these files; their concurrency behavior is covered
only by the advisory lock plus the in-process SQL tests.

## Real-stack check

`scripts/demo-seed.mjs` ran against the local Supabase stack: registration, local mail
confirmation, profile, 3 employment entries and 2 offer drafts saved; a rerun returned
the same receipts; signing in and opening the work-record screen displayed the entries.

## Not covered

Hosted environment, live Gemini, accessibility audit (keyboard and contrast), 390/768/
1440 px visual review of the new employment screen, load or performance testing,
penetration testing, native Android.

## V1.0 verification session (26 Oct)

### Real local stack harness (`node scripts/test-local-real-workflows.mjs`)

Real Supabase Auth, local mail confirmation, TOTP MFA, PostgreSQL and the Next.js app; four
synthetic accounts (worker, employer, approver, operator) per run.

| Run | Result | Cause |
|---|---|---|
| 1 and 2 | 30 PASS, then FAIL: "login/MFA telemetry persists for all four actors" | **Defect, fixed.** The telemetry role allows 4 connections, but each API route bundle made its own pool of 2, so `too many connections for role "oryqen_telemetry_writer"` dropped 3 of 4 login events (reproduced identically twice; DB log evidence) |
| 3 (after fix) | **70 PASS**, then FAIL `net::ERR_INSUFFICIENT_RESOURCES` at "saved offer discovery" | Environment: the browser ran out of memory (about 1.6 GB free of 16 GB) |
| 4 | 20 PASS, then FAIL "Docker Desktop is unavailable" | Environment: the machine was exhausted (0.57 GB free; shell could not fork) |

The harness has **not** completed end to end in this session, so its later stages (passport
sharing with a named recipient, account deactivation, etc.) were not re-run; the earlier
121-check pass of 18 Oct (`docs/STAGE8_INTEGRATION.md`) is historical, not re-verified.
Passing in run 3 (real stack): registration without an unconfirmed session, TOTP enrollment,
independent operator approval, persisted offers with missing-term questions, assessment denial
for unrelated accounts, offer persistence across logout/login, private guidance with foreign
history denied, scoped employer/worker dashboards, private Passport with an eligible verified
record, and mobile-width layout checks.

Fix: `src/server/telemetry.ts` now keeps one process-wide state (pool, in-flight count, last
write) on `globalThis`; regression test in `tests/unit/runtime-telemetry.test.ts`. Hosted
serverless deployments can still exceed the role limit with many concurrent instances; use a
connection pooler or raise the limit before production.

### Other results this session

| Check | Result |
|---|---|
| Browser suite, first rerun from `6ef1c61` | **167 passed, 0 failed** (10.4 min) |
| Guidance deletion browser spec | 2 passed |
| **Browser suite, final full run (after telemetry fix, Android/Windows config)** | **169 passed, 0 failed, 0 skipped, exit 0 (9.7 min)**; `next-env.d.ts`/`tsconfig.json` clean |
| Vitest after all changes | 73 files; 491 passed, 17 skipped, 0 failed |
| Typecheck / lint / `npm audit --omit=dev` | pass / pass 0 warnings / 0 vulnerabilities |
| Desktop policy tests (`node --test desktop/policy.test.cjs`) | 2 passed |
| Android release pipeline | `assembleRelease` with a throwaway ID: BUILD SUCCESSFUL, unsigned APK; guard verified (no release task without parameters) |
| Windows release config | refuses to build without certificate and approved icon (verified) |
| Hosted probe (read-only) | `/` 200, `/sign-in` 200, `/api/v1/me` 401, HSTS present; `/downloads` 404 (deployment is older than the branch) |
| New SQL tests | guidance deletion (3) |

### Missing-functionality session (26 Oct), final gates

| Check | Result |
|---|---|
| Browser suite (isolated runner) | **173 passed, 0 failed, 0 skipped, exit 0 (10.1 min)**; generated files clean |
| Vitest | 79 files; **510 passed, 17 skipped, 0 failed** (the 17 pass via the PostgreSQL scripts) |
| Typecheck / lint / production audit | pass / pass 0 warnings / 0 vulnerabilities (new dependency `pdfjs-dist@6.4.299`) |
| New migrations on real local Supabase PostgreSQL | all 7 applied in order (39 total); privilege error in the roster migration found there and fixed |
| Real-database calls (role `authenticated`, demo account) | guidance delete (0 for an empty thread), employment list (3 entries), foreign-offer analysis refused, both `list_offers` shapes, direct table read denied |

### 22-module session (26 Oct): Gemini contract, company research, localization, jurisdictions

| Check | Result |
|---|---|
| Browser suite (isolated production build), final | **179 passed, 0 failed, 0 skipped, exit 0 (8.5 min)**. An earlier run in this session had 1 failure (stage9 passport download): my Passport skills panel raised a second alert when its endpoint was unmocked; fixed in the fixture, root cause recorded |
| Vitest | 83 files; **539 passed, 17 skipped, 0 failed** (the 17 pass via the PostgreSQL scripts) |
| Typecheck / lint / production audit | pass / pass 0 warnings / 0 vulnerabilities |
| Live Gemini, synthetic text, app's real provider (`npm run test:live:gemini`) | `gemini-3.1-flash-lite`: SUCCESS in 5.3 s; salary 90,000 LKR; 4 grounded warning signs; 2 missing details; 3 questions. Configured `gemini-3.8-flash`: `RESOURCE_EXHAUSTED` (quota) |
| Gemini contract bisection (live) | rejected: `exclusiveMinimum`, length limits, `minItems`/`maxItems` in `responseJsonSchema`; accepted after removal. Older `responseFormat` shape was the original defect source |
| Live company research (`npm run test:live:research`) | 3 passed: Commercial Bank of Ceylon PLC (LK), Siemens AG (DE, country-mismatch finding), unknown name returns no results |
| New unit tests | research 12, i18n 8, jurisdiction 8 |
| New browser tests | company research 2, localization 3, jurisdiction 1 |

Screenshots of Sinhala and Tamil settings screens were reviewed: glyphs render with correct conjuncts in
Chromium on Windows. Android WebView rendering is unverified.

### Trust Chain and credential core (26 Oct)

| Check | Result |
|---|---|
| New unit tests | Trust Chain builders 8, route 5, credentials 11 (tampering, algorithm confusion, wrong key, expiry, not-yet-valid, revocation, oversize, schema-valid-but-unacceptable payloads) |
| New browser tests | Trust Chain 3 (reviewed, self-reported, disputed, retracted; filters; empty and error states; German heading and mobile layout) |
| Defect found by review before release | `list_work` also returns records the caller reviews as a representative; they would have appeared as "You submitted this record". Fixed by filtering to `workerId === caller`; regression test added |
| New dependency | `jose@6.2.13` (MIT), audit 0 vulnerabilities |

Final gates for this batch: browser suite **182 passed, 0 failed, 0 skipped, exit 0 (8.5 min)**; Vitest 86 files,
**563 passed, 17 skipped, 0 failed**; typecheck and lint clean; audit 0 vulnerabilities. One earlier full run in this
batch had a single failure (`stage9` passport download) because the new Trust Chain panel raised an extra alert when
unmocked, the same class of fixture problem as before. The assertion now targets the specific download error and
the new endpoint is mocked.

### Verifiable credential register, API and verify page (26 Oct)

| Check | Result |
|---|---|
| Browser suite (isolated production build) | **188 passed, 0 failed, 0 skipped, exit 0 (12.6 min)** |
| Vitest | 89 files; **583 passed, 17 skipped, 0 failed** |
| Typecheck / lint / production audit | pass / pass 0 warnings / 0 vulnerabilities (new dependency `qrcode@1.5.4`) |
| Real-stack harness, `node scripts/test-local-real-workflows.mjs` (real Auth, mail, TOTP, PostgreSQL; app run with a throwaway test signing key) | **161 PASS, exit 0**; the first complete run this session. Includes 5 Trust Chain checks on real rows and 12 credential checks: forbidden actors refused, issue, replay returns the same credential, public key set has no private part, anonymous status valid/unknown, a real browser verifies the real signature and live status, holder-only revocation visible immediately, verify page shows revoked |
| Migration on the real local Supabase PostgreSQL | applied (40 total); `anon` can execute exactly `api.credential_status` |
| New SQL tests | 7 (register, replay, forged references, ownership, revoke, source withdrawal, expiry, privileges) |
| New unit tests | issuing 7, routes 6 |
| New browser tests | 6, with real Ed25519 verification in the browser: genuine, tampered, expired, wrong key, malformed, revoked/unknown/unreachable status never shown as valid, pasted token, phone layout, create/QR/revoke flow, signing-not-configured message |
| Key ceremony script | refuses repository paths, missing key id and overwrites; success prints only public material |
| Defects found while building | (1) anonymous verifiers lacked schema usage (fixed, with a test that proves nothing else became anonymous-callable); (2) a malformed token reached a table constraint instead of a clean validation error; (3) the verify page needed the shared brand header and its guard test caught it |

## Entitlements batch and release gate (26 Oct 2026)

| Check | Result |
|---|---|
| Real-stack harness (throwaway test key, local Docker PostgreSQL with the new migration) | **163 PASS, 0 FAIL, exit 0**; includes free-plan default, no-billing and non-operator-cannot-grant checks. First attempt failed honestly because the local database lacked the new migration (catalog check), then passed after applying it locally |
| Vitest | all files passed except none failing; new: catalog 5, server helpers 4, route limit 1, SQL 5 (PGlite and real PostgreSQL) |
| Browser | credentials and Trust Chain specs 10 passed (limit-reached message added) |
| `npm run release:verify` (quick mode) | typecheck, lint, vitest, audit, brand assets, Electron policy tests PASS; production build, browser suite and database security SKIPPED without `--full`; configuration, AI policy, credential key, download links, Android release and Windows signing BLOCKED on owner inputs; Android toolchain SKIPPED. Verdict NOT READY: owner input required. Two defects in the new script found and fixed (a lint error; Android preflight reported pass because it exits 0 without `--require-ready`) |

## Full release gate and new modules (27 Oct 2026, local commit after `abc7d61`)

| Check | Result |
|---|---|
| `npm run release:verify:full` | **PASS 13, FAIL 0, SKIPPED 0, BLOCKED 6.** Verdict NOT READY: owner input required. Passed: typecheck, lint, vitest (99 files), dependency audit (0 high or critical), brand assets, Electron policy tests, production build, **browser suite (205 tests)**, real-PostgreSQL case-review tests, Android toolchain, Android debug APK build, Windows unsigned installer build, artifact hashes. Blocked: production configuration, AI policy, credential key, download links, Android release approvals, Windows code-signing certificate |
| Defects the first full run found and fixed | (1) my route file for the vault blob endpoint was corrupted by a shell escaping error and broke the production build (fixed; typecheck and build clean); (2) `windows-build` overwrote the installer whose size and hash the download page records, so `release-data` failed (now builds into `test-results/windows-verify`; figures refreshed; manifest updated honestly); (3) the localization coverage tripwire (`< 100` strings) correctly tripped after real translation growth (raised to 400 with a comment tying it to the coverage wording); (4) release report kept only 6 lines of evidence (now 40 lines plus a full log file per failure) |
| Real-stack harness (real Auth, mail, TOTP, PostgreSQL, local vault store, throwaway signing key) | **181 PASS, exit 0**, including the entitlement, vault and developer API journeys |
| New automated tests this batch | Vault: schema 3, store 5, service 6, SQL 6 (PGlite and real PostgreSQL), browser 3. Plans: unit 9, SQL 5, browser 4. Developer API: SQL 5 (PGlite and real PostgreSQL), unit 8, browser 2. Scam indicators 5. German references 3 unit plus 1 browser. Pay comparison 2 browser. Localized panels 3 browser (si, ta, de) |
| Gemini live re-run | RESOURCE_EXHAUSTED on the configured model and on `gemini-3.1-flash-lite`: external quota blocker, no real-user AI enabled |

## Final state of the 27 Oct 2026 batch

| Check | Result |
|---|---|
| `npm run release:verify:full` on the final commit | **PASS 13, FAIL 0, SKIPPED 0, BLOCKED 6** (NOT READY: owner input required). **Browser suite 217 passed**, real-PostgreSQL case-review tests passed, typecheck, lint, vitest, audit (0 high or critical), production build, Android debug APK and Windows unsigned installer builds passed. BLOCKED, all needing the owner: production configuration, AI policy fields, credential signing key, https download hosts, Android release approvals, Windows code-signing certificate |
| Real-stack harness with webhooks | **186 PASS, exit 0** (real Auth, mail, TOTP, PostgreSQL, local vault store, throwaway signing key). Developer webhook journey: validation, one-time secret, owner-only, test event failure logged, revoke event retried three times in the background and logged |
| New SQL tests (PGlite and real PostgreSQL) | entitlements 5, vault 6, developer keys 5, developer webhooks 6: all pass on both engines |
| Not run on real hardware | No Android device or emulator was attached; no Windows installer was installed and exercised in this batch; hosted Supabase Storage and a hosted backend were not touched |

## Platform installation checks (27 Oct 2026, this machine)

| Platform | What was done | Result |
|---|---|---|
| Android (emulator-5554, Android 17, API 37, x86_64) | `adb install -r` of the debug APK built by `release:verify:full` (`org.fairwork.localpoc`, versionName 1.0.0, minSdk 24, targetSdk 36, debug-signed); `am start -W`; screenshot | **Installed (Success), launched (Status ok, process running), and showed the app's own native "ORYQEN is offline ... Try again" page because no backend was reachable (correct fail-closed behaviour).** The emulator's System UI raised an ANR under memory starvation. **Not exercised:** sign-in, workflows, Back handling, reconnection (those need `scripts/test-android-real.mjs`, which needs more memory than this machine has with the database stack running), physical device |
| Windows (this PC) | Silent install of `ORYQEN-Preview-0.1.0-x64-Setup.exe` (Authenticode status **NotSigned**) to a temporary folder with `/S`, launch, 12-second liveness check, stop, silent uninstall | **Installer exit 0; the app launched with the window title "ORYQEN — Your work, clearly recorded"; four processes ran and were stopped; uninstaller exit 0 and the executable was removed.** Not exercised: signed installer, upgrade over an older version, sign-in against a hosted backend |

## Sprint close (27 Oct 2026): final full gate

| Check | Result |
|---|---|
| `release:verify:full` on the final commit | **PASS 14, FAIL 0, SKIPPED 0, BLOCKED 6** (new gate: secrets scan). **Browser suite 226 passed.** BLOCKED, all needing the owner: production configuration (the validator names `APP_ORIGIN`, `FAIRWORK_DATA_MODE`, credential signing and vault storage), AI policy fields, credential signing key, https download hosts, Android release approvals, Windows code-signing certificate |
| New this sprint | Failure register (24 entries, none OPEN), secrets scan (781 files, 0 unexplained), production configuration validator (3 unit tests), local migration automation, static route and source security audit (9 tests: 49 mutating routes checked, 48 enforce the origin check, the one exception is the documented bearer-key API), HSTS header on every response (7 browser tests), self-service data export (5 unit, 2 browser), production runbook, private-bucket setup SQL and a hosted Storage verification script (not run: needs the owner's project) |
| Live integrations (27 Oct) | GLEIF registry research: 3 of 3 live tests passed. Gemini with synthetic data: RESOURCE_EXHAUSTED (provider quota), BLOCKED |

### 28 Oct 2026 — recruiter verification and AI gateway checks

* Real-stack harness (`test-local-real-workflows.mjs --manage-app`), run alone after F-25: **168 PASS, 0 FAIL**, including the new recruiter journey (domain claim without false control, idempotent create, no worker information in the representative queue, outsider sees nothing, confirm/dispute/withdraw, erase). Credential, vault and developer journeys SKIPPED by design (no signing key / document store configured locally). Evidence `test-results/local-real-1793009069177/`.
* Vitest: 111 files, 732 passed, 17 skipped; `tsc` and `eslint` clean.
* Browser: `recruiter-verification.spec.ts` 2/2, `localized-check.spec.ts` 3/3.

### 28 Oct 2026 — full release gate on `ec242e8` (`npm run release:verify:full`, exit 0)

**PASS 14 | FAIL 0 | SKIPPED 0 | BLOCKED 6. Verdict: NOT READY — owner input required.**
PASS: typecheck, lint, unit-integration (309 s), dependency audit, brand assets, secrets scan, Electron policy, production build, browser journeys (868 s), real-PostgreSQL database security, Android toolchain, Android debug-signed preview APK (not a release), Windows unsigned preview installer (not a release), artifact integrity (9 hashed).
BLOCKED (all owner decisions, none a defect): production configuration, AI policy/key, credential signing key, https download hosts, Android release approvals, Windows code-signing certificate. Report: `release-results/release-verify.md`.

### 28 Oct 2026 — real-stack harness with vault, credential and developer journeys enabled

`test-local-real-workflows.mjs --manage-app`: **206 PASS, 0 FAIL, 0 SKIPPED** (exit 0). The harness now starts the app with a loopback-only disk store for vault bytes and a throwaway, in-memory credential signing key (never written to disk, not the production key), so the vault, credential and developer-API journeys run instead of being skipped. Includes the new vault-attachment checks (employer cannot see or create links; deleting a document removes its link). Real PostgreSQL: `evidence-vault-db` (9) and `recruiter-verification-db` (9) via `scripts/test-feature-postgres.mjs <test files>`; PGlite also passes.

### 28 Oct 2026 — full release gate after F-26 fix (`npm run release:verify:full`, exit 0)

**PASS 14 | FAIL 0 | SKIPPED 0 | BLOCKED 6. Verdict: NOT READY — owner input required.** Browser journeys 239/239 passed (773 s), unit/integration (352 s), real-PostgreSQL database security, production build, Android debug APK and Windows unsigned installer built. The previous run's only failure (F-26, localization coverage tripwire) is resolved. The six BLOCKED gates are unchanged owner inputs. Readiness analysis: `ORYQEN_PRODUCTION_READINESS_AUDIT.md`.

### 28 Oct 2026 — full release gate on `c39c576` and the route matrix

**Gate (`npm run release:verify:full`, exit 0): PASS 14 | FAIL 0 | SKIPPED 0 | BLOCKED 6 — NOT READY: owner input required.** Browser journeys passed (1005 s) including the new accessibility checks (30) and notification preferences; unit/integration 512 s; real-PostgreSQL security 53 s. BLOCKED gates unchanged: production configuration, AI policy, credential key, download hosts, Android release, Windows signing.
**Route matrix (`tests/e2e/route-matrix.spec.ts`): 74 passed.** 13 public routes and 16 signed-in `/app` screens at 390 px and 1366 px: renders, no page errors or hydration messages, no horizontal overflow; signed-out visitors see no private screen; admin and operator routes fail closed.

### 28 Oct 2026 — organization plans and wider translation

Real-stack harness (alone, `--manage-app`): **212 PASS, 0 FAIL, 0 SKIPPED** (exit 0), including the new organization-plan journey (basic allowance 5, refusal at the limit, edit and draft allowed, operator assignment with replay, representative sees the team plan, sixth publication succeeds). One earlier run failed once on a 5 s wait in the sharing journey and passed twice afterwards (F-28). `plan-entitlements-db` 10/10 on PGlite and on a disposable real PostgreSQL cluster. New unit suites: localize-text (4), i18n-dynamic-keys (10), localization-coverage (2), org-plans (8). Browser specs added for translated Settings, AI panel, Passport, sharing, credentials, opportunities, guidance, feed.

### 28 Oct 2026 — full release gate on `1acb58a` (exit 0)

**PASS 14 | FAIL 0 | SKIPPED 0 | BLOCKED 6 — NOT READY: owner input required.** unit-integration 326 s, browser-journeys 963 s (includes accessibility, route matrix, per-language specs), real-PostgreSQL security 61 s, production build, Android debug APK and Windows unsigned installer. The two failures of the previous run (F-29 localization guard list, F-30 screenshot protocol error under resource contention) are resolved. Strict module count: `ORYQEN_22_MODULE_ACCEPTANCE.md` (1 complete and verified, 20 partial, 1 blocked).
