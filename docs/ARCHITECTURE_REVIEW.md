# FAIRWORK 2.0 — Independent Architecture Review

Review date: 2026-10-06  
Reviewer posture: independent pre-implementation architecture, database, security, AI, and feasibility review  
Repository reviewed: `C:/Users/vehiv/Desktop/fairwork`

Documents reviewed in full: `README.md`, `docs/FAIRWORK_MASTER_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/AI_SYSTEM.md`, `docs/API.md`, `docs/SECURITY.md`, and `docs/MVP_PLAN.md`. The Git working tree and history were also inspected. The existing Figma design is treated as the locked visual source of truth. This review recommends no visual redesign.

# Executive Summary

The proposed architecture has a strong trust model for a Stage 1 document set. It correctly separates declared skills from evidence, evidence from evaluation, and evaluation from verification. It also recognizes the principal authorization boundaries: an employer role is not global worker access; company creation is not company authority; a worker cannot self-confirm work; private passport material is shared only through explicit grants; AI output cannot issue verification; and immutable versions preserve offer, agreement, and work history.

The product model covers the FAIRWORK lifecycle, but not all stages are competition P0. `PROVE`, `AGREE`, `WORK`, and `VERIFY` are represented in P0. `DISCOVER`, `GROW`, and `BETTER OPPORTUNITIES` are mainly P1–P3. That is a defensible MVP cut only if the competition narrative clearly says the demo proves the trust spine rather than the complete long-term lifecycle.

The architecture is **not implementation-ready**. The largest blockers are not broad technology choices; Next.js plus Supabase in a single application is appropriate. The blockers are underspecified trust-boundary details: immutable proof of company authority, database-enforceable verification bases, an executable RLS/grant contract, aggregate pointer/state constraints, AI-processing consent, and safe passport projections. In their current form, several controls depend on future service code “doing the right thing” rather than on schema and privilege design that make unsafe states impossible.

The two-week P0 remains too large for an empty repository, even with two engineers. The plan contains the right cut rules, but it still calls too many complex subsystems P0 at the start. A smaller mandatory trust spine should be frozen before Day 1, with live AI and the challenge slice admitted only through explicit early gates. Security, version integrity, and truthful demo labeling must not be traded for feature breadth.

Issue count:

- CRITICAL: 0
- HIGH: 11
- MEDIUM: 10
- LOW: 5

Readiness verdict: **NO**

# Critical Issues

No critical architecture defect was found in the documentation itself. This does not mean the system is secure: no application, schema, RLS policy, storage policy, or test currently exists. The HIGH issues below are implementation blockers. Any implementation that ships trusted evidence before resolving H-01 through H-10 could create critical runtime vulnerabilities.

# High Priority Issues

## H-01 — Company authority has no immutable approval basis

Problem: `company_memberships` is a mutable row with `approved_by` and `approved_at`, while confirmations store an undefined `membership_basis`. The documents require controlled onboarding but do not model an approval request, evidence reviewed, assurance level, approval decision, revocation reason, or immutable membership history. Reactivating or changing the same membership row can make it impossible to prove what authority existed when a confirmation occurred.

Why it matters: Employer confirmation is a trust-producing event. If the authority basis can be overwritten, loosely serialized, or created by an overly privileged operator path, a user can manufacture apparently employer-confirmed work without durable evidence that the confirmer represented the company at that time.

Recommended solution: Add append-only `company_membership_decisions` (or versioned memberships) with decision ID, subject, company, requested role, approver, assurance method, evidence references, decision, reason, effective/revoked timestamps, and policy version. Make an active membership projection derive from those decisions. Store the exact decision ID on agreement and work confirmations. Enforce approver independence and authorized operator role in a narrow transaction. Define assurance labels so a manually provisioned demo representative is not presented as a legally verified company officer.

Priority: HIGH

Affected document(s): `DATABASE.md`, `SECURITY.md`, `API.md`, `MVP_PLAN.md`, `FAIRWORK_MASTER_SPEC.md`

## H-02 — Verification assertion bases are polymorphic and not database-safe enough

Problem: `verification_assertions` proposes `verifier_user_id or trusted_process_id` and `basis_evaluation_id or basis_confirmation_id`, but no trusted-process registry exists and `basis_confirmation_id` is ambiguous between agreement and work confirmations. The proposed CHECKs cannot by themselves prove that the basis type matches the assertion category, belongs to the same worker/evidence, is still eligible, was issued under the stated policy, and came from an independent authorized actor.

Why it matters: This is the central anti-forgery boundary for `FAIRWORK Verified`. A wrong or weak implementation could allow a service-role path, malformed RPC, or later schema change to connect an assertion to an unrelated confirmation and display false trusted evidence.

Recommended solution: Replace the ambiguous basis with typed relations, for example separate `challenge_verification_assertions` and `work_verification_assertions`, or a normalized `verification_basis` table with category-specific foreign keys and strict XOR constraints. Define a protected `trusted_processes` registry if process identities are needed. Issue evidence and assertions only in operation-specific transactions that re-derive subject, policy, basis state, verifier independence, and eligibility from protected rows. Add deferred/composite constraints or guarded triggers for same-subject and same-version integrity, plus partial unique indexes preventing more than one active assertion for the same evidence/category/policy/basis.

