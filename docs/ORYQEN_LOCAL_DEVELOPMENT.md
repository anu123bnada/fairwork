# ORYQEN — real local login and persistent workflow environment

**October 19 update:** Stage 8 reverified 121 real workflow checks, 6 recovery/MFA
checks, 9 installed Windows PWA checks and 11 installed Android emulator checks.
See `docs/STAGE8_INTEGRATION.md` for current evidence; older counts below are retained
as history. Never run `run-local-development.mjs` (3100) and
`android-local-server.mjs` (3102) together: Next shares generated files between them
and can continuously refresh forms. The launchers now reject that combination.
Stop only the app server when switching; keep database services and data intact.
The founder app was restored on port 3100 after verification.

Updated October 18, 2026. **Real local authentication and persistent workflow verified.**

Completed acceptance: **121 real local checks**, including app restart, case review,
company revisions, notifications, privacy requests, named-recipient Passport sharing,
fresh recipient sign-in and account deactivation/access denial with history retained.
Evidence: `test-results/local-real-1792332005869/results.json`. Twenty-two preserved/
additive local migrations are pinned; hosted is unchanged. The local app was left
running on port 3100. Do not start a second instance while that port is occupied.

Windows: a local ORYQEN Chrome PWA is installed in the separate
`.tmp/windows-pwa-profile` profile. Start the backend/app below, then open **ORYQEN**
from Windows Start (Chrome Apps). It retains a synthetic test account; sign out and
use your own locally registered account for manual testing. Seven real installation/
authentication/reopen/offline/back checks passed in
`test-results/windows-pwa-1792302445752/results.json`. This is a PWA, not a native
EXE/MSIX. Keep the repository/profile path stable. It loads current app code from
port 3100; no offline copies of private API responses or production updater exist.
Chrome updates remain managed by Chrome. Hosted distribution needs approved HTTPS.

Gemini remains disabled: read `docs/GEMINI_PROCESSING_GATE.md`. No key, personal
employment data, paid billing or hosted changes are needed for local manual rules.

## Current start and manual test procedure

The historical preparation notes below are superseded by this section. Docker/WSL
are working. Services use a protected named PostgreSQL volume and internal network;
only a restricted TCP relay publishes ports on **127.0.0.1**. `.env.local` remains
unchanged; the launcher supplies local connection settings in process memory.

```powershell
Set-Location C:\Users\vehiv\Desktop\fairwork
# Start Docker Desktop first. These commands use the unlinked LOCAL project only.
node scripts/prepare-local-development.mjs
node scripts/start-local-development.mjs
node scripts/run-local-development.mjs
```

1. Open **http://127.0.0.1:3100/register**. Use a new synthetic address such as
   `founder-worker@example.test` and your own password of at least 12 characters.
2. Open **http://127.0.0.1:55424**. Open the corresponding confirmation email and
   its link, then click **Confirm my email**. Mail stays local; no external delivery.
3. Enter a display name and click **Create my profile**. Open `/app/home`.
4. Sign out through Settings, then use `/sign-in` with the same credentials. Refresh
   and restart the app: the profile and saved records remain in PostgreSQL.
5. For MFA, open Settings → **Account security and deactivation**, then **Set up
   account authenticator**. Add the private key to your authenticator and verify
   its current six-digit code. This grants no employer or operator permission.
6. Use a separate browser profile for the employer. Registration does **not** grant
   representative rights. A distinct authorized operator must approve membership.
   The reviewed `scripts/day2-bootstrap-capability.sql` is still required for the
   first operator, with two real local active profiles, verified TOTP factors,
   a named local approval and bounded expiry. Never run its NULL placeholders.
7. For manual offer entry, open `/app/add-offer`, choose **Enter manually**, supply
   the approved Company ID and worker account ID (visible at `/api/v1/me`), and enter
   known terms. Unknown terms generate persisted questions. Worker-created offers
   remain private drafts. For independent agreement confirmation, the approved
   employer creates an offer for that worker and shares its participant link.
8. The worker creates/proposes its versioned agreement; each account acknowledges
   unresolved items and confirms independently. Log work against that effective
   agreement; submit it; the employer reviews the exact record. The worker's
   `/app/passport` then displays eligible verified work privately.
