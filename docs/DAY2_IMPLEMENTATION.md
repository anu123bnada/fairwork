# Day 2 identity and synthetic authority

2026-10-09. Implements the approved `MVP_PLAN.md` Day 2/B02 scope and the `API.md` operator contracts. This is local implementation, not a claim of hosted completion. No hosted migration, capability grant, commit, push or deployment was performed during this work.

## Implemented

- Existing email/password authentication now has a functional `/sign-in` form. `/operator/authority` uses real same-origin API handlers, the verified Supabase identity and database commands. No service-role key or mock backend is used in application code.
- Explicit TOTP enrollment, challenge and verification use Supabase Auth. Enrollment secrets are shown only for authenticated setup, kept in component memory, cleared after verification/sign-out, and never logged or placed in URLs/storage. Upgraded tokens stay in the SSR cookie transport; they are not serialized in API responses. No automatic factor replacement or public capability-grant endpoint exists.
- `api.provision_company(jsonb)` provisions a visibly `demo_provisioned` company without granting membership. `api.decide_membership(jsonb)` appends independent approve/revoke decisions under a membership lock, with evidence references, reason, fixed policy version, expected revision and bounded expiry. Reapproval creates a new immutable ID.
- Composite parent FKs, immutable-history triggers and deferred commit checks bind the current pointer to the latest decision. Self-approval, inactive approval subjects, stale revisions, arbitrary request fields, backdated decisions and incomplete roots fail closed. Active authority checks account/company state, current decision and database time. Replay returns current status rather than restoring an old approval.
- Dedicated NOLOGIN/NOBYPASSRLS executor, FORCE RLS on all three added private tables, metadata-only policy helpers, fixed empty search paths, narrow authenticated RPC grants, atomic audit/receipts and a 30/minute operator command quota. The Day 1 executor's shared-table policies remain restricted to identity commands. Existing Auth schema grants/ownership and all three applied migrations are unchanged.
- A guarded offline capability-bootstrap template requires existing administrative authority, distinct approver/subject profiles, verified TOTP factors, a named approval record and a bounded expiry. It writes the assignment and audit together. It does not grant database privileges or bypass the infrastructure authorization check.

## Design and scope

The sign-in frame is Figma `68:6613` in file `5mFuLmt00uZP7Osp3ezM0z`. Original background, glass logo and shield SVG assets are stored in `public/figma/auth/` with their intrinsic geometry. Typography, colors, mobile width and spacing follow that frame. Email/password and six-digit authenticator controls implement the already-approved D-02 exception to the illustrated mobile-number/four-digit flow. The minimal operator controls reuse this shell; they are the narrow command surface allowed by the roadmap, not a new dashboard or replacement product Home screen.

The original Day 1 checkpoint remains available at `/`, with a link to sign-in. General profile editing, company directories, offer/agreement/work UI and employer navigation are not added early. A membership table alone does not authorize the browser to infer an employer context.

## Verification

Local database tests run real PostgreSQL via PGlite, including a restricted non-superuser `postgres` migration fixture with CREATEROLE but no Auth schema grant authority. Administrative bootstrap is a separate fixture with explicitly modeled existing offline rights. Those fixtures never grant anything to the hosted database. PGlite is PostgreSQL 18.3; hosted PostgreSQL 17.11 has not executed this new migration. The SQL uses PostgreSQL 17-compatible features; hosted execution remains gated by preflight and approval.

The separate Day 2 catalog verifier extends the Day 1 invariants to **18 checks**, five RPCs, eight private tables, four non-login roles, 27 policies and eight invariant triggers. The original 16-check Day 1 verifier is preserved as historical verification for the Day 1 schema; its exact three-RPC/five-table expectations are intentionally not the post-Day-2 schema contract.

Browser tests include real unconfigured-route/CSRF checks and isolated UI transport fixtures for lost-response retries and TOTP state transitions. The fixture tests do not prove hosted MFA or live operator authorization. `npm run test:e2e:isolated` builds with empty public Supabase settings in `test-results/day2-next`, runs port 3101, refuses to replace any existing server and restores only Next's temporary type-file changes. It does not edit `.env.local` or disturb port 3000. The first browser run against the configured production artifact correctly failed two unconfigured-state expectations; the isolated build fixes that harness error rather than weakening those assertions.

Final command results are recorded in `DAY2_VERIFICATION.md`.

## Hosted procedure — only after approval

