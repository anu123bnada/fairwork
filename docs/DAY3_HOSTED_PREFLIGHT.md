# FAIRWORK Day 3 hosted preflight and verification

**Current continuation update (2026-10-12):** read `REPAIR_20261012.md` and the
root `CONTINUE_HERE.md` first. The new participant recovery work supersedes this
document's current-session-only limitation. The pending queue now also includes
`202610120001_agreement_participant_read.sql`; the current release procedure
requires the original 12 catalog checks **and** 5 additional recovery checks.
The single-pending-file procedure below is retained as earlier context and must
not be used as the current release checklist. No hosted application is authorized.

Updated 2026-10-12. This is a procedure, not evidence of a hosted check. The Day 3 migration remains local and has not been applied to Supabase. Do not perform a hosted mutation without separate explicit approval.

## Product design gate

The owner supplied original FAIRWORK screen exports covering Splash through Notifications. The product routes now include `/`, `/intro/splash`, `/intro/language`, `/intro/onboarding`, `/welcome`, `/sign-in`, `/otp`, and `/app/{home,add-offer,analyzing,check,questions,agreement,work-record,passport,settings,employer,share,notifications}`. Shared styling is mobile-first and uses Manrope, the pale blue/teal gradient, rounded translucent cards, blue actions, and bottom navigation seen in the supplied mobile references.

The prototype links and every frame's pixel-level details were not independently inspected in Figma. Browser coverage and local implementation do not establish exact visual equivalence to every export or hosted behavior. The Day 3 screens call the authenticated offer, answer, and confirmation APIs; work records, passport evidence/sharing, notification feeds, settings persistence, and employer dashboard data remain visibly preview-only because their server contracts do not exist. Agreement state is current-session-only; a separate party cannot fetch authoritative terms until a secure read/query API is approved and implemented.

## Current local implementation

- Day 3 uses six private tables and three authenticated RPCs behind same-origin API routes. Request identity, agreement hash, revision authority, and confirmation actor are derived/validated server-side.
- `scripts/day3-hosted-preflight.sql` is read-only and checks the expected migration/role/schema prerequisites. The local PGlite integration harness executes it and requires ten PASS results.
- `scripts/day3-hosted-catalog.sql` is read-only and checks twelve post-migration catalog/security invariants. The local PGlite integration harness executes it and requires twelve PASS results.
- These scripts and local integration tests do not establish hosted PostgreSQL behavior.

The known hosted state below is supplied by the project owner/context and was not re-queried in this task: Day 1 and Day 2 migrations are recorded in the approved Mumbai project; the Day 2 catalog verifier reportedly returned 18/18 PASS; the Day 3 migration is pending; the linked CLI dry-run previously stopped at database password authentication. Day 2 live TOTP/operator/concurrency checks and Day 1 natural-expiry/refresh and fresh-account evidence remain pending.

## Read-only preflight — before approval

1. In Supabase Dashboard, independently confirm the target is project ref `cqjxsafeodslmyoqftdj` in Mumbai. Compare the displayed name, project ref, and region. If any differ, stop. Do not create, relink, or change project settings.
2. In the SQL Editor for that same project, run `scripts/day3-hosted-preflight.sql` in its entirety. Require **10/10 PASS**. It checks:
   - `postgres` execution identity and expected prior migration history;
   - existing restricted executor roles and owner membership;
   - DDL schema/table prerequisites for this migration;
   - the existing Day 2 authority RPC boundary;
   - no partial Day 3 objects or client private-schema access.
   
   A failed or missing check is a STOP condition. Do not grant privileges or adjust ownership to make it pass.
3. Using the already-linked local checkout, inspect remote migration history and dry-run:

   ```powershell
   Set-Location 'C:\Users\vehiv\Desktop\fairwork'
   npx supabase migration list --linked --skip-vault
   if ($LASTEXITCODE -ne 0) { throw 'Stop: migration history inspection failed.' }
   npx supabase db push --linked --dry-run --skip-vault
   if ($LASTEXITCODE -ne 0) { throw 'Stop: migration dry-run failed.' }
   ```

   Verify the link still targets `cqjxsafeodslmyoqftdj` without running `supabase link`. Required state: all four approved migrations through `202610090002_demo_authority.sql` are recorded, retired `202610080001` is absent, and **only** `202610100001_day3_offer_agreement.sql` is pending.
