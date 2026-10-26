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
