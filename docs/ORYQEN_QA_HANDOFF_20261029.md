# ORYQEN QA handoff (Agent 3), 29 October 2026

Worktree `C:\Users\vehiv\Desktop\fairwork-qa`, branch `feature/oryqen-qa-parallel`, baseline `8057010`. Nothing was pushed, merged, deployed or applied to any database.

## Defect found and fixed

**Audit chain verification depends on the session time zone (module 10, security).** `private.audit_chain_append()` and `private.audit_chain_verify()` hash `to_jsonb(row)::text`.
`to_jsonb` renders `timestamptz` in the caller's `TimeZone`, so a row chained from one session verifies as "altered" from another: a false tamper alarm (or, worse, an
operator learning to ignore the alarm). Reproduced on PGlite: baseline verify ok, then rows written under `Asia/Colombo` and verified from `UTC` / `America/Los_Angeles` gave
`ok:false` with dozens of "altered" records. Regression test: `tests/integration/admin-db.test.ts` ("verification does not depend on the session time zone...").

Fix: migration `20261029170000_audit_chain_timezone_pin.sql` (two `ALTER FUNCTION ... SET timezone TO 'UTC'`). **Authored, not applied; needs owner approval.** Existing links were hashed by
UTC sessions (the hosted default), so staging's chain stays valid. Inventory hash added to `scripts/prepare-local-development.mjs`; `migration-upgrade.test.ts` counts updated (27).

## Tests added

- `evidence-vault-db.test.ts`: the previously untested accepted-reviewer read path of `api.case_evidence_list`. Unaccepted reviewer, AAL1 reviewer, review operator, unrelated user all get NOT_FOUND; the accepted reviewer sees only the snapshot fields (no storage key); a reviewer cannot attach; no reviewer/operator/other user can select `vault_documents` or `case_evidence_refs` directly; access ends on capability revocation and assignment revocation while the opener keeps access. All pass without any permission change.
- `admin-db.test.ts`: exactly one chain link per audit write in each of the two audit tables; a deleted audit row is detected; non-administrators (worker, representative, support) cannot verify.

## Observations not fixed (recommendations)

1. `audit_chain_verify()` holds the same advisory lock as every audit insert for its whole scan, so a verification on a large audit table blocks all audit-writing operations. Recommend verifying in bounded batches or without the writer lock (snapshot read plus a head sequence cut-off).
2. `audit_chain_append` serialises all audit writes globally until commit (by design for a single chain); watch throughput.
3. The existing test "a new audit write extends the chain by exactly one link" swallowed errors with `.catch(() => undefined)` and asserted `>=`; the stronger test above supersedes its intent. The old test was left as is.

## Verification run

See the final report in the conversation for the executed commands and counts. Not verified here: hosted staging with real accounts, physical devices, signed Windows/Android artifacts.
