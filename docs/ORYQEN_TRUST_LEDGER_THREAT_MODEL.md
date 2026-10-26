# Trust Ledger and audit: real guarantees and threat model (module 10)

ORYQEN does not use a blockchain and does not claim absolute immutability. This page states what the database and application actually guarantee, who can
defeat each guarantee, and what is deliberately not claimed. It is written so that a reviewer can check each statement against the code and the tests.

## What is recorded

| Record | Table(s) | How it is protected |
|---|---|---|
| Offer and agreement versions, work record versions, decisions, case events, privacy request history, credential events, plan assignments, recruiter decisions and events, vault events | `private.*_events`, `*_versions`, `*_decisions`, `plan_assignments`, `org_plan_assignments` | Row-level security forced; `UPDATE` and `DELETE` are rejected by the trigger `private.day3_reject_history_mutation()`; inserts are only possible through `SECURITY DEFINER` functions that validate the actor and the request |
| Content of an agreement or work version | `content_hash`, `evidence_hash`, `item_set_hash` (SHA-256) | A later read recomputes or compares the hash; a changed source produces a new version, never an edit |
| Administrative actions | audit receipts with the actor, the target, a reason and a revision | Written in the same transaction as the change; the receipt id is returned to the administrator |
| Credential state | `credentials`, `credential_events` | Revocation is an appended event; the public status endpoint reads the latest event |

## Guarantees (and how they are tested)

1. **Append-only at the database.** Ordinary application roles cannot update or delete history rows. Tests on a real PostgreSQL cluster attempt `UPDATE`
   and `DELETE` on each history table and expect failure (`*-db.test.ts`, "cannot be rewritten").
2. **Actor attribution.** Each event stores the authenticated actor id taken from the verified session, never from the request body (`private.request_uid()`);
   the static route audit (`tests/unit/api-route-audit.test.ts`) rejects routes that read an actor or role from client input.
3. **Server timestamps.** `created_at` / `recorded_at` default to `transaction_timestamp()` and policies require equality, so a client cannot back-date.
4. **Version binding.** Confirmations bind to a content hash; confirming a stale version fails with `VERSION_CONFLICT`.
5. **Idempotency.** Every command carries a key; replays return the original receipt and never create a second event.

## Threat model

| Adversary | Can they alter history? | Why / what remains |
|---|---|---|
| An ordinary signed-in user | No | RLS plus the immutability trigger; no policy grants update or delete |
| An approved representative or reviewer | No | Same; their capabilities add reads and specific insert paths, not edits |
| An administrator in the application | No | The admin console issues defined commands that append receipts; there is no edit command |
| A person with the database owner (`postgres`) or Supabase dashboard access | **Yes** | They can disable the trigger and rewrite rows. This is the unavoidable limit of a single-database design |
| Someone who steals a refresh token | Only as that user | Sessions can be revoked; actions are still attributed to the stolen identity |
| A compromised hosting account | Yes | It can change code and secrets. Mitigation is operational: least privilege, MFA on the hosting and database accounts, change alerts |

**Therefore the ledger is tamper-resistant against application-level actors and tamper-evident only where hashes are stored and compared. It is not tamper-proof
against the operator of the database.** A future hardening step (not built) is to anchor periodic digests of the history to an external timestamping service
or to a write-once store the database owner cannot edit; it needs an owner decision on the third party.

## What is not claimed

* No cross-record hash chain exists yet: individual versions are hashed, but a deleted *whole* table row is only prevented by the trigger, not detected by a chain.
* Exports are checksummed copies (`oryqen-admin-records.v1`): the checksum helps compare copies and notice later edits, but it is not a signature and does not prove authenticity.
* Exporting administrative records is not itself written to the audit trail yet; it needs a new administrative command and migration.
* Credentials are signed with Ed25519; their validity depends on the published public key and the status endpoint, not on the ledger.
* ORYQEN is not a court, regulator or arbitration service; decisions recorded here are internal procedural records.
