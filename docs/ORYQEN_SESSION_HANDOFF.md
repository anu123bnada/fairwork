# ORYQEN session handoff (updated 27 October 2026)

Read `docs/ORYQEN_MASTER_DELIVERY_TRACKER.md` first (module status), then
`docs/ORYQEN_V1_MASTER_SPECIFICATION.md` (the authoritative 22-module target). Do not repeat the audit.

## State

- Repo `C:\Users\vehiv\Desktop\fairwork`, branch `feature/oryqen-sprint-oct25`. Nothing pushed, deployed,
  or applied to hosted systems. Untracked and deliberately left alone: `src/server/identity.ts.bak`,
  `landing/v6/next-env.d.ts`.
- Local Docker stack (Supabase `oryqen-local-dev`, mail on 55424) is up with 43 migrations (all local; includes entitlements, vault and developer keys); the app
  server on port 3100 is stopped. Start it with `node scripts/run-local-development.mjs`.
  Demo worker: `oryqen-demo-worker@example.test`; password in git-ignored `.tmp/demo-password.txt`.
- Eleven migrations are not on hosted Supabase; ordering and risks are in
  `docs/ORYQEN_HOSTED_DEPLOYMENT_APPROVAL.md`. The owner has not yet confirmed which Supabase and Vercel
  projects are production; do not ask again until a hosted operation is genuinely needed.

## 28 October additions (uncommitted until the commit that follows this note)

- AI gateway (`docs/ORYQEN_AI_GATEWAY.md`), committed `e415445`.
- Recruiter Identity & Affiliation Verification (`docs/ORYQEN_RECRUITER_VERIFICATION.md`): migration 14, routes under
  `src/app/api/v1/recruiter/`, `src/features/recruiter/`, `src/server/recruiter/`, `src/server/net/public-network.ts`
  (shared public-address-only fetch/DNS), worker panel in the Check screen, employer panel in the employer workspace.
  Fourteen migrations are now pending on hosted Supabase (`ORYQEN_HOSTED_DEPLOYMENT_APPROVAL.md`).

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

## Credentials (built, 26 Oct)

Register, status, issuing, revoke, published keys, QR and `/verify` are built and verified (see
`docs/ORYQEN_CREDENTIALS_DESIGN.md`). To try locally: `node .tmp/make-test-key.mjs` style throwaway key, export
`ORYQEN_CREDENTIAL_KEY_ID` and `ORYQEN_CREDENTIAL_SIGNING_KEY` (single-line private JWK) before
`node scripts/run-local-development.mjs`. The harness reports credential steps as SKIPPED, never PASS, when the app has no key.
**The owner holds the production key**: `node scripts/generate-credential-key.mjs --kid <id> --out <path outside repo>`.

## Done in the 27 Oct batch (commits after `073604d`)

Entitlements and plan panel; recruiter scam checks; Evidence Vault (private documents, local disk store verified,
hosted Storage not verified); Developer API (scoped keys, credential verification endpoint); translated home,
saved offers, company research, vault, plan and pay panels (si, ta, de drafts); German rest-period, leave and
notice references; Compare pay panel; `release:verify` now builds the Android debug APK and Windows preview
installer in full mode. Real-stack harness: 181 PASS (vault, developer API and entitlement journeys included).
Local environment for the harness: `ORYQEN_CREDENTIAL_KEY_ID=local-test-key-1`,
`ORYQEN_CREDENTIAL_SIGNING_KEY` (private JWK from `.tmp/test-credential-key.json`) and
`ORYQEN_VAULT_LOCAL_DIR=<repo>/.tmp/vault-local` exported before `node scripts/run-local-development.mjs`.
New local migrations must be applied by hand to the Docker database
(`docker exec -i supabase_db_oryqen-local-dev psql -U postgres -v ON_ERROR_STOP=1 < <file>` then insert the version
into `supabase_migrations.schema_migrations`); the harness fails its migration inventory check otherwise.

## Checkpoint (27 Oct 2026, sprint close)

Final full gate: PASS 14, FAIL 0, BLOCKED 6 (owner inputs). Browser suite 226. Harness 186 PASS (before the last UI-only changes; rerun it after any server change).
`docs/ORYQEN_FAILURE_REGISTER.md` has every failure seen in the background-task history with its classification; none is OPEN.
Local Docker database: 44 migrations; `node scripts/apply-local-migrations.mjs` brings it up to date and the harness runs it first.
To run the harness: export `ORYQEN_CREDENTIAL_KEY_ID=local-test-key-1`, `ORYQEN_CREDENTIAL_SIGNING_KEY` (private JWK from `.tmp/test-credential-key.json`) and
`ORYQEN_VAULT_LOCAL_DIR=<repo>/.tmp/vault-local`, start `node scripts/run-local-development.mjs`, then `node scripts/test-local-real-workflows.mjs`.
Android emulator work needs about 4.4 GB of free memory beyond the database stack; run `adb kill-server` first if the device shows unauthorized.
Production steps are in `docs/ORYQEN_PRODUCTION_RUNBOOK.md`; nothing has been pushed, deployed or applied to hosted systems.

## Next exact task

(1) Translate the remaining English screens: agreements, cases, registration, offer drafts, screenshot and PDF import widgets,
the rule-analysis and assessment panels, employment history body, vault body text, privacy requests, guidance, passport.
(2) Evidence Vault attachments to work records and shares; orphan-file reconciliation; malware-scanning decision.
(3) Organization management screens beyond requests and roster; entitlement assignment to organizations.
(4) Developer API: persistent delivery queue, more events and scopes, OpenAPI document.
(5) Windows and Android end-to-end against a hosted backend, installer upgrade tests, device tests: blocked on hosted approval and hardware.
(6) Gemini live proof: blocked on provider quota. Company research: more registries beyond GLEIF need verified keys and terms.
(7) Owner-only items: `docs/ORYQEN_HOSTED_DEPLOYMENT_APPROVAL.md` (twelve pending migrations, secrets, bucket, identities).

## Release gate
`npm run release:verify` (quick) or `npm run release:verify:full` writes `release-results/release-verify.{json,md}` with PASS/FAIL/SKIPPED/BLOCKED per gate. SKIPPED and BLOCKED are never passes.
