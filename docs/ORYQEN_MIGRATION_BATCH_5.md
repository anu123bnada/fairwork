# Staging migration batch 5 — for owner approval (29 Oct 2026)

Status: **PREPARED, NOT APPLIED.** Target: staging project `jpvgsmzomlmowarlfkdl` only. No production, `main` or Fairwork resource. Two migrations, applied in this order.

| # | File | SHA-256 | Purpose |
|---|---|---|---|
| 24 | `20261029150000_dispute_categories.sql` | `4b968bd0531cc4110de2a16c379e3ed595b4fac76545f9ffc325eb13c25ceac4` | Module 9: the owner-approved dispute categories (incorrect pay, incorrect working hours, incorrect duties, incorrect dates, contract terms, missing payment, unfair termination, other) beside the original four |
| 25 | `20261029151000_case_evidence_refs.sql` | `532f3992c74d9c69e32bd2377e6f0243c0a3977f45514a1653392fc9c275b368` | Module 9: evidence references on a dispute (snapshot of the opener's own vault document; never the file) |

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

## Procedure after approval
`node scripts/backup-staging-logical.mjs`, `node scripts/restore-check-logical-backup.mjs`, live-count comparison, checksum + project ref + dry-run (must list exactly these two files), `supabase db push --linked --yes`, then verify: migration list 57/57; the constraint lists twelve codes; the patched function exists once with unchanged owner, `secdef`, `search_path`, grants; refs table RLS enabled and forced, trigger present; the two functions' owner and execute rights; the new `fw_review_exec` policies and column grants are exactly as listed; existing counts unchanged.

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
commit;
```

## Code deployment order
The code in the same commit adds the new categories to the form. Until migration 24 is applied the database would refuse them, so **the code is held locally and will be pushed only after the migrations are applied** (the evidence panel alone would hide itself harmlessly, but the category list would not).
