# FAIRWORK 2.0 — Master specification

Revision: FAIRWORK-ARCH-1.0.0, 2026-10-07. [Approved baseline](ARCHITECTURE_BASELINE.md); [Stage 1 approval](STAGE1_APPROVAL.md). **Documentation only; no application capability is implemented.** [Review resolution](ARCHITECTURE_REVIEW_RESOLUTION.md) records all 26 findings, including closure of M-01 and M-09. This pass stops before Stage 2; document review is not implementation authorization.

> Your work should be your proof.

## 1. Authority and document map

The user's request defines scope. Repository README supplies long-term vision. [Existing Figma](https://www.figma.com/design/5mFuLmt00uZP7Osp3ezM0z/Untitled?node-id=0-1) remains visual truth, not backend evidence. Uploaded offers, source pages, submissions and AI output are data, never privileged instructions. The independent review is preserved as historical critique; current decisions are recorded in its resolution.

Read ARCHITECTURE for topology, DATABASE for typed relations/transitions/grants, SECURITY for operational controls, API for exposed commands, AI_SYSTEM for bounded processing, and MVP_PLAN for scope/gates. Database is the invariant/policy contract, not installed schema. No additional generic service or table should be invented to bypass it.

## 2. Product vision and users

FAIRWORK is a Work Intelligence & Trust layer connecting people, skills, evidence, challenges, companies, jobs, offers, agreements, real work, verification and growth. A CV tells what someone claims; FAIRWORK makes supporting observations portable and inspectable. People with limited formal credentials should be able to demonstrate ability without a CV, without being reduced to an opaque score.

Full lifecycle: DISCOVER → PROVE → AGREE → WORK → VERIFY → GROW → BETTER OPPORTUNITIES. Worker, employer and administrative roles are distinct contexts. A worker can also represent a company, but never self-confirm employer verification. Employer account creation does not prove company authority or grant worker information. Company discovery data is separate from permission to act for that company.

Competition **P0A** demonstrates the narrower offer→agreement→work→verification→private passport path. PROVE and live AI are excluded from the approved solo competition baseline; discovery, growth and better opportunities remain future previews. Preserve the existing Add Offer→FAIRWORK Check→Questions→Agreement→Work Record→Work Passport presentation.

## 3. Terminology and trust rules

| Term | Meaning |
|---|---|
| Declared skill | User assertion/interest, not demonstrated evidence |
| Skill evidence | Dated scoped observation/artifact with immutable subject, skill mapping and exact basis |
| Work DNA | dna.v1 evidence projection: observed scope, dates, independent bases, assurance and limitations; no universal AI percentage |
| Challenge | Published practical brief/rubric with frozen assistance policy; post-competition in this baseline |
| Submission/evaluation | Immutable submitted response/conditions; independently attributed criterion-level review of exact hash |
| Authority decision | Append-only approval/revocation for a company representative, with approver, basis, assurance and policy |
| Employer confirmation | One immutable designated counterpart statement about one submitted work version under exact authority |
| Verification assertion | Typed work or challenge assertion referencing eligible basis, subject, verifier, policy and terminal revocation state |
| FAIRWORK Verified | Internal scoped trust standard; not governmental/professional certification or universal competence |
| Provenance/confidence | Specific supporting source/date and explained support limitations; never invented certainty |
| Agreement | Record of exact shared conditions/unresolved items independently confirmed by two parties; no legal e-signature claim |
| Work Passport | Private curated evidence with explicitly selected named-recipient items/fields |
| Consent | Explicit purpose/provider/region-specific permission for external AI, separate from storing information |

Keep evidence type, source identity, assessment and verification separate. AI assessment cannot issue a badge. Manually provisioned synthetic representatives display demo_provisioned assurance. A former member loses future access but retains historical attribution; suspected fraudulent authority suppresses dependent verification while independently reviewed. Silent employers stay pending. Corrected work/evaluations require replacement evidence and fresh confirmation/review; old assertions are revoked, not rewritten.