Priority: HIGH

Affected document(s): `DATABASE.md`, `SECURITY.md`, `API.md`, `ARCHITECTURE.md`

## H-03 — RLS and SQL privilege design is principles-only, not an executable authorization contract

Problem: The documents correctly require RLS, revoked grants, protected RPCs, and direct database tests, but they do not define a table-by-table matrix for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`, function `EXECUTE`, view ownership/security-invoker behavior, storage object policies, or the precise claims and joins each policy may use. Raw-table reads and “authorized projections” are both mentioned without fixing which tables browser JWTs may query.

Why it matters: Most Supabase authorization failures arise from one forgotten child table, permissive update policy, definer function, view, or storage path. The high-level rules cannot demonstrate that Worker A is isolated from Worker B or that an unrelated employer cannot traverse child records.

Recommended solution: Before feature implementation, add a migration-oriented authorization appendix listing every P0 table/view/function/bucket, each database role, allowed verbs, policy predicate, column grants, and owner. Default browser roles to no raw trust-table mutation and preferably no raw sensitive-table read; expose minimum DTOs through security-invoker views or narrow RPCs where practical. Define direct-Supabase test cases beside each policy, including old-row/new-row checks and child-parent mismatches. Treat policy SQL and tests as part of each schema migration, not a later hardening phase.

Priority: HIGH

Affected document(s): `DATABASE.md`, `SECURITY.md`, `API.md`, `MVP_PLAN.md`

## H-04 — Aggregate pointer and state invariants are incomplete across the schema

Problem: The documents describe composite foreign keys for some current/effective version pointers, but do not consistently specify them for offers, challenges, attempts, work records, evidence corrections, questions, or all supersession links. Root status and version status can duplicate one another and drift. Several transitions are described in prose without a complete transition table or database guard.

Why it matters: A cross-parent `current_version_id`, stale effective pointer, or disagreement between root and child statuses can expose the wrong agreement, carry acceptance to changed terms, attach analysis to the wrong offer, or display a revoked badge as active.

Recommended solution: For every versioned aggregate, define composite unique keys `(root_id, id)`, composite FKs for all current/previous/effective/supersedes pointers, and a single authoritative state model. Publish transition tables with actor, precondition, postcondition, and side effects. Use one transaction to lock the root, verify expected revision/version, append immutable rows, update projections, propagate disputes/revocations, and write audit/receipt. Add database tests for cross-root pointers and every illegal transition.

Priority: HIGH

Affected document(s): `DATABASE.md`, `API.md`, `SECURITY.md`, `ARCHITECTURE.md`

## H-05 — AI processing consent is required in prose but absent from the model and API

Problem: `AI_SYSTEM.md` starts its pipeline with “authorize + consent,” and the documents require provider disclosure and processing terms, but there is no consent record, policy version, purpose, provider/region scope, revocation state, or API workflow. Authorization to store an offer is not automatically consent to send it to an external model provider.

Why it matters: Offers and employment records can contain contact, salary, and other private data. Without a durable consent/purpose record, the system cannot prove that external processing was permitted, stop processing after revocation, or explain which provider policy applied.

Recommended solution: Add purpose-scoped `processing_consents` or `privacy_acknowledgements` with subject, purpose, policy version, provider class/region where relevant, granted/revoked timestamps, and source UI version. Require active consent in the AI enqueue transaction and copy the consent reference into `ai_runs`. Define what revocation does to queued/running work and retained results. For a synthetic competition demo, explicitly label the data and still exercise the same control path.

Priority: HIGH

Affected document(s): `AI_SYSTEM.md`, `DATABASE.md`, `API.md`, `SECURITY.md`, `FAIRWORK_MASTER_SPEC.md`

## H-06 — Work confirmation cardinality and designated authority are not fully enforced

Problem: `work_confirmations` is unique by `(work_record_version_id, actor_id)`, allowing multiple representatives to create conflicting decisions. The prose says only the designated representative may act, but the table does not carry a direct immutable reference to the designated representative or the exact authority decision, and the relationship to the selected effective agreement version is enforced only by future logic.

Why it matters: Conflicting confirm/dispute rows or a representative substitution can make it unclear whether work is verified. A later membership change must not retroactively change who was authorized for a submitted version.

Recommended solution: Snapshot the designated counterpart and membership-decision ID onto the submitted work version or a normalized `work_record_participants` row. For the two-party MVP, allow one authoritative counterpart decision per submitted version with a unique constraint. Corrections or a new representative require a new submitted version/assignment and fresh confirmation. Define conflict handling before multiparty confirmation is introduced.

Priority: HIGH

Affected document(s): `DATABASE.md`, `API.md`, `SECURITY.md`, `FAIRWORK_MASTER_SPEC.md`

## H-07 — Challenge submission immutability relies on a mutable attempt row

Problem: `challenge_attempts` contains `submission_text`, status, and timestamps in one row. The documents say the response freezes at submission, but there is no immutable submission/version row, canonical content hash, or database-level constraint tying an evaluation to exactly what was submitted.

Why it matters: Challenge evidence is only meaningful if the reviewed content, challenge version, rubric version, and allowed-assistance policy are fixed. A service bug or privileged update could alter the response after review while retaining the evaluation and badge.

Recommended solution: Split draft state from immutable `challenge_submissions`, with attempt ID, sequence/version, challenge-version ID, canonical response hash, submitted content/object reference, submission time, assistance declaration, and immutable rubric/policy references. Evaluations must reference the submission ID and content hash. Deny UPDATE/DELETE on submitted payloads except a separately audited retention process that revokes dependent evidence.

Priority: HIGH

Affected document(s): `DATABASE.md`, `API.md`, `AI_SYSTEM.md`, `SECURITY.md`

## H-08 — Passport field masks are not constrained strongly enough to prevent over-sharing

Problem: `selected_fields` and `allowed_fields` are described as allowlisted values, but their storage shape and database validation are not defined. The shared projection depends on application code intersecting passport items, grant items, fields, assertion state, and resource state correctly on every read.

Why it matters: A malformed mask, newly added DTO field, wildcard behavior, or bypassed service path could disclose salary, contact information, dispute reasons, raw evidence, or attachments. This is one of the explicit harms the architecture must prevent.

Recommended solution: Define a versioned field registry for each shareable evidence type and store masks relationally or validate them in guarded SQL against that registry. Build one database-backed projection function used by owner preview and recipient reads; do not maintain two implementations. Default-deny unknown fields, add a projection schema version to each grant, and add golden tests proving new source fields never become shared automatically.

Priority: HIGH

Affected document(s): `DATABASE.md`, `API.md`, `SECURITY.md`, `ARCHITECTURE.md`

## H-09 — Evidence issuance does not yet guarantee immutable skill mapping and atomic lifecycle propagation

Problem: `skill_evidence`, `evidence_skills`, and assertions form the Work DNA trust chain, but immutability and correction rules for `evidence_skills` are not explicit. The documents say issuance, dispute, correction, withdrawal, and assertion state changes should be atomic, yet no single operation contract enumerates all affected rows and uniqueness rules.

Why it matters: If skill mappings can be edited after review, a valid evaluation for one skill could be relabeled as proof of another. If evidence and assertion state propagation is partial, Work DNA and shared passports can display stale verification.

Recommended solution: Freeze `evidence_skills` at issuance and include the approved criterion/task references and mapping-policy version. A correction creates replacement evidence and withdraws the old evidence in one transaction. Define operation-specific issuance functions for challenge and work evidence, each with idempotent origin keys, subject/basis checks, skill mapping validation, assertion issuance, audit, and notification-after-commit. Make all current projections exclude or visibly mark disputed/withdrawn/revoked states by construction.

Priority: HIGH

Affected document(s): `DATABASE.md`, `API.md`, `AI_SYSTEM.md`, `SECURITY.md`

## H-10 — Privileged operator and service-role architecture is not bounded enough

Problem: The proposal depends on operator provisioning, reviewer assignment, membership approval, AI completion, deletion, maintenance, and service-role access, but it does not define separate privileged identities/scopes, authentication strength, approval rules, break-glass behavior, or a prohibition on general-purpose admin browsing. A single service-role secret can bypass all RLS.

Why it matters: Compromise or misuse of a broadly privileged route would defeat every worker/employer boundary and could forge verification metadata. “Admin” cannot be a blanket bypass for private employment data.

Recommended solution: Separate operator commands by capability, require server-side allowlisted operations and MFA for real-data environments, and use least-privilege database roles rather than routing all jobs through one service-role client. AI completion credentials should only complete owned leased runs; membership/reviewer operators should not read raw offers; support access should be time-limited and purpose-audited. Document key rotation, incident revocation, and no-browser exposure. Add negative tests showing each privileged worker cannot invoke unrelated trust operations.

Priority: HIGH

Affected document(s): `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `API.md`, `MVP_PLAN.md`

