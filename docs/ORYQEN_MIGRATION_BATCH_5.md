# Staging migration batch 5 — for owner approval (29 Oct 2026)

Status: **APPLIED to staging on 29 Oct 2026 (owner-approved).** Backup of record `backups/staging-logical-20261028-2158Z` (130 tables, 313 rows; live counts matched; restore rehearsal 0 differences; destructive scan 0; dry run listed exactly these three files; checksums and project ref matched). Verified after: 58/58 migrations matched; the work_cases constraint lists all twelve codes; the patched `api.work_case_command_before_followups` contains the new list and keeps owner `fw_review_exec`, security definer, empty `search_path`, no public/anon execute, and the public wrapper `api.work_case_command` is unchanged and executable only by `authenticated`; `case_evidence_refs` and `audit_chain` have RLS enabled and forced with owner `fw_schema_owner`; the seven new policies and the vault column grants to `fw_review_exec` are exactly as described; the evidence functions and `api.audit_chain_verify` are executable only by `authenticated`, the private chain functions by nobody outside their owners; four triggers present; no create-on-schema grants left; existing counts unchanged (users 5, identities 5, profiles 2, receipts 2, field registry 6, work cases 0, vault documents 0). The chain was initialised from the 2 existing audit rows and verifies `ok` (head `87b0546e8702ca16aa5a417cf9aca0bb4e302b0380a1df9c66453a5281e81bea`, 29 Oct, record it outside the database to anchor it). NOT exercised by a real signed-in staging account. Original status: Target: staging project `jpvgsmzomlmowarlfkdl` only. No production, `main` or Fairwork resource. Three migrations, applied in this order.

