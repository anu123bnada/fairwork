# Backend persistence and authorization audit (Agent 3, 29 Oct 2026)

Branch `feature/oryqen-qa-parallel`. No migration was added or applied. No hosted system was touched.

## Known defect: hosted `GET /api/v1/offers?limit=5` returned 422

**Cause: invalid test input, not a frontend/API mismatch.** `offerListRequestSchema` is a strict object with exactly `context` (WORKER|EMPLOYER, default WORKER), `cursor` (uuid|null) and `view` (active|archived|all). `limit` is not part of the contract; page size is fixed by the server (20). Strict rejection is deliberate: `workerId` and duplicate keys are refused the same way (`scripts/test-local-real-workflows.mjs` already asserts it). The browser never sends `limit` (`saved-offers.tsx`, `privacy/export.ts` use `context`, `view`, `cursor`).

The call comes from `tests/hosted/journeys.spec.ts` (Agent 5), which also lists only `[200, 403, 404]` as acceptable, so it fails by construction. **Fix for Agent 5:** use `/api/v1/offers?context=WORKER&view=active`. Pinned by `tests/integration/api-routes-persistence-db.test.ts` ("refuses `?limit=5` with 422...").

## What was added

`tests/integration/api-routes-persistence-db.test.ts` (34 tests; PGlite and disposable real PostgreSQL via `scripts/test-routes-postgres.mjs`). The real route handlers, server modules and browser schemas run against the fully migrated database with RLS in force; only the Supabase transport is a shim that runs `api.<rpc>` as role `authenticated` with the caller's claims. Every response is parsed with the schema the browser uses.

| Area | Endpoints | Result |
|---|---|---|
| Authentication | 7 GET routes anonymous | 401 on all |
| Identity | `GET/POST/PATCH /me` | create, idempotent replay, new-session read, update persisted, stale revision 409, foreign origin 403, unknown field 422, query string 422 |
| Offers | `GET/POST /offers`, `/offers/lifecycle`, `/offers/drafts`, `/agreements` | list contract (`limit`, `workerId`, duplicate/invalid params 422), worker vs employer context, unrelated account sees nothing, archive/decision persisted and survives a new request, stale revision 409, stranger refused, drafts persist, versioned and isolated per owner, agreement readable by participants only (stranger 404) |
| Records | `/work-records`, `/passport`, `/work-cases`, `/notifications` | empty schema-valid lists for a new account, unexpected parameters 422, unknown record 404 |
| Read sweep | 24 further GET routes (entitlements, guidance, opportunities, organizations, vault, privacy requests, reports, credentials, sharing, expiries, employment history, developer keys, notices, workflows, offer history/analyses/assessment/notes, case evidence/follow-ups, attachments, agreement expiry) | all answer 200/403/404 as a worker, none 5xx, anonymous refused |

Also (previous commits): complete-schema security invariants (`schema-security-invariants-db.test.ts`, 6 tests, both engines), migration 27 pre-flight (10/10, both engines), reviewer evidence read path, audit chain tests.

## Findings

- No broken read flow: every checked GET answers without a schema mismatch against real database output.
- No frontend-only persistence of domain data. Device-local only: language, appearance, the selected offer id for navigation (sessionStorage) and notification category hiding (localStorage). The notification setting is disclosed in the UI as "on this device"; it is not per account (a second person on the same browser inherits it) and does not follow a new login. Case responses and appeals cannot be hidden. Acceptable; a server-side preference would need a migration.
- The same client-chosen draft id used by two accounts creates two independent drafts (no collision, no leak).
- `src/lib/supabase/browser.ts` creates a browser Supabase client but nothing imports it. Harmless with RLS and no client grants; it could be deleted to keep the architecture "server-only".
- Inconsistent strictness: some GET routes reject unknown query parameters (offers, notifications, me), others ignore them (`agreement-expiry`, `offers/notes`, `vault/attachments`). Not a security issue; worth unifying later.

## Realtime

Not implemented, and nothing pretends otherwise. The app has no Realtime client, channel, publication or subscription, and no polling or server-sent stream: the notification feed and every list load on request. Supabase Realtime `postgres_changes` cannot be used safely here, because all data lives in `private` tables with no client grants (enforced by the invariants test); granting `select` to deliver changes would break that boundary. A safe design needs a new migration (owner approval): a database trigger calling `realtime.send` on a per-user private Broadcast channel, an RLS policy on `realtime.messages` limiting `receive` to topic `user:<auth.uid()>`, payloads carrying only an event key (never content), a browser subscription that falls back to the existing feed fetch on disconnect, and a two-account test that user B cannot join user A's topic. Not started.

## Endpoint status (93 routes)

- **Route-level tested on a real migrated database this round:** the endpoints in the table above.
- **Covered by database-level suites (RPC, RLS, two accounts) and the browser fixtures, not route-level:** agreement workflow writes, work-record commands and integrity, Passport sharing writes, disputes and follow-ups, Evidence Vault writes, organization and team writes, recruiter verification, operator queues, admin console, audit export and audit chain, developer keys and webhooks, credentials writes.
- **Not verifiable without hosted credentials:** everything on staging with real accounts; Storage upload; email; AI (off by design).

## Remaining incomplete functionality (unchanged by this pass)

Realtime; server-side notification preferences; recruiter, hiring-manager and viewer roles (module 8); confidential dispute attachments and organization response (module 9); passkeys and account-deletion executor (module 12); migration 27 awaiting owner approval.