## H-11 — The initial P0 is still too large for a secure two-week implementation

Problem: The P0 backlog includes framework setup, Figma extraction, authentication, roles/memberships, migrations/RLS, rate limiting, audit, immutable offers, live grounded AI, questions, two-party agreements, work confirmations/disputes, evidence/assertions, a challenge/reviewer/appeal flow, Work DNA, passport sharing/revocation, privacy operations, deployment, restore, accessibility, and a broad test matrix. This is an empty repository, not an existing application.

Why it matters: Schedule pressure will predictably move authorization, RLS tests, concurrency, and failure handling to the end, exactly where trust products fail. A partially working broad demo is worse than a narrower honest flow because it can imply verification that the system cannot defend.

Recommended solution: Freeze a P0A trust spine before Day 1: auth/isolation, immutable offer/manual terms, questions, agreement versions and dual confirmation, work version and one designated counterpart decision, work evidence, private passport, audit, RLS tests, and deploy/recovery. Make live AI a gated P0B capability admitted only if the Day 4 evaluation/security gate passes; otherwise retain manual analysis and remove the live-AI claim. Admit the curated challenge slice only after the trust spine passes Gate A, or swap it into the demo in place of optional offer AI breadth. No P1 discovery/matching/career work begins during the 14 days.

Priority: HIGH

