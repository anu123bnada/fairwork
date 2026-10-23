# Day 1 private Auth-context repair — 2026-10-09 (Asia/Colombo)

Later owner-reported hosted evidence identifies a separate RPC EXECUTE defect. Use [DAY1_RPC_EXECUTE_REPAIR.md](DAY1_RPC_EXECUTE_REPAIR.md) for the current narrow `202610090001` proposal and verification procedure. The Auth-context proposal below is historical; do not reapply it if already recorded.

**GO for owner-approved application of `202610080002_identity_auth_context.sql`. NO-GO for declaring hosted Day 1 complete or starting Day 2 yet.** All local checks and the owner-supplied hosted preflight passed. No hosted application is authorized or performed by this review. This is the current runbook; the grant-proposal and authority-investigation reports are historical.

## Evidence and decision

The owner confirmed PostgreSQL 17.11; `auth` schema owner `supabase_admin`; SQL Editor effective role `postgres` without Auth schema grant authority; both FAIRWORK executors without Auth schema USAGE; foundation `202610070001` recorded; failed `202610080001` unrecorded. These observations explain why the grant postcondition failed and why repeating it in SQL Editor would not resolve the problem.

| Approach | Managed Auth privileges | Tradeoff / decision |
|---|---|---|
| Authorized platform-administrator grant | Adds USAGE for the two executors | Smallest SQL change and retains direct Auth calls. Requires Supabase to authorize/perform the managed-schema grant. No documented self-service privileged SQL Editor shortcut was found, and Support acceptance is not guaranteed. |
| Two private scalar SECURITY DEFINER helpers | No change | Recommended proposal. Uses postgres's existing ability to call the Auth functions while restricting delegation to two zero-argument helpers. Adds a small privileged code boundary requiring explicit review. |
| Reimplement identity/claims via `current_setting` | No change | Not selected. Would duplicate Supabase's Auth helper semantics, fallback behavior and future compatibility responsibilities. |

Supabase documents SECURITY DEFINER functions, fixed search paths, explicit EXECUTE restrictions and placement outside exposed schemas. This proposal uses those supported mechanisms; it is not a claim that Supabase has certified this exact application-specific design. An owner-owned wrapper cannot manufacture access its owner lacks: the hosted preflight must prove postgres already has Auth USAGE and EXECUTE on both underlying functions.

The approved baseline's domain data executors remain NOLOGIN/NOSUPERUSER/NOBYPASSRLS and separate from table ownership. The new postgres-owned scalar boundary is an explicit implementation/security change proposed for owner approval; it must never grow into a table-reading or table-writing command. Approved architecture records and tags remain unchanged pending that approval.

## Exact migration behavior and security review

- Creates only `private.request_uid() -> uuid` and `private.request_jwt() -> jsonb`, owned by postgres, SQL/STABLE/SECURITY DEFINER, with `search_path = ''`.
- Bodies are exactly `select auth.uid();` and `select auth.jwt();`. No arguments, dynamic SQL, table access, writes, role/session changes, claim mutation, JWT parsing or caller-supplied identifier occurs in either body. Identity still comes from the gateway's verified request context. The helpers do not independently validate a JWT; the existing gateway and Auth boundary remain responsible for that.
- Revokes helper privileges from PUBLIC, anon, authenticated, service_role and fw_schema_owner; grants only exact-signature EXECUTE to fw_user_exec and fw_policy_exec. The owner retains its inherent authority. An unexpected default EXECUTE grant to another role or a grant option aborts the transaction.
- Both executors need existing private-schema USAGE plus helper EXECUTE. They must not have private-schema CREATE or membership in postgres. Preflight/catalog checks verify these conditions; the migration grants no role membership or schema privilege.
- Replaces only the Auth accessor references in five existing private functions and eleven RLS policies. All predicates, policy commands/roles, function owners, existing EXECUTE grants, FORCE RLS, table/column ACLs, triggers and domain authorization semantics are preserved. SQL policy definitions necessarily change their function references; policies are not disabled or broadened.
- The three exposed API RPCs are unchanged. The new functions are in private, with no client execution. Hosted exposure is still verified after application.
- No GRANT/REVOKE/ALTER targets the managed Auth schema or its objects. Existing direct executor EXECUTE on Auth helpers remains unchanged but is not sufficient for direct calls without schema USAGE. Auth schema owner/ACL and Auth table/function owners/ACLs are compared before/after in the local authority regression.
- The migration requires `current_user = postgres`, existing Auth helper access, an unrecorded retired migration and the five reviewed foundation function bodies. It does not switch roles. CREATE (rather than CREATE OR REPLACE) for the two new helpers prevents overwriting an unexpected existing helper. All changes occur in one transaction.
- Helper creation/grants require postgres's existing CREATE/USAGE on private and ownership of its new functions. Replacing existing helpers and altering policies requires immediate privileges of their existing owners. Those are checked by the read-only hosted preflight and modeled in the restricted local fixture. They are not inferred merely from the role name postgres.