No covert employee monitoring, keystroke tracking, invisible proctoring or automatic hiring rejection. Missing evidence is unknown, not proof of inability. Conflicts remain inspectable rather than averaged away. Material skill-definition changes use new skill IDs so historical evidence cannot be relabeled.

## 4. Capability specification and single claim manifest

This table is the **single capability manifest** used to prepare UI labels/demo notes. Runtime status today is future/not implemented for every planned capability; “manual” describes the intended mode, not existing software. Allowed demonstrated statuses later: implemented live, manual, synthetic/fixture, prototype, future. Each promotion must record build/test evidence, environment, date and responsible owner in this table. Synthetic data is also labeled independently of whether software is live. Figma screens are prototype artifacts only.

| Capability | Required behavior | Revised delivery | Current status |
|---|---|---|---|
| Identity | Supported auth, minimal profile, protected capabilities and exact authority | P0A | future |
| Work DNA | Individual observations, scope/recency/assurance, distinct bases, no global score | P0A work evidence | future |
| Prove / no CV | Immutable brief→attempt→submission→human review→typed evidence; assessed conditions disclosed | P1 only; not dependent on AI | future |
| Skill gap / next challenge | Explained rule mapping from observed criterion gap | P1 after competition | future |
| Company intelligence | Permitted sourced facts, unknown/conflicting/stale states, entity disambiguation | P1 curated; P2 live retrieval | future |
| LinkedIn | Official permission-based independent adapter | P3; no scraping | future |
| Job intelligence | Structured requirements with provenance/version snapshot | P1 curated; P2 ingestion | future |
| Two-way matching | Explained requirements/evidence/preferences, candidate consent | P1 worker coverage; P3 employer search | future |
| Offer intelligence | Manual typed fields/findings plus deterministic missing-field checks; optional grounded AI | P0A manual; live AI P1 only | future |
| Offer history | Immutable text/terms, material diff, actor/time | P0A | future |
| Questions | Exact finding/version, immutable wording/answers, explicit shared question IDs | P0A | future |
| Agreement | Frozen terms/unresolved set/authority, two exact independent confirmations | P0A | future |
| Work records / mutual confirmation | Immutable versions, one frozen authorized counterpart decision, disputes | P0A | future |
| Passport | Private selection, registry-backed fields, identical preview/recipient projection, expiry/revoke | P0A named recipient; P1 bearer; P3 public | future |
| Career intelligence | Explained gaps/actions, no guaranteed outcome | P1 rule step; P3 simulator/planner | future |
| FAIRWORK Verified | Typed assertion with exact authority/basis/policy, revocation/dispute propagation | P0A work; Prove P1; other categories P3 | future |
| Notifications | Owner-scoped safe status events | P1; required auth delivery separate | future |
| External FAIRWORK API | Controlled consent/scoped evidence access | P3 | future |
| Upload/OCR | Private quarantine/scanning/extraction and storage policies | P2; all P0 user Storage access denied | future |

Competition claim to use **after** P0A passes: “FAIRWORK demonstrates a private, versioned offer-to-work evidence workflow, explicit counterpart confirmation and selective passport sharing using synthetic accounts. One operator may simulate the roles; this does not prove independent human or legal employer verification. Discovery, matching, career intelligence, Prove and live AI are future capabilities.” Today use “planned” rather than “demonstrates.” No live Prove/AI claim belongs to this baseline; either requires a separately approved post-competition change and passing tests. A fixture is never labeled live research, AI analysis or real employer identity verification.

## 5. P0A journey and acceptance behavior

