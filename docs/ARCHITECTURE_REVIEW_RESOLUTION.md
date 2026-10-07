# FAIRWORK 2.0 — Architecture review resolution

Correction date: 2026-10-07. Review source: [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md), dated 2026-10-06. Scope: documentation correction only; no framework, feature, migration, deployment or Figma change. Closure revision: FAIRWORK-ARCH-1.0.0. The original independent review and final verification are preserved unchanged. [Baseline](ARCHITECTURE_BASELINE.md); [approval](STAGE1_APPROVAL.md).

## 1. Result and meaning of readiness

All 11 HIGH criticisms are technically valid and **ACCEPTED**, with explicit architectural corrections. **HIGH resolved:11; remaining:0 at the specification level.** All 10 MEDIUM findings are resolved at the architecture level, including M-01 and M-09 in this closure pass; none remains an implementation blocker. All5 LOW findings receive proportionate specification fixes. No criticism is rejected.

Verdict: **READY** for the approved solo P0A architecture, FAIRWORK-ARCH-1.0.0. M-01 has an explicit approved document set and documentation-only Git commit/tag; M-09 has recorded Day 0 choices under the owner's constraints and explicit email/password approval. Actual migrations/security tests, account provisioning and deployment/recovery remain implementation/release obligations, not unresolved design choices. Live AI and Prove are excluded for the competition; real employment data remains behind pre-production gates. This task does not start Stage 2 or certify production security.

## 2. HIGH findings

### H-01

Issue: Company authority has no immutable approval basis.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: A mutable membership and undefined membership_basis cannot establish historical authority. Operator-created membership must not be mistaken for legal company verification.
Documents changed: DATABASE §§2,5–6; SECURITY §3; API §4; MASTER_SPEC §§3,5; ARCHITECTURE §§2–3; MVP_PLAN B02.
Final resolution: Append-only company_membership_decisions with reviewed evidence, approver independence, assurance, policy/effective/expiry and immutable revocation successor; protected pointer; exact approval IDs on version/confirmation chains. Current access and historical validity are distinct. Fraud cases suppress dependent trust; ordinary departure preserves historical attribution. Demo assurance explicitly labeled.

### H-02

Issue: Verification assertion bases are polymorphic and insufficiently database-enforced.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: CHECKs on nullable generic IDs cannot prove cross-table subject/category/verifier consistency; an undefined trusted process is not a verifier.
Documents changed: DATABASE §§2–3,5–6; API §§3–5; SECURITY §§3–4; ARCHITECTURE §§2,4; MASTER_SPEC §3; AI_SYSTEM §5.
Final resolution: Separate work_verification_assertions and optional challenge_verification_assertions with typed composite FKs, kind/subject/basis/verifier binding, partial uniqueness, immutable evidence maps and operation-specific issuance guards. No process-verifier registry is needed because these categories require attributed human basis; background workers cannot issue assertions.

### H-03

Issue: RLS/grants/RPC/storage model is principles-only.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: A single forgotten relation/EXECUTE grant can bypass broad prose. A complete contract must resolve raw-table access and definer ownership.
Documents changed: DATABASE §§6,8–9; API §§3–5,7; SECURITY §§2,6,8; ARCHITECTURE §3; MVP_PLAN B02/B10.
Final resolution: Private-schema RPC-only model; all client raw-table verbs deny; no exposed domain views; per-table executor SELECT/I/U/D matrix and predicates; nonrecursive helper model; NOLOGIN nonowner/NOBYPASSRLS executors, ENABLE+FORCE RLS, explicit signature EXECUTE/default revocation; P0 storage denies. Direct-role and catalog tests specified. SQL is deliberately not installed in this architecture-only task; implementation must translate and prove this contract before release.

### H-04

Issue: Aggregate pointer/state invariants incomplete.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: UUID references and duplicated root/version state can cross parents or drift despite intended service behavior.
Documents changed: DATABASE §5; API §§2–3,6; SECURITY §4; ARCHITECTURE §5; MASTER_SPEC §5.
Final resolution: Composite parent/id and sequence keys for all version families, monotonic predecessor guards, deferred pointer/state constraints, one version-state authority and separate root lifecycle. Complete command/precondition/postcondition matrix and lock order cover authority, versions, submissions, cases, sharing and withdrawal. Effective agreement remains during amendment; immutable participants cannot be silently replaced.

