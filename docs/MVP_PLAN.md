# FAIRWORK 2.0 — Solo competition plan

Revision: FAIRWORK-ARCH-1.0.0, 2026-10-07. [Approved baseline](ARCHITECTURE_BASELINE.md); [Stage 1 approval](STAGE1_APPROVAL.md). Architecture decisions are approved; **this task does not authorize starting implementation**. Days are relative to a subsequent explicit implementation start. All runtime backlog items are not started. The [master capability manifest](FAIRWORK_MASTER_SPEC.md) controls capability claims.

## 1. Scope freeze and feasibility

One primary student developer/operator, supported by AI development tools, targets approximately 14 days. AI tools are assistance, not additional accountable engineers or independent reviewers. Available tools are ChatGPT Plus/Codex, GPT-6 Astra when needed, optional Claude Free review, Google Antigravity Free, GitHub and Figma. No paid model API or additional tool subscription is a runtime dependency.

Mandatory **P0A** is one synthetic manual offer→agreement→confirmed work→evidence→private named-recipient passport journey. Preserve authority history, exact version/participant confirmations, database grants/RLS/guards, typed evidence, disputes and terminal revocation, shared projection safety, audit and recovery. **Both live AI and Prove are excluded for these 14 days.** Their retained P0B contracts are P1 references only. They cannot be admitted midway through this baseline. No discovery, matching, career recommendations, LinkedIn, notifications, bearer/public sharing, upload/OCR, external public API or native app is included.

The earlier review's two-engineer estimate does not apply unchanged. Reduce interface and operational breadth as follows:

- One seeded synthetic company, one work category, a small fixed skill catalog and pre-provisioned worker/counterpart/recipient/test identities. Test fixtures include unrelated and conflicted actors. No company onboarding, directory, account search or skill-catalog management.
- One responsive journey using the existing Figma layouts; accessible states and a work-evidence list instead of analytics, portfolio editing, charts or a generalized dashboard. Repeated records and amendments use the same database contracts; the demo concentrates on one offer, one salary amendment, one unresolved term, one work record and one share.
- Minimal authenticated counterpart and operator controls for the exact commands. No admin dashboard, assignment inbox, bulk tooling or automated appeals workflow. Case opening, suppression, terminal revocation and conflict-safe resolution contracts remain required and tested. Simulated reviewer commands may use a minimal protected test/operator surface; no independent human review is claimed.
- Seed minimal profiles/declared skills through the authorized fixture/bootstrap path; defer general onboarding/profile editing UI. Keep ordinary runtime writes behind the existing RPC allowlist. Track privacy requests with manual operator fulfillment; no self-service export/deletion automation.
- Responsive web first. Installability may follow only if core gates pass; offline private-data caching, sync, push and native packaging are excluded. The local demo fallback is a running local app/database, not a browser cache of private data.

This is a bounded solo build target, not a guarantee of 14-day delivery. Days 11–14 are reserved for security fixes/recovery/rehearsal. If the Day 6 integrity gate or Day 10 journey gate fails, freeze breadth and report the schedule risk; complete only tested surfaces and label unfinished ones as prototypes. Do not call an incomplete workflow a functioning MVP, reduce required security checks, or enable optional modules to compensate. Any extension of the target date is a later explicit scheduling decision, not a Stage 1 blocker.

## 2. Resolved Day 0 register

Decision date: **2026-10-07**. Accountable owner for every row: **FAIRWORK project owner, the requesting user and primary student developer/operator**. No additional staff or account access is assumed. Authority: the user's blocker-closure request and explicit email/password demo approval. These are architecture choices; provisioning and tests have not occurred. D-08/D-09 are closed by exclusion and D-10 by a synthetic-data restriction with a separate pre-production gate.

