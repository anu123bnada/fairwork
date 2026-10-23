# Day 1 RPC EXECUTE repair — 2026-10-09

Applied after the owner's instruction to complete Day 1. Live history, all three RPC checks, all 16 catalog checks and the unchanged security boundary are verified. See [DAY1_FINAL_VERIFICATION.md](DAY1_FINAL_VERIFICATION.md) for the current completion status. Preparation/application instructions below are retained as historical evidence; do not reapply an already recorded migration.

Prepared and tested locally; hosted application requires owner approval. This is the latest proposal after the private Auth-context repair. The owner reports that only `RPC grants are authenticated-only among public client roles` fails on the hosted project.

## Cause and correction

The supplied hosted ACL evidence gives `anon` and `service_role` direct EXECUTE on all three Day 1 RPCs, alongside the intended `authenticated` and `fw_user_exec` grants. PUBLIC is absent. This is separate from the earlier Auth schema USAGE defect. The evidence does not establish which operation introduced the extra grants.

The existing catalog predicate requires exactly three api functions, effective authenticated EXECUTE, no effective anon or service_role EXECUTE, and no PUBLIC EXECUTE ACL. `docs/API.md` §3 explicitly excludes anon/PUBLIC/service_role/worker logins. Therefore **service_role must lose EXECUTE too**. The architecture and catalog predicate remain unchanged.

`202610090001_identity_rpc_execute.sql` performs one REVOKE on exactly `api.create_profile(jsonb)`, `api.get_me(jsonb)` and `api.update_profile(jsonb)` from PUBLIC, anon and service_role. PUBLIC revocation is defensive and a no-op for the reported ACLs. It uses RESTRICT, never CASCADE, and adds no grants. Authenticated and internal executor access are preserved.

The transactional postcondition verifies effective privileges and refuses inherited or SET ROLE access for either prohibited role. If indirect access persists, it aborts instead of altering memberships. It changes no RLS policy, FORCE RLS flag, private/schema/table/column ACL, managed Auth privilege, ownership, function body, role property, default privilege or earlier migration. No endpoint is added. A PostgREST schema reload notification is delivered on commit.

The membership inquiry uses PostgreSQL 17's documented `pg_has_role(...,'SET')`; effective EXECUTE includes inherited privileges. See [PostgreSQL 17 privilege inquiry functions](https://www.postgresql.org/docs/17/functions-info.html). Local integration uses PGlite/PostgreSQL 18.3, not the hosted PostgreSQL 17.11 engine. Hosted verification remains mandatory.

## Verification completed locally

| Check | Result |
|---|---|
| Unit/integration suite | PASS: 37 tests, no skips |
| Six new RPC privilege regressions | PASS |
| All hosted catalog predicates in restricted local fixture | PASS: 16/16 |
| Typecheck | PASS |
| Lint, zero warnings allowed | PASS |
| Production build, synthetic configuration | PASS |
| Chromium browser smoke | PASS: 2/2 |
| Applied migrations, archived proposal, UI and .env.local preservation | PASS |
| Hosted application and post-repair checks | NOT RUN; awaiting approval |

The fixture reproduces the exact single catalog failure, applies the repair as restricted non-superuser postgres, and obtains 16 PASS results. Before/after snapshots compare all other security boundaries, including private helper owners, bodies and ACLs. Actual anon/service_role calls to all three RPCs fail with function-level 42501 even when the fixture supplies api schema USAGE. Authenticated/internal calls still reach the body. The existing full profile/RLS suite now applies the new migration before CRUD, isolation, audit and replay checks.

PUBLIC-only access is removed. INHERIT true and INHERIT false / SET true membership paths for both prohibited roles cause atomic failure without changing memberships or ACLs. Tests initially encountered sandbox temporary-file restrictions; the complete suite passed outside that sandbox. A test assertion name and TypeScript annotation were corrected before final checks.

Unchanged SHA256: foundation `6D76BAFDBA1D8A4F61C9881068AC56B5071B51CB0212146C92BD4095824FC0A8`; Auth-context `22981389DB01426A4136B11C22605B7CCF1F62E9C2CB55274EC524A190FA91B4`.

## Owner preflight and dry-run

