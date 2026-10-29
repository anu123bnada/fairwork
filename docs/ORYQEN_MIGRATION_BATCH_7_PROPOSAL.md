# Migration batch 7: PROPOSAL for review (29 Oct 2026)

Status: **DRAFT, NOT APPLIED, NOT IN THE MIGRATION INVENTORY.** The three files live in `docs/proposed-migrations/` on purpose, so `supabase db push` and `scripts/prepare-local-development.mjs` cannot pick them up. Nothing was run against staging, production or any hosted service. Author: Agent 3 (QA/backend), branch `feature/oryqen-qa-parallel`.

| # | File | SHA-256 | What it adds |
|---|---|---|---|
| A | `20261030100000_passport_access_log.sql` | `fc99f694b6cc7982dd8d0a46068b418ea01dc5c6a1beee410e44d46ff02287c0` | Append-only record of every successful recipient view of a shared Passport record, an owner-only summary, and two notification events |
| B | `20261030110000_qualifications.sql` | `b227d45fb9552f64464261be5c0f5777e86453d71a996e069854a86b56ae5b34` | Private qualification records whose verification state is derived and can never be "verified" |
| C | `20261030120000_realtime_signals.sql` | `17b86da1471a180c3f08b1712c5ac0b8d3a3616541011fcfa37486ff63cb370d` | Realtime *hints* on private per-user channels (area name only) |

The hashes change if a file is edited; recompute before any approval. Apply order is A, B, C; B and C do not depend on A.

## Evidence

`tests/integration/proposed-batch7-db.test.ts` applies the three files on top of every real migration in a disposable database and runs a real two-account journey (offer, agreement, work record, verification, Passport). 11 tests pass on PGlite and on a disposable real PostgreSQL (`scripts/test-batch7-postgres.mjs`). Section C ran against a **stub** of Supabase's `realtime` schema, so it proves payload shape, privacy and fan-out but **not** the hosted Realtime service.

## A. Passport access log and notifications

- The existing projection function is renamed `passport_projection_core` and closed to clients; a wrapper under the old name and signature calls it (so named recipient, expiry, revocation, eligibility and quota all still run first) and then records the view. A client calling the database API directly cannot bypass the log.
- Logged: each successful `recipient` view. Not logged: refused reads, the owner's `preview`, unknown or revoked grants (tested). The log stores grant, owner, recipient, whether an entry was shown, and the time; never record content.
- Append-only (trigger), forced RLS, no client privileges. Only the owner can read a summary (views, first and last view per grant); the recipient and everyone else get an empty list.
- Notification events: the recipient sees "shared with you" while the grant is live; the owner sees "opened" from the first view. Strangers and the employer see neither; revocation removes the recipient's event; history is kept.
- **Companion change required first (Agent 1):** `src/features/identity/notifications-schema.ts` has a strict enum of kinds and a strict link pattern. It must accept `passport_share` and `passport_view` and the link `/app/passport` **before** the migration is applied, or the whole notification feed would fail to parse for any account that has such an event.

## B. Qualification records

- Immutable revisions, owner-only, idempotent, version-checked (same shape as private employment history). Removal is a new revision, so history stays.
- Verification is never stored and cannot be sent: it is derived on read as `self_reported` (no document) or `document_attached` (the owner's own, non-revoked Evidence Vault document). Both come with `independentlyVerified: false`. Forged `verification`, `verified`, `status` and `independentlyVerified` fields are rejected (tested). There is no column, value or function that can produce an issuer-verified state; that would need its own authority-backed workflow and migration.
- Documents: must belong to the caller, must exist, a revoked document cannot be newly attached (an already attached one may stay on later revisions).
- API layer still to write (route, schema, screen). Qualifications must not be added to shared Passports or the signed export until a separately approved design says how self-reported data is labelled there.

## C. Realtime signals (needs the hosted Realtime service)

- A signal is the area name only (`offers`, `cases`, `passport`, `notifications`, ...). No ids, titles or content, so a misrouted message discloses nothing. The browser treats it as a hint to refetch through the existing API, using `src/features/realtime/feed-sync.ts` for duplicates, reconnects and missed events.
- Policy on `realtime.messages`: an account may receive broadcasts only on the topic `user:<its own uid>`; there is no insert policy, so clients cannot publish.
- Triggers signal the offer parties, the parties and assigned reviewer of a case, and the named recipient of a Passport grant (activation and revocation). A failing or absent Realtime service never fails or rolls back the business write (tested by making the sender raise).
- **Must be verified on the hosted project with two real accounts before anyone relies on it:** that `realtime.send` can be called by the granted role (otherwise change the owner of `private.realtime_signal`), that private channels and the policy behave as modelled, and that a second account cannot join the first account's topic. Until then the UI must keep presenting the feed as "refresh", not "live".

## Companion work already in this branch (inert until the batch is approved)

- **Qualification API contract:** `src/features/qualifications/schema.ts` and `src/app/api/v1/me/qualifications/route.ts` (GET list, POST save/remove). The schema has no way to send or receive "verified" (`verification` is `self_reported | document_attached`, `independentlyVerified` is the literal `false`), and a database answer that claimed otherwise fails to parse and becomes a 503. Until section B exists the route answers 503. `tests/unit/qualifications-contract.test.ts` (6 tests) and the batch 7 rehearsal (the real database output parses with the browser schema) cover it. **No screen exists yet**; UI owners must label the two states honestly ("You entered this" / "Document attached by you, not checked by anyone") and must keep qualifications out of shared Passports and the signed export.
- **Hosted two-account Realtime check:** `scripts/verify-hosted-realtime.mjs` (logic in `scripts/lib/realtime-authz-check.mjs`, 6 unit tests with a fake client that applies the proposed policy). Staging project or loopback only, hidden password prompts, never writes or publishes. Checks: each account joins its own channel; neither joins the other's; `user:*`, `user:`, `user:%`, `user` and a prefixed topic are refused; an account with no session is refused; clients cannot publish; optional `--listen N` verifies every received payload is exactly `{area}`. Run it only after the batch is applied to staging.
- **Rollback:** rehearsed (see above).

## Risks

1. The projection wrapper adds one insert to every recipient view (already rate limited by the existing quota).
2. A wrapper over `private.notification_events()` is stacked on the existing wrapper chain (the same pattern earlier migrations used); each event source adds a union branch to the feed query.
3. C touches `realtime.messages`, which Supabase manages; policy syntax follows the documented pattern but is unverified here.
4. None of A, B or C changes an existing table, grant, policy or the 22-module status.

## Rollback

`docs/proposed-migrations/rollback_batch7.sql` (reverse order; touches only the objects batch 7 added and restores the renamed functions and their grants). Rehearsed in `proposed-batch7-db.test.ts`: after the rollback the projection, the notification feed and every earlier flow work as before, no batch 7 object remains, existing rows are unchanged, and the three files apply again cleanly. Dropping the access log discards that audit history; remove the last `drop table` line of section A if it should be kept.

## To promote after approval

Agent 1 agrees the companion schema change; copy the files into `supabase/migrations/`, add their names and hashes to `scripts/prepare-local-development.mjs`, update `tests/integration/migration-upgrade.test.ts` counts, take a fresh backup with restore rehearsal, dry-run listing exactly these files, apply, then verify on staging with two accounts (including the Realtime checks above).
