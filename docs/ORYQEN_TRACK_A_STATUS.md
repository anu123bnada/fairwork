# Track A — backend execution status, October 17, 2026

**BLOCKED: founder login is not ready. No hosted operation was performed.**

One fresh prerequisite check found WSL installed/default version 2, but WSL2 reports
virtualization unavailable: enable **Virtual Machine Platform** and firmware
virtualization. Docker Desktop is absent from PATH/standard install location and no
Docker process was found. Current session is not administrator. No installation
retry was attempted in Track A. The previous `0x80073d28` installation error is
historical; the current blocker is WSL2 virtualization plus missing Docker.

`.env.local` has registration enabled but still selects the hosted Supabase URL.
That does not override disabled hosted signup. Shared files and Antigravity-owned
frontend/AI files were not edited. The existing local launcher overrides connection
settings in memory, preserving the original configuration instead of replacing it.

## Evidence

- PASS: 4 local isolation/environment guard tests; these are not Auth tests.
- Native PostgreSQL 18.4 fixture run: sandbox loopback denial, then an unrestricted
  run exceeded the 60-second setup limit inside profile time-zone validation.
  Neither attempt passed; the latter skipped all 33 tests.
- Added optional `--extended-setup` to the existing native runner (five-minute hook
  limit only) and `test-track-a-persistence.mjs` to compare private-table counts/
  SHA-256 across a clean stop/start of a successful, marked native fixture.
- PASS: extended native run, **33/33 tests**, all ten migrations exercised,
  83.07 seconds; `test-results/day7-postgres-1792201494700/tests.log`.
- PASS: focused ESLint and Node syntax checks for the two changed test scripts.
- PASS: clean stop/start durability check, **32 private tables / 1,262 rows**;
  counts and SHA-256 matched before/after restart. Evidence:
  `test-results/day7-postgres-1792201494700/track-a-durability.json`.
  The fixture was stopped afterward. An initial helper error rejecting digits in
  `day3_*` table names was corrected; no application/SQL behavior changed.
- NOT TESTED: real Supabase signup/mail confirmation/session refresh/MFA/profile
  creation, Supabase PG17 CLI migration history, independent employer access through
  real Auth, or the founder's persistent application journey. All require the runtime.

Native fixtures exercise real SQL/RLS using simulated Auth context and test roles.
They cannot certify actual email/password authentication, TOTP, browser sessions or
the intended PostgreSQL 17/Supabase environment.

Exact successful verification commands:

```powershell
node scripts/test-day7-postgres.mjs --extended-setup
node scripts/test-track-a-persistence.mjs test-results/day7-postgres-1792201494700
node --test scripts/local-development-guard.test.mjs
```

The existing evidence file is preserved: do not rerun the last fixture's durability
command over its saved report. Use the next successful native run's directory.
Track A changed only the two test scripts and this short status report. No shared
configuration, frontend/AI source, migration, security rule or hosted service changed.

## Exact startup commands after Windows prerequisites

In **Administrator PowerShell**, enable Virtual Machine Platform:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart
# After required firmware/Windows restart steps, install Docker Desktop if absent:
winget install --id Docker.DockerDesktop --exact --source winget
```

Enable virtualization in firmware if disabled; save work and restart when ready.
Install Docker Desktop and start its Linux engine. `docker version` must show a
working Server section. Then in a new ordinary PowerShell:

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
node scripts/prepare-local-development.mjs
if ($LASTEXITCODE) { throw 'Local preparation failed' }
node scripts/start-local-development.mjs
if ($LASTEXITCODE) { throw 'Local services or isolation checks failed' }
node scripts/run-local-development.mjs
```

## Founder test (only after successful startup)

1. Open `http://127.0.0.1:3100/register`. Register `worker@oryqen.test` with your own
   password (at least 12 characters).
2. Open `http://127.0.0.1:55424`, follow the captured confirmation email and click
   the app's confirmation action. Create the profile through `/register/profile`.
3. Sign out, sign in with the same credentials and reload. Confirm the same profile.
4. Register `employer@oryqen.test` in a separate browser profile and confirm it.
   Employer rights are **not automatic**. Independently approved operator identities
   must complete real TOTP and the existing audited authority/bootstrap procedure
   before company/membership approval; see the existing local runbook.
5. With independent membership approved: create the offer, answer questions,
   confirm the agreement from both accounts, submit a Work Record, verify it from
   the employer account and inspect the worker's private Passport. Self-verification
   and outsider access must fail. Reopen after refresh and a backend stop/start
   that preserves volumes; compare the same IDs/revisions.

Do not remove synthetic employment-data restrictions or substitute fixture tokens
to complete this manual test. No hosted account creation, migrations, Auth change,
deployment, commit, push, reset or clean. Full login setup remains in
[the existing local runbook](ORYQEN_LOCAL_DEVELOPMENT.md).