Affected document(s): `MVP_PLAN.md`, `FAIRWORK_MASTER_SPEC.md`, `ARCHITECTURE.md`, `API.md`, `AI_SYSTEM.md`

# Medium Priority Issues

## M-01 — The Stage 1 documents are untracked in Git

Problem: Git shows `docs/` as untracked; only `README.md` is in `HEAD`. The proposed architecture repeatedly says GitHub is the source of truth, but the source-of-truth documents currently have no committed version, review boundary, or durable change history.

Why it matters: Implementation can begin from an unreviewed local snapshot, and later changes to trust rules may be impossible to correlate with migrations or code reviews.

Recommended solution: After this independent review is resolved, commit the approved documents together with a decision log identifying accepted, deferred, and rejected findings. Require future trust-model changes to update the relevant document and migration/test in the same pull request. Do not commit secrets or generated credentials.

Priority: MEDIUM

Affected document(s): `README.md`, all documents under `docs/`

## M-02 — Challenge anti-cheating and assessment-condition evidence is incomplete

Problem: The challenge design has an assistance policy and retake link but lacks authorship attestation, attempt timing, allowed tools/resources, identity assurance level, duplicate/plagiarism indicators, suspicious-event recording, and a policy for repeated or leaked tasks.

Why it matters: FAIRWORK must not present a challenge outcome more strongly than the conditions support. Human review alone does not establish who produced the submission or whether prohibited assistance was used.

Recommended solution: Record declared assistance, start/submission timestamps, task exposure/version, allowed resources, identity assurance label, and reviewer-visible integrity flags. For MVP, use one low-stakes text task, rotate or retire compromised versions, and label evidence as “completed under stated conditions,” not proof of unaided mastery. Do not add invasive monitoring.

Priority: MEDIUM

Affected document(s): `DATABASE.md`, `AI_SYSTEM.md`, `SECURITY.md`, `FAIRWORK_MASTER_SPEC.md`

## M-03 — Reviewer conflict-of-interest and collusion controls need a policy

Problem: The subject cannot review themself, but the architecture does not prevent the reviewer from being the subject's designated employer, close collaborator, original membership approver, prior disputed evaluator, or another conflicted actor. Reviewer assignment is protected but its selection policy is undefined.

Why it matters: Independent-looking challenge evidence can be produced through collusion without technically violating `reviewer_id != worker_id`.

Recommended solution: Define disqualifying relationships and an explicit conflict declaration. Store assignment reason, assigning operator, policy version, and reviewer decision. Use a second reviewer for appeals and for any high-impact future verification category. For the competition, pre-provision and document one independent reviewer.

Priority: MEDIUM

Affected document(s): `DATABASE.md`, `SECURITY.md`, `MVP_PLAN.md`, `FAIRWORK_MASTER_SPEC.md`

## M-04 — Work DNA lacks a complete multi-evidence aggregation policy

Problem: The documents correctly reject a universal AI percentage and propose counts, recency, evidence type, and distinct basis groups, but do not define how conflicting, stale, repeated, disputed, differently scoped, or differently assured evidence contributes to each skill view.

Why it matters: Without a versioned aggregation policy, developers may reintroduce an opaque score or count many weak/repeated artifacts as stronger than one relevant verified observation.

Recommended solution: Define a versioned deterministic projection per skill: evidence rows remain individually visible; group by independent basis; show status, scope, recency, assurance category, and criterion coverage; never average unrelated rubric levels. Repeated attempts on one challenge are one breadth group. A summary may state “N supported observations across M independent bases,” with limitations, but no probability of ability. Persist or expose the rules version used.

Priority: MEDIUM

Affected document(s): `DATABASE.md`, `AI_SYSTEM.md`, `API.md`, `FAIRWORK_MASTER_SPEC.md`

## M-05 — Provenance and confidence vocabularies need enforceable definitions

Problem: `company_signals` includes source, dates, confidence basis, and verification status, but confidence bands/bases, source-supported versus reviewed transitions, and stale/conflicting display behavior are not enumerated as a controlled policy. `source_snapshots.owner_id` privacy rules are prose rather than concrete constraints.

Why it matters: Company/job intelligence can drift into unsupported reputation claims or accidentally treat user-supplied private data as public. “High confidence” is meaningless without a stated basis.

Recommended solution: Define controlled values and transition rules for claim state: `unverified`, `source_supported`, `contested`, `reviewed`, `stale`; define confidence as source directness/quality plus corroboration, never a raw model probability. Enforce `owner_id` requirements by source kind, prohibit private/user sources from public projections, and require claim-level support spans, retrieval date, publisher, and source snapshot. Preserve contradictions.

