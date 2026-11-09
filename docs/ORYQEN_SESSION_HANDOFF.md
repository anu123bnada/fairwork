# ORYQEN session handoff

## 9 November 2026 (later): Scan an offer
- Built and deployed `/app/scan` (screenshot scan with a real-stage scanning window and a report). `release/oryqen-oct27` is `f561eb4` (content equal to `integration/final-release` at `064bea7`, CI green, E2E 655 passed). It works end to end with rules on the device; the optional AI step reuses the existing consent panel and becomes real only after the owner follows `ORYQEN_AI_SETUP_STEPS.md` (Google key, Vercel settings, redeploy). Until then the scan says plainly that AI is not configured.

## 9 November 2026
- Help assistant (rules-based, not AI) built and deployed to staging: `release/oryqen-oct27` is now `5730cb6` (content equal to `integration/final-release` at `ea3a75b`, CI green, E2E 651 passed). Real AI is still OFF on staging; the owner-only steps are in `ORYQEN_AI_SETUP_STEPS.md` (Google key, Vercel settings, redeploy), after which `node scripts/test-hosted-worker-journeys.mjs https://oryqen-staging.vercel.app` step 3 reports the AI state. The signed-in hosted journey script (CV Builder, security activity, saved-listing history, vault, plans) was started in the owner's Terminal tab but no credentials have been entered yet, so signed-in hosted behaviour of the new features is still unverified.

## 8 November 2026 (staging updated)
Staging DONE with the owner's approval: backup `backups/staging-logical-20261108-0335Z`; three migrations applied (62 recorded); permissions on the `private` and `api` schemas were temporarily granted CREATE to apply the table migrations and revoked in the same step (before and after ACL snapshots identical); `release/oryqen-oct27` fast-forwarded `d8eadfc..b4d69a2` and Vercel rebuilt https://oryqen-staging.vercel.app (new routes 404 to 401). Anonymous smoke 24/0/5, rendering 10/10. How to repeat for later migrations: `node scripts/backup-staging-logical.mjs`, then `supabase db push --linked --yes` (table-creating migrations need the temporary CREATE grant: `set role fw_schema_owner; grant create on schema private to postgres, fw_schema_owner; grant create on schema api to postgres;` before, and `revoke create on schema private from postgres, fw_schema_owner; revoke create on schema api from postgres;` after; the owner of `api` keeps its own CREATE). `scripts/apply-staging-migrations.mjs` is a guarded alternative but cannot create tables on staging without that grant.
To deploy again: build a merge commit with the content of `integration/final-release` whose parents include the current `origin/release/oryqen-oct27` tip (`git commit-tree HEAD^{tree} -p <release tip> -p HEAD`), then `git push origin <it>:release/oryqen-oct27` (fast-forward, never force).
Still open: signed-in hosted smoke (accounts the owner creates), demo accounts and rehearsal, Android device run, AI on/off decision. The GitHub repository `anu123bnada/fairwork` is public: a sentence about the project owner's age was published in one doc on 8 Nov and removed in `01a3dfc`, but it remains in git history; making the repository private in GitHub settings is the effective fix.

## 8 November 2026
- Branch `integration/final-release` pushed to GitHub (owner-approved) and the repo's CI workflow passed fully on `4ce1e1e` (run 42433081034): typecheck, lint, 1055 tests, PostgreSQL suites, **E2E 648 passed 0 failed**, build. F-47 resolved as a laptop problem. Local E2E remains unreliable; use CI. Any commit after `4ce1e1e` (this docs commit and later) is not yet covered by a CI run and is not yet pushed.
- Freeze runbook and the pre-freeze checklist are in `ORYQEN_EXHIBITION.md`. Still needing the owner: approve three staging migrations and a staging deploy, hosted smoke tier 2, demo accounts, AI on/off decision, Android device or phone test.

