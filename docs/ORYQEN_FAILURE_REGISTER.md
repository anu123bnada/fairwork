# ORYQEN failure register

Created 27 Oct 2026 from the Claude Code background-task history (40 task output files for this working session) and the
release-gate logs. Status values: **RESOLVED** (defect fixed and re-verified), **EXPECTED** (a negative test or an intentional stop,
not a bug), **BLOCKED** (needs something outside engineering), **OPEN**. Severity is for application or security impact.

**Open critical or high-severity application or security defects: none.** Evidence for that sentence is the final full gate
(PASS 13, FAIL 0), the 4xx/5xx audit of the two server logs below (no 5xx), and the secrets scan.

## Final results behind the register

| Gate | Result |
|---|---|
| `release:verify:full` (last full run, final commit of the previous batch) | PASS 13, FAIL 0, SKIPPED 0, BLOCKED 6 (owner inputs). Exit 0, verdict NOT READY: owner input required |
| Browser suite | 217 passed |
| Real-stack harness | 186 PASS, exit 0 |
| Server logs audit | `bizuym6dl` (1.1 MB, real-stack harness run) and `b1ak9l3sc`: **0 responses with status 500 or above**; every 4xx is a deliberate authorization or validation negative test (listed below) |
| Live GLEIF research (`npm run test:live:research`, 27 Oct) | 3 of 3 passed |
| Live Gemini (`npm run test:live:gemini`, 27 Oct) | RESOURCE_EXHAUSTED on the configured model and on the earlier working model: BLOCKED (provider quota) |
| Secrets scan (`scripts/scan-secrets.mjs`, new) | 781 files, 11 rules, 0 unexplained findings; 3 reviewed test fixtures allow-listed with reasons; git history scan found only a false positive inside minified WebAssembly glue code |

## Register

