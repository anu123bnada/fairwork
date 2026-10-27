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

## C. What I will do after approvals
Run the backup check, migrations (staging first), bucket-dependent tests against the hosted target, a preview deployment smoke test, and then report. Until then I continue local work only.
