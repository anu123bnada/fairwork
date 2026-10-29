# ORYQEN release verification (Agent 5, branch `feature/oryqen-release-parallel`, base `5814427`)

Factual record. Nothing here was deployed, pushed, published or migrated. No staging credentials were available to this agent, so **no real authenticated hosted test was run in this pass.**

## Evidence classes
U = unit test, M = mocked browser test, H = real authenticated hosted test, E = emulator test, P = physical-device test.

## Audit: what already exists
| Workflow | State |
|---|---|
| `scripts/test-hosted-worker-journeys.mjs` (API-level, one account, hidden password prompt) | Exists, works as designed; owner ran it earlier: PASS 13, FAIL 0, NOT RUN 8. That run **predates the latest UI deployment**, so it does not cover the current build |
| `docs/ORYQEN_TEST_ACCOUNT_WORKFLOW.md` | Exists: owner creates auto-confirmed test accounts in the Supabase dashboard (`jpvgsmzomlmowarlfkdl`) and types the password locally |
| `tests/e2e/*` (70+ specs) | All mocked (M); none sign in to a real backend |
| Windows: `scripts/test-windows-app.mjs`, `desktop/` (unsigned NSIS preview; production config `electron-builder.release.cjs` refuses to build without owner certificate and icon) | Exists; last run 28 Oct (5/5) |
| Android: `scripts/test-android-app.mjs`, `mobile/poc` (debug-signed online APK) | Exists; last run 28 Oct (3/3) on an emulator |

## Added in this pass (new files only; no product code touched)
- `playwright.hosted.config.ts`, `tests/hosted/{guard,auth.setup,journeys.spec}.ts`: real-browser authenticated journeys, no interception. 23 test entries (setup + 20 desktop + 2 mobile-viewport).
- `scripts/run-hosted-browser-journeys.mjs`: prompts for email and a hidden password, passes them to the child through its environment only, keeps the session cookie in `.tmp/hosted-auth/` (gitignored) and deletes it after the run.
- Safety: refuses any origin except `https://oryqen-staging.vercel.app` and loopback. Read-only by default; `--writes` allows one synthetic private offer draft (the product has no draft-delete, so one row stays); `--signout` adds a separate sign-in and sign-out journey.
- Isolation: each run uses fresh Playwright browser contexts (no shared profile) and a unique state file path; no local server port is used because the target is hosted. A loopback origin may be given for rehearsal.

Journeys covered: sign-in and session persistence (reload, second tab, anonymous profile refused with 401), Home dashboard, offer analysis form validation and the honest-AI-status API check, optional private draft save and read-back, Agreements (screens load), Work records and Passport (screens and APIs fail closed or succeed), Disputes (screen fails closed without a record), Notifications feed, sign-out. Session *expiry* is not exercised against hosted (it would need waiting out the token lifetime); the mocked expiry specs (M) cover the client behaviour.

## Verification performed in this pass
| Check | Class | Result |
|---|---|---|
| Hosted suite compiles and lists (23 entries) via `playwright test --list` | tooling | PASS |
| ESLint, `--max-warnings=0`, on the new files | tooling | PASS |
| Staging anonymous probe (no login): `/sign-in` 200, `/app/home` 200, `/api/v1/me` 401, `/api/v1/passport` 401 | live, unauthenticated | PASS (this proves only that the API refuses anonymous callers) |
| Checksums of the existing installer and APK match `SHA256SUMS.txt` (installer `bd27ed2f…93e3`, APK `8d4a1e1b…053cc8f`) | file integrity | PASS |
| Windows silent install of the existing installer on this machine | local | **BLOCKED**: the installer exited with code 2 on two attempts while drive C: had **0 bytes free**. That is the likely cause, not a proven defect in the installer. Re-run after freeing disk space |
| Windows launch checks, Android emulator checks | E | NOT RE-RUN in this pass (depend on the install above; no emulator image started) |

## Release readiness matrix
| Workflow | Unit | Mocked browser | Real hosted (H) | Status |
|---|---|---|---|---|
| Sign-in, session persistence | yes | yes | not run this pass; script ready | NOT TESTED (hosted) |
| Home dashboard | yes (Agent 1) | yes | script ready | NOT TESTED (hosted) |
| Offer creation / saving | yes | yes | script ready (`--writes`) | NOT TESTED (hosted) |
| Offer analysis | yes | yes | API-level PASS in the owner's earlier run (pre-latest UI) | PASS (stale), UI NOT TESTED |
| Agreements (needs a second account) | yes | yes | needs second account | BLOCKED |
| Work records, Passport | yes | yes | screens/APIs ready; verified work needs an employer account | NOT TESTED (hosted) |
| Disputes | yes | yes | needs reviewer capability | BLOCKED |
| Notifications | yes | yes | API PASS earlier (stale); UI ready | NOT TESTED (hosted) |
| Logout / session expiry | yes | yes | sign-out API PASS earlier (stale) | NOT TESTED (hosted, current UI) |
| Windows installer | policy tests | n/a | n/a | Install/launch last PASS 28 Oct (E-like, local); re-run BLOCKED by full disk; unsigned; real sign-in NOT TESTED; clean-machine NOT TESTED |
| Android APK | n/a | n/a | n/a | Emulator PASS 3/3 on 28 Oct; debug-signed; physical device NOT TESTED; real sign-in NOT TESTED |

## Blockers and risks
1. **Credentials**: a dedicated staging test account (auto-confirmed, no authenticator) must be created by the owner and its password typed locally. Second account plus owner-granted capabilities are needed for agreements, verification, disputes.
2. **Windows**: installer is unsigned (SmartScreen warning), default Electron icon, preview product name. Production build needs the owner's certificate (`CSC_LINK`, `CSC_KEY_PASSWORD`) and icon (`ORYQEN_WINDOWS_ICON`) per `docs/ORYQEN_RELEASE_SIGNING.md`.
3. **Android**: debug-signed, `debuggable`, development package id `org.fairwork.localpoc.online`; production id and keystore are owner decisions. No physical device was used at any point.
4. **Binaries are not in this worktree** (gitignored); they were read from the main checkout's `release-artifacts/`. They load the staging origin at runtime, so they exercise the current deployment without rebuilding.
5. **Machine state**: drive C: reported 0 bytes free at the time of writing. This worktree's `node_modules` (about 830 MB) was installed by this pass and can be deleted safely.
6. Live AI on private text stays OFF; Salary Benchmarking blocked on a licensed dataset (unchanged, see `ORYQEN_RELEASE_STATUS.md`).

## How to run (owner, interactive terminal)
```powershell
node scripts/run-hosted-browser-journeys.mjs --email oryqen-test-worker@example.test            # read-only
node scripts/run-hosted-browser-journeys.mjs --email oryqen-test-worker@example.test --writes --signout
node scripts/test-hosted-worker-journeys.mjs https://oryqen-staging.vercel.app --email oryqen-test-worker@example.test
```
Share the printed PASS/FAIL lines only. The selectors in `tests/hosted` were taken from the existing mocked specs; the first hosted run may need small selector corrections, which is why none of it is claimed as passing.

## Integration instructions for Agent 1
Merge only new files: `playwright.hosted.config.ts`, `tests/hosted/*`, `scripts/run-hosted-browser-journeys.mjs`, and the two docs. No product, CSS, migration or dependency changes; `npm run test:e2e` and lint are unaffected (`tests/hosted` is outside `tests/e2e`). Do not run the hosted suite in CI without a secret store for the test password.