Priority: MEDIUM

Affected document(s): `DATABASE.md`, `AI_SYSTEM.md`, `API.md`, `SECURITY.md`

## M-06 — Timestamp, soft-deletion, and foreign-key deletion behavior is inconsistent

Problem: Global conventions imply timestamps and soft deletion, but many table definitions omit `created_at`, `updated_at`, `deleted_at`, actor fields, and `ON DELETE` behavior. Mutable roots such as offers, agreements, work records, grants, and companies do not consistently show deletion/tombstone columns.

Why it matters: Defaults selected during implementation can destroy shared history, orphan provenance, retain personal data indefinitely, or make chronological audit unreliable.

Recommended solution: Publish a lifecycle table for every P0 entity: creation/update timestamps, mutability, tombstone behavior, retention owner, FK `ON DELETE` action, anonymization rule, and effects on shares/assertions/jobs. Default trust-bearing versions and decisions to restricted retention rather than cascade deletion; default access projections to hide disabled/deleted roots.

Priority: MEDIUM

Affected document(s): `DATABASE.md`, `SECURITY.md`, `API.md`

## M-07 — Agreement unresolved items and answers are not structurally tied to final terms

Problem: `unresolved_items` is JSONB, questions/answers are separate, and acknowledgements are a boolean. The documents say unanswered questions are not agreed terms, but there is no field-level rule that identifies which required term remains unresolved, which answer informed a term, or what each participant acknowledged.

Why it matters: A broad boolean can make serious missing conditions appear accepted without proving that both participants saw the same specific unresolved items. Answers could be visually mistaken for amendments even though they do not alter terms.

Recommended solution: Use stable term/finding IDs and normalized or rigorously schema-validated unresolved-item entries. Each participant confirmation should snapshot or hash the exact terms plus exact unresolved-item set. Store links from answers to proposed term changes, but require a new agreement version and fresh confirmations before an answer changes a term.

Priority: MEDIUM

Affected document(s): `DATABASE.md`, `API.md`, `FAIRWORK_MASTER_SPEC.md`

## M-08 — Audit durability and retention are weak for trust disputes

Problem: Audit logs are in the same database and the provisional security-audit retention is 90 days. The documents acknowledge infrastructure tampering but do not define immutable database permissions, export/anchoring, clock integrity, or retention aligned with the lifetime of agreement and work evidence.

Why it matters: A dispute may arise long after 90 days. Losing the event trail while retaining a FAIRWORK assertion makes the assertion difficult to defend or investigate.

Recommended solution: Make audit writes append-only to application roles; restrict correction to compensating events; define retention per event class; and retain trust-transition audit at least as long as the associated assertion/record plus the approved dispute period. For the MVP, periodic protected export is enough; cryptographic transparency infrastructure is not required. Document that audit is operational evidence, not legal notarization.

Priority: MEDIUM

Affected document(s): `DATABASE.md`, `SECURITY.md`, `ARCHITECTURE.md`

## M-09 — Auth, language, reviewer, and provider decisions remain pre-implementation blockers

Problem: SMS/OTP behavior, competition language, first challenge, reviewer, company-authority standard, hosting region, Supabase/AI accounts, provider terms, and retention jurisdiction are intentionally undecided.

Why it matters: These choices change the UI copy, threat model, schema, consent, test data, schedule, and provider feasibility. Starting implementation before deciding them creates rework or encourages insecure shortcuts.

Recommended solution: Hold a short architecture decision gate before Day 1 and record each choice with owner and expiry/revisit date. Use synthetic data until region, retention, and provider processing are approved. Preserve the locked Figma design; only documented content/security corrections such as OTP length or unsupported percentage claims may change.

Priority: MEDIUM

Affected document(s): `FAIRWORK_MASTER_SPEC.md`, `ARCHITECTURE.md`, `SECURITY.md`, `MVP_PLAN.md`

## M-10 — The product lifecycle and MVP claims need explicit separation

Problem: The README target journey includes company/job search, matching, career recommendations, and better opportunities, while the two-week P0 defers most of `DISCOVER`, `GROW`, and `BETTER OPPORTUNITIES`. The documents mention this indirectly but do not define a single public capability statement for the competition build.

Why it matters: Judges or users may infer that the full lifecycle or live company intelligence exists when only the trust spine is implemented or demonstrated with fixtures.

Recommended solution: Maintain one capability manifest used by demo notes and UI labels: `implemented live`, `manual`, `synthetic/fixture`, `prototype`, or `future`. State that the MVP validates the PROVE→AGREE→WORK→VERIFY trust loop and only previews later discovery/growth stages unless P1 gates pass.

Priority: MEDIUM

Affected document(s): `README.md`, `FAIRWORK_MASTER_SPEC.md`, `MVP_PLAN.md`, `ARCHITECTURE.md`

# Low Priority Issues

## L-01 — Skill taxonomy changes are not versioned