9. In Settings, expand **Manage privacy requests** to submit or withdraw an access,
   correction, deactivation or deletion-review request and inspect its audit timeline.
   This records a request only. It does not deactivate an account, export information
   or delete data. A separately assigned MFA-verified `privacy_operator` can review
   other users' requests in Settings. Manual completion must reference an approved
   procedure and evidence; no automatic retention/purge feature is implemented.
10. To share eligible work, open Passport → **Share your passport**. Select one
    eligible revision, enter a minimal disclosure summary, the intended recipient's
    account UUID (they can view their own `/api/v1/me`) and expiry within 30 days.
    Choose fields, **Prepare private preview**, inspect it, check the authorization
    box and activate. Only then copy the link. The recipient signs in independently.
    **Revoke grant** or **Narrow this selection** stops future disclosure. Case,
    withdrawal, retraction and revision checks still apply. Saved copies cannot be
    recalled; summaries are owner-written claims, not verified facts.
11. Test deactivation only on a disposable synthetic account you no longer need.
    In Settings → **Account security and deactivation**, verify the authenticator,
    expand **Deactivate my account**, type `DEACTIVATE`, then submit. This blocks
    account access and its outgoing Passport disclosures and attempts global sign-out.
    It preserves agreements, records and audits. There is no self-service reactivation
    or deletion; submit needed privacy requests before deactivating.

Executable real acceptance test (stop your app with Ctrl+C first; port 3100 must
be free): `node scripts/test-local-real-workflows.mjs --manage-app`. It creates
four synthetic accounts through real browser/email flows, verifies real TOTP,
uses the reviewed audited one-day local operator bootstrap, and tests the actual
APIs and app restart. It retains audit records, never prints credentials, and
does not provide reusable shared passwords. Use your own accounts for manual work.

**Repair:** `202610180001_deferred_integrity_context.sql` is migration 11, applied
locally only. Both deferred integrity triggers now run as their existing restricted
`fw_user_exec` owner at commit. No private client grants, RLS bypass or original
migration edits. SHA-256:
`26c5fae862178116bbdc1d343d2f65542f7930e01a0c52a6d38e8331a304105c`.
The previous hosted activation package covers ten migrations and must be extended
and reviewed before approval. With the historically reported four hosted versions,
**18 files** now await hosted review; the history has not been freshly queried.

**Limits:** real local persistence is working, but business authority remains
synthetic (`demo-authority.v1`). No real employer verification is claimed. The
existing analysis is explicitly rule-based. `GEMINI_API_KEY`, `GOOGLE_API_KEY` and
`OPENAI_API_KEY` are absent; no live AI result is claimed. Android and hosted
activation were not tested here. All existing assets/layouts remain unchanged.

**Storage safety:** the first diagnostic CLI retry automatically pruned its new
failed-start database volume before any accounts existed. The corrected startup
pins the persistent volume with `oryqen-local-volume-guard`; leave this stopped
holder and the preserved diagnostic containers intact. Never prune volumes or run
`db reset`/`stop --no-backup`. The backup/export approval checkpoint remains closed.

## Historical preparation notes (October 17; superseded)

Current October 18 evidence: `test-results/local-real-1792265315798/results.json`
proves real local Auth/API/PostgreSQL workflow and app-restart persistence.
`test-results/local-real-1792265315798/` contains tightened loaded mobile captures.
Regression: 223 passed, 14 skipped (unit/API/PGlite); six startup safety tests pass;
13 fixture-backed browser regressions pass; production build, TypeScript and
focused lint pass. No claim of hosted/Android verification.

Owner priority: make the existing application usable for manual local testing before
broad release work. Use real Supabase Auth, local confirmation mail, PostgreSQL
persistence, existing RLS/RPCs, MFA and independent authority. No mock login,
fabricated verification, hosted accounts or production-data restore.

## Actual blockers and prepared changes

The machine reports WSL not installed; Docker Desktop was not found. Existing
`supabase/config.toml` disables signup and local inbox. Existing `.env.local` selects
hosted services. Starting Next alone cannot provide isolated local login.

Prepared `.tmp/oryqen-local-dev/supabase/` with a different project ID and byte-identical
copies of all ten pinned migrations. Preparation refuses modified existing files,
symlinks, extra migrations and a hosted project link. No DB reset or seed is used.
Root config, `.env.local`, migrations, Android and visual assets remain unchanged.

