# Development Day 7 — case review evidence

October 15, 2026. Deadline: October 23, 2026, 19:00 Sri Lanka time.
**13/14 local criteria PASS (92.9%); NOT LOCALLY COMPLETE.** All functional and
automated verification criteria pass. The carried exact visual/motion gate is
OPEN. Results below are freshly verified, separate from historical Day 6 results.
Hosted completion is not claimed. No Day 8 features were implemented.

## Scope reconciliation

Read the Day 6 handoff, integrity contract, Passport eligibility, existing agreement,
work/Passport migrations and tests. The latest Day 7 request authorizes this work
case vertical slice despite the carried visual gate. The Day 6 ordering of typed
contracts, denial tests, forward migration and protected UI is preserved. Its wider
authority-case/assertion plan remains deferred rather than silently implemented.
Day 3–6 visual gates remain open. No AI adjudication or fabricated fraud finding.

Contract: [DAY7_CASE_REVIEW_CONTRACT.md](DAY7_CASE_REVIEW_CONTRACT.md).

## Explicit local acceptance criteria

| # | Criterion | Evidence | Result |
|---|---|---|---|
| 1 | Reconcile handoff and define typed reasons, statuses, authority, decisions and appeal boundaries | Contract above; strict `src/features/cases/schema.ts` | PASS |
| 2 | Denial tests precede implementation | `test-results/day7-postgres-1792023591471/tests.log`: 14 failures before migration | PASS |
| 3 | Persistent case tables, FORCE RLS, least privilege and indexes | Tenth migration; catalog/ACL test in `day7-case-db.test.ts` | PASS |
| 4 | Server identity, exact submitted work version, no foreign tenant access | Forged identity, foreign, draft, stale, list-scope tests | PASS |
| 5 | Independent assigned reviewer, MFA, explicit acceptance, expiry and revocation | Participant/operator/unassigned/conflicted denial; observed capability and assignment revocation races | PASS |
| 6 | Idempotent commands and serialized conflicting actions | Duplicate opens, concurrent decisions and open-versus-verification tests | PASS |
| 7 | Immutable decisions/events/receipts; authorized history survives a new connection | History mutation denial, typed read/receipt and fresh-connection tests | PASS |
| 8 | Root-wide open-case suppression; resolution cannot defeat independent checks | Correction bypass, withdrawal/retraction, terminal outcome, later dismissal tests; Day 6 eligibility preserved | PASS |
| 9 | Authenticated strict APIs with safe errors, same origin, no-store and retries | `tests/unit/day7-case-api.test.ts` | PASS |
| 10 | Usable reporting/status/evidence/assignment/decision/timeline, mobile and failure states | `src/components/fairwork/case-review.tsx`; six Day 7 browser journeys | PASS |
| 11 | Earlier security and functional regression coverage remains green | Full regression suite; Day 5/6 native suites through migration 10; Day 4 native regression | PASS |
| 12 | Native PostgreSQL authorization, races and revocation pass | 24 Day 7 + 18 Day 6 + 20 Day 5 + 13 Day 4 native executions | PASS |
| 13 | Browser, TypeScript, lint and normal production build pass | Final command results below | PASS |
| 14 | Original visual/motion parity genuinely established | Case screenshots and original Work Record export inspected; no original Case Review export; carried Day 3–6 visual gates open | OPEN |

## Implementation and migration

New local candidate `supabase/migrations/202610150001_work_case_review.sql` follows
the nine existing files. Five private case tables, non-login/non-bypass executor,
strict security-definer commands and scoped RLS helpers. Existing nine migrations
remain unchanged. Migration executed only in disposable local databases, including
under restricted `postgres` with no managed-Auth ownership/grant authority.
SHA-256: `84051535c9108b9fb388e6b6190ef73181e484a5030ebb897186eaa8e9be2629`.

The previous authoritative Passport function is retained as
`private.passport_eligible_day6`; the public-internal eligibility entry adds open-root
and terminal exact-version suppression. The existing work command delegates to its
Day 6 implementation after serializing decisions against open cases. No existing
withdrawal/correction/retraction/consent/authority/hash checks were removed.

API GET `/api/v1/work-cases?caseId=<uuid>` returns authorized case, evidence summary,
decision and history; GET without caseId lists authorized cases, with optional
workId/cursor. POST supports open/assign/accept/revoke/decide. Reporter and reviewer
identity are always server-derived; `reviewerId` is only the operator's candidate
selection, never decision authority. MFA and scoped database authorization decide.

## Verification log

Native PostgreSQL 18.4, synthetic identities and Auth claim adapters, real tables,
transactions/RLS/locks. This is not real Supabase Auth or hosted PostgREST evidence.

- `node scripts/test-day7-postgres.mjs`: **24 PASS**, final
  `test-results/day7-postgres-1792032801728/tests.log`.
- `node scripts/test-day6-postgres.mjs`: **18 PASS**, all ten migrations,
  `test-results/day6-postgres-1792032696705/tests.log`.
- `node scripts/test-day5-postgres.mjs`: **20 PASS**, all ten migrations,
  `test-results/day5-postgres-1792032863491/tests.log`.
- `node scripts/test-day4-postgres.mjs`: **13 PASS**, original Day 4 migration slice,
  `test-results/day4-postgres-1792070451358/tests.log`.
- These 75 executions overlap embedded regression tests; do not add them as unique
  tests. Day 7 includes five native-only concurrency/reconnection tests.
- The initial revocation race exposed missing row-lock RLS permission. A lock-only
  UPDATE policy with `WITH CHECK(false)` fixed it; mutation remains forbidden.
- An interrupted broad run is retained in `day7-browser-interrupted.log`,
  `day7-regression-interrupted.json`, and `day7-postgres-1792024787583/tests.log`.
  Logs show a long execution pause, timeouts and a later out-of-memory process
  startup failure. Those runs are failed evidence, not passes. Sequential reruns
  establish the final results. No timeout or security assertion was weakened.

