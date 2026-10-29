# Backend persistence and authorization audit (Agent 3, 29 Oct 2026)

Branch `feature/oryqen-qa-parallel`. No migration was added or applied. No hosted system was touched.

## Known defect: hosted `GET /api/v1/offers?limit=5` returned 422

**Cause: invalid test input, not a frontend/API mismatch.** `offerListRequestSchema` is a strict object with exactly `context` (WORKER|EMPLOYER, default WORKER), `cursor` (uuid|null) and `view` (active|archived|all). `limit` is not part of the contract; page size is fixed by the server (20). Strict rejection is deliberate: `workerId` and duplicate keys are refused the same way (`scripts/test-local-real-workflows.mjs` already asserts it). The browser never sends `limit` (`saved-offers.tsx`, `privacy/export.ts` use `context`, `view`, `cursor`).

The call comes from `tests/hosted/journeys.spec.ts` (Agent 5), which also lists only `[200, 403, 404]` as acceptable, so it fails by construction. **Fix for Agent 5:** use `/api/v1/offers?context=WORKER&view=active`. Pinned by `tests/integration/api-routes-persistence-db.test.ts` ("refuses `?limit=5` with 422...").

## What was added

`tests/integration/api-routes-persistence-db.test.ts` (39 tests; PGlite and disposable real PostgreSQL via `scripts/test-routes-postgres.mjs`). The real route handlers, server modules and browser schemas run against the fully migrated database with RLS in force; only the Supabase transport is a shim that runs `api.<rpc>` as role `authenticated` with the caller's claims. Every response is parsed with the schema the browser uses.

| Area | Endpoints | Result |
|---|---|---|
| Authentication | 7 GET routes anonymous | 401 on all |
| Identity | `GET/POST/PATCH /me` | create, idempotent replay, new-session read, update persisted, stale revision 409, foreign origin 403, unknown field 422, query string 422 |
| Offers | `GET/POST /offers`, `/offers/lifecycle`, `/offers/drafts`, `/agreements` | list contract (`limit`, `workerId`, duplicate/invalid params 422), worker vs employer context, unrelated account sees nothing, archive/decision persisted and survives a new request, stale revision 409, stranger refused, drafts persist, versioned and isolated per owner, agreement readable by participants only (stranger 404) |
| Records | `/work-records`, `/passport`, `/work-cases`, `/notifications` | empty schema-valid lists for a new account, unexpected parameters 422, unknown record 404 |
| Two-account journey | `/offers` -> `/agreement-workflows` (create, propose, both confirm) -> `/work-records` (create, submit, worker self-verification 403, employer verifies) -> `/passport` (initialize, read) -> `/work-cases` | persisted and re-read from fresh requests; Passport lists the verified record for its owner only; client-chosen Passport owner 422; stranger gets 404 on the agreement and work record and empty lists |
| Disputes | `POST/GET /work-cases` | extended category `incorrect_pay` accepted; unknown/lower-case/empty category 422; extra field 422; stranger refused; exact retry replays; second open case on the same record refused; case readable by its opener, absent for a stranger |
| Passport sharing | `POST/GET /passport/sharing` | select, prepare, activate for a named recipient; recipient sees only the chosen fields; another account and the employer are refused; recipient cannot revoke; owner revokes and access ends; duplicate fields 422. An open dispute removes a record from the Passport until resolved (by design) |
| Administration | `/admin`, `/admin/audit-chain`, `/admin/export-log` | worker, employer and stranger 403, anonymous 401; administrator verifies the chain (ok), a profile PATCH through `/me` adds exactly one link, an export is recorded once and replays, bad checksum and extra fields 422 |
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
- **Covered by database-level suites (RPC, RLS, two accounts) and the browser fixtures, not route-level:** case follow-ups and reviewer decisions, work-record integrity corrections, Evidence Vault writes, organization and team writes, recruiter verification, operator queues, admin console, audit export and audit chain, developer keys and webhooks, credentials writes.
- **Not verifiable without hosted credentials:** everything on staging with real accounts; Storage upload; email; AI (off by design).

