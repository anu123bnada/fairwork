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

## Migration 27 pre-flight (requested before approval)

`tests/integration/audit-chain-timezone-migration-db.test.ts`, run on PGlite and on a disposable real PostgreSQL (`scripts/test-audit-chain-postgres.mjs`, embedded binaries, live staging never touched). The schema is rebuilt as staging was (migrations to 25, the audit rows of backup `staging-logical-20261028-2158Z`, migration 26 backfill in a UTC session), then 27 is applied. 10/10 on both.

- Chain table, `audit_logs`, `admin_audit`, row counts and head hash are byte-identical before and after (digest of every row); verification result in UTC is identical.
- Before the pin, verification fails from non-UTC zones; after, it passes from UTC, Colombo, Los Angeles, Kolkata, Kiritimati, Pago Pago and Berlin with one head. Rows written afterwards from any zone chain correctly.
- Owner, security-definer flag, ACL and `search_path` of all chain functions unchanged; only `TimeZone=UTC` added to `audit_chain_append` and `audit_chain_verify`. `authenticated`/`anon` still cannot read the chain or run the private verifier.
- A member of `fw_schema_owner` can apply it; an unrelated role cannot. Rollback: `alter function private.audit_chain_append() reset timezone; alter function private.audit_chain_verify() reset timezone;` (data untouched, re-applies cleanly).
- Checksum `27e72add82055a7ecf5bbec984025d256f300b143f93bb7cd4519d7ecc9e58c4` matches `scripts/prepare-local-development.mjs`; migrations are `-text` in `.gitattributes`.
- **Only case that can break:** a link chained by a non-UTC session before the pin. A verify from a UTC session before applying predicts the outcome exactly (tested). Run it on staging first (admin console audit verification or `begin; set local timezone='UTC'; select private.audit_chain_verify(); rollback;` as the migration identity). If it is not ok, do not apply; the compatibility option is a verifier that accepts either rendering for links before a recorded cut-over sequence, never rehashing history.
- Limits: the backup holds 2 audit rows and predates the chain, so the staging chain itself was not read; hosted `postgres` membership in `fw_schema_owner` is inferred from migration 26 having changed function owners.

## Browser results (isolated, synthetic mode, port 3101 then 3111)

First full run: 509 passed, 14 skipped by design, 27 failed. All 27 were `ERR_CONNECTION_REFUSED` after the server on 3101 stopped; another process (not mine) held 3101 afterwards, so parallel agents collide there. Rerun of `route-sweep.spec.ts` on a private port (`scripts/test-browser-qa.mjs`, port 3111): 130/130 passed. Every spec has therefore passed at least once. These tests use fixtures and intercepted APIs; they are not evidence of hosted behaviour.

## 22-module release-blocker assessment

The authoritative matrix (`ORYQEN_22_MODULE_ACCEPTANCE.md`) is unchanged. This QA pass re-ran each module's database, unit and browser suites and found nothing that contradicts its counts (1 complete with a test key, 20 partial, 1 blocked). It adds no new "verified working" classification: no hosted signed-in run, no device run and no live-provider run was possible without credentials.

| Module | QA classification | Release blockers |
|---|---|---|
| 01 AI Intelligence | Partially implemented | Model choice, written AI policy approval; real-user AI stays off |
| 02 Company Research | Partially implemented | Hosted signed-in use unverified; more registries need keys |
| 03 Career Matching | Partially implemented | Skills-gap, recommendation history missing |
| 04 Offer Workspace | Partially implemented | Hosted verification outstanding |
| 05 Agreements | Partially implemented | Clause management missing; hosted verification outstanding |
| 06 Evidence Vault | Partially implemented | Hosted Storage unverified; malware scanning, third-party status missing |
| 07 Work Passport | Partially implemented | Signed PDF, skills/achievements in sharing; signing key |
| 08 Organization Portal | Partially implemented | Recruiter, hiring manager, viewer roles not built (design only) |
| 09 Disputes | Partially implemented | Reviewer-only file attachments, org response missing. Evidence-reference reviewer read path now tested (new) |
| 10 Trust Ledger | Partially implemented | **Migration 27 pending approval** (false tamper alarms outside UTC); verification lock scope |
| 11 Copilot | Partially implemented | Same AI approval as 01 |
| 12 Security & Privacy | Partially implemented | Passkeys, account deletion executor, hosted auth/email sender |
| 13 Administration | Partially implemented | Monitoring; console forms/dialogs English only |
| 14 Multiplatform UX | Partially implemented | Device review; manual screen-reader audit. Layout sweep 130/130 and axe checks pass on fixtures |
| 15 Localization | Partially implemented | Native review, remaining English surfaces |
| 16 Country Guidance | Partially implemented | Other countries, counsel review |
| 17 Scam Protection | Partially implemented | Correction path, hosted DNS egress |
| 18 Credentials | Complete and verified (test key) | Production signing key ceremony |
| 19 Salary Benchmarking | Blocked | Licensed dataset |
| 20 Notifications/Timeline | Partially implemented | Email/push provider |
| 21 Developer API | Partially implemented | Delivery queue decision |
| 22 Business Platform | Partially implemented | Optional payment provider |

Cross-cutting blockers: hosted signed-in verification of the 28-29 Oct features; owner-approved migration 27; signed Windows/Android artifacts and physical-device acceptance; AI policy approval; production signing key. Windows/Android packaging was not exercised in this pass.

## Operational note

`scripts/test-browser.mjs` is hard-wired to port 3101 and refuses to run if it is taken; two agents running it at once cause failures that look like product defects. Use `scripts/test-browser-qa.mjs` (port 3111) in this worktree.
