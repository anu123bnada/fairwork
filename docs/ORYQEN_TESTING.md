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
| Real-stack harness (Docker + local Supabase) | NOT RUN this session (earlier recorded 225/225 on 28 Oct, historical) |
| Hosted staging smoke | NOT RUN this session |
| Android build/device | NOT RUN |
| Live Gemini | NOT RUN (earlier synthetic-text pass on 28 Oct, historical) |

Historical counts in older docs (222 unit, 146 integration) are superseded by the numbers above.
Fixture-based browser tests do not prove live service readiness.

`live-refresh.spec.ts` was wrongly reported as flaky: it passed first time in both full runs. Its focus-event steps were still made order-independent (repeat the signal until the listener has attached) because the listener attaches after the first render.
