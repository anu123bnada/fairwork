# Persistent Work Record and Work Passport sprint

Deadline: **23 October 2026, 19:00 Sri Lanka time**. All times below are
Asia/Colombo. This is an implementation plan, not evidence that persistence exists.
Schedule correction: October 13 is still **DEVELOPMENT DAY 3**. Dates below are
delivery targets, not development-day labels and never evidence of completion.
The current phase and entry gate are in `DAY3_COMPLETION_20261013.md`; the next
implementation phase is `DAY4_IMPLEMENTATION_PLAN.md`. Android physical-device
testing is postponed. Preserve the generated APK/project while completing Day 3.

## Scope and prerequisite

One synthetic manual offer → exact two-party agreement → worker work submission →
independent counterpart decision → typed evidence → private passport → one named
recipient → revocation. Retain cases, frozen authority, deny tests and recovery.
Exclude AI, OCR/uploads, matching, notifications, public/bearer links, ratings,
payment, offline writes and new trust categories. Existing preview content must
remain labelled until its backend gate passes.

**Do not create work evidence directly from the current Day 3 UI status.** Current
`private.day3_*` tables are a smaller manual slice, whereas DATABASE/API describe
full versioned agreements. First reconcile the immutable effective version,
designated representative and authority-decision key, exact unresolved-item
acknowledgements, and source/answer-reference hash. Use additive reviewed
migrations/adapter contracts; preserve all six existing migrations byte-for-byte.
Do not silently treat old confirmations as confirmations of newly added content.

## Dated delivery gates

| Due | Deliverable / exact work | Required acceptance |
|---|---|---|
| Oct 13, 18:00 | Finish Android POC evidence and select eventual HTTPS hosting/package ownership; agree the agreement-version adapter contract | Honest APK/install report; no static-export/security shortcut; owner action list for missing infrastructure |
| Oct 14, 18:00 | Agreement prerequisite: additive version/acknowledgement/reference binding in `supabase/migrations/<new>_agreement_context.sql`; schemas in `src/features/offer`, typed RPCs and API adapter | Old repaired behavior passes; each participant confirms the exact same immutable context; stale answer/hash/authority denied; old confirmations never carried forward |
| Oct 15, 18:00 | Work persistence: new work migration; `src/features/work/schema.ts`, `src/server/work.ts`, database types; create/read/list/correct/submit routes from API.md | Refresh/reopen restores DB truth; composite subject/parent/authority FKs; immutable versions; worker-only draft; frozen eligible counterpart sees submitted version only |
| Oct 16, 18:00 | `decide_work`, private `issue_work_evidence`, evidence/skill/assertion rows and read DTOs | One counterpart decision per version; no self-confirmation; one transaction for confirmation and evidence; idempotent retry reauthorizes; stale authority/hash/revision fail |
| Oct 17, 18:00 | Work/agreement/authority cases, withdrawal/correction, assertion suppression and terminal revocation | Open case immediately suppresses badges/projections; corrections revoke old evidence in transaction; case dismissal cannot resurrect revoked assertion; scoped reviewer MFA/conflict rules |
| Oct 18, 18:00 | Private passport, item curation, field registry, frozen named-recipient grants, common owner/recipient projection function | Gate A: complete persisted trust chain + negative/concurrency tests; no private terms, answer text or raw employment material in recipient DTO; expiry/revoke effective immediately |
| Oct 19, 18:00 | Wire existing Work Record, Passport and share Figma components to real endpoints; pending/error/retry/empty states | Explicit synthetic journey in two independent sessions; refresh and app restart recovery; no fabricated counts/badges; preview buttons replaced only for implemented paths |
| Oct 20, 18:00 | Owner-approved hosted migration/deployment window and Android HTTPS packaging; otherwise document external blocker | Verify target/history/hashes/backups before asking final approval; hosted catalogs, RLS/direct-RPC denials, real two-party auth and Android cookie/MFA tests |
| Oct 21, 18:00 | End-to-end Android and browser regression; concurrency, revoke-during-read/write and restore/reseed rehearsal | Gate B: full journey and denials pass on hosted PostgreSQL and installed APK; no mock reported as live; device/version/APK hash evidence saved |
| Oct 22, 18:00 | Feature freeze, fix only release blockers; package review and reproducible demo script | Signed candidate and exact backend/migration versions; no secrets or real employment data; offline and recovery honesty; all unresolved limitations recorded |
| Oct 23, 16:00 | Final rehearsal and artifact verification | Install exact candidate, repeat saved workflow and revocation; checksum/installation notes; preserve 3 hours until 19:00 deadline for delivery problems |