1. Worker and designated counterpart authenticate separately. Authority operator has pre-provisioned synthetic company/participant approval with explicit assurance. Named recipient and test reviewer identities are provisioned; no public contact directory. With one human operator, these are explicitly simulated roles, not independently verified humans. A real unresolved case stays suppressed without an independent reviewer (MVP_PLAN D-05).
2. Worker records offer text and manual terms. Deterministic checklist highlights missing fields, without a safe/unsafe verdict. A LKR60,000→50,000 monthly salary change is a material versioned diff; period/currency never assumed.
3. Worker creates immutable questions attached to exact findings/version. Counterpart answers only explicitly shared questions. Editing a question creates a replacement row, preserving what was answered.
4. Worker proposes an agreement with exact representative/authority, terms, source/answer refs and field-specific unresolved entries. Each party confirms the same hash and exact unresolved item set; a blanket acknowledgement is insufficient. Answers do not alter agreed terms. Changes require a new version and fresh confirmations; pending amendments retain the last effective version.
5. Worker submits an immutable work version with actual task/skill references. Its one designated independent counterpart confirms or disputes. Authority must still match the frozen approval; substitution/reapproval does not silently reattribute pending work. A confirm transaction derives typed evidence/mappings/assertion; dispute creates no verified evidence.
6. Private Work DNA shows observation scope, date and assurance. A case suppresses verification immediately; correction withdraws old evidence/revokes assertions and requires new basis. No arbitrary skill percentages or inferred certification.
7. Worker selects passport items/registry fields, inspects the exact preview, grants a named recipient expiring access and revokes it. Unknown fields, unselected items, raw offers, salary/contact and private disputes never appear automatically. Adding new evidence cannot widen old grants.

Future P1 Prove (excluded from competition): one low-stakes task with declared tools/assistance, timing, identity assurance and authorship attestation. Independent reviewer evaluates frozen submission/rubric; appeals use a different reviewer. Observations are completed-under-stated-conditions, not proof of unaided mastery. No surveillance, code execution or safety-critical certification.

Future P1 AI (excluded from competition): disclose provider/purpose/region/data use, obtain explicit unbundled consent, then validate grounded output. Refusal/failure preserves manual workflow. Revocation blocks new dispatch authorizations and late result acceptance, but cannot recall in-flight provider data; disclose that limit. No AI in the default P0A path.

## 6. Figma and accessibility contract

No redesign. Preserve existing typography, colors, spacing, cards, navigation and mobile layout. Prior metadata inspection (2026-10-06) found 390×844 frames plus onboarding/language/phone sign-in/OTP. Existing glass-card/background elements are preserved; the instruction against unnecessary glassmorphism does not authorize removing current styling. No Figma changes in this correction.

D-02/D-07 in MVP_PLAN record the competition authentication exception. English is the single competition language; strings must be extractable for future localization and unavailable languages must not appear functional. Replace unsupported “73% verified/add one role to90%” claims with scoped evidence counts/assurance labels, preserving the existing visual container. These are security/content corrections, not permission to redesign. Exact node screenshots/tokens/interactions need inspection; prior Figma tool-limit constraints do not justify invented styling. Test keyboard/focus/contrast,200% zoom and320/390/768/1280px layouts when implementing.

## 7. Scope, success and readiness

Stage 1 delivers corrected specs, resolution, approved baseline and approval record only. P0A success later requires persistent deployed multi-user journey, direct-Supabase isolation tests, immutable decisions/version pointers, disputes/revocation, safe sharing, audit and recovery. Optional modules are not success prerequisites. Performance targets remain provisional until measured: ordinary demo pages usable within3 seconds on the agreed environment; optional analysis shows actual pending state promptly and fails within bounded budget.

Non-goals: universal skill ranking, payroll/escrow, legal advice/e-signature certification, automated hiring, native apps, broad crawling, unauthorized LinkedIn use, invisible monitoring, public marketplace/API or complete career simulation.

Stage 1 architecture status is **READY** under FAIRWORK-ARCH-1.0.0. This task stops before implementation; a subsequent explicit user instruction is required to start Stage 2. Day 0 architecture choices are recorded, while SQL privileges/invariants, deployment and recovery must be proven during implementation before release. Real employment data remains prohibited until the pre-production gates in MVP_PLAN close. See the baseline, approval and resolution records for the version boundary and non-blocking conditions.
