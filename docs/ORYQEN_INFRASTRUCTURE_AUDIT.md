# ORYQEN infrastructure identification audit (27 Oct 2026)

Read-only. Nothing hosted was changed, deployed, pushed, reset or renamed. No secret values were printed or recorded. The only hosted calls were `supabase projects list`, `supabase migration list --linked` and aggregate `select count(*)` / `pg_stat_user_tables` queries (the CLI creates its own short-lived login role for these, which is its normal behaviour).

## Verified Supabase projects

| Project | Ref | Region | Schema | Migrations applied | Auth users | Rows (private) | Storage buckets |
|---|---|---|---|---|---|---|---|
| `oryqen-staging` | `jpvgsmzomlmowarlfkdl` (**CLI-linked**) | ap-southeast-1 | ORYQEN: 64 private tables, 59 `api` functions | 32 (through `20261024053156`) | 4 | tiny (1 profile, 1 audit row) | 0 |
| `Fairwork` | `cqjxsafeodslmyoqftdj` (**what `.env.local` points to**) | ap-south-1 | ORYQEN: 59 private tables, 56 `api` functions | 30 (through `202610210002`) | 8 | small but real (4 profiles, 2 Work Passports, 14 audit rows, 2 integrity receipts) | 0 |

Other projects in the account (`echo hero 2`, `VerdiFi`, `ecommerce site 1`, `My Portfolio v0.1`, `supabase-aijourney`) are inactive and unrelated to ORYQEN.

Findings:
- Both projects carry the ORYQEN schema; project names alone do not decide it. `oryqen-staging` is a strict superset (32 vs 30 migrations; the two extra are `20261024052407` and `20261024053156`).
- `Fairwork` holds the older, larger data set (Work Passports and receipts). It is **not disposable**; treat it as holding data worth keeping until the owner confirms otherwise.
- Local `.env.local` uses `FAIRWORK_DATA_MODE=synthetic` against the `Fairwork` URL, so local development does not write hosted data. The CLI link (`supabase/.temp/project-ref`) and the env URL disagree: a mismatch risk, since `db push` would go to the linked staging project while the app config names the other.
- Neither project has a Storage bucket, so the private `evidence-vault` bucket does not exist anywhere yet.
- 17 local migrations are pending on `oryqen-staging` (`202610250001` … `20261028180000`), 19 on `Fairwork` counting the two it lacks. All are additive (create table/function/policy; no `drop`, `truncate`, or `delete` of existing rows) per the earlier per-migration review in `ORYQEN_HOSTED_DEPLOYMENT_APPROVAL.md`, but they have never run against a database that already contains data, so the backup-first plan below is mandatory.

## Vercel and Git (not fully verifiable here)

- The Vercel CLI is not installed or signed in on this machine, and no `vercel.json` / `.vercel` link is committed, so I could not verify which Git branch `oryqen` (oryqen.vercel.app) or `fairwork` (fairwork-opal.vercel.app) deploys, their environment variables, or their Supabase wiring. `gh` is also absent.
- Git: one remote, `github.com/anu123bnada/fairwork`; remote branches `main` (7b97b74) and `release/oryqen-oct27` (a25663a). The work branch `feature/oryqen-sprint-oct25` is local only and many commits ahead; nothing from it is pushed.
- Not verified: Vercel production branch per project, whether either project auto-deploys from `main`, and which Supabase project each uses.

## Recommended mapping (pending owner confirmation)

| Role | Vercel | Supabase |
|---|---|---|
| Staging / preview | a preview deployment of `oryqen` | `oryqen-staging` (`jpvg…`) |
| Production | `oryqen` | undecided: either promote `Fairwork` (keeps existing data, needs 19 migrations) or create a fresh production project (clean, but loses the 2 passports/8 users unless exported) |
| Legacy | `fairwork` (fairwork-opal) | keep unchanged until `oryqen` is confirmed serving; do not delete |

Safest default: keep `Fairwork` untouched as the data-holding legacy project, rehearse every migration on `oryqen-staging` first, then decide production.

## Backup-first migration and deployment plan (all steps need owner approval)

1. Owner confirms the mapping above and which project is production.
2. Back up the target first: `supabase db dump` of schema, roles and data plus a Supabase dashboard backup/PITR check; record the file SHA-256; restore the dump into a throwaway local database and run the schema and row-count checks.
3. Rehearse on `oryqen-staging`: run the 17 pending migrations in filename order inside the CLI's transaction, then `scripts` read-only verification (function owners, RLS forced, grants) and the real-stack journeys against it.
4. Create the private `evidence-vault` bucket, set Storage URL/key secrets, set `APP_ORIGIN`, `FAIRWORK_DATA_MODE=supabase`, credential-signing keys; run secret validation.
5. Preview deployment on Vercel, smoke test, then production migration (same order, backup immediately before) and promote.
6. Rollback: restore from the pre-migration backup; no migration is dropped in place. Keep `fairwork` Vercel/legacy Supabase untouched through the whole process.

## Unresolved questions for the owner

1. Which Supabase project becomes production (`Fairwork` with data, or a new one)? Are the 8 `Fairwork` users and 2 Work Passports real people or test records?
2. Which Git branch does each Vercel project deploy, and which Supabase project does each use? (Needs Vercel dashboard access or `vercel login`.)
3. Is the `fairwork` Vercel project still serving users?
4. Approval for the backup, the 17 staging migrations and later production steps.