4. The prior dry-run failure was database password authentication. Resolve it only by using the already-approved password source/secret manager and the CLI's secure credential mechanism. Never put a password in a command argument, source file, terminal transcript, test output, or this report. Do not reset/change the hosted password or modify database settings. If authentication still fails, stop; do not infer the pending queue from local files.
5. Preserve the Day 2 18/18 catalog result before Day 3. The existing Day 2 verifier has intentionally strict pre-Day-3 object counts; **do not run it as the post-Day-3 verifier**.

No migration has been applied by this checklist. A successful read-only preflight is not migration approval.

## Separate approval gate

Before applying, the owner must review the final migration hash and confirm all of the following in a separate approval:

- exact target ref and Mumbai region;
- complete 10/10 Day 3 preflight output;
- CLI history output and dry-run with only the Day 3 file pending;
- backup/recovery decision and the approved synthetic test account roster;
- explicit authorization to apply `202610100001_day3_offer_agreement.sql`.

Only after that approval may an authorized operator run the linked migration command. Do not use `db reset`, seed hosted data, bootstrap privileges, or repair migration history manually. If application fails or the recorded state is ambiguous, stop and gather read-only history/catalog evidence; never edit an applied migration.

## Post-migration hosted verification — approved synthetic accounts only

After application approval and execution, first confirm the remote history records all five migrations, including `202610100001`. Then run `scripts/day3-hosted-catalog.sql` in the same project's SQL Editor and require **12/12 PASS**. This checks restricted RPC grants, six private FORCE-RLS tables, role/function ownership and search paths, immutable-history/effective-pointer triggers, and removal of temporary schema CREATE grants.

Exercise the application/RPC boundary with only the approved synthetic employer and worker accounts; record PASS, FAIL, or UNVERIFIED for each case and a request/run identifier, never a credential:

1. Employer authority is accepted only for the authenticated current member; a worker cannot use employer role, and cross-company commands are denied.
2. The worker identity must match the authenticated worker. Forged `requesterId`, `confirmedBy`, hashes, unresolved items, or revision fields never establish authority or agreement state.
3. Offers and amendments persist immutable revisions. Same-key/same-payload replay does not add a revision/audit event; same-key/changed-payload returns `IDEMPOTENCY_CONFLICT`; stale expected revision returns `VERSION_CONFLICT`.
4. Questions are attached to their offer revision; authorized answers persist once and cannot be changed in place. Cross-company, wrong-worker, and cross-version answers are denied.
5. Agreement confirmation is blocked while required questions lack answers. Its server-generated agreement hash binds canonical terms and the unresolved-question set. Hash/revision values supplied by a direct caller do not affect the stored hash.
6. Each distinct party must confirm the same offer revision/hash in a separate authenticated session. The first confirmation does not move the effective pointer. Only the second valid confirmation may create/advance it.
7. Revoke employer authority between confirmations; the second confirmation/effective-pointer transition must fail. No stale confirmation may become effective after authority expiry/revocation.
8. Submit two simultaneous amendments with the same expected revision using separate requests. Require exactly one success and one `VERSION_CONFLICT`, one new revision, and one matching command audit for the committed operation.
9. Verify quota enforcement, audit append-only behavior, idempotency receipts, private table denial to `anon`/`authenticated`/`service_role`, and that only the approved authenticated API RPCs are executable.
10. Re-run the read-only catalog verifier and retain the complete output. Do not expose JWTs, TOTP seeds/codes, passwords, service keys, employment details, or full request bodies in evidence.

## Outstanding gates; do not mark complete

- Hosted Day 2 post-migration dry-run/password-authentication blocker.
- Live Day 2 TOTP enrollment/challenge, capability bootstrap, operator authorization, audit/quota, and hosted PostgreSQL concurrency verification.
- Day 1 natural token expiry/refresh and fresh-account creation evidence.
- Hosted Day 3 preflight, migration approval/application, and every post-migration check above.
- Product design handoff/access and the real Figma-integrated product screens/browser coverage. The current `/day3` UI is a developer sandbox; mocked browser tests do not prove live session/API/database integration.

Local PGlite, unit, typecheck, lint, build, and isolated browser passes are local evidence only and cannot close any hosted gate.

## Local scan repair follow-up — 2026-10-12

See DAY3_SCAN_VERIFICATION_HANDOFF.md for independent reproductions, local fixes and regression results. The pending Day 3 migration now freezes the representative across an offer chain, enforces participant-scoped executor access, preserves bootstrap audit compatibility, emits UUIDv8 question IDs, and returns saved terms for display. Worker-created reviews without an explicit representative remain private drafts and cannot be confirmed. Cross-session lookup, participant handoff and downstream preview modules remain incomplete. No hosted migration or deployment is authorized by this update.