| Service | Intended address / persistence |
| --- | --- |
| Next.js development server | `http://127.0.0.1:3100` |
| Local Supabase gateway/Auth/PostgREST | `http://127.0.0.1:55421` |
| Local development PostgreSQL | `127.0.0.1:55422`, CLI-managed named volume |
| Local Studio | `http://127.0.0.1:55423`, local developer access only |
| Local confirmation mailbox | `http://127.0.0.1:55424`, private local capture, no external delivery |
| Future hosted-backup restore | Separate instance/volume/DB, proposed port **55432**, NOT the development database |

The isolated config enables local email signup and confirmation, sets the exact
confirmation redirect/template, keeps passwords at least 12 characters, anonymous
and SMS signup off, secure password change on and TOTP enrollment/verification on.
The mail capture is a real local delivery sink, not a fake confirmation response.
Actual delivered links remain untested until services run.

Scripts:

- `prepare-local-development.mjs`: idempotent local files only; no network/startup.
- `start-local-development.mjs`: requires local Windows Docker context, creates a
  dedicated labelled internal network with loopback port defaults, starts the
  isolated Supabase project and checks actual mounts/bindings. Suppresses raw CLI
  status credentials. First start applies existing migrations to the **new local DB**.
- `run-local-development.mjs`: refuses hosted links/connection overrides, verifies
  local Docker isolation and persistent DB volume, reads local public status fields
  in memory, then starts Next on loopback. Process environment overrides the existing
  hosted settings without editing `.env.local`. It rejects secret/service-role keys.
- `local-development-guard.mjs` / runtime helper: reject remote Docker, publicly
  bound ports, additional container networks, missing persistent DB volume and
  unexpected backend URLs. CLI status JSON shape/container paths still need live
  validation against the installed runtime; an unexpected shape stops startup.

The first runtime check must confirm CLI port publishing respects the internal
network's loopback default. If CLI explicitly binds all interfaces or requires
external runtime connectivity, stop and fix local provisioning before entering any
account information. Do not bypass the checks or enable health-check ignoring.
Local developer infrastructure tools are privileged; never expose Studio/mail/DB
ports to the LAN. These services are not a production hosting setup.

## Next execution sequence

**Installation attempt, October 17:** Windows build 26300, 64-bit process, no
administrator token. `wsl --install --no-distribution` exited 1 without installing.
`winget show --id Microsoft.WSL --exact --source winget --disable-interactivity`
identified official **WSL 2.7.13**. The approved package installation verified its
installer hash, then failed with **0x80073d28: administrator privileges required**.
No successful WSL installation or Docker start is claimed; nothing was rebooted.

**Owner action:** open PowerShell using **Run as administrator** and install the
verified WSL package. This OS elevation cannot be supplied by the current agent
process. Resolve any requested Windows-feature activation/restart, then install
Docker Desktop and launch its Linux engine. Review its license in the installer.

```powershell
# OWNER ADMINISTRATOR TERMINAL; local machine installation only.
winget install --id Microsoft.WSL --version 2.7.13 --exact --source winget
# Check success before proceeding; install/enable required WSL features if requested.
wsl --install --no-distribution
# Restart only when the owner is ready and Windows requests it.
wsl --version
winget install --id Docker.DockerDesktop --exact --source winget
# Launch Docker Desktop, then confirm the local Linux engine starts successfully.
docker version
```

This is not an approval to export/restore hosted data. If administrator access is
unavailable, a separately selected machine/VM with a local Docker-compatible engine
is needed; do not replace Supabase Auth with a stub to bypass this prerequisite.

