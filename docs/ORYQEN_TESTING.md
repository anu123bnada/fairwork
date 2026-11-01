# ORYQEN testing

## Commands
```bash
npx tsc --noEmit
npm run lint
npx vitest run                  # all unit + integration (PGlite); ~14 min
npm run test:unit
npm run test:integration
npm run test:e2e:isolated       # Playwright, single worker, uses fixtures
npm run release:verify:full     # full gate: run alone, edit nothing while it runs
node scripts/test-feature-postgres.mjs <test file>   # one DB test on a disposable real PostgreSQL
npm run test:live:gemini        # calls the live provider: needs explicit owner approval each time
```
Rules: never run vitest, browsers and the harness simultaneously. Never start two harness runs at once.

## Latest recorded results (31 Oct 2026, commit `a0a4076`)
| Check | Result |
|---|---|
| TypeScript | PASS |
| ESLint, 0 warnings | PASS |
| Vitest | PASS: 154 files, 1038 tests passed, 17 skipped, 0 failed |
| `next build` | PASS |
| Playwright E2E (isolated, 1 worker) | 621 passed, 14 skipped, 4 failed in the first run (3 landing-download and 1 offer-draft test were stale against intended behavior: Windows preview link now published; clause check does not flag missing terms under 120 characters). Tests corrected; the two affected files rerun: 9 passed. |
| Playwright E2E full rerun after `99fa25f` | **625 passed, 0 failed, 14 skipped, 0 flaky** (no retries configured; 24.3 min). Fixture-based browser tests, not live-service evidence. |
| Real-stack harness (Docker + local Supabase, dev-mode app) | **NOT PASSING at `f2bda5f`, no complete pass this session.** Six runs against the local Docker stack (`oryqen-local-dev`, synthetic data): runs 1 and 3 stopped after 70 PASS at the Work Passport screen (verified-work link not found in 30 s); runs 2, 4, 5 and 6 reached 199 PASS and stopped at the dispute "Decision receipt" screen. In the failing page loads the browser re-requests the page document every 2-3 s with no JavaScript error and no failed API call; the page stays on "Loading your private ORYQEN session". Cause not established; dev-server reload is suspected, a product defect is not excluded. A production-mode attempt could not register accounts (mode difference not investigated). Last complete pass: 225/225 at `bc29682` (28 Oct, historical). Bisect: the same harness at `bc29682` in a separate worktree also failed on 1 Nov (66 PASS, then 0 saved-offer links), so the failures are not shown to be a regression. **Later 1 Nov:** with the app started separately (no `--manage-app`) the harness passed 173/173 with 3 key-dependent journeys skipped; the managed run's dev server logged 130 rebuild events versus 0, pointing at a development-server watcher effect (F-43 update). Still no complete pass of all journeys. |
| Hosted staging smoke | NOT RUN this session |
| Android build/device | BLOCKED: no usable JDK 17+ (Android Studio `jbr` is incomplete; only JRE 8 present). See `ORYQEN_ANDROID.md` |
| Live Gemini | NOT RUN (earlier synthetic-text pass on 28 Oct, historical) |

Historical counts in older docs (222 unit, 146 integration) are superseded by the numbers above.
Fixture-based browser tests do not prove live service readiness.

`live-refresh.spec.ts` was wrongly reported as flaky: it passed first time in both full runs. Its focus-event steps were still made order-independent (repeat the signal until the listener has attached) because the listener attaches after the first render.
