# Development Day 4 — completion evidence

Updated **October 14, 2026, Asia/Colombo**. Deadline: **October 23, 19:00 Sri Lanka**.
Calendar dates do not advance development phases. The latest user instruction
explicitly authorized Day 4 in parallel with the remaining Day 3 visual gate.

**A real, persistent local agreement slice is implemented. The complete Day 4
checklist is 11/12 (91.7%); NOT marked LOCALLY COMPLETE because exact original
visual parity remains open.** This percentage is the equally weighted checklist
below, not overall MVP progress. Hosted and native-device gates are separate.
No hosted data or schema was modified; no deployment, commit or push occurred.

## Explicit acceptance and evidence

| ID | Acceptance criterion | Result and concrete evidence |
|---|---|---|
| D4-01 | Reconcile the existing Day 3/API/DB contracts without upgrading old consent | PASS — `DAY4_AGREEMENT_COMPATIBILITY.md`, `DAY4_AGREEMENT_CONTRACT.md`; existing six migrations/legacy RPCs unchanged |
| D4-02 | Worker-owned private draft, explicit designated representative and proposal sharing | PASS — SQL draft privacy, employer/other-member denial; browser creates draft from saved offer, checks sharing before proposal |
| D4-03 | Immutable canonical terms and exact source/question/answer binding | PASS — new composite source/participant/authority FKs, frozen IDs/text/attribution/UTC timestamps; changed source/answers require a new version; strict API rejects caller answer/identity substitutions |
| D4-04 | Independent exact unresolved acknowledgements | PASS — persisted actor/version/content/item-set hashes; missing/extra/duplicate/stale ID sets denied; empty set succeeds only when truly empty; confirmation requires the actor's persisted acknowledgement |
| D4-05 | Current designated authority, self/cross-company/participant denials, suspension and expiry | PASS — same-company alternate representative, separately approved foreign-company representative, revoked/reapproved/expired authority, suspended participant; authority operator commands retain aal2/capability requirements |
| D4-06 | Authoritative state machine and effective pointer | PASS — draft/proposed/confirmed/declined/superseded; required-answer gate; old effective pointer survives amendment; only two exact independent confirmations advance it; terminal decline and deferred pointer checks |
| D4-07 | Immutable receipts and audit; reauthorized idempotent retry | PASS — actor-scoped request key/hash, original database-time receipt on replay, no duplicate audit; changed input/key conflict denied; transaction rollback protects partial writes |
| D4-08 | Strict authenticated transport and restricted database execution | PASS — two additive RPCs, strict input/output schemas, Origin checks, private/no-store, safe errors, bounded deadlock/serialization retry with reauthentication; nine catalog assertions |
| D4-09 | Existing visual components support review, attribution, recovery and errors | PASS for functionality — saved source fields and canonical terms, proposal/effective history, independent statuses, acknowledgements, sign-in link preservation, stale/network/expiry recovery; four new mocked browser tests |
| D4-10 | Real PostgreSQL concurrency | PASS — independent connections blocked on real advisory locks: concurrent acknowledgements, confirmations, competing amendments; committed revocation while confirmation waits prevents effective agreement |
| D4-11 | Full local regression/build checks and preservation | PASS — results below; 641 protected files unchanged, including original assets, six migrations and Android files; APK hash unchanged |
| D4-12 | Preserve and demonstrate exact original Figma visual parity | OPEN — new 390/378 captures and Home geometry review exist; Questions/Agreement density and motion choreography remain unproven; D3-13 remains open |

No unsupported dispute state, successful AI evaluation, evidence issuance or
native Android compatibility is claimed. Day 5 features were not implemented.

## What was implemented

One additive local migration:
`supabase/migrations/202610140001_versioned_agreements.sql`.
SHA-256: `C8833649E89C7B15E4073404FB71226B7E0B123F7679D94A6B8FFD7D047527CE`.