| ID | Status and recorded choice | Evidence / rationale | Revisit trigger |
|---|---|---|---|
| D-01 | RESOLVED: one developer, narrow P0A above, approximately 14 relative days; AI and Prove P1 only | User's staffing/target constraints; scope cut replaces two-engineer assumption | Day 6/10 gates or explicit scope/date change |
| D-02 | RESOLVED: Supabase email/password, pre-provisioned demo accounts, public signup disabled, no delivery in demo script; strong unique passwords; TOTP MFA for privileged commands | Owner explicitly approved email/password competition exception; avoids SMS and email-delivery dependency | Before real-user onboarding or auth/provider change |
| D-03 | RESOLVED: English primary, externalizable strings, honest unavailable-language state | User permits English; Figma language selector is not evidence that translations exist | Before adding a fully reviewed language |
| D-04 | RESOLVED: synthetic company and internal explicit counterpart confirmation, assurance demo_provisioned | User excludes government/legal/company-registry claims; immutable authority basis retained | Before real employer onboarding |
| D-05 | RESOLVED: owner runs deployment/fixture provisioning; separate synthetic accounts/capabilities and TOTP MFA exercise protected commands; no independent real reviewer is assumed | Single-person team; demo roles are simulations. Real cases remain open/suppressed without an eligible independent human; self/conflicted decisions still denied | Before actual review/appeal or real trust claims; name independent reviewer then |
| D-06 | RESOLVED: Next.js/React/TypeScript; Vercel Hobby if eligible personal/non-commercial use; one hosted Supabase Free synthetic demo project in Singapore (ap-southeast-1), isolated local test databases; owner holds secrets and encrypted manual exports | User's free-tier preferences; local rehearsal fallback; no production/PITR/multiple hosted environments assumed | Provisioning/quota/region/hosting eligibility failure; production deployment |
| D-07 | RESOLVED: locked Figma visual source; approved email/password exception within existing visual style; English-only content and scoped evidence counts replace unsupported percentage claims | Owner auth approval plus existing no-false-claims requirement; inspect actual frames/tokens before implementation; no Figma edit in this pass | Exact screen implementation/accessibility review; missing Figma access blocks that screen, not schema work |
| D-08 | RESOLVED BY EXCLUSION: no live AI/provider/worker/key/data dispatch in competition; retain provider abstraction and explicit scoped consent design for P1 | No provider budget/access dependency; manual workflow is complete | Separately approved post-competition AI activation, including provider/config/region/disclosure/budget/consent tests |
| D-09 | RESOLVED BY EXCLUSION: no Prove mode in competition; future first release limited to one low-stakes category with reviewed rubric and independent reviewer | User permits narrow Prove only if required; solo plan does not require it | Separately approved post-competition Prove scope and reviewer availability |
| D-10 | RESOLVED FOR COMPETITION: synthetic employment content only; no external AI processing; fixture/account/export cleanup within 7 days after the competition and no later than 30 days after first hosted demo data creation | No production legal policy is invented. Minimal real operator/login identifiers and hosting/auth metadata still require a truthful demo notice and restricted access | Before real employment data, public signup, longer retention or production hosting |

D-05 operational details: the requesting user is the named accountable operator in the approval record; do not invent another person. Bind actual actor UUIDs/capabilities and TOTP enrollment during provisioning, record the operator and fixture purpose, and keep secrets outside Git. Distinct IDs, explicit confirmations and conflict declarations remain mandatory. The owner may operate simulated actors only with visible synthetic/simulation labels; this is not an independent reviewer staffing solution. A non-synthetic case cannot be resolved by inventing a second account. Offline fixtures cannot substitute for live-command authorization tests or a claimed real employer decision.

