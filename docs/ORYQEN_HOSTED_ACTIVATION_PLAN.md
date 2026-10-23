# ORYQEN hosted activation preflight — October 16, 2026

**Decision: NO-GO for hosted activation. This is a reviewed local preparation and
read-only inspection, not permission to execute hosted writes.** Deadline remains
October 23, 2026, 19:00 Asia/Colombo. No migration, Auth setting, registration flag,
deployment, commit or push was applied. Original UI, assets and Android are unchanged.

## 1. Target and evidence boundary

The already linked project matches `NEXT_PUBLIC_SUPABASE_URL`; values are redacted.
The SHA-256 project-origin fingerprint in the reports identifies the target without
publishing its URL. Independently compare the intended project in the owner's
Dashboard before any approval. Never relink to make this plan pass.

Fresh read-only history reports exactly four applied versions:
`202610070001`, `202610080002`, `202610090001`, `202610090002`.
All six versions below remain pending, with no unexpected recorded versions.
Evidence: `test-results/hosted-auth-readiness-1792146214082.json`.
History proves version records, **not the original applied file bytes or complete
absence of schema/function/policy drift**. The six local hashes are verified; no
remote checksum for an unapplied file exists. Applied files were not rewritten.

The first live inspection passed 19 baseline catalog assertions:
`test-results/hosted-activation-inspection-1792146791794.json`.
Final expanded checks and verification results are recorded in section 10.
All catalog SQL runs in a read-only transaction and ends in rollback. No application
RPC is called by these inspections: some apparently read-only RPCs write quota rows.

**Backup blocker:** the read-only backup API returned zero listed backups,
`pitr_enabled=false`, `walg_enabled=true`. The latter does not prove an available,
recoverable backup. No restore has been tested. Do not proceed on that assumption.

## 2. Exact migration order and immutable hashes

All files are under `supabase/migrations/`. Each depends on the four foundation
migrations above and the preceding stages; do not skip stages or replay applied SQL.

| Stage | Complete filename | SHA-256 |
| --- | --- | --- |
| 1 | `202610100001_day3_offer_agreement.sql` | `effcd3fe1aabca632f86f383c972a3d44efa4459a6de8c41ed6dafda365b62d6` |
| 2 | `202610120001_agreement_participant_read.sql` | `482e92b957020a87ef65b41574f5be8279e710a0b82f7edb5acd102b2f1d1c2b` |
| 3 | `202610140001_versioned_agreements.sql` | `c8833649e89c7b15e4073404fb71226b7e0b123f7679d94a6b8ffd7d047527ce` |
| 4 | `202610140002_work_records.sql` | `75e2dc2b1cb84068c9525bcb27f267ce253fe88fa0d321b12160d2389843b10d` |
| 5 | `202610140003_work_integrity_passport.sql` | `f24bae17ea2dc1a1308f4aa3d15125f41bab5afe21b5fafeedbf1a805f71ad6b` |
| 6 | `202610150001_work_case_review.sql` | `84051535c9108b9fb388e6b6190ef73181e484a5030ebb897186eaa8e9be2629` |

`node scripts/prepare-activation.mjs` validates these hashes, the four foundation
hashes and the exact ten-file inventory. It generates cumulative staged copies,
read-only SQL, and `test-results/activation-plan/inventory.json` containing literal
table, function, policy and index names. It does not connect to Supabase. A mismatch
is a STOP, not a reason to update a pinned hash without review.

## 3. Migration effects, existing-data risks and recovery

Common boundary: new tables live in `private`, owned by `fw_schema_owner`, with
FORCE RLS; client roles `anon`, `authenticated`, `service_role` receive no direct
table access. Public entrypoints live in `api`, use restricted SECURITY DEFINER
owners and empty search paths, and grant execute to `authenticated`. Temporary
executor schema CREATE grants must disappear at each commit. No new public table,
Auth schema alteration, data deletion, table/column drop, TRUNCATE or data backfill
is executed by these six migration bodies. DELETE/UPDATE text inside function or
trigger definitions is runtime code, not a migration-time data operation.

They are **conditionally compatible with existing data**, not certified safe for
every possible hosted drift/volume. Shared CHECK replacements take locks and scan
existing rows. New indexes/constraints need disk and lock time. Existing records
must satisfy the expected validated constraints; a complete backup-clone rehearsal
and bounded maintenance window remain required. No legacy confirmations are silently
promoted into the new agreement contract.

