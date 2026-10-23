# Day 1 completion review — 2026-10-08 (Asia/Colombo)

Historical review, superseded on 2026-10-09 by [DAY1_AUTH_CONTEXT_REPAIR.md](DAY1_AUTH_CONTEXT_REPAIR.md). The grant proposal described below failed and is confirmed unrecorded; its unchanged SQL is archived under `docs/superseded`. Follow the new private-helper proposal and its approval gates, not the old application instructions below.

**Status: local correction prepared and verified; hosted Day 1 completion remains blocked. Do not proceed to Day 2 yet.**

Subsequent owner-reported attempt: the forward migration failed its grant postcondition through the linked CLI. Persisted grants/history are not yet established. See [DAY1_HOSTED_AUTHORITY_REVIEW.md](DAY1_HOSTED_AUTHORITY_REVIEW.md) for read-only authority checks and the conditional administrative procedure. The local test results below remain historical verification, not proof of hosted grant authority.

## Repository and evidence

- Workspace read/write authorization verified with a temporary write/read/delete probe.
- Branch `main`; HEAD and `fairwork-architecture-v1.0.0` both resolve to `c1dc8ab8e956819ce5af5f0f2c047e5cbee2d2f1`. Day 1 implementation was already uncommitted/untracked on arrival; nothing was staged, committed or pushed.
- Reviewed the implementation, handoff, approved architecture records, hosted public/interactive verdicts and diagnostic SQL.
- The requested `test-results/day1-rpc-diagnostics.json` was absent when checked. The owner subsequently pasted the complete diagnostic JSON in this chat. The findings below refer to that owner-supplied hosted catalog snapshot, not a database connection made by this review.
- All 12 `api`/`private` function source MD5 values in that snapshot match the normalized function bodies in the original local migration. These hashes compare source consistency; they are not an independent attestation of hosted state.

## Exact permission failure

The hosted interactive report confirms retained session cookies and direct Auth identity HTTP 200, followed by authenticated `get_me` HTTP 403 / PostgreSQL `42501`.

The catalog identifies the missing privilege:

| Role | `auth` schema USAGE | `auth.uid()` EXECUTE | `auth.jwt()` EXECUTE |
|---|---|---|---|
| `fw_user_exec` | **false** | true | true |
| `fw_policy_exec` | **false** | true | true |

`authenticated` already has `api` USAGE and EXECUTE on the three RPCs. `api.get_me` is SECURITY DEFINER, owned by `fw_user_exec`; it calls `private.require_identity`, which resolves `auth.uid()` / `auth.jwt()` under that executor. Missing schema USAGE produces `42501: permission denied for schema auth`. Function EXECUTE alone does not provide schema lookup access.

The policy helpers are SECURITY DEFINER functions owned by `fw_policy_exec` and also resolve Auth helpers. Repairing only the outer RPC executor leaves the policy executor failing. The regression test independently reproduces both stages and then verifies recovery.

The supplied catalog shows FORCE RLS enabled on all five tables, separate table ownership, restricted metadata-column grants, expected policies and non-login/non-superuser/NOBYPASSRLS executors. A false table-level INSERT check on `profiles` is expected: the implementation intentionally grants INSERT on selected columns only. It is not evidence for adding whole-table INSERT.

The initial migration already contains the intended Auth schema grant. The diagnostic proves it is absent in the hosted effective privileges; it does **not** establish whether the original grant lacked authority, was skipped, or was later revoked. Determining that history would require migration output or database audit evidence. No historical cause is invented.

## Prepared forward-only correction

New file: `supabase/migrations/202610080001_identity_auth_schema_usage.sql`.

Its only permission change is:

```sql
grant usage on schema auth to fw_user_exec, fw_policy_exec;
```

The transaction includes a postcondition that raises if either role still lacks USAGE, so a grant warning cannot silently count as a successful repair. Use an approved offline migration identity authorized to grant this privilege. If that identity lacks grant authority, resolve ownership/grant authority through the trusted infrastructure owner; do not add runtime role memberships or broaden application access.

