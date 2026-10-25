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
