# Development Day 6 — record integrity and private Work Passport

Updated October 14, 2026 (Sri Lanka). Deadline: **October 23, 2026, 19:00 Sri Lanka**.
This is DEVELOPMENT DAY 6; calendar dates do not advance development phases.

**12/13 explicit local criteria pass (92.3%). Day 6 is NOT LOCALLY COMPLETE.**
The persistent functional slice passes; exact original Figma visual/motion parity
does not. This is an equally weighted checklist for the latest Day 6 attachment,
not overall MVP completion or the original roadmap's complete Gate A.

## Scope reconciliation

Read `CONTINUE_HERE.md`, `REPAIR_20261012.md`, `DAY5_COMPLETION.md`,
`DAY5_AGREEMENT_BASIS.md`, the Day 5 handoff, `MVP_PLAN.md`, `DATABASE.md` and
the existing API/security contracts. There was no standalone Day 6 plan.
The new instruction prioritizes corrections, withdrawal and a private persistent
Passport. This delivers that slice without inventing public disclosure rights.

The roadmap groups Days 5–6 and includes a broader evidence/assertion chain,
independent case review, authority-fraud suppression and sharing grants. Those
are **not implemented** by this private work-history adapter. Gate A as a whole
therefore remains open. Ordinary authority departure does not rewrite truthful
historical confirmations; that follows `DATABASE.md` §2. Retraction of one's own
verification is not independent dispute adjudication. No simulated browser data
or company label establishes a legally verified employer or real human review.

## Acceptance checklist

| ID | Criterion | Result and evidence |
|---|---|---|
| D6-01 | Contracts and denial-first tests before protections | PASS — `DAY6_RECORD_INTEGRITY_CONTRACT.md`, `DAY6_PASSPORT_ELIGIBILITY.md`; real PostgreSQL RED run: all 11 original tests failed before the new migration existed |
| D6-02 | Authorized, reasoned permanent withdrawal | PASS — active owner only, optimistic version/state/content/evidence checks; owner can withdraw after authority departure; alternate actors denied; old direct revise/reopen paths cannot bypass withdrawal |
| D6-03 | Immutable evidence, decisions, integrity events and audit | PASS — original rows retained; append-only reason/actor/time events and actor-scoped receipts; FORCE RLS and immutable triggers; historical decisions visibly labeled as not current after supersession/withdrawal/retraction |
| D6-04 | Corrections create fresh immutable agreement-bound revisions | PASS — worker reason, existing Day 5 validator, unchanged root parties, exact effective agreement; old revision superseded, no inherited decision, fresh independent verification needed; replaced basis rejects stale corrections |
| D6-05 | Replay, duplicate and conflicting command safety | PASS — changed key reuse rejected; one audit for concurrent duplicate withdrawal; real PostgreSQL correction/verification, withdrawal/correction, withdrawal/verification and waiting-retraction/revocation races |
| D6-06 | Identity, participant authority and tenant isolation preserved | PASS — unauthenticated, forged fields, foreign actor, worker self-retraction, alternate representative, revoked/expired authority and suspended owner denials; original MFA/auth/authority tests still pass |
| D6-07 | One backend eligibility policy | PASS — `private.passport_eligible(uuid,integer)` checks current verified version, exact independent decision/both hashes, frozen agreement/consents, authority at verification time, actual evidence snapshot, absence of withdrawal/retraction; all specified noneligible states excluded |
| D6-08 | Persistent authenticated owner-private Passport | PASS — explicit idempotent initialization; no write hidden in GET; persisted owner root and live bounded projection of eligible work; company/agreement/verification references, time, short work summary and evidence count; no raw evidence/reasons/public sharing |
| D6-09 | UI recovery, correction/withdrawal controls and safe detail navigation | PASS — five new browser fixture journeys cover two contexts, refresh, correction/reverification, withdrawal, retraction, empty/offline/expired reads; new real database connection reopens root and immutable correction history; record/agreement links remain authenticated |
| D6-10 | Strict private API and least privilege | PASS — strict Zod input/output, verified nonanonymous user, same-origin writes, bounded JSON, private/no-store, redacted errors and reauthenticated bounded serialization retry; seven new API tests; six Day 6 catalog checks; no client private-helper/table access |
| D6-11 | Regression, real SQL, browser, types, lint and production build | PASS — 169 regression tests, 51 real PostgreSQL executions, 46 browser tests; typecheck/lint/normal Next production build passed; methodology below |
| D6-12 | Preserve repairs, eight migrations, originals and Android | PASS — 93 protected Day 6 manifest files unchanged, plus all 641 protected original-manifest files unchanged; APK hash unchanged; no hosted mutation, deploy, commit, push, reset or clean |
| D6-13 | Exact approved visual/motion parity | OPEN — original/current screenshots inspected; Passport card height corrected; dynamic history and private/empty/error states retained. Original motion, icon/spacing parity and earlier Questions/Agreement adaptations are not certified |