1. Install WSL 2 and Docker Desktop using official installers with owner/system
   approval. Windows feature changes may require administrator access and a restart;
   do not reboot automatically. Verify hardware virtualization, supported Windows
   build, memory, free storage and Docker license eligibility. No paid service is
   required merely to run the application locally; licensing depends on usage.
   [Docker prerequisites](https://docs.docker.com/desktop/setup/install/windows-install/),
   [WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install).
2. Start Docker Desktop's local Linux engine. Keep the reviewed CLI at **2.120.0**
   for this first run; no automatic version upgrade. This Windows path requires a
   container runtime; the documented Supabase native runtime does not support
   Windows. [Supabase local services](https://supabase.com/docs/guides/local-development/cli/getting-started).
   Open a new terminal after installation so the Docker executable is on PATH.
3. From the repository, run in order:

```powershell
node scripts/prepare-local-development.mjs
if ($LASTEXITCODE) { throw 'STOP: local preparation failed' }
node scripts/start-local-development.mjs
if ($LASTEXITCODE) { throw 'STOP: local services/isolation failed' }
node scripts/run-local-development.mjs
```

Initial image downloads take time and consume local disk. Container health,
migration application and status format are **not yet runtime-tested**. Neither
backend nor frontend startup is currently claimed successful. Run the generated
stage-6 catalog/constraint assertions against local PostgreSQL before workflow tests;
do not reuse the `--network` hosted inspector for local DB verification.

4. Visit `/register` on the local app origin; create a new local account with a
   password you choose. Use an address under `.test` for local development, e.g.
   `worker@oryqen.test`. Open the local mailbox, follow the real token-hash link,
   explicitly confirm and create a profile. Sign out and sign in again. Never paste
   credentials or confirmation links into chat; no shared default passwords.
5. Verify reload/session recovery. Create a distinct employer account in a separate
   browser profile. Use the existing independent authority process below before
   company/offer actions. A successful profile alone does not grant employer rights.
6. Execute offer → questions/answers → agreement revisions → independent confirmations
   → submitted work record → independent verification → private Passport. Verify
   participant/outsider denial, self-verification denial and stale revision rejection.
   Stop/restart the local backend without deleting volumes, then reopen the same
   records and compare their revisions/receipts. This is the required persistence proof.
7. Stop the app with Ctrl+C. Use ordinary `supabase stop` with **the isolated workdir**
   to preserve local data. Never `db reset`, `stop --no-backup`, prune, volume deletion,
   or a root-directory hosted command. No hosted backup is loaded into this environment.

## Independent authority prerequisite

Existing `scripts/day2-bootstrap-capability.sql` is an offline owner procedure with
NULL placeholders and cannot be run unchanged. It requires distinct active approver
and authority-operator profiles, verified TOTP factors for both, explicit approval
reference, bounded expiry (at most seven days), and an immutable audit record.
The authority operator then reviews/provisions the synthetic company and the
employer's membership through existing AAL2-protected APIs. The employer cannot
self-approve. Depending on existing local profiles, this needs additional local
operator accounts beyond the worker/employer pair. Do not silently auto-seed
privileges or replace the real MFA process with test JWT claims.

No bootstrap, account creation or authority command has been executed yet. Once
local login is running, prepare a private local copy for specifically approved
identities and verify the existing denial requirements before executing it.

## Product and AI limits, stated plainly

The local stack is real infrastructure and stores real local user actions, not
browser response fixtures. Nevertheless, existing business policy deliberately
accepts synthetic employment data only (`FAIRWORK_DATA_MODE=synthetic`,
`demo_provisioned` / `demo-authority.v1`). This preparation does not remove that
restriction or claim commercial production readiness. Changing it needs an explicit
production authority/data-policy implementation, not a flag bypass.

The reviewed offer route is `manual-offer.v1` using authenticated SQL commands.
This task has not integrated an AI provider or proved an AI-assisted offer flow.
Do not label deterministic/manual checks as working AI. After real login and
persistence pass, scope the missing AI functionality, provider credentials, data
consent, server-only integration, cost limits and failure handling as a separate
implementation. Keep any AI recommendations outside authorization/verification
decisions. No AI keys or external model calls were introduced here.

## Evidence

- Local preparation generated **10 pinned, unchanged migration copies** and local
  config/template. Re-running preparation does not reset data or overwrite changes.
- **4 guard tests PASS**: hosted/credential-bearing URLs, secret keys, remote Docker,
  unsafe port/network/volume cases denied; inherited hosted app settings overridden.
- Focused ESLint and Node syntax checks PASS for the prepared scripts.
- Actual `node scripts/start-local-development.mjs` attempt stopped with exit 1 at
  the missing-Docker check, before network/container creation or database writes.
  All ten copied migration hashes were independently compared with source again;
  no hosted link exists in the local project.
- These tests are configuration/security tests, **not real Auth/DB/browser success**.
- Runtime installation/startup, actual email confirmation/MFA, local migration/catalog
  checks and durable workflow/browser testing remain outstanding.

Backup plan remains [stopped at approval](ORYQEN_BACKUP_RESTORE_EXECUTION.md).
Owner confirms Supabase **Free** and proposes
`C:\Users\vehiv\ORYQEN-Secure-Backups`; encryption/ACLs/restore target are not ready.
No hosted export, restore, migration, Auth change, deployment, commit or push.