## 6 November 2026
- Built the Smart CV Builder (`/app/cv`; migration `20261106100000_cv_documents.sql` applied **locally only**). Three migrations are now pending for staging (security event log, recommendation history, CV documents), all needing owner approval and a staging backup. New docs: `ORYQEN_LINKEDIN.md` (official API check: no experience import without a partner program), `ORYQEN_AI_PROVIDERS.md`, `ORYQEN_COMMERCIAL_LAUNCH.md`.
- NOT built from the 6 Nov brief: AI Challenge Arena, AI career analysis, AI cover letters, LinkedIn OAuth (needs an adult-created developer app), interview simulator, organization analytics, load tests, Android device verification. Each is listed with its blocker in `ORYQEN_FEATURE_MATRIX.md` terms: NOT_IMPLEMENTED or BLOCKED.
- Full-E2E gate is not passing for this commit family: three runs, three different single failures, the last `net::ERR_INSUFFICIENT_RESOURCES` (F-47). Rerun it alone with several GB of free RAM.
- Incident: while clearing port 3100 I stopped an unrelated server (`next start -p 3100` from `C:/Users/vehiv/Desktop/Anne-German-Academy/annes-german-academy-stage6-complete/annes-german-academy-production-starter`). Restart it with `node node_modules/next/dist/bin/next start -p 3100` in that folder. Always check a port's owner before stopping it.

## 5 November 2026
- 5 Nov (later): recommendation history built (module 3). Migration `20261105110000_recommendation_history.sql` is applied locally only; with `20261105100000_security_event_log.sql` there are now **two migrations pending for staging**, both needing owner approval and a staging backup. `scripts/apply-local-migrations.mjs` now handles table-creating migrations locally (temporary CREATE grants, always revoked). Remaining buildable gaps: skills-gap suggestions (03), clause editing (05), skills in shared Passport (07), recruiter roles (08), account-deletion workflow and passkeys (12), correction procedure for named parties (17), persistent webhook queue (21).
- 5 Nov: built two local features. (1) Work Passport "Print or save as PDF" private copy (browser print, not a signed PDF). (2) Security activity log (module 12): migration `20261105100000_security_event_log.sql`, `/api/v1/security-events`, Settings panel. **That migration is NOT applied to staging** (owner approval and a staging backup are needed first; apply with the existing procedure, then update the staging-baseline pin in `tests/integration/migration-upgrade.test.ts` only if the baseline changes). The delivery tracker's gap lists are stale; the 22-module acceptance doc (29 Oct) is closer, and research history (module 02) and dispute categories (module 09) were already built and applied to staging.
- Harness reliability: never run two harness runs at once; if `app not ready`, check for a leftover Next process on port 3100 (`Get-NetTCPConnection -LocalPort 3100`) and stop it first.

## 3 November 2026
- Added `scripts/local-tier2-journey.mjs` (wired into `scripts/test-local-real-workflows.mjs`): anonymous route/API protection, outsider direct-URL denial, MFA-aware password recovery. Full real-stack run via `node scripts/run-local-split-harness.mjs`: 245 PASS / 0 FAIL / 0 SKIPPED. Docker Desktop must be started first (`C:/Users/vehiv/AppData/Local/Programs/DockerDesktop/Docker Desktop.exe`). One intermittent telemetry miss is recorded as F-45 (open).
- Hosted: Tier 1 done (24/0/5). A single approval request for Tier 2 is in `ORYQEN_HOSTED_APPROVAL_REQUEST.md`; NOT approved, nothing hosted written.
- Not done: full vitest/E2E/build rerun after these script-only changes (no product code touched), Android emulator retry, live Gemini, release signing.