## Implementation and use

One **local-only forward migration**:
`supabase/migrations/202610140003_work_integrity_passport.sql`.
SHA-256: `F24BAE17EA2DC1A1308F4AA3D15125F41BAB5AFE21B5FAFEEDBF1A805F71AD6B`.
The prior eight files are byte-for-byte unchanged.

Three new private tables: immutable `work_integrity_events`, immutable
`work_integrity_receipts`, and owner-only `work_passports`. Corrections reference
both versions; retractions reference the original work decision. A unique partial
index permits one permanent withdrawal per root. Existing state guards extend to
withdrawn/invalidated; legacy command/read bodies are retained as private helpers
with client execution revoked. The public work-command wrapper takes the original
lock order and prevents reopening withdrawn roots. Old revise/reopen clients still
supersede prior verification; the new UI uses reasoned `correct` commands.

`POST /api/v1/work-records/integrity` accepts only withdraw/correct/retract with
exact optimistic guards and an idempotency key. `GET /api/v1/passport` derives the
current user's live projection, 20 entries per page with UUID keyset cursor.
`POST /api/v1/passport` initializes that user's persistent Passport explicitly.
No owner/company/status/actor or public selector is accepted from the client.
The read projection omits raw evidence, verification reasons, contacts and offer
source/salary. No file upload, skill certificate or recipient grant is issued.

Local configured journey: independently confirm a Day 4 agreement; create and
submit a Day 5 record; designated representative verifies that exact revision;
worker opens `/app/passport` and chooses **Create private Passport**. Subsequent
reads recover from the database. Open a record to correct, withdraw, or retract
one's own verification. Correction removes it until the new revision is submitted
and independently verified. Withdrawal is permanent for that record root.
The existing Share screen still cannot create/copy a link; the Passport is private.

## Fresh verification and exact commands

Run from `C:\Users\vehiv\Desktop\fairwork` unless stated otherwise.

| Command | Result / durable evidence |
|---|---|
| `npm test -- --reporter=default --reporter=json --outputFile=test-results/day6-regression-results.json` | PASS: 169 tests, 21 files; nine real-PostgreSQL-only tests skipped here and passed below |
| `node scripts/test-day6-postgres.mjs` | PASS: 18/18; `test-results/day6-postgres-1791987581516/tests.log` |
| `node scripts/test-day5-postgres.mjs` | PASS: 20/20 **with the new Day 6 migration included**; `test-results/day5-postgres-1791986641468/tests.log` |
| `node scripts/test-day4-postgres.mjs` | PASS: 13/13 original agreement tests; `test-results/day4-postgres-1791986748994/tests.log` |
| `npm run test:e2e:isolated` | PASS: 46/46; `test-results/day6-browser-final.log`; includes five Day 6 journeys and three mobile Chromium tests |
| Normal Next production build, run by the isolated browser script | PASS: `test-results/day6-production-build-final.log`; dynamic API routes retained, no static export |
| `npm run typecheck` | PASS: Next route generation and TypeScript |
| `npm run lint` | PASS: zero errors/warnings |
| `npm run doctor` in `mobile/poc` | Expected exit 1: no usable test device; `test-results/day6-android-doctor.json` records inventory |

Real database runs use disposable native PostgreSQL 18.4, loopback only, restricted
migration/execution roles and synthetic JWT claims. Clusters were stopped by their
runners. Total **51 real SQL test executions** includes scenarios overlapping the
embedded regression suite; do not add these numbers as unique tests. Day 6's four
real-only tests cover new-session recovery, observed advisory-lock revocation,
three conflicting command pairs and concurrent duplicate withdrawal.

Browser success responses are **transport fixtures**, never production mocks.
They prove navigation/forms/recovery/layout and request contracts, not hosted Auth,
PostgREST or real independent humans. Real database journeys run through the actual
SQL RPCs. A live browser → Supabase Auth/PostgREST → database journey remains a
hosted/local-stack integration gate; it was not silently treated as tested.

RED evidence: `test-results/day6-postgres-1791985788345/tests.log` (11/11 failed
before implementation). Intermediate failures were resolved: least-privilege
owner-lock helper called an unavailable identity helper; native pg returned a
fixture bigint as text; an API error fixture expected a known-code mapping for an
unknown message; stale browser review needed a fresh reason after reload.
Sandbox-only EACCES/Next path/Vitest temp-file failures were rerun with approval
outside the sandbox. First browser attempt was 45/46; preserved in
`day6-browser-first.log`. The final run is 46/46. Do not cite failed attempts as passes.