## Migration queue and preservation

Active migration files:

1. `202610070001_identity_foundation.sql` — applied, byte-identical, SHA256 `6D76BAFDBA1D8A4F61C9881068AC56B5071B51CB0212146C92BD4095824FC0A8`.
2. `202610080002_identity_auth_context.sql` — proposed, not applied.

The failed and confirmed-unrecorded `202610080001_identity_auth_schema_usage.sql` is preserved under `docs/superseded/`, byte-identical, SHA256 `ECC782C6962A0C12B6E1E2A6B4DC3D749685AD3CAE0A7952CFB1EDC8444DECC8`. It is outside CLI migration discovery. A gap in local version numbers does not require a ledger placeholder. No history repair or manual applied marker is part of this procedure.

## Verification status

| Check | Final result |
|---|---|
| Hosted PostgreSQL 17.11 preflight, owner-supplied complete JSON | PASS: all 10 checks; effective/login role postgres |
| Restricted-role installation and original 42501 reproduction | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, zero warnings |
| `npm test` | PASS: 31 tests in six files; 14 unit and 17 integration; zero skipped |
| Production build | PASS |
| Production Chromium smoke tests | PASS: 2; runner exit 0; server stopped |
| Updated catalog query in the migrated local fixture | PASS: exactly 16 rows |
| Hosted application and post-application verification | NOT RUN; requires approval |

The owner's preflight confirms postgres has Auth USAGE (without grant option), private USAGE/CREATE, EXECUTE on both Auth functions, required language access and immediate owner privileges for all five tables and affected functions. Both executors have private USAGE without CREATE or Auth USAGE; helper names are unused and both repair versions remain unrecorded. This proves the catalog prerequisites missing from the earlier grant proposal. It does not claim the future CLI connection has already executed the migration.

The earlier fixture setup error was fixed, not skipped: PostgreSQL cannot demote its bootstrap superuser. The disposable test setup renames that fixture identity and creates a separate ordinary postgres role; the actual migration runs as that non-superuser without any Auth grant authority. Full verification was rerun after this correction. The final production/browser run used empty Supabase values only in child-process environments; `.env.local` was not changed.

Local regression coverage includes:

- The original authenticated RPC 42501 and failed grant proposal reproduced before installing the replacement.
- Installation under a non-superuser/NOBYPASSRLS postgres role with Auth USAGE but no Auth grant option, while Auth is owned by a separate fixture role. Test-fixture provisioning uses an isolated PGlite superuser only to construct the hosted-like initial state; the migration itself is executed as the restricted role. Nothing is provisioned on the real hosted database.
- Both executors still lack direct Auth schema and Auth user-table access afterward.
- Catalog snapshots prove no table/column ACL, FORCE RLS flag, role/membership, trigger, existing function owner/ACL or managed Auth privilege change. Policy/function body comparisons allow only the exact accessor substitution.
- Helper ACL/body/owner/search-path checks; direct client calls and executor alteration attempts denied; repeated A/B identity switching; missing/malformed identity fails closed; malicious search-path shadows do not replace the qualified calls.
- The existing full profile/RLS suite now uses the replacement helpers with direct executor Auth USAGE removed: create/read/update, isolation, capability/MFA/revocation, suspension, replay/revision/audit and quotas.
- The complete hosted catalog query is executed against the migrated fixture and must return exactly 16 PASS results. The hosted preflight is executed against the restricted fixture before migration and must return exactly 10 PASS checks.