Problem: Evidence references stable skill IDs, but skill labels/category semantics can change without a taxonomy version.

Why it matters: Historical evidence can appear to support a later, broader, or renamed skill definition.

Recommended solution: Version material taxonomy changes or retain immutable skill definitions with successor links. Cosmetic label corrections may remain mutable but must not change evidence meaning.

Priority: LOW

Affected document(s): `DATABASE.md`, `AI_SYSTEM.md`

## L-02 — Edited clarification questions lack an explicit version model

Problem: The API says worker edits are tracked, while `clarification_questions` has one text value and audit history rather than a version/supersession record.

Why it matters: An answer can become associated with text different from what the counterpart saw.

Recommended solution: Add question revisions or make shared/answered question text immutable and require a new question version after editing. Answers reference the exact revision.

Priority: LOW

Affected document(s): `DATABASE.md`, `API.md`

## L-03 — Named-recipient onboarding is operationally ambiguous

Problem: P0 grants require an existing `recipient_user_id`, but public lookup/invitation is deferred and the exact operator-provisioning flow is not part of the user journey.

Why it matters: The passport demo can stall or encourage a searchable contact directory that creates enumeration risk.

Recommended solution: Pre-provision the named recipient for the competition and document this as an operator step. Later add a privacy-preserving invitation flow with single-use tokens and no account-existence disclosure.

Priority: LOW

Affected document(s): `API.md`, `MVP_PLAN.md`, `SECURITY.md`

## L-04 — Job requirement history is weaker than offer/agreement history

Problem: Jobs and requirements have freshness fields but no explicit job version or requirement snapshot tied to a persisted match/recommendation.

Why it matters: A saved match explanation can change meaning when a job description changes.

Recommended solution: When P1 ships, version curated/imported job content or store the exact requirement snapshot/hash and rule version referenced by each persisted recommendation.

Priority: LOW

Affected document(s): `DATABASE.md`, `AI_SYSTEM.md`, `API.md`

## L-05 — Index requirements should be expressed as migration acceptance checks

Problem: The index guidance is strong but general; several policy and transition lookups will require composite/partial indexes whose exact order is not specified.

Why it matters: RLS predicates and passport/AI queues can become slow enough to encourage unsafe caching or service-role shortcuts.

Recommended solution: Add representative query plans and migration tests for owner lists, active membership, current assertions, grant reads, and AI queue claims. Create only measured indexes, but make acceptable plans part of release review.

Priority: LOW

Affected document(s): `DATABASE.md`, `MVP_PLAN.md`

# Database Review

The proposed database model is normalized in the places that matter most: versions, confirmations, evidence, assertions, grants, and AI runs are separate. UUID keys, UTC timestamps, numeric money, explicit currencies/periods, optimistic revisions, idempotency receipts, composite parent/version constraints, and append-only decisions are appropriate.

The principal database risk is that several essential invariants remain prose. The schema must make these states impossible:

- an assertion whose basis belongs to another worker or wrong basis type;
- a current/effective/superseding pointer crossing aggregate roots;
- a confirmation by anyone other than the immutable designated counterpart;
- an active employer authority row without an immutable approval decision;
- evidence skill links changing after issuance;
- a passport grant exposing a field absent from its schema-versioned allowlist;
- a public source snapshot derived from private worker content;
- a challenge evaluation pointing to mutable or altered submission content;
- conflicting active assertions or counterpart decisions for the same basis;
- root and child state disagreeing about what is current, confirmed, disputed, or revoked.

Primary and foreign keys are generally identified, but all FKs need explicit `ON DELETE` choices and join/policy indexes. Every mutable aggregate needs a clear tombstone/retention rule. JSONB is acceptable for rubric and term snapshots only with strict schemas, size limits, stable IDs, and SQL checks for trust-critical fields. Participants, owners, verifier identities, statuses, visibility, and authority must remain relational.

The decision not to create duplicate `company_sources` and `job_matches` tables is sound if `company_signals → source_snapshots` and `recommendations` remain the single models. If discovery later needs sources without extracted claims, add the join then. Avoid parallel scoring systems.

# Security Review

The security design directly addresses the required abuse cases in principle:

- Worker A versus Worker B isolation: intended through owner predicates, RLS, minimal DTOs, and direct database tests.
- Employer A versus unrelated workers: generic employer role grants no access; only exact proposal/submission relationships do.
- Worker self-confirmation: subject inequality, designated representative, and active membership are required.
- Forged FAIRWORK Verified evidence: ordinary users cannot write assertions and AI cannot issue them.
- Client modification of verification metadata: trusted fields are server-derived and trust tables are RPC-only.
- Agreement tampering: immutable versions, expected revisions, content hashes, and fresh confirmation are required.
- Accidental public Work Passport evidence: private default, explicit grants, item/field intersection, no public P0 mode.
- Frontend-only authorization: service, RLS, grants, RPCs, and direct database tests are all required.
- Secret leakage: service-role and provider secrets are server-only and client-bundle scans are release gates.

