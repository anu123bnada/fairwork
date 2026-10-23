# Day 1 hosted migration authority review — 2026-10-08

Historical review, superseded by [DAY1_AUTH_CONTEXT_REPAIR.md](DAY1_AUTH_CONTEXT_REPAIR.md). The owner has now confirmed postgres cannot grant auth USAGE, both executor grants remain absent, the foundation is recorded and `202610080001` is not. The old grant proposal has been archived outside active migrations; its application procedure below is retained only as investigation history.

Status: owner reports `db push --linked --skip-vault` failed at the repair migration's postcondition with P0001. No new hosted connection or change was made by this review. Current grants and migration history remain unverified; do not retry a write until the read-only results below are reviewed and the owner approves the next action.

## What the failure establishes

At the postcondition, at least one of `fw_user_exec` and `fw_policy_exec` still lacked USAGE on schema `auth`. The migration deliberately raises instead of accepting an ineffective GRANT. This is a migration-side P0001, distinct from the original runtime 42501.

The leading explanation is that the effective migration role can use `auth` but is neither its owner nor a superuser and lacks `USAGE WITH GRANT OPTION`. PostgreSQL can warn and grant nothing in this situation. Merely owning the database or administering application schemas does not confer ownership of every managed schema.

The original runtime defect is established by the owner-supplied catalog and local reproduction. The new administrative explanation still needs the current schema ACL and effective-role evidence. The failure alone does not identify the exact login/effective role, prove both grants are absent now, or prove the migration ledger lacks a record. The explicit transaction should abort on the exception; establish persisted state through a fresh connection rather than assuming rollback/history behavior.

## Supported roles and administrative path

Supabase documents that hosted SQL Editor queries execute as `postgres`, and that hosted dashboard superuser access was removed. The editor is privileged for application administration but is not a separate `supabase_admin` superuser escape hatch. `supabase_admin` is an internal platform role; Auth objects are managed by `supabase_auth_admin`. The owner of the **auth schema itself** must be read from `pg_namespace`, not inferred from its tables or functions.

Passwordless CLI connections can use temporary `cli_login_postgres` credentials. The actual failed push's effective role is not established by that login name alone. Do not assume changing credentials or using the dashboard changes grant authority.

The installed CLI 2.120.0 help says `db query --linked` uses the Management API. Its current_user result identifies that query path, not necessarily the direct migration connection. A query in SQL Editor likewise identifies the editor connection. If role identity remains in dispute, inspect the failed push's role-initialization/warning lines and relevant project Postgres logs; do not share passwords, connection strings or unrestricted debug output.

- If the editor's `can_grant_auth_usage` is true, it is an authorized administrative path for the narrow grant, subject to the guarded migration completing successfully.
- If false, SQL Editor cannot ordinarily issue that grant as its current role. Request Supabase Support to perform or authorize the exact two-role USAGE grant using the managed schema owner/platform administration path. Do not grant yourself managed roles, change schema ownership, or assume Support will permit it. If the platform declines, stop for a separately reviewed design decision.
- Do not add service-role runtime credentials, table grants, RLS bypass, role inheritance, schema CREATE or WITH GRANT OPTION to either FAIRWORK executor.

## Read-only evidence collection

1. Open the intended FAIRWORK hosted project's SQL Editor in a fresh query using its normal administrative role.
2. Run the entire `scripts/day1-auth-grant-authority.sql`. It is one SELECT returning one JSON cell. Save/export the complete `authority_diagnostics` value.
3. Inspect `connection.migration_history_relation`. If missing, stop; do not create or repair the ledger. Otherwise run the entire `scripts/day1-repair-history.sql` and save both rows. An access error is also a stop condition, not evidence of absence.
4. Run `scripts/diagnose-day1-rpc.sql` again to establish the rest of the current permission/RLS snapshot.