Final regression: `npm test -- --reporter=default --reporter=json
--outputFile=test-results/day7-regression-results.json` — **196 PASS, 14 native-only
skips, 23 test files**. The skipped tests are exercised with native PostgreSQL
runners separately. All 14 native-only tests have fresh passing native coverage.

`npm run test:e2e:isolated`: **52 PASS**, including six new Day 7 HTTP-fixture
journeys and three mobile Chromium tests. Logs:
`test-results/day7-browser-final.log`, `day7-browser-build-final.log` and
`day7-browser-server-final.log`. The isolated build also passed. Browser fixtures
prove UI behavior, not PostgreSQL authorization or hosted Auth. Those boundaries
are separately tested as described above.

Final quality checks, sequentially after browser verification:

- `npm run typecheck`: **PASS**, `test-results/day7-typecheck-final.log`.
- `npm run lint`: **PASS**, zero warnings, `test-results/day7-lint-final.log`.
- `npm run build`: **PASS**, normal `.next` production artifact,
  `test-results/day7-production-build-final.log`. The API remains server-rendered;
  no static-export workaround was introduced.

All disposable PostgreSQL clusters and the isolated browser server were stopped.
The earlier sandbox-denied Next canonical-path check was rerun successfully with
approved local execution; it was not counted as a passing check.

The browser rerun isolated an accessible-name defect in the Decision select.
An explicit accessible label corrected it; `day7-browser-label-failure.log`
retains the 51-pass/1-fail run. No browser assertion was removed or timeout raised.

Preservation: `test-results/day7-preservation/comparison.json` records 277/287
pre-existing manifest files unchanged. The ten intentional changes are the route
allowlist, product navigation/auth return, Work Record case link, scoped case CSS,
validated participant path, RPC types, Day 5/6 forward-migration test inclusion,
participant-path test and `CONTINUE_HERE.md`. All nine prior migrations
are unchanged. All 641 entries in the earlier protected asset/migration/Android
manifest are unchanged. The original 4,120,514-byte APK remains hash-identical.
New Day 7 files are additive. Existing uncommitted/untracked work was retained.

## Visual evidence

Supplied original: `C:/Users/vehiv/Downloads/Untitled/08-Work-record.png`, 390×844;
the original prototype recording remains at
`C:/Users/vehiv/Videos/Screen Recordings/Screen Recording 2026-10-11 014452.mp4`.
Screenshots: `test-results/day7-visual/390-case.png`, `378-case.png`, `320-case.png`.
These are populated HTTP-fixture UI captures, not real adjudications. Full-page
captures include the fixed bottom navigation at its viewport position; that alone
does not demonstrate content occlusion during scrolling.

Visual inspection confirms reuse of original page gradient, dark summary surface,
glass cards, rounded controls, font and navigation assets. New functional case
fields necessarily expand the original layout; there is no original Case Review
screen to establish exact parity. Earlier Questions/Agreement density and motion
evidence gaps remain recorded in the Day 3–6 handoffs. No original asset replaced.

## Hosted, operational and Android gates

No hosted migration/read/write, deployment, commit or push was performed. Before
an explicitly approved rollout: verify target identity, migration ledger, backups,
restore plan, ownership/ACL/preflight and queued migration hashes. Check hosted
PostgreSQL version compatibility, schema cache and API grants; use separate real
Auth/MFA participants/operator/reviewer to test every denial, expiry, revoked and
conflicting decision path through PostgREST and the browser. Provision reviewer
capabilities through separately approved controlled operations, never this UI.
Real work remains unresolved without a real independent reviewer.

No verified production HTTPS URL. No native Android compatibility claimed.
Fresh `npm run doctor` in `mobile/poc` exits 1: build-ready Studio/SDK36/BuildTools35/
JDK21/ADB present, **0 authorized devices**, existing AVD lacks hypervisor driver.
Original APK remains previously generated/signature-verified; **no APK generated
or installed in Day 7**. Debug loopback-only exception and disabled release variant
remain untouched. Mobile browser/back tests do not prove installed Android behavior.

Per-case and work-detail history need bounded pagination and load/query-plan
verification before production scale. Secure files, authority-wide fraud cascade,
typed skill assertions, appeals and public/named-recipient disclosure are deferred.

## Exact Day 8 starting plan — no implementation yet

1. Resolve remaining visual references/gates and record the intended Case Review
   adaptation. Do not relabel earlier gates as passed. Confirm Day 7 final evidence.
2. Reconcile original roadmap B06/B07 and `DATABASE.md`: define typed authority-
   decision and assertion targets, affected-record linkage, independent reviewer
   disqualification, appeal linkage and permanent versus reversible suppression.
3. Write denial/race tests for forged targets, cross-tenant evidence, prior-resolver
   appeals, authority invalidation versus new verification, duplicate decisions,
   retroactive suppression and non-resurrection. Keep ordinary employer departure
   distinct from a retrospective human finding.
4. Implement a forward local migration and minimal authenticated commands for the
   agreed next slice, extending the same authoritative eligibility function. Do
   not issue skills/assertions before mapping/evidence rules are explicitly defined.
5. Reuse existing UI surfaces, add bounded case-history reads/query-plan evidence,
   then run unit/API/native PostgreSQL/browser/type/lint/build and visual checks.
6. Only after those trust gates, plan private named-recipient disclosure with a
   typed field registry, explicit curation, expiry, revocation and access auditing.
   Public sharing, deployment and hosted migration remain separately approved.

First action: close/reconcile the visual gate and confirm the typed Day 8 target
contract; do not start broad public sharing or automatic punitive AI decisions.
