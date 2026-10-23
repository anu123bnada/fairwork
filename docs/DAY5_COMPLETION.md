# Development Day 5 — verified work and private text evidence

October 14, 2026, Asia/Colombo. Deadline: **October 23, 19:00 Sri Lanka**.

**The local persistent vertical slice is implemented and functional checks pass.
Day 5 is NOT marked LOCALLY COMPLETE: exact visual parity remains open.**
No hosted Supabase change, migration application, deployment, commit or push.

## Scope and acceptance

The request expands the original Day 5 draft/version/submit plan to include
independent verification and persistent text evidence. This was reconciled before
implementation in `DAY5_AGREEMENT_BASIS.md`. File storage, typed skill issuance,
case adjudication and Passport curation/sharing remain distinct capabilities.

| ID | Criterion | Evidence / result |
|---|---|---|
| D5-01 | Effective agreement basis contract, immutable historical binding | PASS — contract plus six-column agreement FK; real DB pending-amendment/changed-effective-basis test |
| D5-02 | Denial tests before implementation | PASS — 15/15 failed on real PostgreSQL before the new RPCs existed; preserved `day5-postgres-1791966922423/tests.log` |
| D5-03 | Persistent draft/revise/submit/reopen/history | PASS — immutable payloads, guarded states, previous/current same-parent FKs; new database session reads saved text/hash |
| D5-04 | Private persistent evidence with ownership/provenance/replacement history | PASS for text — DB UUID/owner/time, canonical evidence hash, immutable old sets; unrelated and pre-submit representative reads denied |
| D5-05 | Exact parties, no self-verification, current authority | PASS — forged worker/company/revision, private draft, other participant, worker-company-member self-verification, revoke/reapprove and natural expiry denials |
| D5-06 | Independent exact-revision outcomes and receipts | PASS — verified/disputed/rejected; exact record/evidence hashes; one immutable decision per version; no client badge/status mutation |
| D5-07 | Atomic replay, stale/conflict and real concurrency | PASS — competing decisions yield one success; committed revocation while verification waits yields no decision/audit; stale basis requires fresh work revision |
| D5-08 | Strict authenticated API and least-privilege SQL | PASS — six API tests; nine catalog checks; FORCE RLS, restricted owners/EXECUTE, private/no-store, CSRF and bounded reauthenticated retries |
| D5-09 | Real Work Record UI, recovery and authorized actions | PASS — five browser fixture journeys; save/refresh, independent contexts, explicit sharing, dispute/reopen, stale/retry/offline/expiry; no production fixtures |
| D5-10 | Work Passport read contract without invented history | PASS for contract — exact projection and exclusions in basis document; Passport UI remains unissued preview; Day 6 dependencies below |
| D5-11 | Regression/type/lint/build verification | PASS — results below; skipped tests explicitly run on real PostgreSQL |
| D5-12 | Preserve earlier fixes, migrations, assets and Android project | PASS — protected hash comparison, seventh migration and existing APK hash unchanged; no Android regeneration |
| D5-13 | Demonstrate exact approved visual/motion parity | OPEN — original PNGs inspected; five-row and populated screenshots at 390/378/320; Work Record dimensions corrected, but full dynamic-detail and motion parity unproven; earlier D3-13/D4-12 remain open |

**12/13 equally weighted criteria = 92.3%.** This is a Day 5 checklist percentage,
not overall delivery progress. Hosted and native installation are separate gates.

## Delivered behavior and contracts

- `/app/work-record` lists authorized persisted records, with pagination. Select
  a record or use `/app/work-record?workId=<uuid>` in another authenticated session.
- **Log work → load effective agreement ID → role/period/hours/tasks/text evidence
  → save private draft → explicit sharing → submit.** The designated representative
  opens the participant link, reviews the exact submitted data, enters a reason
  and independently verifies, disputes or rejects. Worker cannot use those actions.
- Editing a draft appends a new immutable version. Reopening a submitted or
  decided record supersedes it and creates a new private draft; previous decisions
  remain historical and cannot make the new revision verified. Text replacement
  and removal follow the same version boundary, with audit and receipt.