Local PGlite reports PostgreSQL **18.3**, not hosted 17.11. The SQL uses features documented for PostgreSQL 17: CREATE OR REPLACE FUNCTION retaining owner/ACL, SECURITY DEFINER, fixed search_path, ALTER POLICY, pg_has_role USAGE, privilege inquiry functions, ACL expansion and transactional DDL. No PostgreSQL 18-only syntax is used. This is a compatibility review plus local execution, not an exact hosted-version or Supabase-extension execution claim. Hosted 17.11 application and end-to-end verification remain mandatory.

## Required read-only hosted preflight — before approval

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
Get-Content -Raw '.\scripts\day1-auth-context-preflight.sql' | Set-Clipboard
```

The owner has supplied all ten PASS results. If the hosted state changes before approval/application, paste and run the entire single SELECT again in the intended project's SQL Editor and require all ten checks PASS. Specifically, postgres must already have Auth USAGE plus EXECUTE on uid/jwt, private CREATE/USAGE, required language access and immediate privileges of the existing function/table owners. Both executors must retain private USAGE without CREATE or postgres membership. The two helper names must be unused; reviewed function bodies and migration history must match.

The SQL Editor query establishes permissions for postgres, not the actual identity of a future CLI connection. The migration's first guard independently refuses any effective role other than postgres before doing work. `db query --linked` in this installed CLI uses Management API and should not be presented as a probe of the direct migration connection.

If any preflight result fails or the query cannot run, **STOP and report the exact result. Do not create missing memberships, grant managed Auth access, change ownership or bypass the guard.** No deployment GO is justified without these results.

## Exact owner commands after preflight review and approval

Use a normal interactive PowerShell terminal; retain secrets in existing credential storage or hidden prompts. Do not place passwords in commands or chat.

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
$fwCli = '.\node_modules\.bin\supabase.cmd'
Get-Content -LiteralPath '.\supabase\.temp\project-ref'
Get-ChildItem -LiteralPath '.\supabase\migrations' -File | Select-Object Name
& $fwCli migration list --linked
if ($LASTEXITCODE -ne 0) { throw 'Stop: migration history could not be read.' }
& $fwCli db push --linked --skip-vault --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Stop: dry-run failed.' }
```

Compare the reference with the intended dashboard project and configured application. Require only `202610080002_identity_auth_context.sql` in the pending list, with foundation `202610070001` already recorded and no remote `202610080001`. Dry-run lists pending migrations; it does not execute or validate grant/ownership operations.

**Application command, only after explicit approval of the preflight and proposal:**

```powershell
& $fwCli db push --linked --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'Stop: application failed; inspect fresh state.' }
& $fwCli migration list --linked
if ($LASTEXITCODE -ne 0) { throw 'Stop: post-application history check failed.' }
```

No include-all, role/seed inclusion, automatic yes, database reset or migration-repair command is appropriate. If an operation fails, do not assume either rollback or successful bookkeeping. Read current state and history before proposing a next action. Do not weaken guards to make a retry pass.

## Hosted verification after application