| # | File | SHA-256 | Purpose |
|---|---|---|---|
| 24 | `20261029150000_dispute_categories.sql` | `4b968bd0531cc4110de2a16c379e3ed595b4fac76545f9ffc325eb13c25ceac4` | Module 9: the owner-approved dispute categories (incorrect pay, incorrect working hours, incorrect duties, incorrect dates, contract terms, missing payment, unfair termination, other) beside the original four |
| 25 | `20261029151000_case_evidence_refs.sql` | `532f3992c74d9c69e32bd2377e6f0243c0a3977f45514a1653392fc9c275b368` | Module 9: evidence references on a dispute (snapshot of the opener's own vault document; never the file) |
| 26 | `20261029160000_audit_chain.sql` | `e8fc3fc3dfb4b7b1689b58a8251d50f8790eaaa5a285a9ad8693423f106832a0` | Module 10: cross-record audit hash chain with tamper detection and an administrator verification |

## Migration 24 — what it changes
- Drops and re-adds the `reason_code` check constraint on `private.work_cases` with twelve codes (the old four plus eight). Existing cases keep their codes; staging has none.
- Rewrites the case command's input validation list. The migration finds the one function whose definition contains the old list (`api.work_case_command_before_followups` on staging, `api.work_case_command` on a fresh chain), replaces only that list in the text returned by `pg_get_functiondef`, and re-creates it; it aborts unless exactly one function was patched and the text actually changed. `create or replace` keeps owner, grants and security settings.
- No other table, column, policy or grant is touched. No data is touched.

## Migration 25 — what it adds
- `private.case_evidence_refs` (forced RLS, append-only by trigger): `case_id`, `document_id`, `owner_id`, snapshot of title, category, file name, media type, byte size and SHA-256. Unique per case and document. No foreign key to the vault, so deleting the document later does not erase what a case was shown.
- `api.case_evidence_attach` (only the person who opened an **open** case; only their own documents; refuses a document marked revoked; at most ten per case; replay-safe) and `api.case_evidence_list` (same visibility as case details: participants and the accepted reviewer). Both are `SECURITY DEFINER`, empty `search_path`, owned by `fw_review_exec`, executable only by `authenticated`.
- **Permission surface it widens (review this):** `fw_review_exec` gets column-limited `select` on `private.vault_documents` (id, owner_id, title, category, file_name, media_type, byte_size, sha256) and `select` on `private.vault_document_status`, each behind a new policy that only returns rows whose `owner_id` is the caller. A reviewer therefore still cannot read anyone's documents through the review role; the policies exist so the attach function can read the opener's own row.

## SQL inspection (done)
No `DROP TABLE`/`TRUNCATE`/data change. The only `drop constraint` is the work_cases reason-code check, re-added in the same statement block. Dependencies already on staging: `private.work_cases`, `private.case_visible`, `private.case_quota`, `private.vault_documents`, `private.vault_document_status`, `private.day3_reject_history_mutation`, roles `fw_review_exec`, `fw_schema_owner`.

## Tests passed (local)
- Migration 24: day-7 case database tests 34 of 34 on a disposable real PostgreSQL and 29 + 5 skipped on PGlite, including a new test that every one of the twelve codes is in the constraint, three new categories open real cases, and invalid codes (`made_up`, uppercase, empty, trailing space) are refused; the migration-upgrade rehearsal applies it on top of the full chain with the function renamed by the follow-up migration (25 later migrations in total).
- Migration 25: evidence/vault database tests 23 of 23 on PGlite and on real PostgreSQL: attach, replay, snapshot hash, reference survives deleting the document, foreign/unknown/revoked document refused, other person's and closed cases refused (NOT_FOUND), signed-out refused, bad shapes refused, cap of ten, update and delete rejected.
- Browser: 11 of 11 case specs (category list and chosen category sent; attach flow and checksum shown). All 644 unit and rehearsal tests, lint, typecheck.
- **Not tested:** the accepted-reviewer read path of `case_evidence_list` (needs reviewer capability fixtures; its gate is the existing `private.case_visible`), and anything on a real signed-in staging account.

## Migration 26 — audit hash chain (module 10)
- New append-only, forced-RLS table `private.audit_chain` (`seq`, `source`, `source_id`, `record_hash`, `prev_hash`, `chain_hash`). `chain_hash = sha256(prev_hash : source : source id : sha256(row as jsonb text))`; genesis previous hash is 64 zeros. Existing rows in `private.audit_logs` and `private.admin_audit` are chained first (oldest first), then two `AFTER INSERT` triggers chain every new row under an advisory lock so the order is global.
- `api.audit_chain_verify` (administrator with fresh MFA; owner `fw_admin_exec`) calls `private.audit_chain_verify`, which recomputes every link and every source row's hash and counts source rows missing from the chain. It returns `ok`, counts, the first problem's sequence number and the head hash (to be recorded outside the database).
- Widening to review: two `select` policies for the owner role `fw_schema_owner` on `private.audit_logs` and `private.admin_audit` (this role is NOLOGIN and owns only the definer functions that need to read the rows); one policy on the new table for the same role. Ordinary roles, including `authenticated`, still cannot read the chain.
- Honest limit: this detects tampering after the fact and across both audit tables; a database superuser can rewrite a row and the whole chain, which is what the exported head hash is for.
- Tests: admin database tests 27 of 27 on a disposable real PostgreSQL and 24 + 3 skipped on PGlite: chain length equals the sum of both audit tables; non-admin, aal1 and extra-field requests refused; an edited audit row, a row inserted with triggers off, and an edited chain link are each detected (and the check is ok again once undone); chain and audit tables cannot be rewritten through the normal path. Admin browser tests 14 of 14. The full unit and integration suite: 903 passed, 17 skipped; lint clean.
- Rollback: `drop trigger audit_chain_audit_logs on private.audit_logs; drop trigger audit_chain_admin_audit on private.admin_audit; drop function api.audit_chain_verify(jsonb), private.audit_chain_verify(), private.audit_chain_append(), private.audit_chain_hash(text,uuid,text,text); drop table private.audit_chain; drop policy audit_logs_chain_owner_read on private.audit_logs; drop policy admin_audit_chain_owner_read on private.admin_audit;` and delete migration row `20261029160000`. No audit row is changed or lost.

## Procedure after approval
`node scripts/backup-staging-logical.mjs`, `node scripts/restore-check-logical-backup.mjs`, live-count comparison, checksum + project ref + dry-run (must list exactly these three files), `supabase db push --linked --yes`, then verify: migration list 58/58; the constraint lists twelve codes; the patched function exists once with unchanged owner, `secdef`, `search_path`, grants; refs table RLS enabled and forced, trigger present; the two functions' owner and execute rights; the new `fw_review_exec` policies and column grants are exactly as listed; existing counts unchanged.

## Rollback
```sql
begin;
drop function api.case_evidence_list(jsonb), api.case_evidence_attach(jsonb);
drop table private.case_evidence_refs;
drop policy vault_documents_case_owner_read on private.vault_documents;
drop policy vault_status_case_owner_read on private.vault_document_status;
revoke select on private.vault_document_status from fw_review_exec;
revoke select(id,owner_id,title,category,file_name,media_type,byte_size,sha256) on private.vault_documents from fw_review_exec;
-- migration 24: only if no case uses a new code
alter table private.work_cases drop constraint work_cases_reason_code_check;
alter table private.work_cases add constraint work_cases_reason_code_check check(reason_code in ('work_inaccurate','evidence_integrity','verification_conflict','suspected_fraud'));
-- re-apply the original validation list in api.work_case_command_before_followups from 202610150001 line 185 with create or replace
delete from supabase_migrations.schema_migrations where version in ('20261029150000','20261029151000');
-- and, for migration 26, the rollback listed above
commit;
```

## Code deployment order
The code in the same commit adds the new categories to the form. Until migration 24 is applied the database would refuse them, so **the code is held locally and will be pushed only after the migrations are applied** (the evidence panel alone would hide itself harmlessly, but the category list would not).