The commands below have not been executed against hosted Supabase by this review. Use an interactive PowerShell terminal. Keep secrets in existing storage or hidden prompts.

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
$fwCli = '.\node_modules\.bin\supabase.cmd'
Get-Content -LiteralPath '.\supabase\.temp\project-ref'
Get-ChildItem -LiteralPath '.\supabase\migrations' -File | Select-Object Name
Get-Content -Raw '.\scripts\day1-repair-history.sql' | Set-Clipboard
```

Compare the reference with the intended dashboard project and configured app. Run the copied read-only SQL in that project's SQL Editor. Before application require foundation `202610070001` and Auth-context `202610080002` recorded; retired `202610080001` and new `202610090001` unrecorded. Stop if this differs.

```powershell
Get-Content -Raw '.\scripts\day1-rpc-execute-check.sql' | Set-Clipboard
```

Run the complete copied query in SQL Editor. Require exactly three rows, owner `fw_user_exec`, inspection role `postgres`, `migration_role_is_owner=true`, and authenticated/internal EXECUTE true. Inspect the direct ACL and role-path arrays. The reported direct anon/service_role grants should explain FAIL. If another role is reachable through a role path, or ownership/authority differs, stop and review it. The current role itself can appear in a path array while its direct EXECUTE exists. SQL Editor authority does not prove a future CLI session's identity; the migration's postcondition prevents a successful repair claim if its revocation lacks authority.

```powershell
& $fwCli migration list --linked
if ($LASTEXITCODE -ne 0) { throw 'Stop: migration history could not be read.' }
& $fwCli db push --linked --skip-vault --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Stop: dry-run failed.' }
```

Expected pending list (CLI headings may vary), **only**:

```text
202610090001_identity_rpc_execute.sql
```

Foundation and Auth-context must already be remote. The retired failed proposal remains outside the active queue and absent from remote history. Dry-run lists files; it does not execute SQL or validate authority.

## Application — only after explicit approval

```powershell
& $fwCli db push --linked --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'Stop: application failed; inspect fresh state.' }
& $fwCli migration list --linked
if ($LASTEXITCODE -ne 0) { throw 'Stop: post-application history check failed.' }
```

No reset, history repair, include-all, automatic yes, role/seed push or managed Auth grant is part of this procedure.

## Hosted verification

1. Run `scripts/day1-repair-history.sql` again. Require `202610070001`, `202610080002` and `202610090001` recorded; retired `202610080001` absent.
2. Run `scripts/day1-rpc-execute-check.sql` again. Require exactly **three PASS rows**: authenticated/internal EXECUTE true, anon/service_role/PUBLIC false, both role-path arrays empty. The direct ACL must retain owner and authenticated without prohibited grantees.
3. Copy `scripts/day1-hosted-catalog.sql` and run its complete `WITH checks ... SELECT` statement in SQL Editor, excluding surrounding BEGIN/ROLLBACK if the UI otherwise displays only the final command. Require **all 16 checks PASS**, including the unchanged RPC predicate. Save sanitized history, privilege evidence and catalog results.

```powershell
Get-Content -Raw '.\scripts\day1-repair-history.sql' | Set-Clipboard
# Run the copied SQL in SQL Editor; then copy/run each next file separately.
Get-Content -Raw '.\scripts\day1-rpc-execute-check.sql' | Set-Clipboard
Get-Content -Raw '.\scripts\day1-hosted-catalog.sql' | Set-Clipboard
```

4. In terminal A, run the app using its existing configuration for the same project. Keep `.env.local`; ensure APP_ORIGIN is localhost:3000 and the page confirms Supabase is configured. Do not reuse the synthetic verification build for hosted checks.

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
npm run dev -- --port 3000
```

5. In terminal B, run the interactive verifier. Use two distinct ordinary synthetic accounts without operator capabilities, preferably fresh profiles. Enter credentials only in hidden prompts. The runner mutates synthetic profiles/metadata and attempts cleanup/sign-out; new profiles remain and revisions advance.

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
node .\scripts\verify-day1-hosted.mjs
$fwVerificationExit = $LASTEXITCODE
Write-Output "Verification exit code: $fwVerificationExit"
$fwVerdicts = Get-Content -Raw '.\test-results\day1-hosted-interactive.json' | ConvertFrom-Json
$fwVerdicts.results | Format-Table check,status,note -AutoSize
```

Require anonymous RPC denial and all authenticated profile/create/update/isolation/replay/cleanup checks to pass. Service-role denial is verified through effective catalog privileges; no service key is required. Share only sanitized verdicts. Exit 1 or any FAIL blocks completion. Exit 2 means UNVERIFIED coverage: catalog verification and natural expiry/automatic refresh are always separate. Pair the catalog note with the 16-check report; verify natural refresh separately before claiming that coverage. Existing-profile creation UNVERIFIED requires fresh accounts. Do not label incomplete checks PASS.

If any command/check fails, stop and retain the error. Re-run only the read-only history, RPC evidence and catalog queries to establish actual state. Do not assume rollback or successful recording, retry with broader grants, alter memberships, edit applied migrations or mark anything applied manually. Cleanup/sign-out failure requires owner review of test sessions. If grants reappear, investigate their source before proposing another forward migration.

## Files changed in this repair

- Added `supabase/migrations/202610090001_identity_rpc_execute.sql`.
- Added `scripts/day1-rpc-execute-check.sql`; extended `scripts/day1-repair-history.sql`.
- Extended `tests/integration/auth-context.test.ts`; updated `tests/integration/identity.test.ts` to apply the new migration.
- Added this report; linked it from `docs/DAY1_IMPLEMENTATION.md` and `docs/DAY1_AUTH_CONTEXT_REPAIR.md`.

**GO for owner-reviewed dry-run/application after approval and matching preflight. NO-GO for declaring hosted Day 1 complete or starting Day 2 until hosted verification is supplied.** No hosted operation, commit or push was performed by this repair.
