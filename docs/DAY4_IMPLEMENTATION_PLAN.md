# DEVELOPMENT DAY 4 — exact implementation plan

**October 14 execution update:** the user's subsequent Day 4 attachment explicitly
authorized implementation alongside the open Day 3 visual gate. The planning-only
and close-Day-3-first wording below records the original plan, not the current
authorization. See `DAY4_COMPLETION.md` and `DAY4_AGREEMENT_COMPATIBILITY.md` for
implemented scope, evidence, deliberate adapters and remaining gates.

Prepared October 13, 2026, Asia/Colombo. **Planning only; no Day 4 implementation
started.** Deadline remains October 23, 2026 at 19:00 (13:30 UTC).

## Entry gate and phase definition

Read `DAY3_COMPLETION_20261013.md` first. Close its remaining local acceptance
gate before starting this implementation. Hosted approval gates stay separate;
do not relabel local tests as hosted evidence. The original `MVP_PLAN.md` groups
Days 3–4 together: B04 manual offers/questions and B05 versioned agreements.
Day 4 completes those agreement contracts. Persistent Work Record and Work
Passport follow in development Days 5–6; their detailed backlog remains in
`NEXT_SPRINT_20261013.md`. Calendar dates do not advance development phases.

## Ordered work and exit evidence

1. **Contract inventory (first action, approximately 1 hour).** Write
   `docs/DAY4_AGREEMENT_CONTRACT.md` mapping each current `private.day3_*` table,
   RPC and DTO to `API.md` §3 and `DATABASE.md` agreement rules. Specify immutable
   source version, terms, question IDs, answer IDs/attribution, unresolved IDs,
   worker, designated representative and authority-decision ID. Decide exact
   canonical serialization/hash and draft/proposed/confirmed/rejected/superseded
   transitions before SQL. Keep current confirmations readable; never reinterpret
   them as consent to a richer context or eligible work-evidence basis.
2. **Forward database contract (approximately 3 hours).** Add a new timestamped
   migration, preserving all six existing files. Implement worker-owned draft
   and explicit representative designation, immutable version/proposal, exact
   question sharing, answer/source reference binding and explicit unresolved-ID
   acknowledgements. Model proposed and effective versions separately. Changing
   representative starts a new agreement; reapproval requires a new version.
   Keep non-login/non-bypass owners, empty search paths, FORCE RLS, fixed DTOs,
   narrow grants, actor-scoped idempotency and database-time audit/atomic quotas.
   Do not grant client table writes or managed Auth privileges.
3. **Strict transport (approximately 1–2 hours).** Extend schemas under
   `src/features/offer`, `src/server/offer.ts`, `src/types/database.ts` and explicit
   API routes from API.md: create/amend/propose/read/decide agreement. Use exact
   expected version/hash/state and acknowledgement set. Reject extra fields,
   mismatched source/question/answer references and client authority claims.
   Reauthorize retries. Retain Origin/CSRF, private/no-store and safe error mapping.
4. **Existing UI wiring (approximately 2 hours).** Extend the existing offer,
   questions and agreement components; do not replace their layout. Show frozen
   proposal versus currently effective terms, attributed notes, exact unresolved
   items with explicit unchecked acknowledgements, independent decisions and
   safe stale/rejected states. Restore these from server after refresh/sign-in.
   No arbitrary account directory; identifiers remain references only.
5. **Acceptance suite (approximately 2 hours).** Restricted-role local SQL:
   invalid transition; missing/extra acknowledgement IDs; foreign answer/source;
   unshared questions; substituted/self representative; stale hash/version and
   authority; revocation/reapproval; retry/key conflict; no private projection
   leakage; effective pointer changes only after two eligible exact decisions.
   Add strict API tests and two-context browser tests for amended proposal,
   decline, interruption/retry and recovery. Run the full prior regression suite,
   typecheck, lint and isolated production build. Record multi-connection race
   cases for approved PostgreSQL testing; PGlite serial execution cannot close them.
6. **Handoff (approximately 30 minutes).** Record migration hash, catalog checks,
   compatibility/data treatment, test totals and any failed requirements. Prepare
   the exact reviewed release queue and recovery decision; hosted application,
   deployment, commit and push still require explicit approval.

These are estimates for one developer, not guaranteed completion dates. Aim to
close the local agreement gate on October 14; if Day 3 or a security gate remains
open, report the delay and reduce breadth, never reduce integrity requirements.

## Day 4 completion condition

One synthetic worker proposes a frozen version to the designated authorized
representative; both review the same source/answer context and acknowledge the
exact unresolved set independently. Amendment invalidates prior proposal consent
without rewriting historical/effective records. Both sessions recover the same
server state; all denial, catalog and build checks pass. Only then may the Work
Record phase consume the effective agreement-version contract. No existing
preview status, old manual confirmation or browser storage can issue evidence.

Hosted Day 4 completion additionally needs the approved exact migration queue,
real separate synthetic Supabase sessions, current authority/MFA checks and true
PostgreSQL concurrent-write tests. Android installation remains a distinct gate.