- A pending agreement amendment leaves the previous effective basis intact.
  A newly effective revision blocks old pending work decisions. The worker must
  explicitly load that agreement basis and reopen into a new work revision.
- Exact role, hours, tasks and text evidence are attributed claims. Verification
  is the designated counterparty's decision, not legal employer accreditation,
  an AI finding, a skill certificate or an independently observed file artifact.
- Additive `/api/v1/work-records` GET list/read and POST discriminated commands;
  `/api/v1/work-evidence?evidenceId=<uuid>` private text retrieval. These adapters
  preserve old API paths. No service-role credential or direct table path exists.

Database candidate: `supabase/migrations/202610140002_work_records.sql`.
SHA-256: `75E2DC2B1CB84068C9525BCB27F267CE253FE88FA0D321B12160D2389843B10D`.
All seven earlier migrations remain unchanged. The new migration has only run
against disposable local test databases, under the existing restricted fixture
migration role. Its supporting grants do not alter managed Auth ownership/ACLs.

Five private FORCE-RLS tables: roots, immutable work versions, evidence,
independent decisions and actor receipts. Database canonical JSONB SHA-256 binds
exact agreement, text evidence and provenance. Participant/profile locks,
membership lock, agreement key 4 and work key 5 serialize intersecting writes.
Current authority expiry is checked against database wall time after locks.
Audit contains field names and IDs, not private evidence text. Commands use the
existing write quota; reads use the existing shared identity-read quota.

## Fresh verification

| Command | Result and limits |
|---|---|
| `npm test -- --reporter=default --reporter=json --outputFile=test-results/day5-regression-results.json` | **148 PASS, 5 explicitly skipped PostgreSQL-only cases**, 19 files; unit/API/PGlite, synthetic identities |
| `node scripts/test-day5-postgres.mjs` | **20/20 PASS**, real PostgreSQL 18.4, including conflict/revocation concurrency and new connection recovery; `test-results/day5-postgres-1791968478474/tests.log` |
| `node scripts/test-day4-postgres.mjs` | **13/13 PASS**, original real PostgreSQL agreement suite; `test-results/day4-postgres-1791968409733/tests.log` |
| `scripts/day5-catalog.sql` through the DB suite | **9/9 PASS**; grants, ownership, immutable guards and typed/deferred FKs |
| `npm run test:e2e:isolated` | **41/41 PASS**, including five Day 5 transport-fixture tests and three mobile browser tests |
| Final affected-browser rerun after last spacing correction | **5/5 PASS** through `node test-results/day5-browser-focused.mjs`; these overlap the full suite, not five additional tests |
| Normal Next.js production build | PASS; real dynamic server API routes, no static export. Build-time public Supabase config deliberately blank for isolated tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, zero warnings |
| `npm run doctor` in `mobile/poc` | Build prerequisites ready; exits 1 for installation gate: zero authorized devices, emulator hypervisor driver absent |

The 20/13 PostgreSQL totals overlap their PGlite cases; do not add them as unique
regressions. SQL uses real row/advisory locks and local synthetic JWT claims. Browser
success sessions use labeled transport fixtures. Neither proves hosted Auth,
PostgREST schema exposure, real human independence or Android WebView behavior.
All disposable clusters were stopped by their runners.

Initial sandbox runs failed on loopback EACCES, Vitest temporary-module ENOENT,
Next.js Windows path access, and ADB visibility. Approved reruns outside the sandbox
are the passing evidence. An expiry fixture originally violated the existing
immutable decision validity constraint; it was corrected to use an actual short
approval and wait for natural expiry. No constraint was weakened. A React ref
render lint error was fixed using state. Earlier failed runs are not counted.

Full browser/build logs: `test-results/day5-browser-final.log` and
`day5-production-build-final.log`. Source snapshot and hash comparisons:
`test-results/day5-preservation-20261014/`: **641/641 protected original files unchanged**;
the seventh migration is separately unchanged. The final focused log/build captures
are separate so they do not overwrite the full-suite evidence.
Their filenames are `test-results/day5-browser-focused-final.log` and
`test-results/day5-production-build-focused-final.log`. A side-by-side gallery
is saved at `test-results/day5-visual/index.html`.

