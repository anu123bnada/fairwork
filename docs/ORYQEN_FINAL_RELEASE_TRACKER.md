# ORYQEN final release tracker

Started 25 October 2026 on branch `release/oryqen-oct27`. Nothing committed, pushed,
deployed or changed in hosted systems. Statuses: NOT STARTED, IN PROGRESS,
IMPLEMENTED, VERIFIED, BLOCKED. VERIFIED here means local execution evidence only;
no hosted feature is verified.

## Evidence rerun this session (not inherited from earlier reports)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | passed |
| Lint | `npm run lint` | passed, 0 warnings |
| Full suite | `npx vitest run` | 67 files passed; 471 passed, 17 skipped (172 s) |
| Full suite after Module I | `npx vitest run` | 69 files passed; 477 passed, 17 skipped (157 s); typecheck and lint passed |
| Production build / browser | not rerun this session | earlier sprint claims only |

Skipped tests (17): real-PostgreSQL concurrency tests that skip in the default run. Run
via `scripts/test-day{4,5,6,7}-postgres.mjs` and `test-admin-postgres.mjs`: 105 passed, 0 failed.

## Gemini integration finding (blocker)

- Request shape in `src/server/ai/provider.ts` uses `generationConfig.responseFormat.text`
  with `mimeType: "APPLICATION_JSON"`. The 22 Oct record in `docs/GEMINI_PROCESSING_GATE.md`
  shows a real HTTP 400 INVALID_ARGUMENT on `gemini-3.8-flash` with the cause unknown.
- 25 Oct, synthetic text only, no app data, key not printed: model metadata GET returned
  200 in about 1.1 s. Two `generateContent` calls (current shape, then `responseMimeType`
  plus `responseJsonSchema`) each timed out client-side (25 s, 60 s). A plain call with
  no `generationConfig` also timed out at 100 s. The first run sent both shapes
  sequentially; the second sent only the classic one.
- **Root cause of the timeouts (found 25 Oct, second session):** on this machine the IPv6
  route to `generativelanguage.googleapis.com` accepts the connection and never answers.
  `curl -4` returned HTTP 200 (`OK`, 17.6 s for a one-word reply on a thinking model);
  `curl -6` hung for 40 s. `NODE_OPTIONS=--dns-result-order=ipv4first node ...` made
  Node's `fetch` get a response in 1.5 s instead of hanging. The earlier "model responds"
  claim and the timeouts are both true: they used different network paths.
- **Contract question still open:** over IPv4 the app's real request body (synthetic
  offer text) and a `responseMimeType` + `responseJsonSchema` variant both returned
  HTTP 503 `UNAVAILABLE` ("high demand"), twice each. Neither shape was accepted or
  rejected, so `generationConfig.responseFormat` is still unproven. Retry later.
- Latency risk: a one-word reply took 17.6 s; the app timeout is 25 s with a 3,000 output
  token ceiling that thinking tokens may consume. Long offers may end as `incomplete` or
  `timeout` (both handled safely, never accepted as analysis).
- The local launcher strips `NODE_OPTIONS` deliberately (injection guard); that was not
  changed. For live diagnostics set the option only in a one-off terminal.
- External AI stays disabled: `ORYQEN_AI_ENABLED=false`, `ORYQEN_AI_POLICY_APPROVED=false`,
  no approval reference, region or data-use text invented. Approval needs the owner
  decisions listed in `docs/GEMINI_PROCESSING_GATE.md`.

## Module status (from source audit; no module is VERIFIED against hosted systems)

| Module | Status | Gap to finish |
|---|---|---|
| A Auth/identity | IMPLEMENTED | staging email/session/cross-user acceptance; leaked-password protection is an owner setting |
| B Dashboard | IMPLEMENTED | richer persisted activity |
| C Offer intelligence | IMPLEMENTED | generated-analysis history not persisted |
| D Gemini | BLOCKED | see finding above and approval gate |
| E Company research | IMPLEMENTED | stored records only; no external registry |
| F Recommendations | IMPLEMENTED | no external job feed (must stay labeled) |
| G Offer management | IMPLEMENTED | drafts and lifecycle migrations not on staging |
| H Agreements | IMPLEMENTED | hosted acceptance; UI must keep "not a legal signature" wording |
| I Employment records | IMPLEMENTED | migration `20261025140000_private_employment_history.sql` not on staging; not linked to Work Passport or verification (entries stay private and self-reported) |
| J Work Passport | IMPLEMENTED | self-reported history integration |
| K Employer portal | IMPLEMENTED | real employer assurance unverified |
| L Disputes | IMPLEMENTED | hosted independent review |
| M Audit | IMPLEMENTED | docs must state rows are append-only by policy, not immutable ledgers |
| N AI assistant | IN PROGRESS | rules-based only; Gemini conversation blocked by D |
| O Notifications | IMPLEMENTED | in-app only |
| P Admin | IMPLEMENTED | operators and procedures unverified |
| Demo mode | IMPLEMENTED | `scripts/demo-seed.mjs` ran end to end on the local stack (idempotent rerun; UI showed entries). Worker-side records only; no companies/agreements/passport |
| Docs set (architecture, test, security, deployment, demo, limitations, summary) | NOT STARTED | only this tracker and the sprint report exist |