PowerShell copy commands (run each separately immediately before pasting):

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
Get-Content -Raw '.\scripts\day1-auth-grant-authority.sql' | Set-Clipboard
```

```powershell
Get-Content -Raw '.\scripts\day1-repair-history.sql' | Set-Clipboard
```

Optional CLI read-only history comparison:

```powershell
.\node_modules\.bin\supabase.cmd migration list --linked
if ($LASTEXITCODE -ne 0) { throw 'History could not be verified; stop.' }
```

The queries expose only catalog metadata, named roles and the two requested migration identifiers. They do not select account/profile rows, tokens, passwords, connection strings or stored migration SQL. Both new scripts were executed successfully in local PGlite READ ONLY transactions, including missing-grant-authority and absent-repair-history fixtures. No hosted execution is claimed.

## Procedure after evidence review and separate approval

First require the initial migration `202610070001` to be recorded. If it is absent, history is inaccessible, or the repair is already recorded while either executor still lacks USAGE, stop for investigation. Do not edit recorded migrations or delete/repair ledger rows. An already-recorded repair with missing privileges needs a separately reviewed forward correction.

If `202610080001` is absent and either executor lacks USAGE:

1. If SQL Editor has grant authority, run the existing **complete, unchanged** `supabase/migrations/202610080001_identity_auth_schema_usage.sql` there. Its BEGIN/GRANT/postcondition/COMMIT performs only the narrow administrative grant. A warning, exception or ambiguous result requires fresh read-only checks. Do not run only a selected fragment or omit the postcondition.
2. If SQL Editor lacks authority, ask Supabase Support to execute that same guarded grant transaction, or provide an explicitly supported path for this project. Supply the authority diagnostic, history rows and the exact error. Request only USAGE on auth for the two named executor roles; no ownership, memberships, grant options, table/function permissions or history edits. The owner must authorize Support's action; this review has not contacted Support.
3. In a fresh SQL Editor query rerun both diagnostics. Both executor USAGE checks must now be true; compare the rest of the permission/RLS snapshot to the preceding one. SQL Editor/Support execution does not itself constitute CLI migration-history registration.

If both grants are already true and the repair is absent, skip the administrative grant and proceed directly to the normal CLI migration workflow below after approval.

Reconcile by **actually rerunning the unchanged migration through the CLI**, not by manually marking it applied:

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
$fwCli = '.\node_modules\.bin\supabase.cmd'
& $fwCli migration list --linked
if ($LASTEXITCODE -ne 0) { throw 'History check failed; stop.' }
& $fwCli db push --linked --skip-vault --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Dry-run failed; stop.' }
```

Confirm the linked project against the dashboard and require the pending list to contain **only** `202610080001_identity_auth_schema_usage.sql`. Dry-run does not prove SQL/grant authority. Then, only with approval:

```powershell
& $fwCli db push --linked --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'Application/registration failed; stop and inspect fresh state.' }
& $fwCli migration list --linked
if ($LASTEXITCODE -ne 0) { throw 'Final history check failed; stop.' }
```

GRANT is additive: existing required privileges need not be revoked or broadened. If the CLI still lacks grant authority, it may warn that it did not grant privileges, while the postcondition sees the administrator's already-established grants. Accept completion only if the CLI exits successfully, both effective privileges are true in a fresh check, and the migration is now recorded. A hard GRANT error or history-write failure is a stop condition; do not suppress it or manually insert a ledger row. Escalate the exact new failure for review.

If history already records the repair and both grants are present, do not rerun or repair history; move to verification after reviewing the unexpected outcome.

Finally run all 13 checks in `scripts/day1-hosted-catalog.sql`, then the configured application's authenticated synthetic-account runner described in `docs/DAY1_COMPLETION_REVIEW.md`. Require all catalog rows PASS and no behavioral FAIL. Separate UNVERIFIED items (including natural expiry/automatic refresh) remain pending. Retain synthetic cleanup/session-revocation results. Day 2 is not authorized.

## Support request text (not sent)

> Our hosted FAIRWORK project uses two NOLOGIN/NOSUPERUSER/NOBYPASSRLS function executors, fw_user_exec and fw_policy_exec, with fixed search paths and FORCE RLS on private tables. They need to resolve auth.uid() and auth.jwt(), whose EXECUTE privileges already exist. A guarded GRANT USAGE ON SCHEMA auth TO fw_user_exec, fw_policy_exec failed its postcondition through the linked CLI. Attached are current schema ownership/ACL/grant-option diagnostics and migration-history rows. If postgres lacks schema grant authority, please perform or confirm the supported administrative path for only this two-role USAGE grant, preserving all ownership, table/function permissions, memberships, RLS and migration history. We do not authorize broad grants or history repair. We will verify the resulting state and run the existing forward migration through the CLI to register it normally.

## Primary references checked

- [Supabase database roles](https://supabase.com/docs/guides/database/postgres/roles): hosted dashboard executes as postgres; supabase_admin is internal.
- [Supabase dashboard superuser change](https://supabase.com/docs/guides/self-hosting/remove-superuser-access): hosted SQL Editor superuser access was removed; self-hosted behavior may differ.
- [Supabase managed-schema permissions](https://supabase.com/docs/guides/platform/permissions): preserve Auth/Storage service ownership.
- [Supabase temporary CLI login role](https://supabase.com/docs/guides/troubleshooting/permission-denied-when-deleting-the-cli_login_postgres-role-808bae): managed temporary login lifecycle.
- [PostgreSQL GRANT](https://www.postgresql.org/docs/17/sql-grant.html): grant authority and warnings when privileges cannot be granted.
- [PostgreSQL privilege inquiry functions](https://www.postgresql.org/docs/17/functions-info.html): USAGE WITH GRANT OPTION tests grant authority separately from USAGE.
- [Supabase Support](https://supabase.com/support): owner escalation channel; no support request was sent.