Five FORCE-RLS tables: agreement roots, immutable version payloads, independent
acknowledgements, independent decisions and actor receipts. Owners remain
NOLOGIN/NOBYPASSRLS; clients receive no table privileges. Membership and source
locks intersect existing authority/offer writers. Participant row locks protect
against account-state writes. New helpers never grant managed Auth access.

The worker edits terms through the existing offer revision command, then freezes
the latest saved source as a new agreement version. Designating a replacement
representative creates a new agreement; same-person reapproval needs a new
version. No old personal confirmation is transferred. Proposal shares every
listed source question/answer explicitly. This adapter does not implement an
arbitrary custom-question/subset editor; the difference is documented rather than
silently changing the existing contract.

New endpoint `/api/v1/agreement-workflows` exposes strict create/amend/propose/
acknowledge/decide commands and participant reads. This preserves the occupied
legacy `/api/v1/agreements` and `get_agreement` contracts. UI entry: open a saved
offer's Agreement page as its worker, expand **Create a versioned agreement**, and
select the agreed representative ID. The server verifies authority. New screen:
`/app/agreement-workflow?workflowId=<uuid>`; the identifier grants no access.

New files: migration; `workflow-schema.ts`; `server/agreement-workflow.ts`;
`api/v1/agreement-workflows/route.ts`; `components/fairwork/agreement-workflow.tsx`;
`day4-workflow-api.test.ts`, `day4-agreement-db.test.ts`, `day4-workflow.spec.ts`;
`tests/local-postgres.ts`; `scripts/test-day4-postgres.mjs`, `day4-catalog.sql`;
contract/completion/Day 5 plan documents.

Existing files extended: database transport types; bounded participant-path and
secure sign-in return handling; product route allowlist and existing product
screen wiring; `visual.css`; handoff/phase evidence docs. Existing working
components, backend RPCs, Figma assets and Android project were not replaced.

## Verification performed in this run

| Command / evidence | Result and limits |
|---|---|
| `npm test -- --reporter=default --reporter=json --outputFile=test-results/day4-regression-results.json` | **125 PASS, 2 explicitly skipped PostgreSQL-only race cases**, 17 files; these two run below, not simulated in PGlite |
| `node scripts/test-day4-postgres.mjs` | **13/13 PASS** on a new real PostgreSQL cluster; includes the 11 Day 4 database cases and 2 multi-connection cases |
| `scripts/day4-catalog.sql` through both DB runners | **9/9 PASS**: RLS/owner, client table denial, RPC owner/path/EXECUTE, private helper denial, role privileges, immutable/deferred guards and typed FKs |
| `npm run test:e2e:isolated` | **36/36 PASS**, Chromium; includes four new Day 4 browser tests and existing mobile/browser checks |
| Production build inside that isolated runner | **PASS**, Next.js 16.4 normal server build; no static export; real API routes remain server-side |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS**, zero warnings |
| `npm run doctor` from `mobile/poc` | Build prerequisites available; exit 1 because no authorized device and emulator hypervisor driver missing; inventory only |
| Preservation comparison | **641/641 protected files unchanged** against the Day 3 manifest; `test-results/day4-preservation-20261014/protected-comparison.json` |

Regression JSON: `test-results/day4-regression-results.json`. Browser/build logs:
`test-results/day4-browser-final.log`, `day4-production-build-final.log`.
Final static-check logs: `day4-typecheck-final.log`, `day4-lint-final.log` in the
same folder. PostgreSQL binary reports **18.4**; no hosted version is assumed.
Final real PostgreSQL evidence: `test-results/day4-postgres-1791938542965/`
(`initdb.log`, `start.log`, `tests.log`, `server.log`, `stop.log`). The test cluster
was stopped. Data directories contain synthetic fixtures only and remain for
inspection; no Windows service was installed.

The portable PostgreSQL runtime/client are isolated in
`test-results/day4-postgres-tools`, outside application dependencies. Reproduce:

```powershell
npm install --prefix test-results/day4-postgres-tools --ignore-scripts --no-audit --no-fund --save-exact @embedded-postgres/windows-x64@18.4.0-beta.17 pg@8.23.1
node scripts/test-day4-postgres.mjs
npm test -- --reporter=default --reporter=json --outputFile=test-results/day4-regression-results.json
npm run typecheck
npm run lint
npm run test:e2e:isolated
```

The runner starts only a newly initialized loopback cluster, uses a random port,
checks the `fairwork_day4_disposable` cluster marker and stops its own server.
It does not consume a hosted connection string. Binary provenance:
[embedded-postgres](https://github.com/leinelissen/embedded-postgres).

Initial failures were not counted as passes: Windows sandbox denied Next path
canonicalization, Vitest temporary modules, ADB and local PostgreSQL sockets;
approved reruns resolved those environment limitations. A revocation test first
sent an expiry where the existing revoke contract requires null; fixture fixed.
The first concurrency harness read transaction-cached activity; replaced by live
`pg_locks` assertions. Browser runs found an actual Home greeting/avatar hit-target
overlap (fixed) and ambiguous status/alert locators (scoped, not removed).

## Visual and Android evidence

Fresh populated Day 3 captures are in `test-results/day3-visual/after/` at
390×844 and 378×744. Original Home PNG was compared with the fresh 390 capture:
bell/avatar/greeting positions restored; truthful live content still differs in
card density from the sample. The navigation test caught and now verifies the
avatar hit-target repair. Questions/Agreement functional adaptations and exact
motion timing remain open in `DAY3_VISUAL_GATE_20261013.md`.

Day 4 full-page captures: `test-results/day4-visual/390-confirmed.png` and
`378-confirmed.png`. These use synthetic browser transport fixtures, not live
Supabase sessions or a new approved Figma frame. Glass, gradients, typography,
cards and mobile navigation reuse the original application styling. They do not
prove exact Figma or Android-device parity.

Existing APK remains **generated, not installed**; no new APK was built this turn.
`mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk`, 4,120,514 bytes,
SHA-256 `1076209E7B023D70A788A1071490269B91FCEEE102E1261B6FA8959BC14FBFB6`.
Capacitor 8.5.3, Android project, loopback-only debug HTTP exception and release
guard are unchanged. Doctor: Java 21 compatible, SDK platform 36/build tools 35
available, ADB available, **0 authorized devices**, AVD `Medium_Phone_API_37.0`,
hypervisor driver absent. Physical testing remains postponed.

## Hosted gates — not performed

1. Inspect the actual target/history and recovery plan; do not blindly replay all
   migrations. Required order is the existing six (`202610070001`,
   `202610080002`, `202610090001`, `202610090002`, `202610100001`,
   `202610120001`) then `202610140001`. Apply only the reviewed missing queue,
   after explicit approval and verifying exact hashes.
2. Run prior preflight/catalog checks and `day4-catalog.sql` on the approved
   target; verify hosted PostgreSQL version and restricted migration privileges.
3. Test actual separate synthetic Supabase sessions, JWT/cookie expiry, TOTP MFA,
   representative revoke/reapproval and direct-RPC denials. Local SQL uses
   synthetic JWT claims and local Auth fixture functions; browser success uses
   transport fixtures. Neither proves live GoTrue, PostgREST or cookies.
4. Repeat race checks against that approved environment and verify service/anon
   denial, effective pointers and immutable receipts there.
5. Approve HTTPS hosting before packaging a release Android origin, then install
   the exact APK and verify startup/auth/MFA/back/offline behavior on a device.

Commercial hardening still includes a reviewed bounded history/pagination and
retention policy before large-scale usage. No public, paid or production-ready
launch is implied by this local slice.

## Exact next action

Close D3-13/D4-12 with the supplied visual references and explicit evidence;
do not relabel it as hosted-only. The prepared Day 5 starting task is the typed
Work Record agreement-basis contract and deny tests in
`DAY5_IMPLEMENTATION_PLAN.md`. No Work Record or Passport evidence may be issued
from legacy confirmations, browser storage or preview status.
