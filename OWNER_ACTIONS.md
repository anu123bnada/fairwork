# ORYQEN owner actions (27 Oct 2026)

Everything here needs **you**. Nothing hosted has been changed by the engineering sessions: no Supabase, Vercel, DNS or deployment action was taken.
Never paste a secret into chat; set secrets only in the Vercel or Supabase dashboards. Verify any target before acting; see `docs/ORYQEN_INFRASTRUCTURE_AUDIT.md`.

Verified read-only on 27 Oct: Supabase `oryqen-staging` (`jpvgsmzomlmowarlfkdl`, 32 migrations applied, 4 users) and `Fairwork` (`cqjxsafeodslmyoqftdj`, 30 applied, 8 users, 2 Work Passports, holds real-looking data). Vercel and Git branch linkage are **not** verified (no Vercel CLI login here).

## A. Decisions only you can make
| # | Decision | Options |
|---|---|---|
| D1 | Which Supabase project is production | (a) promote `Fairwork` (keeps its data; needs 21 migrations) or (b) create a new production project (clean; export the 8 users and 2 Passports first if they matter). Staging stays `oryqen-staging`. |
| D2 | Which Vercel project is production | Preferred: `oryqen` (oryqen.vercel.app). Keep `fairwork` untouched until `oryqen` serves. Tell me each project's production branch (I could not read it). |
| D3 | Gemini model | `gemini-3.1-flash-lite` (proven live through the app's provider code with synthetic text) or `gemini-3.5-flash` (listed by the API, not yet run through the app). The previously configured `gemini-3.8-flash` returned 503 under load. |
| D4 | AI policy | Approve (or not) sending user text to Google under written retention and region terms. Until then real-user AI stays off. |
| D5 | Webhook delivery worker | Vercel Cron route with a secret, or Supabase `pg_cron`+`pg_net`. See `docs/ORYQEN_DEVELOPER_API.md` ("Why there is no persistent delivery queue yet"). |
| D6 | Licensed salary dataset | Provide a licensed source; none is invented. |

## B. Actions (each approval-gated)
ACTION: Back up the target database, then check the backup restores
TARGET PROJECT: the project chosen in D1 (and `oryqen-staging` first for rehearsal)
WHY REQUIRED: 19 new migrations have never run against a database that already holds data
EXACT UI LOCATION: Supabase dashboard > Project > Database > Backups (check the PITR or daily backup), then download a schema+data dump (`supabase db dump`)
EXPECTED VALUE: a dated backup you have restored into a throwaway database
SECURITY IMPACT: none; the dump contains personal data, store it privately
ROLLBACK: n/a (this is the rollback source)
OWNER APPROVAL REQUIRED: YES

ACTION: Apply the pending migrations in filename order (staging first)
TARGET PROJECT: `oryqen-staging`, then the production project from D1
WHY REQUIRED: the app needs the 19 newer tables and functions: `202610250001` ... `20261028190000_offer_notes`, `20261029100000_admin_export_log`. All are additive (no drop/truncate/delete); list and risks in `docs/ORYQEN_HOSTED_DEPLOYMENT_APPROVAL.md`
EXACT UI LOCATION: after approval I run `supabase db push` against the verified ref; or Supabase dashboard > SQL editor, one file at a time
EXPECTED VALUE: `supabase migration list` shows every local version applied
SECURITY IMPACT: adds RLS-protected tables and authenticated-only functions
ROLLBACK: restore the backup above; no migration is edited after being applied
OWNER APPROVAL REQUIRED: YES (name the exact project ref)

ACTION: Create the private Storage bucket
TARGET PROJECT: the production project (and staging)
WHY REQUIRED: Evidence Vault documents; neither project has any bucket yet
EXACT UI LOCATION: Supabase dashboard > Storage > New bucket
EXPECTED VALUE: bucket id `evidence-vault` (the app default; override only with `ORYQEN_VAULT_BUCKET`), **Public bucket OFF**, file size limit 5 MiB, allowed MIME types `application/pdf, image/png, image/jpeg, image/webp`, no storage policies for anon or authenticated (the app reaches it only with the server key)
SECURITY IMPACT: files are private; downloads use 60-second signed links
ROLLBACK: delete the empty bucket
OWNER APPROVAL REQUIRED: YES

ACTION: Set Vercel environment variables (Production; names only here, values yours)
TARGET PROJECT: Vercel `oryqen` (D2)
EXACT UI LOCATION: Vercel > Project > Settings > Environment Variables
EXPECTED VALUE:
- `APP_ORIGIN` = the https production origin, no path
- `FAIRWORK_DATA_MODE` = `supabase`
- `AUTH_REGISTRATION_ENABLED` = `true` or `false` (true only after the Supabase confirmation email template and sender are set)
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` of the D1 project (publishable key only; never a service-role key)
- `ORYQEN_VAULT_STORAGE_URL` = the project URL; `ORYQEN_VAULT_STORAGE_SERVICE_KEY` = server-only secret (mark Sensitive)
- `ORYQEN_CREDENTIAL_KEY_ID`, `ORYQEN_CREDENTIAL_SIGNING_KEY` (secret), optional `ORYQEN_CREDENTIAL_PUBLIC_KEYS`
- AI (leave off until D4): `ORYQEN_AI_ENABLED=false`, `ORYQEN_AI_POLICY_APPROVED=false`; to enable later add `GEMINI_API_KEY`, `GEMINI_MODEL`, `ORYQEN_AI_PROVIDER=gemini`, `ORYQEN_AI_POLICY_APPROVAL_REF`, `ORYQEN_AI_PROCESSING_REGION`, `ORYQEN_AI_DATA_USE`
- Do **not** set `ORYQEN_VAULT_LOCAL_DIR` or `SUPABASE_SERVICE_ROLE_KEY`
SECURITY IMPACT: secrets live only in Vercel; `node scripts/validate-production-config.mjs --env-file=<file>` checks names and shape without printing values
ROLLBACK: remove or change the variable and redeploy
OWNER APPROVAL REQUIRED: YES

ACTION: Supabase Auth settings
TARGET PROJECT: production project
EXACT UI LOCATION: Supabase > Authentication > URL Configuration and Email Templates / SMTP
EXPECTED VALUE: Site URL = the production origin; redirect URLs `https://<origin>/auth/confirm` and `https://<origin>/auth/recover`; a real SMTP sender; MFA (TOTP) enabled
SECURITY IMPACT: controls where sign-in links can land
ROLLBACK: restore previous URLs
OWNER APPROVAL REQUIRED: YES

ACTION: Generate and install signing keys (you hold them, I never see them)
EXACT UI LOCATION: run `node scripts/generate-credential-key.mjs` offline, put the private JWK into Vercel as a Sensitive variable, keep an offline backup
EXPECTED VALUE: enables verifiable credentials and the signed Work Passport copy (both return "unavailable" without it)
ALSO: Android release keystore + application ID, Windows code-signing certificate, and https hosts for `NEXT_PUBLIC_WINDOWS_URL` / `NEXT_PUBLIC_APK_URL`; until then installers are debug-signed or unsigned and are labelled so
ROLLBACK: rotate the key id; old public keys stay published for verification
OWNER APPROVAL REQUIRED: YES

## E. Authentication on staging (found by the auth audit, `docs/ORYQEN_AUTH_AUDIT.md`)
The app now accepts Supabase's default recovery and invitation emails and forwards a link that lands on the site root, so **no template change is required** for password reset or invitations to work once the fixed build is deployed to the staging Vercel project. These are the checks and optional hardening:

ACTION: Confirm the settings the audit read
TARGET PROJECT: Supabase `oryqen-staging` (`jpvgsmzomlmowarlfkdl`)
EXACT UI LOCATION: Authentication > URL Configuration
EXPECTED VALUE: Site URL `https://oryqen-staging.vercel.app` (already set); Redirect URLs include `https://oryqen-staging.vercel.app/**` (already set). For production later add `https://<production origin>/auth/recover`, `/auth/confirm` and set Site URL to the production origin
SECURITY IMPACT: a redirect that is not on the list falls back to the Site URL
ROLLBACK: restore the previous list
OWNER APPROVAL REQUIRED: only if you change it

ACTION: Raise the minimum password length (recommended)
EXACT UI LOCATION: Authentication > Sign In / Providers > Email > Minimum password length
EXPECTED VALUE: 12 (currently 6; the app already requires 12 for its own sign-up and reset, but dashboard-created users can have 6)
ROLLBACK: set it back
OWNER APPROVAL REQUIRED: YES

ACTION: Sender domain for Brevo (recommended before real users)
EXACT UI LOCATION: Brevo > Senders, Domains & Dedicated IPs; Supabase > Authentication > SMTP Settings
EXPECTED VALUE: an address on a domain you own with SPF and DKIM verified in Brevo (the current sender is a free webmail address, which many mailbox providers treat as spoofed when sent through a relay)
OWNER APPROVAL REQUIRED: YES

ACTION: Optional templates (not needed for the fix)
EXACT UI LOCATION: Authentication > Email Templates > Reset Password
EXPECTED VALUE: either keep the default, or `<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>`. Leave the Invite template on its default (an invitation link is completed by the forwarder and the recovery page)
OWNER APPROVAL REQUIRED: only if you change it

### Manual staging checks (after the fixed build is deployed to `oryqen-staging.vercel.app`)
1. Open https://oryqen-staging.vercel.app/forgot-password, request a reset for an account you control, open the **newest** email. Expect the "Confirm recovery link" page (not "Check the supplied fields."). Click it, choose a password of 12+ characters, expect "Your password was changed", sign in with it.
2. Open the same email link again. Expect "This link has expired" with a "Request a new reset email" button and no password field.
3. In Supabase Authentication > Users, invite a test address. Open the invitation email. Expect to land on the recovery page with "You were invited to ORYQEN", click the button, choose a password, sign in, create the profile.
4. Register a new account at /register, open the confirmation email, expect the "Confirm my email" page, then profile creation.
5. Open /auth/recover directly. Expect "Open the link in your email".
6. If you use a second browser or tab for any link, the first successful use consumes it; the other shows the expired message.
Report any step that differs, with the page text, not the link.

## F. Staging deployment runbook (exact commands; nothing below has been run against hosted systems except the read-only checks listed as DONE)

Target: Supabase project **`oryqen-staging`**, ref **`jpvgsmzomlmowarlfkdl`** (ap-southeast-1). Do **not** use `Fairwork` (`cqjxsafeodslmyoqftdj`, which `.env.local` still names for local work).

### F0. What I verified before asking (read-only, 28 Oct 2026)
| Check | Result |
|---|---|
| Real-stack harness on the current commit | **225 PASS, 0 FAIL, 0 SKIPPED**, exit 0 |
| Upgrade rehearsal: first 32 migrations + synthetic rows, then the 19 pending, on PGlite **and** a real PostgreSQL cluster | **5/5 pass on both**. No existing row changed or lost; all 26 new private tables have row-level security enabled and forced; no direct client grants; no PUBLIC-callable function; the only anonymous-callable functions are the two designed ones (`api.credential_status`, `api.developer_key_check`) |
| `supabase db push --dry-run` against the linked project | Lists exactly the 19 pending migrations (`202610250001_offer_lifecycle` ... `20261029100000_admin_export_log`) |
| Storage on staging | Bucket **`evidence-vault` already exists**: private (`public=false`), limit 5,242,880 bytes, MIME `application/pdf, image/png, image/jpeg, image/webp`, created 27 Oct 03:02 UTC, 0 objects, no policies on `storage.objects`. **Do not create another one.** |
| Platform backups | `supabase backups list`: `walg_enabled: true`, `pitr_enabled: false`, **no backups listed**. There is no restorable platform backup for this project today |
| Logical backup | **Made by me, read-only**: `backups\staging-20261028\{schema,data,roles}.sql` + `SHA256SUMS.txt` (git-ignored; contains personal data and password hashes, keep it private). Data file holds 5 auth users, 5 identities and all `private` rows |
| Restore validation | Restored into a throwaway Postgres 17.11 container (same image family as staging): roles and **schema restored with no errors (64 private tables)**; `private` data restored with row counts identical to staging (profiles 1, audit_logs 1, command_receipts 1, passport_field_registry 6, rate_limit_buckets 10). **Not validated: the `auth` data.** A bare Postgres has no GoTrue `auth` schema, so the 5 users could not be loaded there. The container was removed |
| Secrets in the push | Commit range `origin/release/oryqen-oct27..HEAD` has no `.env`, key, keystore or backup files; neither the Gemini key nor the Supabase publishable key value appears in any commit; the only key-shaped text is scanner patterns and clearly fake test fixtures |
| Baseline for comparison | 32 migrations applied (latest `20261024053156`), 64 private tables, 0 without forced RLS, 0 anonymous-callable functions |

**Not verified by me (needs you):** the Vercel project, its production branch and its Preview environment variables (no Vercel access from here); a Supabase **dashboard** backup (none is listed by the API); the hosted email template.

### F1. Preflight (safe to run any time)
```powershell
cd C:\Users\vehiv\Desktop\fairwork
git status --short                                  # only the two known untracked files may appear
git log --oneline -1                                # record this hash
Get-Content supabase\.temp\project-ref              # MUST print jpvgsmzomlmowarlfkdl
npx supabase projects list                          # the row marked linked must be oryqen-staging
npx supabase migration list --linked                # 32 versions on both sides, 19 local-only
npx supabase db push --linked --dry-run             # must list exactly the 19 files
npx supabase backups list --project-ref jpvgsmzomlmowarlfkdl
```
Stop if any line differs from the expectation in the comment.

### F2. Fresh backup immediately before applying (read-only on hosted)
```powershell
$d = "backups\staging-$(Get-Date -Format yyyyMMdd-HHmm)"; New-Item -ItemType Directory $d | Out-Null
npx supabase db dump --linked -f "$d\schema.sql"
npx supabase db dump --linked --data-only --use-copy -f "$d\data.sql"
npx supabase db dump --linked --role-only -f "$d\roles.sql"
Get-FileHash "$d\*.sql" -Algorithm SHA256 | Format-Table Hash, Path
```
Also, if your plan allows it, take a dashboard backup (Supabase > Database > Backups). The API shows none.

### F3. Apply (needs your explicit "approved, project jpvgsmzomlmowarlfkdl")
```powershell
npx supabase db push --linked          # prints the 19 files and asks for confirmation; answer Y
```
The CLI runs each file in order in its own transaction and stops at the first error. A failed file leaves the earlier ones applied and the failed one not applied; nothing is partially applied inside a file.

### F4. Post-migration verification (read-only)
```powershell
npx supabase migration list --linked    # 51 on both sides
npx supabase db query --linked -o json "select (select count(*) from supabase_migrations.schema_migrations) applied, (select max(version) from supabase_migrations.schema_migrations) latest, (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r') private_tables, (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and not (c.relrowsecurity and c.relforcerowsecurity)) without_forced_rls, (select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text),'none') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private') and has_function_privilege('anon', p.oid, 'EXECUTE') and p.proowner<>(select oid from pg_roles where rolname='supabase_admin')) anon_callable, (select count(*) from private.profiles) profiles, (select count(*) from auth.users) auth_users"
```
Expected: `applied 51`, `latest 20261029100000`, `private_tables 90`, `without_forced_rls 0`, `anon_callable` = `api.credential_status(jsonb), api.developer_key_check(jsonb)`, `profiles 1`, `auth_users 5`. Anything else: stop and send me the output.

### F5. Rollback and recovery
- **The migrations are additive** (no drop, truncate or delete of existing data; proven by the rehearsal). The previous build (`a25663a`) never calls the new objects, so the safest rollback of *behaviour* is to redeploy the previous Vercel deployment; the new empty tables then simply stay unused.
- **If a file fails:** nothing from that file is applied. Fix is mine to make; do not retry by hand. Send me the CLI output.
- **To remove the new objects entirely or recover from a mistake:** create a new Supabase project, restore `roles.sql`, then `schema.sql`, then `data.sql` (with `set session_replication_role = replica;` first), as validated above for the `private` schema. Auth users are in `data.sql` but the restore of `auth` rows was **not** validated; on a new project you would load them into the project's own `auth` schema or ask each user to reset their password.
- No hosted data is deleted by any step here.

### F6. Vercel Preview environment (names are exact; values yours; mark secrets Sensitive)
Staging project mapping: the Preview deployment for branch `release/oryqen-oct27` must point at **`oryqen-staging`** and its origin must be the host people use (`https://oryqen-staging.vercel.app`, which Supabase already lists as Site URL).
| Variable | Value for staging | Required |
|---|---|---|
| `APP_ORIGIN` | `https://oryqen-staging.vercel.app` (no path; must equal the host in use, it is the same-origin check and the reset-link target) | yes |
| `FAIRWORK_DATA_MODE` | `supabase` | yes |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jpvgsmzomlmowarlfkdl.supabase.co` (**not** `cqjxsafeodslmyoqftdj`) | yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging publishable (anon) key; never a secret/service key | yes |
| `AUTH_REGISTRATION_ENABLED` | `true` | for sign-up |
| `ORYQEN_VAULT_STORAGE_URL` | `https://jpvgsmzomlmowarlfkdl.supabase.co` | for the Vault |
| `ORYQEN_VAULT_STORAGE_SERVICE_KEY` | staging secret key (server only, Sensitive). This key can read every file in the project; limit who can see Vercel settings and rotate it after the trial | for the Vault |
| `ORYQEN_VAULT_BUCKET` | omit (default `evidence-vault` exists) | no |
| `ORYQEN_AI_ENABLED`, `ORYQEN_AI_POLICY_APPROVED` | `false` | keep off |
| `ORYQEN_CREDENTIAL_KEY_ID`, `ORYQEN_CREDENTIAL_SIGNING_KEY` | omit until you run the key ceremony; credentials and the signed Passport copy then report "unavailable" | later |
Do not set `ORYQEN_VAULT_LOCAL_DIR`, `SUPABASE_SERVICE_ROLE_KEY` or any `NEXT_PUBLIC_` variable named like a secret. After the build, check the values without printing secrets: `node scripts/validate-production-config.mjs --env-file=<a file you create outside the repo>`.

### F7. Push (needs your explicit "approved to push")
```powershell
git push origin feature/oryqen-sprint-oct25:release/oryqen-oct27     # fast-forward of a25663a, 97+ commits, no force
```
The remote branch is an ancestor of this branch, so no force is needed or allowed. Vercel will build the Preview automatically.

### F8. After the build I run (no account needed)
```powershell
node scripts/verify-hosted-staging.mjs https://oryqen-staging.vercel.app --json
```
Baseline today (old build `a25663a`): PASS 19, FAIL 5 (`/verify` 404, vault and credentials routes 404, recovery fix absent). The new build must show FAIL 0. Then the signed-in checks in section E and the 14-feature demo (`docs/DEMO_SCRIPT_14_FEATURES.md`) on staging with accounts you control; I need only the visible results, never passwords.

## C. What I will do after approvals
Run the backup check, migrations (staging first), bucket-dependent tests against the hosted target, a preview deployment smoke test, and then report. Until then I continue local work only.