### Stage 1 — offers and legacy agreements

- Dependencies: profiles, companies, membership decisions, immutable history,
  identity/AAL helpers, authority helpers, audit/quota tables and restricted owners.
- Adds `day3_offers`, `day3_offer_questions`, `day3_offer_answers`, `day3_agreements`,
  `day3_command_receipts`, `day3_effective_agreements`, with typed FKs and unique keys.
- Adds `api.review_offer`, `api.answer_offer_question`, `api.confirm_agreement`;
  private quota, hash/diff/question, company-role and revision/history/effective
  agreement guards (`consume_day3_quota`, `day3_*`).
- Adds six executor table policies, `day3_offer_guard_read`, `audit_day3_insert`
  and three `limits_day3_*` policies. Grants scoped executor SELECT/INSERT/UPDATE
  and policy-executor offer metadata access; guards constrain immutable rows.
- Replaces `audit_logs_action_check`, `audit_logs_reason_code_check` and
  `rate_limit_buckets_operation_check` with expanded value sets. These are the
  destructive DDL operations (constraint replacement), not data deletion.
- Preflight: stage 0 plus foundation preflight and stage-0 constraint fingerprints.
  Postflight: stage 1, constraint-stage-1 and `scripts/day3-hosted-catalog.sql`.
- Recovery: on transaction failure require stage 0/history unchanged; on ambiguous
  completion reconcile stage 0/1 before any retry. Never drop these tables to undo.

### Stage 2 — authorized agreement reopening

- Depends on stage 1 offer/answer/confirmation tables and authorization helpers.
- Adds only `api.get_agreement(jsonb)`, owned by `fw_user_exec`, authenticated-only
  execute; participant scope, current offer recovery and quota consumption remain
  authoritative. No new table/policy/index or existing-row transformation.
- Preflight: stage 1; no pre-existing `get_agreement` collision. Postflight: stage 2
  and `scripts/agreement-read-catalog.sql`. Constraint fingerprints remain unchanged.
- Recovery: failed transaction leaves stage 1; successful function installation is
  retained. Resolve grants/function drift by separately reviewed forward repair.

### Stage 3 — versioned independent consent

- Depends on stage 1 source revisions/answers, stage 2 recovery boundary and live
  representative authority. Adds `agreement_roots`, `agreement_versions`,
  `agreement_acknowledgements`, `agreement_decisions`, `agreement_receipts`.
- Adds `api.agreement_workflow`, `api.read_agreement_workflow`; private
  `agreement_participants_active`, `agreement_lock_participants`,
  `agreement_source_current`, `agreement_hash`, `agreement_freeze`,
  `agreement_guard_version`, `agreement_guard_root`, `agreement_check_pointers`.
- Adds twelve agreement RLS policies, `day4_answer_integrity`, `agreement_audit_insert`;
  strengthens `agreement_root_read`. Immutable consent/receipt and deferred pointer
  guards protect exact versions/hashes and same-parent current/effective FKs.
- Adds policy-executor `day3_offers.term_hash`, selected answer-column reads and
  `profiles.id` UPDATE privilege used for row locking, still constrained by RLS.
  User executor updates only root pointers/published and version state/proposed time.
- Replaces the two shared audit CHECKs, retaining prior allowed values. No upgrade
  of legacy confirmations or existing-row rewrite.
- Preflight: stage 2; postflight: stage 3, constraint-stage-3,
  `scripts/day4-catalog.sql`. Recovery: failure leaves stage 2; do not delete consent
  or downgrade confirmed revisions after successful commit.

### Stage 4 — verified Work Record

- Depends on stage 3 exact agreement basis/consent and live authority. Adds
  `work_records`, `work_record_versions`, `work_evidence`, `work_decisions`,
  `work_receipts`; immutable evidence/decision/receipt and version/root/pointer guards.
- Adds `api.work_command`, `api.read_work`, `api.read_work_evidence`, `api.list_work`;
  private `work_authority`, `work_guard_version`, `work_guard_root`, `work_check_pointer`.
- Adds twelve work RLS policies and `work_audit_insert`; scoped SELECT/INSERT and
  root/version column UPDATE grants. Adds `work_evidence_version_idx`,
  `work_worker_list_idx`, `work_representative_list_idx` plus PK/unique/FK indexes.
- Adds `agreement_work_basis_unique` on existing `agreement_versions`. Its first
  two columns already form the PK, so valid prior rows cannot duplicate this wider
  key; index construction still takes time/space/locks. Replaces two audit CHECKs.