## 31 October 2026 checkpoint (branch `integration/final-release`)
- Verified this session at `a0a4076`: tsc, lint, vitest (154 files, 1038 passed, 17 skipped, 0 failed), `next build`. Playwright E2E, real-stack harness, hosted smoke, Android and live Gemini were NOT run; see `ORYQEN_TESTING.md`.
- Unstaged 1,287 accidentally staged files under `work/temp` and ignored them. `landing/v6/next-env.d.ts` is still untracked on purpose.
- New docs: `ORYQEN_FEATURE_MATRIX`, `_SECURITY`, `_DEPLOYMENT`, `_ANDROID`, `_TESTING`, `_EXHIBITION`, `_MAINTENANCE`. They summarize and link the older detailed docs.
- Next: run `npm run test:e2e:isolated` (alone), then the real-stack harness, then hosted smoke after owner approval (D1/D2 in `OWNER_ACTIONS.md`). Nothing hosted was touched.
- 1 Nov update (HEAD `6a8e08e`): full isolated E2E rerun 625 passed / 0 failed / 14 skipped / 0 flaky. Real-stack harness NOT passing (F-43: Work Passport link or Decision receipt not found; page re-requests its document every 2-3 s; cause not established). Android build BLOCKED (no usable JDK 17+). Hosted smoke and live Gemini not run (approval needed); procedures in `ORYQEN_HOSTED_SMOKE.md` and `ORYQEN_GEMINI_ACTIVATION.md`.
- Next: bisect F-43 against `bc29682` (last complete 225/225) in a separate worktree, or reproduce in a signed-in browser; then JDK install (needs approval) and Android debug build.
- 1 Nov final state (HEAD after this commit): real-stack harness 219/219 via `node scripts/run-local-split-harness.mjs` (`--manage-app` still unreliable, F-43). Android debug/online compile with JDK 21; emulator run BLOCKED: APK installs but the real-UI journey timed out twice at onboarding with ~350 MB host RAM free (cause unconfirmed). Hosted smoke, live Gemini, release signing: NOT RUN / need owner decisions. Next: rerun Android with >=8 GB free RAM or a physical device; hosted smoke after approval.


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

- Full gate on `ec242e8`: PASS 14, FAIL 0, BLOCKED 6 (owner inputs). See `ORYQEN_TEST_REPORT.md`. Recruiter verification is committed.

- Later 28 Oct batches (all committed locally): translated agreement workflow, offer drafts, case review and employer recruiter panels
  (and made `useI18n().t` stable per locale, which had made effects re-run every render); recruiter-check and pending-decision
  reminders; private Vault-to-work-record links (migration 15, `ORYQEN_VAULT_DESIGN.md` area, real-stack journey); OpenAPI document at
  `/api/v1/developer/openapi.json`; harness now starts the app with a loopback vault store and a throwaway in-memory signing key so
  vault, credential and developer journeys run (206 PASS, 0 SKIPPED). `scripts/test-feature-postgres.mjs <test files>` runs one
  integration file on a disposable real PostgreSQL cluster (one file per run).
- Never start two harness runs at once (F-25). Heredocs containing unbalanced quotes break the Bash tool here; use the Write tool.

- Latest full gate: PASS 14 / FAIL 0 / BLOCKED 6 (F-26 fixed). Audit of all 22 modules, external connections and the owner checklist: `ORYQEN_PRODUCTION_READINESS_AUDIT.md`. Next engineering task: translate sign-in/registration, import tools and rule-analysis panels (then shorten the coverage note), then agreement expiry reminders.

- Gate on `c39c576`: PASS 14 / FAIL 0 / BLOCKED 6. Route matrix 74/74. Accessibility (axe) 30/30. Notification preferences added. Run `git checkout next-env.d.ts` after builds (Next rewrites it).

