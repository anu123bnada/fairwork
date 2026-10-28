# Staging migration batch 2 — for owner approval (28 Oct 2026)

Status: **APPLIED to staging on 28 Oct 2026 (owner-approved).** Backup of record: `backups/staging-logical-20261028-1541Z` (127 tables, 283 rows, live counts matched, restore rehearsal 0 differences). Post-migration: 53/53 migrations matched; both tables RLS enabled and forced, owner `fw_schema_owner`, owner-only policies; five functions `SECURITY DEFINER`, empty `search_path`, execute only by `authenticated`; no create-on-schema grants left; existing row counts unchanged (users 5, identities 5, profiles 2, audit logs 2, receipts 2, field registry 6). Original text: applying needed explicit approval. Target: staging project `jpvgsmzomlmowarlfkdl` only. No production, `main` or Fairwork resource is involved.

## Contents (one migration so far; more will be added to this batch as features land)
| # | File | SHA-256 | Purpose |
|---|---|---|---|
| 21 | `20261029120000_vault_evidence_status.sql` | `20f8c8df9acd7d9e88b5f801f84f1d25afe20b84ff389fea5cd157356bc1aaad` | Module 06: worker's own revocation (withdrawn/superseded) and correction notes for Evidence Vault documents |

## SQL inspection (done)
- Statements: 2 `create table`, 1 `create index`, 7 `create policy`, 5 `create function`, grants/revokes, `notify`. **No `DROP`, `TRUNCATE`, or change to any existing table, column, function or policy.** The only `DELETE` is inside `api.vault_reinstate` (removes the caller's own revocation row).
- Dependencies (all already on staging): `private.vault_documents`, `private.profiles`, `private.require_identity`, `private.is_active`, `private.request_uid`, `private.consume_identity_quota`, roles `fw_user_exec`, `fw_schema_owner`.
- Security: both tables are owned by `fw_schema_owner` with RLS enabled **and forced**; policies allow `fw_user_exec` only for the owner (`owner_id = private.request_uid()` and an active account). The five functions are `SECURITY DEFINER`, `search_path=''`, owned by `fw_user_exec`, executable only by `authenticated` (revoked from public, anon, service_role). The temporary `create on schema api` grant is revoked in the same transaction.
- Data: new tables start empty. Rows cascade away when their document is deleted.

## Tests already passed (not on staging)
19 of 19 vault database tests on PGlite and on a disposable real PostgreSQL 18 (isolation between two accounts, replay, idempotency conflict, caps, validation, signed-out refusal), 1 browser test for the screens, route audit, i18n pins, and the migration-upgrade rehearsal (21 later migrations on top of existing data).

## Before applying (I will do these only after your approval)
1. Take a fresh backup: `node scripts/backup-staging-logical.mjs` (Docker-free; writes `backups/staging-logical-<time>/` with SHA-256 sums; folder is git-ignored and contains personal data).
2. Verify it: `node scripts/restore-check-logical-backup.mjs` (rebuilds the schema from the applied migrations in a scratch database, restores the `private` rows, compares every row) and compare live row counts to the backup.
3. Confirm the file checksum above, the linked project ref, and `supabase db push --linked --dry-run` listing only batch files.
4. `supabase db push --linked --yes`, then re-run the post-migration checks: migration list matches, RLS enabled and forced, policies owner-only, grants, function owner/`secdef`/`search_path`/execute rights, existing row counts unchanged.

## Rollback (nothing depends on these objects until the code is deployed)
```sql
begin;
drop function api.vault_evidence_status(jsonb), api.vault_correction_resolve(jsonb), api.vault_correction_add(jsonb), api.vault_reinstate(jsonb), api.vault_revoke(jsonb);
drop table private.vault_corrections, private.vault_document_status;
delete from supabase_migrations.schema_migrations where version = '20261029120000';
commit;
```
Run only after backing out the code that calls them (the vault screen tolerates a missing status endpoint for display, but note actions would fail).

## What the approval covers
Applying exactly the files listed above, verifying them, then a fast-forward push of the related commits to `origin/release/oryqen-oct27`.