### H-05

Issue: Explicit AI processing consent absent from schema/API.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: Authorization to store employment information does not authorize external processing.
Documents changed: DATABASE §4; AI_SYSTEM §§2–3; API §5; SECURITY §5; MASTER_SPEC §5; ARCHITECTURE §6; MVP_PLAN B11/D-08.
Final resolution: Purpose/provider/config/region/disclosure-version consent record and explicit grant/list/revoke commands; typed run/input linkage; active checks at enqueue/claim/retry/dispatch/completion; withdrawal cancels jobs and discards late results. Revocation cannot recall data already dispatched, which is documented as a network race/retention limitation. Manual P0A remains fully usable without consent.

### H-06

Issue: Work confirmation cardinality/designated authority incomplete.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: Unique(version,actor) permits multiple authoritative answers; current membership cannot retroactively choose a historical counterpart.
Documents changed: DATABASE §§2,5; API §3; SECURITY §§3–4; MASTER_SPEC §5.
Final resolution: UNIQUE(work_record_version_id), frozen representative/authority/subject/company composite FK, exact agreed context and current authority check at decision. A different representative requires a new agreement; same-person reapproval requires new agreement version. Pending work must be replaced/reconfirmed, not reattributed.

### H-07

Issue: Challenge evidence depends on mutable attempt content.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: A “frozen” flag without separate immutable basis/hash leaves evaluation provenance ambiguous.
Documents changed: DATABASE §3; API §5; AI_SYSTEM §5; SECURITY §4; MASTER_SPEC §5; MVP_PLAN B12.
Final resolution: Optional Prove separates draft attempts from immutable challenge_submissions; exact response/rubric/assistance hash, subject and conditions are bound by composite FKs to human evaluation. Retakes are new attempts; corrections are new evaluations; retention erasure first revokes dependent evidence. No draft-row evaluation.

### H-08

Issue: Passport field masks inadequately constrained.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: Application-only JSON allowlists can accidentally grow with DTO/source fields and preview can diverge from recipient output.
Documents changed: DATABASE §§2,7; API §3; SECURITY §5; ARCHITECTURE §§3,5; MASTER_SPEC §5.
Final resolution: Versioned immutable field registry, relational item/grant-field FKs, exact same-passport/kind/version checks and fixed constructors in one passport_projection RPC. Unknown fields default deny; no raw-row serialization. New item/field/source columns never widen prior grants; projection golden tests and no-store requirements.

### H-09

Issue: Skill mapping immutability and atomic evidence propagation incomplete.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: Mutable evidence_skills can launder a legitimate basis into another skill; asynchronous-only revocation permits stale badges.
Documents changed: DATABASE §§2,5,7; API §§3,5; SECURITY §4; AI_SYSTEM §§5–6; MASTER_SPEC §3.
Final resolution: Freeze mapping/policy/task/criterion references at issuance; derive them in typed internal issuance transactions with unique origin. Correction withdraws/revokes before replacement in same transaction; live eligibility checks exclude open basis/agreement/authority cases immediately. Revocation terminal; dismissal cannot resurrect revoked assertions; notifications post-commit only.

### H-10

Issue: Privileged operator/service-role access insufficiently bounded.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: A service-role backend defeats RLS regardless of user-role policies.
Documents changed: DATABASE §6; SECURITY §§2–3; API §§4–5; ARCHITECTURE §§2–3,7; MVP_PLAN B02/B11.
Final resolution: No service-role runtime credentials; independent NOLOGIN executor owners, human capabilities+MFA, scoped operator commands, least-privilege AI worker login/lease functions, offline bootstrap/break-glass, rotation/revocation procedure and cross-capability deny tests. Infrastructure administration remains explicitly outside runtime RLS protection.

### H-11