- CHECKPOINT (28 Oct 2026, after `456d0ff`): **hosted staging database is now at 51 migrations** (owner-approved; see OWNER_ACTIONS section G). The deployed Vercel build is still the old `a25663a`; pushing `feature/oryqen-sprint-oct25` to `release/oryqen-oct27` (fast-forward) awaits owner approval and a check of the Vercel Preview variables (section F6). After the build run `node scripts/verify-hosted-staging.mjs https://oryqen-staging.vercel.app`. Real-stack harness 225/225; upgrade rehearsal passes. `.env.local` still names the Fairwork project for local work; staging is `jpvgsmzomlmowarlfkdl`.
- CHECKPOINT (27 Oct 2026, after the DOCX / listing-comparison commits): added since the previous checkpoint: migration 19 `20261029100000_admin_export_log` (every admin export recorded in the audit
  trail before delivery; PGlite + real PG passed), retention statement in Settings, signed offline-verifiable Work Passport copy (`/api/v1/passport/signed`, needs the owner's signing key; real-stack
  harness verified it with the throwaway key), admin console shell/filters/tables translated, on-device .docx offer intake (no new dependency, zip-bomb guarded), saved-listing comparison.
  Counts unchanged: 1 complete (module 18) / 20 partial / 1 blocked (19) / 0 production-verified. 19 local migrations pending hosted; none applied.
  Docker note: the `supabase_*_fairwork` containers (Supabase CLI stack) crash-loop on a corrupt postgresql.conf and are unrelated to the harness, which uses `*_oryqen-local-dev`; they were not touched.
  Still open (no owner input): skills sharing in Passport grants, recruiter correction path (needs a product decision on disclosing report existence), saved company research and recommendation
  history, Vault corrections/verification status, agreement clause editing, account-deletion executor (reviewed privacy case), server-side message translation. Blocked: webhook worker decision,
  licensed salary data, AI policy approval, signing keys, hosted checks. A full release gate is due after these commits (run it alone; nothing else beside it).
- CHECKPOINT (27 Oct 2026, HEAD after `b062ee1`): full gate on `cb365ff`: exit 0, PASS 14 / FAIL 0 / SKIPPED 0 / BLOCKED 6 (all owner/external), verdict NOT READY: owner input required
  (recorded in the test report). Infrastructure audit in `ORYQEN_INFRASTRUCTURE_AUDIT.md` (read-only; `.env.local` -> Fairwork `cqjx...`, CLI -> oryqen-staging `jpvg...`, nothing hosted
  changed). Since the gate: migration 18 `20261028190000_offer_notes` (private offer notes + vault links to offers; PGlite, real PG and real-stack harness passed), employment
  timeline and Passport-link expiry reminders, abuse-report queue inside the admin console (Cases & moderation), interview/negotiation preparation (fixed rules, 4 languages),
  side-by-side agreement version comparison. Eighteen local migrations are now pending on oryqen-staging (21 on Fairwork); none has been applied hosted.
  NEXT (no owner input): record admin exports in the audit trail (needs migration), account-deletion workflow + retention controls, recruiter correction path, Passport skills sharing and
  signed export, translate admin console and server messages, DOCX intake, saved company research. If Docker's engine hangs, restart Docker Desktop (kill and relaunch) before the harness.
  Run only targeted tests; one full gate at the final milestone.
- CHECKPOINT (28 Oct, HEAD after `9a5ea85`): sign-in/registration/recovery translated; coverage note now lists only the rule-analysis and
  assessment panels (their text comes from English-only deterministic engines in `src/features/offer/{assessment,deterministic-extractor}.ts`,
  so translating them means making those engines locale-aware, not just the chrome), the admin console and server messages.
  NEXT: locale-aware assessment/extractor texts; persistent webhook queue; organization plans; audit export; Android emulator run when memory allows.

- RULE: never run vitest, browsers or the harness beside `release:verify:full` (F-30); never edit `src/` while it runs.

- CHECKPOINT (28 Oct, after `0b170fb`): strict module count in `ORYQEN_22_MODULE_ACCEPTANCE.md` (1 complete and verified, 20 partial, 1 blocked). Seventeen
  hosted migrations pending. Live Gemini verified with synthetic text on `gemini-3.1-flash-lite` (configured `gemini-3.8-flash` returned 503). Added since the last
  gate: private abuse reporting (migration 17), offer summary download, saved-offer search/filter, Passport recipient QR and print copy, admin record export.
  NEXT (no owner input): report queue inside the admin console + correction path; offer review notes and supporting documents (needs migration); expiry reminders and
  employment timeline; admin console and server-message translation; account-deletion workflow and retention controls; passkey feasibility; interview/negotiation
  preparation in the rules-based Copilot. Do NOT run the full gate again until a meaningful milestone; use targeted tests.

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