- Preflight: stage 3; postflight: stage 4, constraint-stage-4,
  `scripts/day5-catalog.sql`. Recovery: failure leaves stage 3; no deletion of work
  evidence/decisions after commit. Preserve basis and idempotency receipts.

### Stage 5 — integrity and private Passport

- Depends on all stage 4 work objects. Adds `work_integrity_events`,
  `work_integrity_receipts`, `work_passports`, six integrity/owner policies and
  `integrity_audit_insert`; immutable event/receipt/passport guards; unique indexes
  `work_withdrawal_once`, `work_retraction_once`.
- Moves existing entrypoints into `private.work_command_day5` and
  `private.read_work_day5`, revokes client execute, installs API wrappers. Adds
  `api.work_integrity`, `api.initialize_passport`, `api.read_passport` and private
  `work_lock_owner`, `work_historical_authority`, `work_company_label`,
  `passport_eligible`. Replaces `private.work_guard_version`.
- Expands `work_record_versions_state_check` to include withdrawn/invalidated and
  replaces audit CHECKs. Grants policy executor company-name SELECT; owner Passport
  reads retain exact evidence, consent, historical-authority and current-revision checks.
- Preflight: stage 4, old API functions present, no private wrapper collisions;
  postflight: stage 5, constraint-stage-5, `scripts/day6-catalog.sql` and old-function
  client-denial assertions. Recovery: failure leaves stage 4; after commit, never
  expose old wrappers or remove withdrawal/retraction guards as a rollback shortcut.

### Stage 6 — scoped review and suppression

- Depends on stage 5 Passport predicate/work wrapper, work/evidence/authority and
  capability tables. Creates restricted NOLOGIN/NOBYPASSRLS `fw_review_exec`, granted
  to migration identity `postgres`; no global administrator or new user capability.
- Adds `work_cases`, `work_case_assignments`, `work_case_resolutions`,
  `work_case_events`, `work_case_receipts`; immutable history, guarded revisions and
  indexes `work_case_one_open`, `work_case_target`, `work_case_one_assignment`,
  `work_case_reviewer`, `work_case_terminal_target`.
- Adds `api.work_case_command`, `api.read_work_case`, `api.list_work_cases`; private
  `case_capability`, `case_privileged`, `case_participant`, `case_independent`,
  `case_operator`, `case_reviewer`, `case_visible`, `case_version_access`,
  `work_case_blocked`, `case_lock`, `case_guard`, `case_quota`.
- Adds scoped case/assignment/resolution/event/receipt/work/version and metadata
  policies plus `case_audit_insert`. Policy-executor capability `UPDATE(subject_id)`
  supports locking; `case_capability_lock` has `WITH CHECK(false)` and the immutable
  capability guard remains. Review executor work reads require current scoped access.
- Renames Passport predicate to `private.passport_eligible_day6`, then wraps it with
  case suppression. Moves the prior work wrapper to `private.work_command_day6` and
  guards verification. Private prior entrypoints remain client-denied. Audit CHECKs
  expand. Unresolved cases suppress the work root; non-dismissal resolutions suppress
  the affected revision. Dismissal never overrides independent Day 6 conditions.
- Preflight: stage 5, reviewer role absent, `postgres` can create restricted role,
  old wrapper present and new-name collisions absent. Postflight: stage 6 and
  constraint-stage-6, retained wrapper/suppression/immutable history assertions;
  real role/concurrency behavior is a separate account-test gate.
- Recovery: failure leaves stage 5, including transactional role/grant rollback.
  After commit, never delete cases/receipts or restore an unsuppressed predicate to
  make Passport entries visible. Stop publication and design a reviewed forward fix.

## 4. Backup, maintenance and failure protocol

Before approving the first migration, the owner must provide an encrypted,
access-controlled recoverable backup/checkpoint with timestamp, retention, operator,
restore destination, acceptable RPO/RTO and a successful restore rehearsal. Include
application and Auth data, schemas/functions/policies/grants/history; follow the
provider's supported process for managed schemas/roles. Save Auth/SMTP/template and
application configuration separately and securely; never put secrets or user data
in this repository. Backups listing alone is insufficient.

