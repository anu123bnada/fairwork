# Staging migration batch 6 — for owner approval (29 Oct 2026)

Status: **PREPARED, NOT APPLIED.** Target: staging project `jpvgsmzomlmowarlfkdl` only. No production, `main` or Fairwork resource. Authored by Agent 3 (QA) in `feature/oryqen-qa-parallel`; reviewed and integrated by the integration owner.

| # | File | Purpose |
|---|---|---|
| 27 | `20261029170000_audit_chain_timezone_pin.sql` | Module 10 correction: make the audit hash chain independent of the session time zone |

## The defect (found by QA, reproduced)
`private.audit_chain_append()` and `private.audit_chain_verify()` hash `to_jsonb(row)::text`; `to_jsonb` renders `timestamptz` in the caller's `TimeZone`. A row chained from a session in one time zone verified as "altered" from a session in another, a false tamper alarm. Reproduced on PGlite by writing under `Asia/Colombo` and verifying from `UTC` and `America/Los_Angeles`.

## What the migration does
Two statements: `alter function private.audit_chain_append() set timezone to 'UTC'; alter function private.audit_chain_verify() set timezone to 'UTC';`. No table, policy, grant, owner, or data is touched; no hash is rewritten.

## Compatibility with the existing staging chain (checked read-only on 29 Oct)
- Staging `TimeZone` is `UTC`. The chain holds 2 links, created by the migration's own backfill under UTC; `private.audit_chain_verify()` currently returns `ok: true`, 0 broken links, 0 altered records, head `87b0546e8702ca16aa5a417cf9aca0bb4e302b0380a1df9c66453a5281e81bea`.
- Pinning the functions to UTC reproduces exactly the text those sessions hashed, so every existing link stays valid; the head hash must be unchanged after applying (that is the post-check).
- Both functions currently have `search_path=""` and no other setting; `alter function ... set` adds `timezone=UTC` beside it.

## Tests (local)
Regression: verification is independent of the session time zone (rows written under Asia/Colombo verify ok from UTC and America/Los_Angeles); exactly one chain link per audit write in each audit table; a deleted audit row is detected; non-administrators cannot verify. Also the accepted-reviewer read path of `api.case_evidence_list` (unaccepted or AAL1 reviewer, review operator and unrelated user get NOT_FOUND; the accepted reviewer sees only the snapshot fields; direct table access denied; access ends on revocation). Results of the integrated run are in the release status.

## Procedure after approval
Fresh Docker-free backup and restore check, checksum, project-ref and dry run listing exactly this one file, `supabase db push --linked --yes`, then: migration list 59/59; both functions show `timezone=UTC` and unchanged `search_path`, owner and execute rights; `private.audit_chain_verify()` still `ok` with the same head hash; existing counts unchanged.

## Rollback
```sql
alter function private.audit_chain_append() reset timezone;
alter function private.audit_chain_verify() reset timezone;
delete from supabase_migrations.schema_migrations where version = '20261029170000';
```
No data is affected either way.

## QA recommendations not applied (for a later reviewed batch)
`audit_chain_verify()` holds the global audit lock for the whole scan (a verification on a large audit table blocks audit writes: verify in bounded batches or from a snapshot with a head cut-off); the chain serialises all audit writes by design (watch throughput).
