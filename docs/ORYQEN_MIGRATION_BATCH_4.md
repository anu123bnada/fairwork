# Staging migration batch 4 — for owner approval (28 Oct 2026)

Status: **PREPARED, NOT APPLIED.** Target: staging project `jpvgsmzomlmowarlfkdl` only. No production, `main` or Fairwork resource.

| # | File | SHA-256 | Purpose |
|---|---|---|---|
| 23 | `20261029140000_agreement_expiry.sql` | `0f80b49c85e34789dae04613dfc4523e6fc84ab1c3627bb290d5d5e8aa1db428` | Modules 05 and 20: expiry date and renewal for a proposed agreement version, enforced when acknowledging or deciding |

## What it does
- New table `private.agreement_expiries (agreement_id, version, expires_at, set_by, set_at, renewals)`; forced RLS; participants read, only the worker who owns the agreement inserts or updates.
- `api.agreement_expiry_set` (worker only, current version in draft or proposed, date between one minute and 366 days ahead; setting a later or different date is a renewal and counts it), `api.agreement_expiry_read` (either participant), `api.agreement_expiries` (the caller's open proposals with a date, for reminders).
- **One existing function is replaced:** `api.agreement_workflow` (`create or replace`) gains one check inside the acknowledge/decide branch: if the version has an expiry date that has passed, raise `AGREEMENT_EXPIRED`. The function body is otherwise the original, copied programmatically from `202610140001_versioned_agreements.sql`. Agreement versions, hashes, acknowledgements, decisions and receipts are never changed by expiry, so the immutable history is untouched. Agreements without an expiry date behave exactly as before.

## SQL inspection (done)
No `DROP`/`TRUNCATE`; no existing table or column changed; the only replaced function is `api.agreement_workflow` (owner, grants and security settings preserved by `create or replace`). Dependencies already on staging: `private.agreement_roots`, `private.agreement_versions`, `private.profiles`, `private.request_uid`, `private.is_active`, `private.consume_identity_quota`, roles `fw_user_exec` and `fw_schema_owner`. New functions are `SECURITY DEFINER`, empty `search_path`, executable only by `authenticated`.

## Tests passed (local)
Day 4 agreement database tests: 17 of 17 on a disposable real PostgreSQL (including the existing real-concurrency acknowledgement/confirmation/revocation tests **running against the replaced function**) and 15 + 2 skipped on PGlite. New tests: only the worker can set or renew, both participants read, others get NOT_FOUND, bad dates and shapes rejected, after the date acknowledge and decide are refused while history stays byte-identical, renewal re-enables them, agreements without an expiry are unaffected. Also 1 browser test for the screen, 2 reminder unit tests, all 636 unit tests, the migration-upgrade rehearsal (23 later migrations), lint and typecheck.

## Procedure after approval
`node scripts/backup-staging-logical.mjs`, `node scripts/restore-check-logical-backup.mjs`, live-count comparison, checksum + project ref + dry-run, `supabase db push --linked --yes`, then verify: migration list 55/55; table RLS enabled and forced; policies; function owner, `secdef`, `search_path`, execute rights for the three new functions; `agreement_workflow` exists once, contains the check, same owner/grants; existing counts unchanged.

## Rollback
Re-apply the original `api.agreement_workflow` body from `202610140001_versioned_agreements.sql` with `create or replace`; `drop function api.agreement_expiries(jsonb), api.agreement_expiry_read(jsonb), api.agreement_expiry_set(jsonb); drop table private.agreement_expiries;` and delete migration row `20261029140000`. Expiry dates set in between are lost; agreement history is unaffected.

## Code that is already deployed and independent of this migration
The screen hides its expiry panel and the reminders ignore failures until the endpoints answer, so deploying the code first is safe; the feature becomes live only after the migration.