## Visual evidence and remaining local gate

References inspected: `C:/Users/vehiv/Downloads/Untitled/08-Work-record.png`
and `09-Work-Passport.png`, both 390×844, plus existing local Figma styles/assets.
The original recording and earlier comparison inventory remain untouched.

Captures: `test-results/day5-visual/390-five-rows.png`, `378-five-rows.png`,
`320-five-rows.png`, `390-verified.png`, `378-verified.png`. Browser tests verify
no horizontal overflow. The populated five-row capture is a **test fixture**, not
five actual user records. The first pass revealed undersized typography/rows;
the second revealed content-box padding enlarging the summary. Both were corrected
with scoped CSS. Header, navy summary, frosted weekly card, green/pending bars,
blue action and bottom navigation reuse the original design components.

The original total includes pending hours; the live summary explicitly counts
verified hours only among loaded records. Actual dates, pending/verified labels,
private editing and detailed consent/receipt states are necessary real data
states. They are not presented as pixel-identical original frames. No animation
choreography proof was produced for these additional states. Earlier Questions/
Agreement density and motion gates remain open. Do not mark any of these passed
because the functional tests or preserved asset hashes pass.

## Hosted, storage and Android gates

Hosted migration history/target/queue/hash/recovery review requires explicit owner
approval, followed by hosted catalogs, PostgREST schema-cache/grant verification,
real independent session/Auth/MFA/expiry checks and concurrency/negative tests.
Do not run a hosted push from this document. There is still no verified production
HTTPS URL. File uploads are blocked until private storage, MIME/size validation,
server-authorized signed access and provenance/integrity are implemented and tested.
The text slice does not display a pretend upload control.

Before production-scale use, add bounded history pagination and load tests: the
record list is paginated, but an authorized detail read currently returns all
revisions. This local vertical slice is not a claim of production load readiness.

Existing APK remains 4,120,514 bytes, SHA-256
`1076209E7B023D70A788A1071490269B91FCEEE102E1261B6FA8959BC14FBFB6`.
It was generated and signature-verified earlier. **No APK was built or installed
in Day 5.** Studio/SDK 36/Build Tools 35/JDK 21 and ADB are available; ADB lists
zero authorized devices. Existing AVD `Medium_Phone_API_37.0` cannot run without
its missing hypervisor driver. Debug localhost-only HTTP exception and disabled
release variant are unchanged. Native Back, cookies, keyboard, offline WebView
and authenticated API sessions still require actual installation and testing.

## Changed files and exact Day 6 starting point

New: migration; `features/work/schema.ts`; `server/work.ts`; the two API route
files; `components/fairwork/work-record.tsx`; Day 5 DB/API/browser tests;
`scripts/test-day5-postgres.mjs`, `scripts/day5-catalog.sql`; these contract and
completion documents. Extended existing database transport types, bounded sign-in
selection, product Work Record wiring, agreement navigation, scoped `visual.css`,
two old empty-state browser expectations and the continuation entry point.
Original auth implementation, prior migrations, Android project and Figma assets
were not replaced.

**Before closing Day 5:** finish/document the exact visual and motion comparison,
including the carried Day 3/4 gaps; local functionality alone does not close it.

**Day 6 first implementation task:** define and write denial-first tests for
typed work-decision eligibility, withdrawal/correction, authority-fraud suppression
and independently assigned case review. Use `(work_id, version)` and the immutable
work-decision ID; never a caller-supplied generic evidence target. Reopening already
supersedes a record, but no durable skill assertion, review case or public Passport
grant is issued by Day 5. Reconcile these tables with DATABASE.md's evidence chain
before the next forward migration. Test atomic suppression during correction,
stale decisions, self/conflicted reviewers and concurrent withdrawal. Then implement
the owner-private verified-history projection described in the basis contract,
followed by explicit Passport curation/field registry/named-recipient grants only
after those eligibility tests pass. No Day 6 implementation was started here.