Use a restored isolated environment to rehearse the exact hashes with existing
data, record row counts/checksums under an authorized audit identity, validate
constraint/index construction and measure locks/disk/time. Local synthetic fixtures
are not a substitute for that production-volume rehearsal. Do not grant BYPASSRLS
or disable RLS to inspect hosted rows.

Pause application writes during the approved window and retain an external change
log. Establish `postgres` privileges, connection source, lock/statement limits and
available disk through approved operational tooling. Start with a 5-second lock
timeout and a bounded statement timeout chosen from the clone rehearsal; do not
apply global DB settings. These read-only assertion scripts already bound reads.
CLI session timeout configuration/direct connection readiness is not yet verified.

Each file has its own BEGIN/COMMIT. **The six-file sequence is not one transaction.**
If a command fails: stop immediately, close/rollback the failed session, capture
sanitized diagnostics, re-read migration history and the last/next catalog stages.
If the failed file did not commit, its DDL/role/grants roll back; prior stages remain.
If connection loss makes commit/history state ambiguous, do not retry or edit history.
If it committed but a postflight fails, freeze writes and require a reviewed forward
repair or owner-approved restore. Never edit an applied file, run down SQL, reset,
delete receipts, or use `migration repair` to force green results. Restoring an older
snapshot can lose later audit data and needs a separate recovery approval.

## 5. Executable preflight and staged application procedure