No function EXECUTE, table/column privilege, schema CREATE, owner, role attribute, membership, policy, search path or API exposure is changed. No Auth user-table access is granted. No service-role runtime, RLS bypass or application error-mapping workaround was added. The previously applied migration is unchanged.

The hosted catalog script now has **13 checks**, adding forward-migration history and effective Auth-helper access for both executors. The repair-history check should fail until the migration is applied through the approved migration workflow.

## Verification performed

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, zero warnings |
| `npm test` | PASS: 27 tests across five files (14 unit, 13 PostgreSQL integration) |
| Production `next build` | PASS |
| Chromium production smoke tests | PASS: 2 tests; runner exit 0 |
| Original migration, `.env.local`, existing UI file hashes | Unchanged |
| All 12 approved architecture/review documents | Unchanged from baseline tag |

The new integration regression recreates the hosted missing schema grants, asserts the exact SQLSTATE/message, proves a user-executor-only repair is insufficient, applies the new migration locally, and exercises missing-profile lookup plus profile create/read/update. It compares private table/column ACLs, RLS policies/flags, function bodies/ownership/ACLs, role properties/memberships and private/API schema ACLs before and after; these remain equal. It also verifies both executors still cannot access `auth.users`. The existing isolation/capability/replay/quota tests run with both migrations applied.

Initial sandbox attempts failed because Next.js could not canonicalize the repository path (Windows access denied) and two Vitest suites could not read sandbox temporary files. The authorized rerun outside the sandbox passed. These initial infrastructure failures are not recorded as successful checks.

Browser verification used empty Supabase values only in child-process environments, leaving `.env.local` untouched. The local production server was stopped afterward. Logs and browser output are under ignored `test-results/day1-local-*`; existing hosted reports were preserved. The generated `.next` build is the **unconfigured smoke-test build**: rebuild with normal configuration before using `npm run start` for hosted verification, or use the configured development server.

PGlite executes PostgreSQL with a test-only Auth shim and one connection. Local results do not establish hosted PostgREST behavior, hosted grant authority, automatic session refresh/expiry, or concurrent-connection behavior. Dependency versions/lockfile were unchanged; the previous dependency-audit result was not re-established in this review.

## Remaining verification and stopping point

No hosted SQL, migrations, profile probes or Auth mutations were executed in this review. No hosted correction is claimed. No commit, push, deployment, Figma change or Day 2 work occurred.

After separate authorization to apply the reviewed migration:

1. Use the approved offline migration workflow with Auth schema grant authority. Preserve `202610070001`; record only the new forward migration. Inspect warnings/errors and confirm migration history.
2. Rerun `scripts/diagnose-day1-rpc.sql`: both executor rows for `auth` USAGE must be true. Existing narrow function/table/column grants, FORCE RLS, owners and policies must remain intact. Rerun `scripts/day1-hosted-catalog.sql`; all 13 verdicts should pass.
3. Run the configured app and `node scripts/verify-day1-hosted.mjs` locally, entering two distinct synthetic accounts through its hidden prompts. This runner performs synthetic profile/metadata writes, so it was intentionally not run here. Verify profile create/read/update, revision/idempotency, A/B isolation, escalation denial, authenticated exposure and sign-out/revocation. Use fresh synthetic accounts if profile creation otherwise remains UNVERIFIED. Share only sanitized verdicts, never passwords or tokens.
4. Review the remaining UNVERIFIED items honestly, including actual expiry/automatic refresh and the separate hosted catalog result. The interactive runner explicitly leaves those gates unverified; do not infer success from initial cookies or an explicit refresh alone.

**Day 2 readiness: NO until the hosted repair and required verification are complete and reviewed, followed by a new instruction to begin Day 2.** The local fix is ready for review; Day 1 end-to-end completion is still pending.