1. Run `scripts/day1-repair-history.sql`: foundation and `202610080002` recorded; retired `202610080001` absent.
2. Copy `scripts/day1-hosted-catalog.sql` into SQL Editor. Select the complete WITH checks ... SELECT statement, excluding the surrounding BEGIN/ROLLBACK. Run it and require **all 16 rows PASS**. The previous 13-check grant-path inventory is superseded: direct executor Auth USAGE is no longer a prerequisite.
3. Run `scripts/diagnose-day1-rpc.sql` and `scripts/day1-auth-grant-authority.sql`. Compare managed Auth ownership/ACLs, executor properties and private-table protections with the preceding diagnostics. Both executor Auth USAGE values should remain false on this project. Inspect the new private helper grants/owners and expected accessor-only policy changes.
4. Run a configured app in terminal A:

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
npm run dev -- --port 3000
```

Keep `.env.local` configured for the same hosted project and APP_ORIGIN `http://localhost:3000`; do not overwrite it. Confirm the page says Supabase is configured. The local verification production build uses empty process-only Supabase values, so do not reuse it for configured hosted verification without a normal rebuild.

5. In terminal B, run the interactive verifier directly (no piping credentials):

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
node .\scripts\verify-day1-hosted.mjs
$fwVerificationExit = $LASTEXITCODE
Write-Output "Verification exit code: $fwVerificationExit"
$fwVerdicts = Get-Content -Raw '.\test-results\day1-hosted-interactive.json' | ConvertFrom-Json
$fwVerdicts.results | Format-Table check,status,note -AutoSize
```

Use two distinct ordinary synthetic accounts without operator capabilities, preferably fresh profiles so creation is exercised. Enter credentials only in hidden prompts. The runner changes synthetic profiles/metadata and attempts cleanup/sign-out: new profiles remain, revisions advance, and previously absent metadata probe keys may become null. Share only the sanitized verdict JSON and catalog results.

Exit 1 or any FAIL blocks completion. Exit 2 means UNVERIFIED coverage, not an all-pass result. This runner always leaves separate catalog verification and natural expiry/automatic refresh unverified; pair its catalog note with the separate 16-check report and retain the refresh limitation until independently verified. Existing-profile creation UNVERIFIED needs fresh synthetic accounts. Cleanup/sign-out failure requires owner review/revocation of those test sessions. Do not count skipped/incomplete checks as success.

## Files changed for this replacement proposal

- Added `supabase/migrations/202610080002_identity_auth_context.sql`.
- Moved the unchanged failed `202610080001_identity_auth_schema_usage.sql` from `supabase/migrations/` to `docs/superseded/`; added `docs/superseded/README.md`.
- Added `tests/integration/auth-context.test.ts`; updated `tests/integration/identity.test.ts` to run the replacement and `tests/integration/auth-schema-usage.test.ts` to retain the archived proposal's regression.
- Updated `scripts/day1-hosted-catalog.sql` and `scripts/day1-repair-history.sql`; added `scripts/day1-auth-context-preflight.sql`.
- Added this runbook; updated current links/status in `README.md`, `docs/DAY1_IMPLEMENTATION.md`, `docs/DAY1_COMPLETION_REVIEW.md` and `docs/DAY1_HOSTED_AUTHORITY_REVIEW.md`.
- Local verification refreshes ignored build/test output. No application/UI source, `.env.local`, dependency manifest/lockfile, approved architecture document/tag or applied migration was intentionally changed.

## References

- [Supabase database functions](https://supabase.com/docs/guides/database/functions): definer/invoker semantics, fixed search path, restrictive EXECUTE grants.
- [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security): keep definer helpers outside exposed schemas; definer authority must be scoped carefully.
- [PostgreSQL 17 CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html): ownership, SECURITY DEFINER safety and CREATE OR REPLACE behavior.
- [PostgreSQL 17 privilege inquiry functions](https://www.postgresql.org/docs/17/functions-info.html): effective object and role privileges.
- [Supabase managed-schema permissions](https://supabase.com/docs/guides/platform/permissions) and [database roles](https://supabase.com/docs/guides/database/postgres/roles): preserve managed ownership; hosted SQL Editor uses postgres.

Approval requested is for this bounded helper architecture and eventual execution of the reviewed forward migration, after preflight evidence passes. It is not permission for Day 2. No hosted change, manual history modification, reset, commit or push has been performed by this work.