## Release decision

NOT READY for production. Local suite is green; hosted verification, Gemini generation,
employment-history module, demo seed and the remaining documents are open.

## Exact next action

1. Owner: confirm Gemini generation from another network or console, then approve the
   processing policy (separate decision).
2. Engineering: remaining release documents (architecture, security review, deployment checklist, limitations, test report, summary).

## Module I record (25 Oct)

Files: `supabase/migrations/20261025140000_private_employment_history.sql`,
`src/features/work/employment-schema.ts`, `src/app/api/v1/me/employment-history/route.ts`,
`src/components/fairwork/employment-history.tsx` (rendered under the work-record screen in
`product-app.tsx`), `src/types/database.ts`, tests `tests/integration/employment-history-db.test.ts`
and `tests/unit/employment-history-api.test.ts` (6 tests, passing).
Design: append-only revisions per user, FORCE RLS, idempotent saves with expected-revision
guard, strict server-side validation (dates, current/end consistency, 20 skills),
verification fixed to `self_reported` by the server. No delete and no visibility toggle:
entries are private only. Sharing through Work Passport is not built.

Browser: `tests/e2e/employment-history.spec.ts` (2 tests, mocked API, isolated runner with AUTH_REGISTRATION_ENABLED=true) passed 25 Oct alongside offer-drafts (3 passed). Fixtures prove UI behavior only, not hosted persistence.

## Local stack incident (25 Oct)

After Docker restarted, `supabase_db_oryqen-local-dev` crash-looped: its container-level
`/etc/postgresql/postgresql.conf` contained NUL bytes. The data volume was untouched. The
container was stopped and renamed `supabase_db_oryqen-local-dev-preserved-corrupt-conf-20261025`
(kept, not deleted) and the launcher recreated it. The separate `supabase_*_fairwork`
stack also shows restarting containers and was not modified.

## Documents complete (25 Oct)

Architecture, test report, security review, deployment checklist, known limitations and
final summary now exist in `docs/` (`ORYQEN_*`). Browser suite: no single 164/164 run;
see the test report. `zod` upgraded to 4.6.7 (audit clean).

## Recovery session (25 Oct, second pass): defects, root causes, fixes

| Defect | Root cause | Fix | Evidence |
|---|---|---|---|
| Browser runner left `next-env.d.ts` pointing at `test-results/day2-next` | The runner restores generated files once at exit; a dev server on port 3100 writes the same files, so one restore failed (`UNKNOWN: open`) | `scripts/test-browser.mjs`: restore retried up to 8 times with verification, loud warning if it still fails, notice when a dev server is running on 3100 | file restored with `git checkout`; runner syntax and lint pass; full run below |
| 6 browser failures | 2 from my "Role" label clash (renamed "Job title"); 4 stale fixtures from earlier-sprint UI (`&view=active`, drafts panel) | test fixtures and locators updated; product code unchanged | see test report |
| `android-browser:27` 5.5 min stall | Likely memory starvation: free RAM about 1.5 of 16 GB (WSL VM 1.3 GB, many browser processes); the test passes in 9.9 s alone | none to code; documented | passes alone; slow-run symptom reproduced as machine pressure, not proven |
| Gemini timeouts | Broken IPv6 route to Google on this machine; IPv4 works | documented; local launcher intentionally strips `NODE_OPTIONS`, left unchanged | `curl -4` 200, `curl -6` hang, Node with `--dns-result-order=ipv4first` answered in 1.5 s |
| Employment card looked unstyled | used generic classes outside the app's list-card system | `fw-list-card fw-employment` plus scoped CSS in `product.css` (fieldset reset, grid, checkbox row, textarea in a field wrapper, two columns from 768 px) | screenshots at 390 and 1440 px reviewed |

UI sweep: 13 `/app` screens (home, add-offer, check, guidance, opportunities, work-record,
passport, agreement, cases, notifications, settings, share, employer) were loaded as the
demo worker at 390, 768 and 1440 px: no horizontal overflow, no duplicate headings, no
console errors (39 of 39 loads). This is a programmatic check plus screenshots of the
employment card only; other screens were not visually reviewed.