However, those claims are not yet demonstrable because policy SQL and grants do not exist. H-01, H-03, H-06, H-08, and H-10 must be resolved before security implementation. No client route should ever accept a subject, actor, verifier, role, membership, status, or timestamp as authority. Every privileged RPC must fix `search_path`, schema-qualify objects, verify `auth.uid()`/trusted worker identity, and revoke execution from `PUBLIC`.

P0 text-only input is a good cut. When uploads arrive, quarantine, scanning, MIME/magic-byte validation, parser isolation, storage RLS, and short-lived authorized download must be implemented together. Until then, no upload or OCR capability should be claimed. Rate limits must be shared and atomic; in-memory counters are insufficient. Sensitive responses must be `private, no-store` and must not enter shared Next.js/CDN caches.

# AI Review

The AI architecture is one of the strongest parts of the proposal. It uses operation-specific inputs, structured outputs, independent validation, source spans, canonical-text hashes, durable runs, leases, bounded retries, explicit failure, prompt/schema/policy versions, and deterministic rules for material changes and matching. It explicitly treats prompt injection as untrusted content and rejects LLM-only verification.

Company/job intelligence includes the necessary axes: fact/claim, source, retrieval date, confidence basis, and verification status. These should be enforced as controlled fields per M-05. A source-supported claim is not verified fact; conflicts must remain visible.

Required changes before AI implementation:

1. Add durable purpose/provider consent per H-05.
2. Store a prompt-template digest or immutable prompt-version artifact, provider configuration/version, normalization version, and validation-policy version; do not store raw sensitive prompts in general logs.
3. Require operation-specific input FKs and constraints rather than a growing nullable `ai_runs` record.
4. Enforce accepted output only after schema, span, domain, authorization, and stale-lease checks in one completion transaction.
5. Keep live AI outside the demo claim until the synthetic evaluation gates pass. Manual fallback must be a first-class path, not a hidden fixture.

# Work DNA Review

The proposed chain is correct:

`SKILL → EVIDENCE → SOURCE/BASIS → VERIFICATION ASSERTION → CONFIDENCE/LIMITATION → DATE`

Work DNA should not store a universal profile percentage. Each skill projection should show the underlying evidence, independent basis count, evidence type, task/criterion scope, date/recency, verifier and method, assertion status, and limitations. Declared skills remain visually and semantically separate.

Multiple evidence items should contribute through a deterministic, versioned grouping policy, not averaging model scores. Evidence from repeated attempts at the same challenge is one breadth group. A confirmed work version and a reviewed challenge are separate bases. Disputed, revoked, expired, withdrawn, and self-provided material remain visible in private history but cannot silently contribute as active verified coverage. Contradictory evidence should be shown, not collapsed into a false consensus.

H-02, H-09, and M-04 are required before implementing Work DNA or displaying any verification badge.

# Challenge Review

The template → immutable version → attempt → submission → evaluation → evidence flow is conceptually correct. Rubrics use stable criterion IDs and observable levels; AI evaluation is a draft; human review and appeals are required; safety-critical certification and code execution are excluded.

The implementation must strengthen submission immutability (H-07), reviewer conflicts (M-03), and assessment conditions/anti-cheating (M-02). Evidence should state what task was observed under what declared conditions. It must never imply universal competence or unaided authorship. An LLM score alone cannot create evidence or an assertion. Human review must cite criterion-level support in the frozen submission and use a separate attributed row rather than editing the AI draft.

# Offer / Agreement Review

Offer versioning, content hashes, actor/time history, deterministic material diffs, exact money semantics, and version-specific analyses are well designed. Material terms include salary amount/currency/pay period, hours, overtime, payment schedule, responsibilities, employment type, location, duration, leave/benefits, deductions, and termination. Unknown changes defaulting to material is a safe rule.

Agreement versions correctly require fresh confirmation and preserve the last effective version during a pending amendment. Confirmation must cover the exact content hash and unresolved-item set. Questions and answers must never mutate terms automatically. H-04 and M-07 should be resolved so root/version states cannot drift and unresolved terms are field-specific. L-02 should be addressed before counterpart-shared questions can be edited.

The UI must not present an agreement as a legal e-signature or legal advice product. Important employment terms must never be silently overwritten; all changes, including apparently nonmaterial changes, remain in history.

# Work Verification Review

The design correctly uses explicit worker submission and counterpart confirm/dispute. It excludes covert monitoring and employer silence never becomes confirmation. A disputed or corrected version cannot retain a current badge.

The main weakness is durable authority and cardinality. H-01 and H-06 must bind a submitted work version to one designated counterpart and immutable membership approval basis. A correction requires a new submitted version and fresh decision. A dispute immediately changes current evidence/assertion projections; resolution appends a decision and never erases the history. A former representative loses future access, but historical actions remain attributed to the authority that existed at the time.

# MVP Feasibility

The repository contains no application scaffold, dependency manifest, schema, migrations, tests, CI, or deployment configuration. All eight Stage 1 documents are currently local/untracked except `README.md`. Even with two full-time engineers, the documented P0 is closer to a multi-sprint pilot than a safe 14-day build.

