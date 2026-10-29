# Offer journey: real-stack save/reopen verification (handoff to Agent 1)

Status: **NOT RUN. The UI-to-database offer journey is NOT verified.** Agent 4 did not run this on purpose: it changes the shared local database. Do not record the journey as verified until the command below exits 0 on the integrated branch.

## What it proves
`scripts/test-local-real-workflows.mjs` uses real local Supabase Auth, mail, TOTP and PostgreSQL with no route mocks. Its offer section (stages `worker private offer` and `offer persistence after logout and fresh login`) drives the real Add Offer screen as a signed-in worker:
1. Paste text, press **Suggest terms with local rules**, check Role title, Pay amount and Responsibilities fill correctly.
2. Pick the company in **Company organization**, check **Worker account ID** is read-only and equals the signed-in id.
3. Press **Analyze offer** and expect HTTP 200 from `POST /api/v1/offers`, then the `/app/analyzing` screen.
4. Read the saved offer back with `GET /api/v1/agreements?offerId=` and check unresolved questions exist.
5. Read `GET /api/v1/offers/assessment` and check version and term hash match the saved revision and the score is exactly 25 with employer verification `not_assessed`.
6. Check an unrelated employer and reviewer are denied (403/404) on the assessment and the private draft.
7. Reload, sign out, sign in again, and check the same revision, hash and terms come back.

The script already uses selectors that still exist after the intake redesign (checked by reading them against `offer-intake.tsx`): `Paste offer text`, `Suggest terms with local rules`, `Role title`, `Pay amount`, `Responsibilities`, `Company organization`, `Worker account ID`, `Analyze offer`. Not run, so a mismatch is still possible.

## Command (run on the integrated branch, from the repository root)
```bash
node scripts/test-local-real-workflows.mjs --manage-app
```
Success is exit code 0 and `test-results/local-real-<timestamp>/results.json` with every check `PASS`. Expect roughly 160+ checks; the offer checks above are a small part. It is not possible to run the offer stage alone.

## Prerequisites
- Docker Desktop running, with the `oryqen-local-dev` Supabase stack healthy: `supabase_db_oryqen-local-dev`, `..._auth_...`, `..._rest_...`, `..._kong_...`, `..._inbucket_...` and `oryqen-local-gateway`. (The unrelated `fairwork` stack was restarting on 29 Oct and is not used.)
- Port 3100 free. `--manage-app` refuses to start if something answers there and never kills existing processes.
- `test-results/activation-plan/constraints-stage-6.sql` present. It is gitignored and exists in the main checkout; it is absent in Agent 4's worktree. If missing, generate it with `node scripts/test-day7-postgres.mjs --extended-setup` (needs `test-results/day4-postgres-tools`).
- The app environment the local launcher expects (`scripts/run-local-development.mjs`), including the local Supabase URL and publishable key, synthetic data mode and registration enabled (`AUTH_REGISTRATION_ENABLED=true`). Agent 4 did not read or copy any `.env.local`.
- Credential signing key and vault variables: the script generates a throwaway signing key in memory and a vault directory under the evidence folder if you do not export your own.
- AI stays off. Nothing in this run needs a provider key and none should be set.

## Expected database changes (local Docker database only)
- Preflight runs `node scripts/apply-local-migrations.mjs`, which applies any `supabase/migrations/*.sql` the local database has not recorded, in order, and records each version. Run `node scripts/apply-local-migrations.mjs --check` first to see what is pending (exit 1 lists pending files).
- Four synthetic accounts are created through real registration: `oryqen-worker-…@example.test`, employer, approver and operator, each with a profile, plus an MFA factor for some.
- Synthetic company and organization claims, memberships, offers (including the worker's private offer `Synthetic local maintenance`), offer revisions and answers, agreements and confirmations, work records, Passport entries, notifications, privacy and case records, credentials, vault objects (files on disk under the evidence folder), recruiter, plan, report and developer-API rows, and runtime events.
- Late in the run it revokes the synthetic employer's membership and deactivates synthetic accounts.
- Audit history, offer revisions and integrity records are append-only by design and are retained.

## Cleanup
- There is no cleanup script and the retained history is intentional ("Synthetic accounts and records are retained", per the script's own results note). The synthetic accounts use `@example.test` addresses and random ids, so they do not collide with later runs.
- The script stops the app process tree it started. Check port 3100 is free afterwards.
- Evidence and the on-disk vault store are in `test-results/local-real-<timestamp>/` (gitignored); delete that folder when no longer needed.
- Removing the synthetic rows themselves would need a deliberate local reset (`supabase db reset` for the local stack), which also wipes unrelated local data: do that only with the owner's agreement.

## If it fails
Record the failing `stage` and `reason` from `results.json`. A failure in `worker private offer` right after a selector wait points at the Add Offer UI (Agent 4 can fix); a failure in the score check (25) points at which fields the form sends; failures elsewhere are outside the offer journey.