If a date has already passed when resuming, treat its item as overdue; do not mark
it complete or move the final deadline. If Gate A fails, stop breadth and disclose
the schedule risk. Never cut authority, evidence integrity, revocation, private
projection or denial coverage to meet the deadline.

## Concrete data and API implementation checklist

1. `work_records`, `work_record_versions`, `work_confirmations` exactly bind the
   worker/company/agreement version/representative/authority decision. DB time,
   expected revision, canonical hash and unique decision govern transitions.
   Changing representative requires a new agreement and work root; reapproval
   requires new agreement/work versions; never reassign historical decisions.
2. Routes: `POST /api/v1/work-records`, `GET /api/v1/work-records/{id}`,
   `GET /api/v1/me/work-records`, and POST version/submit/confirmation/withdraw
   actions. Follow API.md's RPC names; use strict Zod inputs/outputs, request IDs,
   origin checks, private/no-store, bounded inputs, quota and actor-scoped receipts.
3. `skill_evidence`, `evidence_skills`, `work_verification_assertions` issued only
   by private internal function after authorized confirmation. Use exact typed
   immutable basis, task references and deployment-curated skill definitions.
   No public/client EXECUTE grant on issuance. Later employment departure blocks
   new actions but does not by itself rewrite a historically truthful assertion.
4. Cases and corrections follow DATABASE.md's target-specific joins, acceptance,
   reviewer conflict/authority rules and terminal revocation. Implement these
   before displaying evidence as share-eligible.
5. `work_passports`, items, registry, item fields, grants, grant items and grant
   fields enforce owner/subject/composite-scope FKs. New items, fields or disclosure
   summaries require new consent/grants. A known recipient ID is an authenticated
   reference, never a bearer credential or account-existence directory.
6. Routes/RPCs: private GET passport, PUT items, POST grants, owner preview,
   recipient shared-passport GET, DELETE grant. `fw_projection_exec` owns the one
   common explicit projection; `fw_user_exec` performs scoped user commands;
   preserve FORCE RLS, empty search paths, narrow grants and no BYPASSRLS.

## Required tests before calling the sprint complete

- Unit contract tests in `tests/unit/work.test.ts` and `passport.test.ts` for
  input/output strictness, error mapping, origin/no-store and hash/revision errors.
- Restricted migration-role SQL tests in `tests/integration/work-security.test.ts`
  and `passport-security.test.ts`: owner, eligible counterpart, worker B, unrelated
  employer, former representative, anon, service_role and PUBLIC effective grants.
  Include direct RPC calls, quotas, immutable guards and composite-FK attacks.
- Two writers: submit/correct vs confirm, authority revoke vs confirm, duplicate
  confirmation vs retry, case open vs confirm/share, grant revoke vs recipient
  read. Repeat on approved hosted PostgreSQL; PGlite alone is not concurrency proof.
- Passport: other owner’s item, arbitrary field, new item/field after grant,
  expired/revoked grant, wrong recipient, owner-preview mode abuse, evidence
  withdrawn/revoked/disputed, zero private-field leakage, identical shared field
  constructors for preview and recipient.
- Browser + installed Android: two independent accounts, restart/reopen,
  sign-out/back, refresh/expiry, MFA elevation, offline denial, interrupted submit
  retry, stale displayed revision, keyboard/back and 320–430px layout. Save the
  test type explicitly: mocked, local SQL, hosted or native.

Migration release remains a separate explicit approval. Prepare exact SQL, hashes,
catalog queries, rollback/recovery decision and target/history evidence first.
No migration, deployment, commit or push is authorized by this plan.