The competition can still demonstrate the core proposition if scope is frozen around a trust spine and all data is synthetic. Recommended sequencing:

1. Days 1–2: decisions, Figma inventory, scaffold, auth, profiles, operator-provisioned participants, deny-by-default schema/RLS, and direct isolation tests.
2. Days 3–7: offers/manual terms, immutable versions, questions, agreement confirmation, work submission/confirmation, evidence issuance, and audit. This is the non-negotiable Gate A.
3. Days 8–9: either the curated challenge/reviewer slice or validated live offer AI, depending on which is competition-essential and which passes its gate. Do not attempt both at full breadth if Gate A slipped.
4. Days 9–10: Work DNA projection and named-recipient passport sharing/revocation.
5. Days 11–14: integration, direct RLS tests, failure paths, privacy operations, accessibility, deployment, restore, visual comparison, and rehearsals. No new capabilities.

Company/job discovery, matching, career intelligence, notifications, bearer links, uploads/OCR, live retrieval, LinkedIn, public publishing, and public APIs should not enter the two-week implementation.

# Recommended Architecture Changes

1. Model employer authority as append-only decisions and bind every confirmation to an immutable decision ID and assurance label.
2. Replace polymorphic verification bases with typed, database-enforceable assertion relations and operation-specific issuance transactions.
3. Write the exact P0 RLS/grant/function/storage matrix and direct-database tests before building UI feature breadth.
4. Complete aggregate composite FKs, transition tables, and atomic propagation rules for current/effective/disputed/revoked state.
5. Add purpose/provider consent and bind it to AI runs; queued/running/revoked behavior must be defined.
6. Freeze challenge submissions as immutable content-hashed rows referenced by evaluations.
7. Implement one schema-versioned passport projection with database-validated field masks, used identically by preview and recipient reads.
8. Freeze evidence-to-skill mappings and make issuance/correction/dispute/revocation atomic and idempotent.
9. Split privileged capabilities so service-role access is not a general application backend shortcut.
10. Adopt the reduced P0A/P0B gates and commit the approved Stage 1 documents before implementation.

# Recommended P0/P1/P2/P3 Scope

## P0 — Competition-critical trust spine

- One supported authentication flow; minimal profile and declared skills.
- Operator-provisioned reviewer, employer representative, and named passport recipient, with explicit assurance labels.
- Deny-by-default schema, RLS/grants, audit, idempotency, concurrency, quotas, and direct actor-isolation tests.
- Private pasted offer, immutable versions, deterministic material diff, manual terms/findings/questions fallback.
- Two-party versioned agreement and independent exact-version confirmations.
- Work record versions, explicit submit, one designated counterpart confirm/dispute, and atomic work evidence/assertion issuance.
- Work DNA evidence list with no universal score.
- Private passport, safe field selection, exact preview, named-recipient grant, expiry/revocation.
- One curated low-stakes challenge with immutable submission and independent human review only if Gate A is met early; otherwise demonstrate it separately as an explicitly limited prototype rather than weakening the trust spine.
- Live offer AI only if consent, validation, grounding, budget, and evaluation gates pass by Day 4; otherwise manual workflow and no live-AI claim.

## P1 — Important after a stable P0

- The gated P0 capability not selected above: full challenge slice or live grounded offer AI.
- Small curated/fictional company and job catalog with explicit provenance/demo labels.
- Deterministic worker-side requirement coverage and one rule-based next challenge.
- In-app notifications.
- Optional bearer passport link only after token/log/cache review.

## P2 — Useful later

- Permitted live company/job retrieval and job extraction.
- Secure upload/OCR pipeline.
- Self-service export and mature deletion automation.
- Version-specific employer feedback and operational dashboards.

## P3 — Future

- Generated challenge catalog and broader assessment domains.
- Employer candidate marketplace/search.
- Career simulator/planner and broad recommendations.
- Official permission-based LinkedIn integration.
- Public passport publishing and public evidence API.
- Additional FAIRWORK verification categories.

# Implementation Readiness

Verdict: **NO**

Implementation should not begin as broad feature work. A short remediation/decision pass may begin immediately to resolve H-01 through H-10, define the reduced P0, and commit the approved documentation. Framework scaffolding is safe only after the Day 1 product/security decisions are recorded; trust-bearing tables and badges should not be implemented until the typed authority, assertion, RLS, state-transition, consent, and sharing contracts are complete.

The five most important changes required before implementation are:

1. Create immutable company-authority decisions and bind confirmations to their exact authority basis.
2. Replace ambiguous verification bases with typed database-enforced relations and atomic issuance rules.
3. Produce the complete P0 RLS/GRANT/RPC/storage policy matrix with direct Supabase isolation tests.
4. Complete composite version pointers, transition tables, and atomic dispute/revocation propagation for all trust-bearing aggregates.
5. Reduce and gate the two-week P0, including explicit consent for any live AI processing and a manual fallback when the live AI gate is not met.