Issue: Mandatory two-week scope remains too broad.
Original priority: HIGH.
Decision: ACCEPTED.
Reason: Original P0 required both complete AI and challenge subsystems from an empty repository, risking late security work.
Documents changed: all seven specifications; especially MVP_PLAN §§1–4 and MASTER_SPEC §4.
Final resolution: Freeze manual P0A offer→agreement→work→evidence/private-passport. Final M-09 closure uses the actual one-developer constraint: both AI and Prove are P1 only, pre-provisioned synthetic actors/one company/category, minimal forms/evidence lists/operator controls and tracked manual privacy operations. No onboarding, catalog management, admin dashboard or native/offline-sync breadth. All discovery/matching/career/notifications/bearer/uploads remain excluded. Day 6/10 gates expose schedule risk; Day 11–14 remain remediation/recovery/rehearsal. The earlier two-engineer estimate is not claimed as a solo guarantee; security contracts/tests remain mandatory.

## 3. MEDIUM findings

### M-01

Issue: Specifications untracked in Git.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: The final verification correctly requires an approved durable snapshot. The owner now expressly requests closure and an identifiable implementation baseline; a local documentation commit/tag completes that request without publishing or starting implementation.
Documents changed: ARCHITECTURE_BASELINE; STAGE1_APPROVAL; README baseline index; ARCHITECTURE §§1,8; MVP_PLAN §2; all seven specification revision headers; this resolution.
Final resolution: FAIRWORK-ARCH-1.0.0 records approval status/date/owner/basis, exact approved documents and change rules. Immutable local tag fairwork-architecture-v1.0.0 identifies the documentation-only commit containing the seven specs, baseline, approval, resolution and both unchanged independent reports, plus README index. Resolve the tag to obtain the exact commit; do not move it. Remote push is separate. Architecture is approved; implementation execution still requires a subsequent user instruction.

### M-02

Issue: Challenge authorship/conditions/anti-cheating evidence incomplete.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: Human review alone does not prove authorship or unaided performance; scoped disclosures improve correctness without surveillance.
Documents changed: DATABASE §3; AI_SYSTEM §5; SECURITY §4; MASTER_SPEC §5; MVP_PLAN B12.
Final resolution: Immutable submission stores attestation, declared assistance/resources, timing, task exposure, identity assurance; reviewer records integrity limitations, repeated attempts grouped and compromised versions retired. Evidence labeled completed-under-stated-conditions; no invasive monitoring or automated guilt.

### M-03

Issue: Reviewer conflict-of-interest policy undefined.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: Subject inequality does not prevent employer/approver/prior-review conflicts or undisclosed collusion.
Documents changed: DATABASE §§2–3,6; SECURITY §4; API §4; MASTER_SPEC §5; MVP_PLAN D-05/D-09.
Final resolution: Stored assignment/acceptance/conflict declaration and policy; reject known subject/employer/authority-approver/original-evaluator relationships; different appeal reviewer. Unknown relationships require declaration and remain residual risk. If no independent reviewer, suppress verification and leave case open.

### M-04

Issue: Multi-evidence Work DNA aggregation undefined.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: Counts without grouping/status/assurance rules can imply unjustified strength.
Documents changed: DATABASE §7; AI_SYSTEM §6; API §3; MASTER_SPEC §§3–4.
Final resolution: dna.v1 individual observations, exact scope/date/assurance, independent work-root/challenge-template groups, conflicts preserved, no averaging; invalid/disputed/expired/withdrawn evidence excluded from verified totals; old evidence age explicit. Shared summaries use only disclosed evidence; rulesVersion returned.

### M-05

Issue: Provenance/confidence/privacy vocabularies not enforceable.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: “High confidence” and nullable source owner are insufficient to distinguish public fact candidates from private user data.
Documents changed: DATABASE §10; AI_SYSTEM §6; SECURITY §§5–6; API future-module boundaries.
Final resolution: Controlled source kinds and CHECK-enforced owner/visibility partition; no relabeling private source as public. Controlled unverified/source_supported/contested/reviewed plus derived stale state; directness/corroboration descriptors with basis, no model probability. Immutable sources/claim spans and contradictory claims retained. Applied as future-module contract, not unnecessary P0 tables.

### M-06

Issue: Lifecycle/timestamp/FK deletion behavior inconsistent.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: Unspecified cascade or timestamp defaults can erase shared basis or retain personal content indefinitely.
Documents changed: DATABASE §§1,9; SECURITY §7; API §§2–4.
Final resolution: Universal DB timestamps, explicit actor/immutability conventions, ON DELETE RESTRICT default, complete per-table lifecycle classification, ordered authorized privacy erasure with prior dependent revocation, pseudonymous retained identities and restore replay. No blind cascade or assertion without retained basis.