Safe local generation and authorized read-only checks:

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
node scripts/prepare-activation.mjs
if ($LASTEXITCODE -ne 0) { throw 'STOP: inventory/hash mismatch' }
node scripts/hosted-auth-readiness.mjs --network --migration-list
node scripts/inspect-hosted-activation.mjs --network --stage=0
if ($LASTEXITCODE -ne 0) { throw 'STOP: preflight incomplete or failed' }
```

Constraint comparison files `constraints-stage-0.sql` through `constraints-stage-6.sql`
are produced by the native local rehearsal (`node scripts/test-day7-postgres.mjs`).
Their rows contain catalog-definition SHA-256 fingerprints, no business data. The
inspection script requires them and reconstructs their fixed read-only SQL before
execution. Missing files are UNVERIFIED, not PASS. They verify the shared audit/quota
checks and, from stage 4, work-state CHECK; they do not certify every function body.

`stage-0.sql` through `stage-6.sql` check exact cumulative history, future table/function
absence, RLS/owners/client grants, restricted roles, revoked temporary CREATE,
validated constraints/indexes and enabled triggers. Later stages also check private
wrappers, secured RPCs and case suppression. Use detailed catalog scripts specified
per stage for FKs/pointers/guards. All rows must return PASS; any unknown or extra
history version stops the run. Only stage 0 has been inspected on hosted Supabase.

**The following is approval-gated procedure, NOT executed or authorized here.**
The installed CLI 2.120.0 has no one-file/count limit on `migration up`. To avoid
applying all pending files at once, generated stage packages contain the unchanged
four foundation files plus only the approved cumulative prefix. Never move files
out of the actual migration directory. No stage package contains credentials or
changes the application config. Do not run `config push` with its copied local config.

After the owner approves the specific stage, backup, target and maintenance window:

```powershell
$activationCli = Join-Path (Get-Location) 'node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
$activationProjectRef = (Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim()
$activationStage = 1 # Set explicitly to the single approved next stage, 1..6; no auto-loop.
$activationWorkdir = Join-Path (Get-Location) "test-results/activation-plan/stage-$activationStage"
node scripts/prepare-activation.mjs
if ($LASTEXITCODE -ne 0) { throw 'STOP: reviewed artifacts changed' }
& $activationCli db push --project-ref $activationProjectRef --workdir $activationWorkdir --dry-run --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'STOP: dry-run failed' }
# Inspect privately: dry-run MUST propose exactly the one approved next filename/hash.
```

Stop for operator review. Only after the specific stage approval is recorded and
all gates are satisfied, run this separate block in the same terminal. The typed
acknowledgement does not replace the owner's authorization. Never pipe confirmation
or use `--yes`.

```powershell
if ((Read-Host "Approved stage $activationStage only: type APPLY STAGE $activationStage") -ne "APPLY STAGE $activationStage") { throw 'STOP: approval acknowledgement missing' }
& $activationCli db push --project-ref $activationProjectRef --workdir $activationWorkdir --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'STOP: application failed; inspect before retry' }
node scripts/inspect-hosted-activation.mjs --network "--stage=$activationStage"
if ($LASTEXITCODE -ne 0) { throw 'STOP: postflight failed or incomplete' }
# Run that stage's detailed read-only catalog SQL and archive every PASS result.
# Reconcile history and approve continuation before selecting the next stage.
```

Use the existing approved CLI credential mechanism; never pass a password/connection
URL in a command argument, transcript or report. `--skip-vault` is mandatory: this
CLI's help says `db push` otherwise updates Vault secrets before migrations. Do not
add `--include-all`, `--include-roles` or `--include-seed`. CLI connection/dry-run and
hosted DDL are untested; the prepared package is not evidence of successful execution.

## 6. HTTPS and Auth configuration gates

| Item | Current evidence | Required before controlled real-account test |
| --- | --- | --- |
| `APP_ORIGIN` | Present, local HTTP origin; value redacted. | Owner-chosen canonical reachable HTTPS Next.js server origin; certificate and same-origin API checked. No static export or invented hostname. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Present, valid shape, matching linked project; values redacted. | Same intended project in build/runtime; public key only, no service-role key. |
| `FAIRWORK_DATA_MODE` | `synthetic`. | Keep synthetic; real Auth identities do not authorize real employment data. |
| `AUTH_REGISTRATION_ENABLED` | Absent/disabled. | Separate owner approval for controlled enablement and later closure. |
| Auth settings endpoint | HTTP 200, email/password on, confirmation required, anonymous off, global signup disabled. | Preserve confirmation and anonymous denial; approve any signup change. |
| Site URL / redirects | Full hosted values not captured. No difference reported for declared local Site URL/empty redirects; that is not proof of correct hosted URLs. | Set Site URL to approved origin and exact `<APP_ORIGIN>/auth/confirm` allowlist; no wildcard. Owner verifies actual administrative values. |
| Email provider vs global signup | Config diff shows email signup true, public settings say global signup disabled. | Check both settings; neither alone proves registration readiness. |
| Provider password policy | Config diff reports minimum 6, secure password change false; local app minimum is 12. | Align provider minimum to at least 12 and secure password-change policy through approved settings; direct Auth calls can bypass app-only password rules. |
| SMTP / sender / template | Delivery, credentials, sender DNS, quota and custom template unverified; no email sent. | Approved working delivery, verified sender, rate limits and intended inboxes; test actual receipt/expiry/scanners. Default delivery must not be assumed adequate. |
| TOTP MFA | Local enroll/verify enabled; hosted full administrative settings and live challenge unverified. | Real authenticator enrollment/challenge/recovery and AAL2 operator session; no SMS claim. |
| PostgREST | Anonymous api-schema inspection HTTP 401. | Authenticated RPC/schema cache, denial and persistence checks after migrations; 401 alone proves only reachability/denial. |

Prepared signup template (NOT applied):
`<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Confirm your ORYQEN email</a>`.
The confirmation page requires an explicit same-origin POST with the hash, calls
`verifyOtp(type: email)` and installs the normal session. No GET/prefetch verification,
OAuth/PKCE callback, arbitrary redirect, or phone/SMS OTP is implied. The fragment
avoids server URL logs but is still a bearer secret; do not capture it in traces.

Existing session factory uses Supabase SSR cookies: Secure in production,
SameSite=Lax, path `/`, no-store responses. It does not set an HttpOnly override;
do not claim all session cookies are HttpOnly. Protected server handlers validate
`getUser`, reject anonymous/missing identity, then use user-scoped RPCs. The `/api/v1/me`
proxy refreshes claims; it is not the authorization boundary. No production fixture
identity bypass or service-role fallback is introduced. Live expiry/refresh,
logout, revocation, cross-origin denial and stale-cookie recovery remain hosted gates.

Registration is a **project-wide switch, not a two-email allowlist**. Approval for a
test window must explicitly address direct Auth signup exposure, abuse controls,
email quotas and closing both switches. Current code has no CAPTCHA token UI; do
not disable required CAPTCHA to pass. If a closed invitation-only pilot is required,
stop and approve that separate implementation before any signup enablement.

## 7. Controlled two-account procedure and retention

Use two fresh, distinct, owner-controlled inboxes and synthetic display names:
one worker, one independent employer representative. No impersonation, real work
claims or third-party addresses. Distinct Auth UUIDs alone do not establish two
independent humans; the owner records the approved testers and their roles privately.

An existing separately authorized operator needs an active profile, live
`authority_operator` capability and AAL2. They independently provision the synthetic
company and review the employer membership with permitted evidence, policy, reason,
expected revision and expiry. They must not approve themselves. Do not grant either
participant operator powers or self-select role metadata. If no operator exists,
stop for a separately approved capability bootstrap procedure. Existing company
authority is `demo_provisioned` / `demo-authority.v1`, not real employer verification.

1. Pass stage 6 history/catalog, backup, approved HTTPS, delivery/template, abuse and
   temporary registration gates. Refresh readiness immediately before testing.
2. Run `node scripts/test-hosted-two-accounts.mjs --plan` first (network-free).
3. Only after explicit approval for account/session/email and synthetic record writes:

   ```powershell
   node scripts/test-hosted-two-accounts.mjs --execute-approved-hosted-writes --readiness=<fresh-readiness-report-path>
   ```

4. The runner requires a clean interactive terminal, typed approval acknowledgement,
   matching project/hashes, no missing/unexpected migrations and report age <1 hour.
   It prompts privately for each distinct email/password and its delivered real
   confirmation link; then creates profiles, signs out/in and reloads the browser to
   check cookie persistence. Existing verified MFA factors require a real code.
5. Pause for the operator's independently approved company/membership action; enter
   its UUID only after success. The runner cannot provision capabilities or memberships.
6. Employer creates offer; worker reopens authoritative offer, creates/proposes the
   agreement and acknowledges the exact unresolved set. Worker confirmation alone
   must not make it effective. Independent employer acknowledgement/confirmation
   yields two persisted actors bound to the same version/hash.
7. Worker creates/submits synthetic work and text evidence. Self-verification must
   fail; employer verifies exact content/evidence hashes. Owner Passport must contain
   the eligible revision; employer cannot get it as their own or inject an owner ID.
8. Sign out both sessions and require denied Passport reads. Preserve sanitized
   step statuses and created business UUIDs; no passwords, tokens, inbox addresses,
   screenshots, traces or storage-state files. Reviewers/case evidence testing and
   natural-expiry/new-factor/recovery are additional tests, not silently covered.

The reusable flow's salary/hours were strings; SQL would generate required unanswered
questions and reject proposal. This task corrected them to JSON numbers and ran the
same command journey against real local SQL. Work Record hours deliberately remain
a string per that separate contract. This is not a hosted test success claim.

Retention/closure: record run ID, approved purpose, actor/business IDs and retention
owner in restricted operational records. On failure retain partial records and
receipts for diagnosis; do not rerun blindly with fresh accounts. After approved
testing close registration, sign out sessions, and have the authorized operator
expire/revoke test membership through existing audited commands as appropriate.
Withdraw test work through the supported integrity command if visibility suppression
is required and separately approved. Preserve agreements, evidence, decisions,
withdrawal/case events and receipts. Never hard-delete Auth users, audit history or
company/work rows to clean up. Any privacy erasure must follow the separately
approved retention policy; this preflight does not authorize it.

## 8. Explicit owner approvals required

No broad “activate everything” approval is assumed. The owner must approve:

1. The intended project and backup/restore plan, including any backup/PITR purchase,
   creation, configuration or recovery action and the maintenance/write-freeze window.
2. The six exact named hashes above, their staged sequence and the authorized operator;
   continuation only after each successful postflight. Any repair/restore is separate.
3. The canonical HTTPS origin and hosting/deployment arrangement. Deployment itself
   requires explicit approval; preparation does not publish the application.
4. Specific Auth changes: Site URL/redirects, sender/SMTP/template, password policy,
   TOTP/abuse configuration as necessary, and any project-wide signup enablement.
5. The temporary application registration flag, two approved synthetic test inboxes,
   email/session/profile/business-record writes, independent authority review and
   audited retention/closure actions. Public launch is a separate decision.

No commit, push, hosted migration, configuration write or deployment has run. The
next task is to resolve backup recovery and choose the HTTPS origin, then request
these concrete scoped approvals. Do not start the hosted mutation commands now.

## 9. Abort conditions and final go/no-go

Abort on target/hash/history mismatch, extra pending files, object/role collision,
failed/missing assertion, invalid constraint/index, disabled guard, excessive grant,
RLS bypass, missing restore evidence, unbounded locks/timeouts, CLI credential or
dry-run failure, ambiguous commit, unapproved config delta, unavailable HTTPS/email,
unconfirmed/anonymous session, missing AAL2/authority, self-approval, incorrect
Passport visibility, captured secrets, or unsupported test cleanup. Do not relax a
security boundary or mutate history to overcome a blocker.

| Gate | Decision at this checkpoint |
| --- | --- |
| Six unchanged hashes and dependency review | PASS locally |
| Existing-row preservation and stage security checks | PASS in local synthetic PostgreSQL rehearsal; not a hosted backup clone |
| Hosted baseline history/catalog | Read-only evidence only; final details below |
| Recoverable backup / restored clone / maintenance limits | BLOCKED: no listed backup, PITR off, restore untested |
| Intended HTTPS application origin / hosted deployment | BLOCKED: no verified hosted origin |
| Complete Auth redirect/SMTP/template/TOTP/abuse configuration | BLOCKED/UNVERIFIED; password-policy differences require approval |
| Independent approved operator and tester roster | Owner confirmation required |
| Six hosted migrations and authenticated PostgREST postflights | NOT RUN; approval required |
| Real inbox confirmation, MFA/session behavior and two-account hosted journey | NOT RUN; approval required |
| Public release, real employment-data policy and commercial authority | Separate pending gates |
| Android | Existing historical debug APK preserved; no new build/install/device test in this task |

## 10. Verification and changed files

| Fresh verification | Result / evidence |
| --- | --- |
| Hosted baseline | **24/24 PASS**: foundation 10, stage 0 security/history 11, shared constraint fingerprints 3; `test-results/hosted-activation-inspection-1792153982129.json`, captured 2026-10-16 12:32:49 UTC. Backup/config observations are in the same redacted report. This is not a post-migration test. |
| Affected embedded SQL test first | **27 PASS, 5 native-only skips**, before adding the foundation-row preservation assertion. Initial assertion-count expectation was corrected; no migration changed. |
| Native PostgreSQL | **33/33 PASS**, `test-results/day7-postgres-1792153855817/tests.log`. All six migrations applied only in a disposable local cluster under constrained migration identity; all seven catalog stages and constraint SQL checked; existing rows across all eight foundation tables preserved; same two-account command journey passed; concurrency/revocation tests passed. Cluster stopped. Earlier native pass was 32; counts overlap, not additive. |
| Full local regression | **220 PASS, 14 native-only skips**, 25 files; `test-results/activation-regression-final.log` / `.json`. Includes embedded SQL and fixture/unit/API tests; no hosted two-account claim. |
| Typecheck | **PASS**, final code/declarations verified; `test-results/activation-typecheck.log`. |
| Lint | PASS, zero warnings, `test-results/activation-lint.log`. |
| Package verification | Six pinned pending hashes PASS; **45 cumulative migration copies** byte-identical to originals; seven stage SQL and seven constraint SQL files matched their generators. |
| Test plan / syntax | `node scripts/test-hosted-two-accounts.mjs --plan` PASS (no network/writes); `node --check` for the four affected `.mjs` files PASS. |
| Hosted migration/Auth/account test | **NOT RUN**. Only read-only Auth GET, migration list, config diff, backup list and read-only catalog SQL ran. |

Exact main commands were `node scripts/prepare-activation.mjs`,
`npm test -- tests/integration/day7-case-db.test.ts`,
`node scripts/test-day7-postgres.mjs`,
`node scripts/inspect-hosted-activation.mjs --network`,
`npm test -- --reporter=default --reporter=json --outputFile=test-results/activation-regression-final.json`,
`npm run typecheck`, and `npm run lint`.
The sandbox blocked the first native loopback connection, Next type-generation path
access, and regression temporary-module imports. Authorized unrestricted local
reruns succeeded; initial evidence was retained (`day7-postgres-1792146869850`,
`activation-regression.log` / `.json`). These failures did not involve hosted writes.

No browser or production build rerun is needed for this scripts/tests/documentation
scope; their prior passes remain historical and are not counted as new evidence.

Changed existing files: `scripts/hosted-two-account-flow.mjs`,
`tests/integration/day7-case-db.test.ts`, `CONTINUE_HERE.md`.
New source files: `scripts/activation-checks.mjs`, its `.d.mts` declaration,
`scripts/prepare-activation.mjs`, `scripts/inspect-hosted-activation.mjs`,
`scripts/hosted-two-account-flow.d.mts`, and this document.
Generated evidence/packages are under `test-results/activation-plan/` and unique
readiness/inspection/native-test report paths. No application, migration, Supabase
config, environment, Figma or Android source file was changed.
