# ORYQEN session handoff (26 October 2026)

Read `docs/ORYQEN_MASTER_DELIVERY_TRACKER.md` first (module status), then
`docs/ORYQEN_V1_MASTER_SPECIFICATION.md` (the authoritative 22-module target). Do not repeat the audit.

## State

- Repo `C:\Users\vehiv\Desktop\fairwork`, branch `feature/oryqen-sprint-oct25`. Nothing pushed, deployed,
  or applied to hosted systems. Untracked and deliberately left alone: `src/server/identity.ts.bak`,
  `landing/v6/next-env.d.ts`.
- Local Docker stack (Supabase `oryqen-local-dev`, mail on 55424) is up with 39 migrations; the app
  server on port 3100 is stopped. Start it with `node scripts/run-local-development.mjs`.
  Demo worker: `oryqen-demo-worker@example.test`; password in git-ignored `.tmp/demo-password.txt`.
- Seven migrations are not on hosted Supabase; ordering and risks are in
  `docs/ORYQEN_HOSTED_DEPLOYMENT_APPROVAL.md`. The owner has not yet confirmed which Supabase and Vercel
  projects are production; do not ask again until a hosted operation is genuinely needed.

## Done this session (commits `2ff7908` and the batch after it)

- Gemini: the request contract was wrong (HTTP 400 on live API). Fixed: `responseMimeType` +
  `responseJsonSchema` with keywords Gemini rejects removed (found by live bisection), Gemini 3
  `thinkingLevel: low`, 35 s timeout, route `maxDuration` 60. Proven live with synthetic text on
  `gemini-3.1-flash-lite` (SUCCESS 5.3 s). Configured `gemini-3.8-flash` returns quota errors
  (`RESOURCE_EXHAUSTED`) or overload, so the owner must choose a model/quota. Machine note: this
  dev machine's IPv6 route to Google stalls; tests set IPv4-first.
- Company research: GLEIF provider, evidence UI, live-proven (real LK and DE companies).
- Localization engine (en/si/ta/de, 22 strings each), formatters, pay-period normalization.
- Jurisdiction references: Germany ArbZG §3 and §4 verified from primary text; Sri Lanka unavailable.
- Earlier in the session: PDF extraction, saved analysis history, Passport skills, team roster,
  list_offers backward-compat migration, telemetry pool fix, guarded Android/Windows release config.

## Commands that matter

`npm run typecheck`, `npm run lint`, `npx vitest run`, `npm audit --omit=dev`,
`AUTH_REGISTRATION_ENABLED=true node scripts/test-browser.mjs [specs]` (isolated production build),
`npm run test:live:gemini` (set `ORYQEN_LIVE_GEMINI_MODEL=gemini-3.1-flash-lite`),
`npm run test:live:research`, `node scripts/test-day{4,5,6,7}-postgres.mjs` and `test-admin-postgres.mjs`
(real-PostgreSQL concurrency), `node scripts/test-local-real-workflows.mjs` (needs about 3 GB free RAM).

## Known defects and blockers

- Gemini: configured model quota; no AI approval (`ORYQEN_AI_ENABLED` and `ORYQEN_AI_POLICY_APPROVED` stay false).
- Translations are unreviewed drafts and cover only 22 strings; server-side locale persistence needs a migration.
- Real-stack harness previously stopped on out-of-memory (machine had ~1.5 GB free), not on a defect.
- No signed Android or Windows release; owner decisions in `docs/ORYQEN_RELEASE_SIGNING.md`.
- Windows `desktop/policy.cjs` pins `https://oryqen.vercel.app`.

## Gotchas learned

- Shell heredocs containing apostrophes can fail in this environment; write files with the editor tool.
- `sed` replacement of `\b` silently corrupts regexes; use the editor tool and re-read the line.
- The in-memory (PGlite) database does not enforce every privilege rule; apply migrations to the real
  local Postgres (`start-local-development.mjs`) before trusting them.
- `prepare-local-development.mjs` pins every migration by hash; add new ones, and delete only an
  *unapplied* stale copy under `.tmp/oryqen-local-dev/supabase/migrations` if a migration is revised.

## Next exact task

Build the **Trust Chain** claim model (tracker, "Next batches" 1): migration for claims, issuers,
evidence references, status, expiry, revocation and audit events; RPCs with forced RLS; a "who claims,
who verified, is it valid" view over offers, agreements, work records and the Passport; SQL, API and
browser tests. Then verifiable credentials (needs an owner decision on signing-key custody).
