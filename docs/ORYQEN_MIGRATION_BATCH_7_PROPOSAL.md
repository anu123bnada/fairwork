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

## Risks

1. The projection wrapper adds one insert to every recipient view (already rate limited by the existing quota).
2. A wrapper over `private.notification_events()` is stacked on the existing wrapper chain (the same pattern earlier migrations used); each event source adds a union branch to the feed query.
3. C touches `realtime.messages`, which Supabase manages; policy syntax follows the documented pattern but is unverified here.
4. The rollback script below has not been rehearsed yet; rehearse it on the disposable database before approval.
5. None of A, B or C changes an existing table, grant, policy or the 22-module status.

## Rollback (no data outside the new objects is touched)

```sql
-- C
drop trigger signal_offer_change on private.day3_offers;
drop trigger signal_case_event on private.work_case_events;
drop trigger signal_passport_grant on private.passport_grants;
drop policy oryqen_own_topic_receive on realtime.messages;
drop function private.signal_offer_change(), private.signal_case_event(), private.signal_passport_grant(), private.realtime_signal(uuid,text);
-- B
drop function api.qualifications(jsonb); drop table private.qualification_revisions;
-- A
drop function private.notification_events();
alter function private.notification_events_before_passport() rename to notification_events;
drop function private.passport_notification_events();
drop function api.passport_access_summary(jsonb);
drop function api.passport_projection(jsonb);
alter function api.passport_projection_core(jsonb) rename to passport_projection;
grant execute on function api.passport_projection(jsonb) to authenticated, fw_user_exec;
drop table private.passport_access_log;
```
Dropping the log discards audit history; prefer leaving the table and only restoring the functions.

## To promote after approval

Agent 1 agrees the companion schema change; copy the files into `supabase/migrations/`, add their names and hashes to `scripts/prepare-local-development.mjs`, update `tests/integration/migration-upgrade.test.ts` counts, take a fresh backup with restore rehearsal, dry-run listing exactly these files, apply, then verify on staging with two accounts (including the Realtime checks above).