## Visual evidence and carried gates

Reference: `C:\Users\vehiv\Downloads\Untitled\09-Work-Passport.png`, 390×844.
Unmodified copy: `test-results/day6-visual/original-work-passport.png`.
Current captures: `390-passport.png` (390×844), `378-passport.png` (378×744),
`320-passport.png` (320×844), and `320-expired.png`, in that same evidence folder.
`index.html` presents original/current at native width. All populated current
screens use clearly documented test fixtures. No user work was fabricated.

Reused existing background, navy gradient hero, avatar, frosted cards, Manrope,
blue action and bottom navigation. Scoped CSS restored a 200px border-box hero,
52px avatar, readable type/rows and wrapping at 320px. Browser checks found no
horizontal overflow. Review/reload remains reachable by scrolling above the fixed
action area; the additional history details and private-sharing notice change
the original content density. The Demo control, role/skill content adaptation,
check glyph, exact colors/shadows and motion are not claimed pixel-identical.

The original's 73% progress and sample skill claims are deliberately not applied
to real work records. A count of eligible loaded records and explicit private
status replace unsupported metrics. This is the original roadmap D-07 content
exception, not certification of complete visual parity.

Earlier gates remain separate and unchanged: **Day 3 12/13 (D3-13 open), Day 4
11/12, Day 5 12/13**. Questions/Agreement editor density and exact motion remain
open. The prototype recording has incomplete opening coverage and conflicting
1800ms/2000ms Splash references; no new timing proof was produced in Day 6.

## Hosted, release and Android blockers

No hosted Supabase read/write/migration, deployment, commit or push was performed.
Before any approved hosted rollout: identify the actual target and migration
history; review queued forward migrations and hashes, ownership/grants, backups
and restore plan; run the restricted-role preflight/catalogs; then verify schema
cache, independent Auth/MFA sessions, expiry/revocation, denial/race tests and the
real browser journey. Local PG 18.4 does not prove hosted PostgreSQL compatibility.
There is still no verified production HTTPS URL.

Public/named-recipient sharing, case/fraud adjudication, skill assertions and
secure file uploads are deferred, not fake enabled controls. Before production
load readiness, add bounded history/event pagination and query-plan/load checks:
Passport/list pages are bounded, but authorized work detail returns its history.

Original APK: `mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk`,
4,120,514 bytes; SHA-256
`1076209E7B023D70A788A1071490269B91FCEEE102E1261B6FA8959BC14FBFB6`.
It was built/signature-verified earlier. **No APK built or installed in Day 6.**
Fresh doctor: Studio/SDK platform 36/Build Tools 35/JDK 21/ADB available;
**zero authorized devices**. Existing `Medium_Phone_API_37.0` AVD lacks the emulator
hypervisor driver. Debug-only localhost HTTP exception and disabled release
variant are unchanged. Browser mobile tests do not establish native WebView,
Android back button, cookie, keyboard or offline behavior on an installed APK.

## Exact Day 7 plan — not implemented

1. Close the carried visual gate first: compare original exports/recording with
   populated live screens at 390×844 and 378×744; document justified dynamic
   content, fix remaining spacing/icon/fixed-action defects and capture timing.
   Keep a gate open where the source cannot establish the original behavior.
2. Reconcile roadmap B06/B07 and `DATABASE.md` with the private adapter: define
   typed work-decision/assertion and authority-case targets, conflict rules,
   accepted independent reviewer assignment, suppression and terminal revocation.
   No broad generic target JSON, self-review or invented human reviewer.
3. Write failing denial/race tests for case opening versus verification/sharing,
   self/conflicted/unassigned/expired reviewers, revoked authority, duplicate
   resolution, stale revisions and no resurrection after terminal revocation.
   Privileged case operations retain protected capability plus aal2 requirements.
4. Add a forward migration and minimal protected commands only after those tests;
   connect case/fraud suppression to the existing authoritative eligibility
   function. Preserve the distinction between ordinary employment departure and
   retrospective invalidation. Reconcile skill mapping before issuing assertions.
5. Integrate minimal original-style case/status controls and one reproducible
   worker → representative → private Passport journey. Label simulated reviewer
   tests honestly; real cases remain unresolved without an independent reviewer.
6. Run database/API/browser/type/lint/build and visual gates, update the manifest
   and handoff. Keep named-recipient curation/field registry/expiry/revoke for the
   roadmap's later disclosure gate; no public sharing, uploads or unrelated work.

First next action is the visual gate review; no Day 7 implementation was started.
The deadline is unchanged. The remaining full Gate A trust/disclosure work is a
schedule risk, not permission to weaken checks or claim the broader MVP complete.