### M-07

Issue: Unresolved terms/answers not tied structurally to acceptance.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: A single boolean cannot establish which missing terms were acknowledged; answers must not be mistaken for amendments.
Documents changed: DATABASE §§2,5; API §6; MASTER_SPEC §5; ARCHITECTURE §5.
Final resolution: Fixed term/field IDs, unique unresolved item IDs with schema/DB-reference validation, canonical unresolved-set hash and exact ID-set acknowledgement. Confirmation hash covers terms, unresolved set, authority, source/answer/shared-question references. Answers append against exact immutable question; changes require fresh terms version/confirmations.

### M-08

Issue: Trust audit durability/retention too weak.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: Keeping a trusted assertion longer than its transition trail undermines investigation;90 days cannot apply uniformly.
Documents changed: DATABASE §9; SECURITY §7; ARCHITECTURE §7; MVP_PLAN B09/B10.
Final resolution: Append-only application permissions, DB timestamps, compensating events; trust audit retained with record/assertion plus approved dispute period. Protected release/rehearsal exports for synthetic competition; separate protected export boundary before real data. Infrastructure tampering remains possible; no notarization/blockchain requirement.

### M-09

Issue: Auth/language/reviewer/provider/region/privacy decisions remain open.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: The owner supplied solo-team/free-tier/14-day/synthetic constraints and explicitly approved pre-provisioned email/password demo authentication. Applicable architecture choices can now be recorded without inventing staff, account access or production policy approval. Excluded-module and real-employment-data decisions need not block this synthetic scope.
Documents changed: MVP_PLAN §§1–5; MASTER_SPEC §§2,4–7; ARCHITECTURE §§2,4–8; DATABASE §§1,9; API scope; AI_SYSTEM scope; SECURITY §§2–3,7–8; ARCHITECTURE_BASELINE; STAGE1_APPROVAL; this resolution.
Final resolution: D-01–D-10 record status, actual choice, accountable owner/date, rationale and revisit gate: solo narrow P0A; approved seeded email/password with privileged TOTP MFA; English; demo_provisioned internal counterpart authority; honest simulated roles/no real independent reviewer assumed; Vercel Hobby if eligible and Supabase Free Singapore with local fallback/manual restore; locked Figma with documented auth/content exceptions; AI and Prove excluded; synthetic-only retention/notice rule. Real-data jurisdiction/privacy/reviewer/provider/residency/retention decisions move to PRE-PRODUCTION. Provisioning/security/recovery proofs remain implementation obligations. No Stage 1 owner decision remains pending.

### M-10

Issue: Full lifecycle and competition claims not explicitly separated.
Original priority: MEDIUM.
Decision: ACCEPTED.
Reason: Broad README vision is easily mistaken for live scope if multiple documents carry inconsistent capability lists.
Documents changed: MASTER_SPEC §4 (canonical manifest); MVP_PLAN §§1,5; ARCHITECTURE §§2,8; AI_SYSTEM §7.
Final resolution: Single manifest with all runtime capabilities currently future; defined labels/evidence required for promotion, synthetic-data labels independent. Exact competition statement limits live claims to tested synthetic P0A; role simulations do not establish human independence. README remains long-term vision and now links the approved baseline/master/plan under M-01. No claim that the entire lifecycle or optional AI/Prove is live.

## 4. LOW findings

### L-01

Issue: Skill taxonomy meaning can change under historical evidence.
Original priority: LOW.
Decision: ACCEPTED.
Reason: A small immutable definition/version rule prevents significant semantic drift without a taxonomy service.
Documents changed: DATABASE §§2,10; AI_SYSTEM §6; MASTER_SPEC §3.
Final resolution: Material definition changes create new skill ID/version with successor; evidence keeps original meaning. Cosmetic label changes audited only.

### L-02

Issue: Edited questions can change what an answer appears to answer.
Original priority: LOW.
Decision: ACCEPTED.
Reason: This directly affects agreement integrity and is cheap to fix before implementation.
Documents changed: DATABASE §§2,5; API §§3,6; MASTER_SPEC §5.
Final resolution: Question text immutable from creation; edit creates new same-version successor ID. Answers reference exact immutable question; their corrections append same-question successor. No separate mutable shared-text history to reconstruct.

### L-03

