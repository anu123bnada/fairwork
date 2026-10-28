# Staging migration batch 3 — for owner approval (28 Oct 2026)

Status: **APPLIED to staging on 28 Oct 2026 (owner-approved).** Backup of record `backups/staging-logical-20261028-1613Z` (129 tables, 284 rows; live counts matched; restore rehearsal 0 differences). Verified after: 54/54 migrations matched; `vault_attach` and `vault_attach_offer` each exist once, contain the revocation check, owner `fw_user_exec`, security definer, empty `search_path`, executable only by `authenticated`; no create-on-schema grant; existing counts unchanged. NOT verified with a real signed-in staging account (none available to the assistant). Original status: Target: staging project `jpvgsmzomlmowarlfkdl` only. No production, `main` or Fairwork resource.

| # | File | SHA-256 | Purpose |
|---|---|---|---|
| 22 | `20261029130000_vault_revocation_enforcement.sql` | `d419eedb69dbe3e9ab6306504bb84227887891752a5503d6c4431c72138573a8` | Module 06: a document the worker marked revoked cannot be newly attached to a work record or a saved offer |

## SQL inspection (done)
- Two `create or replace function` statements only: `api.vault_attach` and `api.vault_offer_attach` equivalents (`api.vault_attach`, `api.vault_attach_offer`). Each is the existing function body, copied programmatically from its original migration, with one added check after the ownership checks: `if exists(select 1 from private.vault_document_status ...) then raise exception 'EVIDENCE_REVOKED'`.
- No tables, columns, policies, grants or data are touched. `create or replace` keeps the owner (`fw_user_exec`), execute grants (`authenticated` only) and `SECURITY DEFINER` with empty `search_path`.
- Dependency: `private.vault_document_status` (batch 2, already on staging).
- Existing links are unchanged; revoked documents stay visible and downloadable by their owner.

## Tests passed (local)
20 of 20 vault database tests on PGlite and on a disposable real PostgreSQL, including: revoked document refused for both attach paths, an earlier link survives revocation, attaching works again after reinstating, a missing document still answers NOT_FOUND. Also the error-mapping unit test and the migration-upgrade rehearsal (22 later migrations).

## Procedure after approval
Fresh `node scripts/backup-staging-logical.mjs`, `node scripts/restore-check-logical-backup.mjs`, live-count comparison, checksum + project ref + dry-run check, `supabase db push --linked --yes`, then verify the two functions (owner, secdef, search_path, execute rights), migration list 54/54, and existing row counts unchanged.

## Rollback
Re-apply the original two function bodies from `20261028160000_vault_attachments.sql` and `20261028190000_offer_notes.sql` with `create or replace`, and delete migration row `20261029130000`. No data is affected.

## Code that is already deployed and independent of this migration
The `EVIDENCE_REVOKED` message, and the data export now including `evidenceVaultStatus` and `researchHistory` sections (both already on staging).