D-06 free-tier details (official references checked 2026-10-07): [Vercel Hobby](https://vercel.com/docs/plans/hobby) is for personal/non-commercial use; no commercial deployment is authorized under this assumption. If ineligible, keep the documented local competition rehearsal path and obtain an eligible hosting decision before public deployment. [Supabase password auth](https://supabase.com/docs/guides/auth/passwords) supports the selected flow; [built-in email rate limits](https://supabase.com/docs/guides/auth/rate-limits) make email delivery unsuitable as a demo dependency. [TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa) supplies the privileged second factor. Select [Singapore](https://supabase.com/docs/guides/platform/regions) for the synthetic demo, subject to provisioning availability; changing region is a recorded configuration decision, not a residency guarantee. No resources are created here.

For [Supabase Free recovery](https://supabase.com/docs/guides/platform/backups), use encrypted manual database exports at release/rehearsal checkpoints, stored outside the application account boundary with owner-only access. Versioned migrations and synthetic seed/reset recreate the environment; do not assume a default dump includes Auth accounts, role secrets, provider settings or MFA enrollment. Record export coverage, re-provision demo users/MFA securely if needed, rotate restored credentials, replay tombstones/revocations, and prove recovery in an isolated local database before deployment. No Storage objects exist in P0. Check project quotas/availability and rehearse before the competition; the free service is not an availability guarantee. The local synthetic environment is the live fallback if hosted infrastructure is unavailable; a recorded demonstration is labeled recorded, never passed off as live.

D-10 retention details: use invented employment/person/company facts and operator-controlled demo login identifiers; no participant employment records. Display a short demo notice identifying stored account/hosting metadata, operator contact channel, synthetic purpose and cleanup window. Track early export/deletion requests and process manually through scoped operations. Close/revoke simulated evidence and grants before erasure, purge protected fixture exports within the same window, retain only nonpersonal test results/source, and prevent deleted fixtures returning on restore. Provider-managed logs/backups may have their own retention: disclose and verify those terms before hosted use; do not promise immediate deletion from the provider. This is a competition operating rule, not a legal conclusion.

No owner-only architecture decision remains pending. Before real employment data/public signup, the owner must approve jurisdiction, identity/authority standard, eligible independent reviewers, retention/dispute/appeal periods, privacy notices/rights handling, provider terms/residency, protected audit/backup boundary and recovery objectives. Those are **PRE-PRODUCTION gates**, not prerequisites for synthetic P0A implementation. Future AI/Prove activation has its own recorded gates.

M-01 is closed by the documentation-only commit and immutable local tag specified in [ARCHITECTURE_BASELINE](ARCHITECTURE_BASELINE.md). Git publication is separate; no remote push is authorized by this task.

## 3. Fourteen-day plan

| Day | Deliverable | Exit gate / fallback |
|---|---|---|
| 1 | After explicit start: strict Next.js foundation, inspect exact Figma screens, local Supabase tests and reproducible seed plan | Build/design inventory; no UI redesign or unrelated routes |
| 2 | Seeded email/password identities, minimal profiles, TOTP/capability bootstrap, immutable demo authority, audit/quotas | A/B isolation; no raw grants or runtime service-role; SEC-01/02/03/07 |
| 3–4 | Manual offers/questions and agreement versions, unresolved acknowledgements, exact confirmations | API/DB integrity tests alongside contracts; thin forms only |
| 5–6 | Work confirmation, typed evidence, cases/revocation, passport projection/grants | Gate A: persisted trust spine and required denial/concurrency tests; if late freeze breadth and flag date risk |
| 7–8 | Figma-faithful worker/counterpart journey and evidence/passport screens | One seeded scenario end to end; no onboarding/management dashboards |
| 9 | Named recipient preview/expiry/revoke, minimal protected case/privacy controls | Exact scopes; simulated reviewer limitations explicit; tracked manual fulfillment |
| 10 | Full mandatory journey and security suite integration | Gate B: P0A journey passes; feature freeze; incomplete surfaces remain prototypes |
| 11 | Authorization, concurrency, CSRF/cache/accessibility remediation | Zero known high/critical trust defect; no new capabilities |
| 12 | Hosted synthetic deployment plus isolated restore/reseed rehearsal | Gate C: secret/catalog audit, tombstone/revocation replay, deploy/recovery evidence |
| 13 | Fix/retest, manifest accuracy, two-session and local-fallback rehearsals | Script twice with truthful simulation/manual labels |
| 14 | Final smoke/rehearsal and competition presentation | Gate D: stable tested demo with operator/recovery instructions; no unsupported live claims |

## 4. Ordered backlog

None is done today. Required tests ship with each first-use contract; hardening days are not a substitute. Existing B IDs remain stable for review traceability.

| ID | Priority / deliverable | Dependencies | Definition of done / required validation |
|---|---|---|---|
| B01 | P0A foundation/design/auth | Approved baseline and later implementation instruction | Single app, exact visual inventory, email/password seed flow, build/type/lint, session expiry and secret scan |
| B02 | P0A identity/authority/privileges | B01 | Protected bootstrap, TOTP, immutable authority; SEC-01/02/03/07, self-approval and cross-role denial |
| B03 | P0A command/audit/limits | B02 | Idempotency, errors/locks, append-only DB-time audit, atomic quotas; retries/direct-RPC/audit-tampering tests |
| B04 | P0A manual offers/questions | B03 | Immutable manual terms/findings/answers and deterministic diff; owner isolation and cross-version tests |
| B05 | P0A agreements | B04 | Frozen terms/authority/unresolved hash, exact two-party confirmations/effective pointer; illegal-transition/concurrency tests |
| B06 | P0A work/evidence | B05 | One counterpart decision, typed assertion/skill map atomically issued; duplicate/self-confirm/stale-authority denial |
| B07 | P0A disputes/revocation | B06 | Cases, independent assignment/acceptance/resolution contract and terminal revocation; minimal controls, simulation labels, no badge resurrection |
| B08 | P0A DNA/passport | B06+B07 | Individual evidence list, curation and registry-backed grant, one preview/recipient projection; private/new field/item/expiry/revoke tests |
| B09 | P0A privacy/operations | B03+B08 | Tracked manual requests, scoped fulfillment, synthetic reset and protected exports; SEC-11 recovery/deletion tests |
| B10 | P0A integration/release | B01–B09 | SEC-01–08+11, end-to-end roles, catalog audit, bounded query plans, accessibility/Figma comparison, deploy/restore rehearsals |
| B11 | P1 live AI; excluded in competition | Separately approved scope, B04, provider/consent/worker gates | Future 20-case corpus, consent/lease/race and SEC-09 tests; no verification authority |
| B12 | P1 Prove; excluded in competition | Separately approved scope, B06+B07, D-09 gate | Future one immutable task/submission, independent reviewer/conditions and SEC-10 tests |
| B13 | P1 other future work | B10 and separate scope approval | Curated catalog, matching/next challenge, notifications/bearer links; feature-specific provenance/privacy tests |
| B14 | P2 | Stable P1 plus provider/storage policies | Permitted retrieval, uploads/OCR, privacy automation, scoped employer feedback; SSRF/storage/private-to-public tests |
| B15 | P3 | Proven product plus explicit rights/policies | Official LinkedIn, generated tasks, marketplace, simulator, public passport/API and new trust categories; separate review |

B10 depends on neither B11 nor B12. Optional-module SEC-09/10 are future activation gates; all P0A tests remain mandatory. No unused optional tables/RPC grants are created.

## 5. Demo scope and evidence

After the relevant build passes, say: “The competition build demonstrates a private, versioned offer-to-work evidence workflow, explicit counterpart confirmation and selective passport sharing using synthetic accounts. One operator may simulate the roles; this is not proof of independent human or legal employer verification. Discovery, job matching, Prove and live AI are future capabilities.” Before that, use “planned,” not “implemented.”

Demonstrate a salary change, missing term and exact unresolved acknowledgement, separate authenticated counterpart action, rejected self-confirmation, case suppression, selected share and revocation. Preserve the database subject/authority/conflict checks; seeded data never substitutes for test evidence. No account-existence directory, real employment data or actual provider AI call is required. The capability manifest records manual/implemented/synthetic/prototype/future truthfully.

Release still requires executable SQL/security/concurrency tests, role/catalog checks, representative query plans and recovery proof. Stage 1 approval certifies the design baseline only. No application, framework, migration, deployment or Figma edit occurs in this task.