Issue: Named recipient onboarding operationally unclear.
Original priority: LOW.
Decision: ACCEPTED.
Reason: Explicit fixture provisioning avoids both a blocked demonstration and account-enumeration shortcuts.
Documents changed: API §6; MVP_PLAN §5; SECURITY §5; MASTER_SPEC §5.
Final resolution: Named synthetic recipient pre-provisioned and sign-in checked in rehearsal; consented fixture selection, no email/phone directory. Private token invitations later, outside14 days.

### L-04

Issue: Saved job matches can drift when requirements change.
Original priority: LOW.
Decision: ACCEPTED.
Reason: Snapshot binding is a small future contract; implementing job history now would be unnecessary scope.
Documents changed: DATABASE §10; AI_SYSTEM §6; ARCHITECTURE §6; API future-module boundaries.
Final resolution: Future jobs use immutable versions/requirement snapshot/hash; recommendations retain input/evidence/rules version. No P0 job tables or features created.

### L-05

Issue: Index guidance lacks migration acceptance criteria.
Original priority: LOW.
Decision: ACCEPTED.
Reason: Concrete policy/queue indexes and representative plan review prevent pressure to bypass security without premature tuning.
Documents changed: DATABASE §9; MVP_PLAN B10; ARCHITECTURE §7.
Final resolution: Required FK/composite/partial index families plus EXPLAIN acceptance for owner/authority/assertion/grant/queue queries. Small-table scans acceptable; no speculative optimization or RLS bypass. Runtime measurement waits for implementation/data.

## 5. New risks and boundaries identified in correction

- Consent withdrawal and external network dispatch are not atomically reversible. Define dispatch authorization ordering, best-effort abort and rejected late results; disclose in-flight/provider-retention limits.
- Current employment authority and historical confirmation validity must differ. Ordinary departure must not erase legitimate history; fraud cases must affect dependent claims immediately.
- Definer role ownership can accidentally bypass RLS or make helper policies recurse. Separate nonowner executors/helpers, catalog assertions and direct-role tests are mandatory.
- Registry allowlists do not make user-entered disclosure summaries nonsensitive. Use explicit owner preview and immutable selected summaries, never raw-task auto-copy.
- Tightened trust guarantees add implementation work. Both optional modules are excluded, and interface/operations breadth is reduced for the actual solo team. Even this P0A schedule remains an estimate with explicit Day 6/10 checkpoints.
- Infrastructure administrators and undeclared human collusion remain beyond guarantees provided by row policies/attestations. Offline controls, independent review, audit export and honest assurance labels remain necessary.

## 6. Cross-document consistency check

The closure aligns all seven current specifications with FAIRWORK-ARCH-1.0.0: solo synthetic P0A; both AI/Prove excluded for competition; pre-provisioned email/password with privileged TOTP; English and locked Figma/content exceptions; demo-only authority and simulated-role disclosure; no invented independent human reviewer; one hosted free-tier project/local isolation; manual exports/recovery; explicit pre-production gates and no Stage 2 start. Both independent reports remain unchanged historical evidence.

Consistency result: **PASS at the specification level**. Checks cover all 26 review IDs and six disposition fields, with 11 HIGH accepted, 10 MEDIUM accepted and 5 LOW accepted; relative Markdown links, fences/table widths, consistent baseline version, all ten Day 0 choices, unchanged review/report hashes, and the existing 45 mandatory/future relation names in policy/lifecycle inventories. Current specifications contain no stale Day 0 OPEN requirement or competition AI/Prove admission gate. README links the baseline while preserving its vision.

Manual trace checks retain the verified authority/current-versus-historical semantics, typed assertions, exact hashes/pointers/confirmations, suppression/terminal revocation, private RPC grants and role ownership, fixed passport projection, Storage deny default, future consent/reviewer boundaries and mandatory release tests. Final M-01/M-09 choices do not change these trust contracts. The synthetic retention exception is explicitly scoped and does not invent real employment retention law.

This is a documentation consistency check, not execution of migrations or a new independent runtime audit. SQL policies/constraints/grants/concurrency behavior, account/MFA provisioning, actual host eligibility and recovery still require implementation evidence. The final approval supersedes the earlier governance verdict only after the documented local commit/tag boundary is created; it does not retroactively alter either independent report.
