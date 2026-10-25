# ORYQEN final release summary (25 October 2026)

## Release status: NOT READY for production

Local engineering is green; hosted verification, working Gemini generation and several
product modules are open. Presentable as a local demonstration (see the demo guide),
not as a deployed product.

## Implemented and verified (local evidence only)

- Full local suite after all changes: typecheck and lint pass; Vitest 70 files, 480
  passed, 17 skipped.
- **Employment history (Module I):** private, self-reported, revisioned; migration, API,
  UI, SQL tests (RLS, isolation, idempotency, validation), API tests and browser tests.
- **Demo seed:** ran end to end on the real local stack (registration, local mail
  confirmation, API writes, idempotent rerun, UI check). Worker-side records only.
- Browser suite (isolated runner): **164 passed, 0 failed** in the final full run (9.4 min),
  after fixing the six failures and hardening the runner. 17 PostgreSQL concurrency tests
  that skip in Vitest passed via the disposable-PostgreSQL scripts (105 tests, 0 failed).
  Details in `docs/ORYQEN_TEST_REPORT.md`.
- **High-severity dependency fix:** `zod` 4.6.7; production `npm audit` reports 0.
- Earlier in-sprint work, re-confirmed by the green suite (not independently re-browsed
  here): private offer drafts, offer archive/restore and decisions, sign-in access
  checks, API error handling, AI numeric grounding.

## Not done / blocked

- **Gemini:** timeouts traced to a broken IPv6 route on the dev machine (IPv4 works). The
  app's request then got HTTP 503 "high demand" twice, so the request shape is still
  unproven; the prior real call returned HTTP 400. No code change. External AI stays disabled pending owner approval.
- **Hosted:** no deployment, no staging migration, no hosted journey verified.
- Missing modules or parts: employment verification and Work Passport integration,
  Gemini assistant history, generated-analysis history, file storage, external company
  data, live job feed, email/push notifications, landing/design/accessibility sweep.
  See `docs/ORYQEN_KNOWN_LIMITATIONS.md`.

## Documents

Tracker, architecture, test report, security review, deployment checklist, demo guide,
known limitations and this summary are in `docs/` with the `ORYQEN_` prefix.

## Changed files (major)

New: `supabase/migrations/20261025140000_private_employment_history.sql`,
`src/features/work/employment-schema.ts`, `src/app/api/v1/me/employment-history/route.ts`,
`src/components/fairwork/employment-history.tsx`, `scripts/demo-seed.mjs`,
`scripts/demo-seed-data.json`, tests for employment history and the demo seed, and the
documents above. Modified: `src/components/fairwork/product-app.tsx`,
`src/types/database.ts`, `scripts/prepare-local-development.mjs` (three migration pins),
`package.json` and `package-lock.json` (`zod`). Earlier sprint changes remain
uncommitted. Nothing was committed, pushed or deployed.

## Next required user action

Decide the Gemini path: confirm generation works from another network or console, then
make the separate policy-approval decision. Then approve a reviewed staging migration
and deployment so section 6 of the deployment checklist can run.

## V1.0 session addendum (26 Oct)

- **Verdict: NOT READY for production.** Final local gates: browser 169 passed / 0 failed;
  Vitest 491 passed / 17 skipped (the 17 pass via the PostgreSQL scripts); typecheck, lint and
  production audit clean.
- **Added:** user-controlled deletion of assistant conversations (with receipts); landing
  download cards fed by the verified release manifest; guarded Android release variant and
  Windows release configuration (both refuse to produce a release without the owner's
  inputs); `docs/ORYQEN_RELEASE_SIGNING.md`.
- **Defect found and fixed:** telemetry connection exhaustion (per-route pools vs a 4-connection
  role) silently dropped login events; found by the real-stack harness.
- **Not achieved:** no signed Android or Windows release; no hosted verification (the deployment
  is older than the branch); the real-stack harness did not complete end to end (resource
  exhaustion on this machine); entitlements/billing not built; Gemini unproven.
- **Owner actions required:** see `docs/ORYQEN_RELEASE_SIGNING.md` (application ID, production
  domain, approved icons, signing certificate and keystore) and approve deploying the branch
  and applying four migrations to hosted Supabase.
