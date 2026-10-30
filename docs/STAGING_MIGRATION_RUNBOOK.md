# Staging database: apply the pending migrations

Why: on 30 Oct 2026 a read-only check of `oryqen-staging` (`jpvgsmzomlmowarlfkdl`) showed that the database is missing the
functions behind offer drafts, offer lifecycle, analysis history, employment history, company team, credentials, evidence
vault, developer keys/webhooks, entitlements and recruiter tools. The app then answers "ORYQEN could not reach the secure
service" when saving. `supabase/migrations` holds 46 files; staging had about 32 applied.

This needs the project owner's Supabase login. It changes the database, so it is done by the owner, staging only.

## 1. Back up first
Supabase dashboard → project `oryqen-staging` → Database → Backups → take a backup (or "Create backup" / download).
Staging currently holds a few test users; the migrations are additive (rehearsal on PGlite and real PostgreSQL passed 5/5 with no
existing row changed), but do not skip the backup.

## 2. Link and review what is pending
```bash
npx supabase login
npx supabase link --project-ref jpvgsmzomlmowarlfkdl
npx supabase migration list
```
Rows with a LOCAL version and an empty REMOTE column are the pending ones. If any REMOTE version has no LOCAL file, stop and ask
before continuing.

## 3. Dry run, then apply
```bash
npx supabase db push --dry-run
npx supabase db push
```
`db push` applies only the missing files, in filename order. Do not use `db reset` (it deletes data).

## 4. Verify (read-only, no secrets printed)
```bash
node scripts/verify-staging-migrations.mjs
```
Expect `All functions the app calls exist.` Then in the app: sign in → Add offer → Analyze offer. The result must say
"Saved to your account as a private draft", survive a page refresh under "Private offer drafts", and open again for edit.

## 5. If something goes wrong
Restore the backup from step 1 (Database → Backups). Do not edit a migration after it has been applied.

## Do not run this against the `Fairwork` project (`cqjxsafeodslmyoqftdj`): it holds older real-looking data and is a separate decision (OWNER_ACTIONS.md, D1).