## Remaining incomplete functionality (unchanged by this pass)

Realtime; server-side notification preferences; recruiter, hiring-manager and viewer roles (module 8); confidential dispute attachments and organization response (module 9); passkeys and account-deletion executor (module 12); migration 27 awaiting owner approval.

## Work Passport, sharing and trust (second pass, same day)

Verified on a real migrated database through the real routes (`api-routes-persistence-db.test.ts`, 42 tests, PGlite and disposable real PostgreSQL):

- **Self-reported is never promoted.** Employment history and skills are stored with a schema-level literal `verification: "self_reported"`; forged `verification`, `verified` or `status` fields are rejected (422) in the content and at the top level. None of that content appears in the Passport read, a share, or the signed export, and a share can only carry the six verified-record field codes (`skills` is refused). Only a work record that an independent account verified reaches the Passport, and an open dispute removes it again.
- **Signed export.** `POST /passport/signed` signs only the holder's eligible records with the issuer key; the JWS verifies offline against the published key set, a changed field fails verification, an account with no Passport gets no document, anonymous gets 401, and with no configured key the route answers 503 (no fallback key). The payload carries no account ids, work ids, evidence text or self-reported content.
- **Sharing is recipient-bound, not a bearer link.** There is no secret in the URL: access needs the grant id (an unguessable UUID) *and* being signed in as the named recipient. Expiry is capped at 30 days and enforced at read time (an expired grant is 404 for the recipient and the owner preview), revocation is immediate, sharing with yourself, past dates and over-long expiry are refused, the recipient cannot revoke, and eligibility is re-evaluated on every read (a live share of a record stops showing it once a dispute opens).

### Needs a new migration or an external dependency (not started, nothing applied)

| Item | Why |
|---|---|
| Dedicated qualification records (certificates, licences, courses) with `self_reported` / `document_attached` / `issuer_verified` states | No table exists; today only free-text employment entries and Evidence Vault documents (never marked verified) |
| Recipient access log and owner-visible "who viewed" | Share commands and recipient reads write no `audit_logs` row; grants keep created/activated/revoked timestamps only |
| Notification to a recipient when a Passport is shared with them, and to the owner on first view | Feed kinds today: offer revision, organization decision, agreement decision, work decision, work integrity, case follow-up (+ reminders) |
| Skills in a shared Passport | `shareField` has no skills code; must stay labelled self-reported |
| Bearer-token (link-only) sharing | A product decision: today's recipient-bound model is safer; a token model needs a hashed-token table, constant-time lookup, rate limiting and the owner's approval |
| Realtime Broadcast (below) | `realtime.send` trigger and `realtime.messages` policies |

### Realtime feasibility per entity

Supabase `postgres_changes` is not usable: offers, agreements, work records, notifications and disputes live in `private` tables that clients cannot read (enforced by `schema-security-invariants-db.test.ts`), and granting `select` would break that boundary. The only safe route is Broadcast on private per-user channels: a SECURITY DEFINER trigger calls `realtime.send(payload, event, 'user:<uid>', true)` with an **event key only**, a policy on `realtime.messages` allows `select` only where the topic equals `'user:' || auth.uid()`, and the client treats any message as a hint to refetch through the existing authorized API. This needs a migration (owner approval) and a hosted Realtime service, so it was not built, and the app does not claim live updates.

What is implemented now, without a migration: `src/features/realtime/feed-sync.ts` (tested in `tests/unit/feed-sync.test.ts`): duplicate suppression by event key, read state that cannot regress, bounded newest-first merge, a rule for when a gap or reconnect requires a full refetch, and jittered exponential backoff. It is transport-agnostic so a later Broadcast signal and a focus/interval refresh can share it; wiring it into `notifications.tsx` belongs to the UI owners.
