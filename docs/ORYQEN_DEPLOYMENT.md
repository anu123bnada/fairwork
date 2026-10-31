# ORYQEN deployment

Detail: `ORYQEN_HOSTED_DEPLOYMENT_APPROVAL.md`, `ORYQEN_PRODUCTION_RUNBOOK.md`, `ORYQEN_DEPLOYMENT_CHECKLIST.md`, `OWNER_ACTIONS.md`.

## Targets
- Staging: https://oryqen-staging.vercel.app, Supabase project `oryqen-staging` (migrations applied to staging per the 28-29 Oct handoff; re-verify with `supabase migration list`).
- Production: not chosen. Owner decisions D1/D2 in `OWNER_ACTIONS.md` are open. Do not deploy or migrate production without explicit approval.

## Environment variables (names only)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN` (https origin, no path), `FAIRWORK_DATA_MODE`, `AUTH_REGISTRATION_ENABLED`, `ORYQEN_AI_PROVIDER`, `ORYQEN_AI_ENABLED`, `ORYQEN_AI_POLICY_APPROVED`, `ORYQEN_AI_POLICY_APPROVAL_REF`, `ORYQEN_AI_PROCESSING_REGION`, `ORYQEN_AI_DATA_USE`, `GEMINI_MODEL`, `GEMINI_API_KEY`, `ORYQEN_CREDENTIAL_KEY_ID`, `ORYQEN_CREDENTIAL_SIGNING_KEY`, `ORYQEN_CREDENTIAL_PUBLIC_KEYS`, `NEXT_PUBLIC_APK_URL`, `NEXT_PUBLIC_WINDOWS_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, optional `ORYQEN_VAULT_BUCKET`.

## Commands
```bash
npm ci
npm run build
node scripts/verify-hosted-staging.mjs https://oryqen-staging.vercel.app
supabase migration list        # needs the verified project ref; read-only
```
Migrations: files in `supabase/migrations`, applied in filename order, additive only, never edited after applying. Back up and test a restore first. `supabase db push` only after owner approval naming the project ref.

## Release steps
1. Gates green (see `ORYQEN_TESTING.md`). 2. Backup. 3. Migrations to staging. 4. Push the release branch (owner approval). 5. Run hosted smoke test. 6. Freeze.

## Rollback
Vercel: promote the previous deployment. Database: restore the backup taken in step 2; there are no down-migrations.

## Common failures
- Auth redirect loops: `APP_ORIGIN` and Supabase Auth redirect URLs must match the deployed origin.
- Next rewrites `next-env.d.ts` after builds: `git checkout next-env.d.ts`.
- Gemini 503/400: the app shows an unavailable state or deterministic analysis; do not loop retries.