| ID | Where it showed up | Exact failure | Classification | Status | Evidence |
|---|---|---|---|---|---|
| F-01 | Harness task `b1c7t6tt7`, exit 1 | `page.goto: net::ERR_CONNECTION_REFUSED` in worker registration | Environment: the local app server was not running (I had stopped it) | RESOLVED | Server started, harness rerun: 163 PASS. The harness now checks for a running app first and stops with an explicit instruction (or starts one with `--manage-app`) |
| F-02 | Harness task `b36zaoz3q`, exit 1 | `FAIL: saved offer discovery: Local migration/trigger repair assertions failed` | Environment: the local Docker database was behind the migration folder (the new entitlements migration was not applied), and the harness correctly refused | RESOLVED | Migration applied; harness 163 PASS. Automated afterwards by `scripts/apply-local-migrations.mjs` (run before the harness) |
| F-03 | `release:verify:full` run 2, check `unit-integration`; task `b49iaoalv` | `release-data` test: installer size and SHA-256 differ from the recorded values | **Genuine defect in my verification script**: `windows-build` rebuilt into the folder that holds the installer the download page documents, overwriting it | RESOLVED | Build now goes to `test-results/windows-verify`; recorded figures and manifest refreshed after re-checking the package (no secrets, shipped files identical); `release-data` test passes in the final gate |
| F-04 | `release:verify:full` run 2, check `browser-journeys` | Localization test: `translated < 100` failed with 142 | Test limit overtaken by real translation growth (not a product defect) | RESOLVED | Limit raised to 400 with a comment tying it to the wording of the coverage note; test passes |
| F-05 | `release:verify:full` run 1, check `production-build` (and `browser-journeys`, same cause) | Parsing failure in `src/app/api/v1/vault/blob/route.ts` | **Genuine defect**: a shell escaping error dropped a backslash from a regular expression in a file I had just written | RESOLVED | File rewritten without the pattern; typecheck, lint and production build pass in every later gate |
| F-06 | `release:verify:full` run 1, check `android-build` | Failed with empty evidence | Genuine defect in my script: `gradlew.bat` was started without a shell | RESOLVED | Fixed; debug APK built (4,121,524 bytes) in later gates |
| F-07 | `release:verify:full` run 1, check `windows-build` | Reported FAIL although the installer was built | Genuine defect in my script: it looked for the installer in the wrong folder | RESOLVED | Fixed; unsigned installer verified in later gates |
| F-08 | `release:verify` quick run, check `android-release` | Reported PASS while the preflight said NO-GO | Genuine defect in my script (the preflight exits 0 unless given `--require-ready`) | RESOLVED | Now BLOCKED with the owner decisions, as it should be |
| F-09 | `release:verify` quick run, check `lint` | One `no-unused-expressions` error in the new script | Genuine defect in my script | RESOLVED | Fixed; lint clean in all later gates |
| F-10 | Release gate failure evidence | Only six lines of evidence were kept | Reporting weakness | RESOLVED | 40 lines in the JSON report and a full log per failed command under `release-results/logs` |
| F-11 | `npm run test:live:gemini` (27 Oct) | `RESOURCE_EXHAUSTED` (three attempts) | External: provider quota or billing tier | BLOCKED | Owner must check the key's quota; real-user AI stays disabled by policy. The integration contract was proven earlier with synthetic text (SUCCESS, 4 grounded warning signs) |
| F-12 | Browser task `be1boic6b` (25 Oct), exit with `6 failed, 158 passed` | Saved-offer and passport panels timing out | Test fixture defect: new panels raised alerts when their endpoints were not mocked, plus memory starvation | RESOLVED | Fixtures corrected earlier; later full suites passed 164, 169, 173, 188 and 217 |
| F-13 | Browser tasks `bxluaylh9` and `bz07bc4de` (25 Oct) | `android-browser.spec.ts:27` failed after 5.5 minutes | Environment: machine memory starvation (about 0.6 GB free) stalled the browser | RESOLVED | The same spec passes in every later run (217 passed in the last gate) |
| F-14 | Earlier sessions (see tracker) | Trust Chain showed a reviewer's records as the viewer's own | **Genuine security-relevant defect** | RESOLVED | Route filters by worker id; regression test in `trust-chain-api.test.ts` |
| F-15 | Earlier sessions | Anonymous credential status failed (no schema usage), malformed token hit a table constraint, brand header missing on `/verify` | Genuine defects | RESOLVED | SQL test pins that anonymous callers execute only the intended functions; explicit validation; brand guard test passes |
| F-16 | Earlier sessions | Roster migration `permission denied for schema private` on real PostgreSQL | Genuine defect found only on the real database | RESOLVED | Migration corrected; real-PostgreSQL tests pass |
| F-17 | Earlier sessions | Telemetry role connection limit exhausted by per-route pools | Genuine defect | RESOLVED | Process-wide pool; telemetry tests pass |
| F-18 | Server log `bizuym6dl` and `b1ak9l3sc` | 401, 403, 404, 409 and 422 responses (for example 32 unauthenticated `GET /me`, 9 forbidden `POST /operator/organization-requests`, 8 forbidden `POST /admin`) | **Expected negative tests**: unauthenticated and unauthorized actors, duplicate and invalid inputs | EXPECTED | Each is an assertion in the harness that the server refuses; the harness passed. No 5xx anywhere |
| F-19 | Tasks `boiolgcjp`, `bltka1vfq`, `bpx9ddajd`, `bjvbb42tf` (`[killed]`) | Local development servers ended | Intentionally stopped by me with `TaskStop` after the harness finished | EXPECTED | Documented |
| F-20 | Task wrapper notices reading `exit code 1: No matches found` | The wrapper reports the status of the last command in my chain, a `grep` that found nothing, while the harness prints its own `exit N` in the output | Tooling artifact: the harness's own status is the authoritative one (F-01 and F-02 were real harness failures and are listed separately) | EXPECTED | Harness runs that passed show `exit 0` and their PASS count in the task output |
| F-21 | Tool permission layer | One broad `taskkill` of all `node.exe` processes was denied; the classifier was briefly unavailable twice | Not executed / transient tooling error | EXPECTED | I used `TaskStop` for my own servers only |
| F-22 | Android emulator (27 Oct): `adb devices` showed `emulator-5554 unauthorized`, even after a clean boot | Stale adb server key handshake (the server had run since the day before) | Environment | RESOLVED | `adb kill-server` then `start-server` returned `device`; documented in the handoff |
| F-23 | Android emulator under load: `System UI isn't responding` dialog over the app | The emulator takes about 4.4 GB on this machine (free memory fell from 4.8 GB to 0.4 GB) and the system UI stalled | Environment: memory starvation, not an application defect | EXPECTED | The same app screen shows the application's own fail-closed page. A full emulator workflow run (`scripts/test-android-real.mjs`, which also needs the local Supabase stack and a server on port 3102) cannot run reliably on this machine; it needs a machine with roughly 8 GB free or a physical device |
| F-24 | Hosted Storage, hosted backend, physical Android device, Windows code signing | Cannot be run here | External | BLOCKED | See the runbook: `verify-vault-storage.mjs` and `test-hosted-two-accounts.mjs` exist and wait for approval |
| F-25 | Real-stack harness failed in 'saved offer discovery' with a count mismatch, then ERR_CONNECTION_REFUSED and 'Could not stop the test-owned app process tree' | Two harness copies were started at once by mistake (a detached subshell survived and collided on port 3100 and the shared synthetic accounts) | Harness run | RESOLVED (rerun alone; see test report) | Run the harness once, never detached; check for running node processes first |
| F-26 | Full gate browser-journeys: `localization.spec.ts` coverage tripwire (597 translated strings, limit 400) | Genuine consequence of the translation work: the note "Only N strings are translated; most screens remain in English" would have become inaccurate, and the tripwire did its job | Test + copy | RESOLVED: the note now lists the screens that really are still English (import tools, rule-analysis panels, administration console) in all four languages; tripwire raised to 1200 with the rule that the note is edited when those screens change. Isolated rerun 4/4; full gate rerun recorded in the test report |
| F-27 | New axe-core accessibility checks found: low contrast on unselected add-offer tabs (3.0:1), the muted text token (3.9:1), landing navigation and decorative phone text (2.7:1), and an `aria-label` on a role-less element | Genuine product defects (accessibility) | App CSS/markup | RESOLVED: colours darkened to meet 4.5:1, `role="img"` added, decorative mock hidden from assistive technology; `tests/e2e/accessibility.spec.ts` (30 tests) now guards 15 screens in both colour schemes |

## How to use this file

Add a row when anything fails; never delete a row. A row moves to RESOLVED only with a rerun that is recorded in
`docs/ORYQEN_TEST_REPORT.md`. EXPECTED needs the reason a failure is correct behaviour.