1. Preserve the ongoing Day 1 token-expiry run. Retain its JSON report. The two unfinished Day 1 checks remain in `DAY1_VERIFICATION_BACKLOG.md`.
2. In SQL Editor, run the **read-only** `scripts/day2-preflight.sql`. All 10 checks must PASS. This specifically verifies new CREATEROLE/ownership prerequisites; the older Day 1 diagnostics did not establish all of them. Do not assume a SQL Editor result proves the identity of a different CLI connection.
3. In PowerShell, inspect the linked target and the proposed queue:

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
npx supabase migration list --linked --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'Migration history inspection failed' }
npx supabase db push --linked --dry-run --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'Dry-run failed' }
```

Expected pending file: **only `202610090002_demo_authority.sql`**. The three Day 1 migrations must remain recorded; retired `202610080001` must remain absent. A dry-run shows the queue, not execution proof. Stop for any different target, extra migration, missing history or failed preflight.

4. After explicit application approval:

```powershell
npx supabase db push --linked --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'Apply failed: inspect state; do not repair history manually' }
npx supabase migration list --linked --skip-vault
```

5. Run `scripts/day2-hosted-catalog.sql` in SQL Editor: all **18** checks must PASS. Keep the complete output with the migration history. Do not use the old Day 1 allowlist check to assert that the now-approved extra RPCs are unauthorized.
6. Use only existing/pre-provisioned synthetic accounts, with public signup disabled. Through the application, create any missing minimal profiles using the existing Day 1 profile contract and complete TOTP enrollment/verification for the distinct approver and authority operator. Record real profile and factor IDs privately, never passwords, JWTs or MFA seeds. Both enrollments must be verified. Complete a fresh authenticator challenge as each approver/operator before the approved bootstrap. The SQL can verify enrollment, but cannot independently prove that human approval or that a fresh interactive challenge occurred.
7. After separate approval of actual identities and purpose, populate a **private copy** of `scripts/day2-bootstrap-capability.sql`. Keep its stable assignment UUID, named owner approval reference and expiry. Run using the already-authorized offline `postgres` administration path. The template requires existing BYPASSRLS/superuser administrative status and SELECT on `auth.mfa_factors`; if either is absent, STOP. Do not grant broader permissions, change Auth ownership, SET ROLE to a managed superuser or use a runtime service-role key. The procedure is outside the runtime RLS boundary. Revoke a capability through an approved offline transaction using the same `hashtextextended(subject_id::text,0)` advisory lock as commands, with audit; no generic revocation endpoint has been introduced.
8. Sign in as the authority operator at `/sign-in`, verify TOTP, and use `/operator/authority` to provision the one approved synthetic company. Record its returned UUID. Approve a distinct synthetic representative with revision 0, a `demo:` fixture evidence reference, an explicit simulation reason and an expiry within 30 days. Save the returned decision ID/revision. Never treat this as real employer verification.
9. Exercise the live hosted gates: ordinary A/B and anonymous users denied; operator at aal1 denied; verified operator succeeds; self-approval denied; changed request with reused idempotency key denied; exact retry creates one audit/decision only; stale revision denied; revoke makes authority inactive; old approval replay stays inactive; reapproval produces a new decision ID; direct RPC quota cannot be bypassed; capability revocation blocks even a receipt replay. Verify no private-table access, no anonymous/service-role RPC access and all 18 catalog checks again. Record PASS/FAIL per case with identifiers only. Hosted tests mutate synthetic records and require approval; they have not been run here.

If anything fails, stop operator activity, preserve the error code/request ID and read-only catalog/history evidence. The migration is transactional, but establish current state rather than assuming rollback or success. If unrecorded, fix the pending migration only after proving no partial state. If recorded, prepare another forward migration. Never edit an applied migration, reset the database, fabricate a migration-history row, widen client privileges or disable RLS. Local passing tests do not override a hosted failure.

## Remaining gates

- Hosted Day 2 preflight, migration application, actual synthetic fixture IDs/approvals, TOTP bootstrap and live authorization tests are pending approval. No hosted Day 2 PASS is claimed.
- Local PGlite validates transactional integrity and stale revisions but is not a multi-connection concurrency rehearsal. On hosted PostgreSQL 17.11, two simultaneous commands with the same expected revision must produce one new decision and one VERSION_CONFLICT; confirm one matching audit event. Perform this only with approved synthetic fixtures after deployment approval.
- Full competition fixture provisioning (the final named worker/counterpart/recipient accounts and fixed skill definitions/declarations) requires the approved dataset and is not fabricated here. Existing provisioned Day 1 accounts are preserved. This does not block the implemented identity/authority command slice.
- Day 1 natural token expiry/application refresh and fresh-account creation remain pending until their independent evidence is collected.

References: [approved API](API.md), [database contract](DATABASE.md), [roadmap](MVP_PLAN.md), [Supabase TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp).
