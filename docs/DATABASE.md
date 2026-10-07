# FAIRWORK 2.0 — Database contract

Revision: FAIRWORK-ARCH-1.0.0, 2026-10-07. [Approved baseline](ARCHITECTURE_BASELINE.md); [Stage 1 approval](STAGE1_APPROVAL.md). **Specification only: no SQL, migrations, policies or tests have been implemented.** [MVP_PLAN](MVP_PLAN.md) owns delivery scope; [SECURITY](SECURITY.md) defines operational controls; [API](API.md) maps the commands below.

## 1. Scope and conventions

P0A is the mandatory manual offer/agreement/work/evidence/private-passport path. The approved solo competition baseline excludes both P0B-AI and P0B-Prove; their retained contracts are P1 design references only. Neither module, its tables, worker, credentials nor RPC grants are created in P0A. P0B labels below identify those future contract families, not competition admission. Do not create unused optional tables. MVP_PLAN §1 fixes the narrow interface and fixture scope without relaxing database invariants.

Application tables live in unexposed `private`, user RPCs in exposed `api`, worker functions in unexposed `ops`. No raw domain tables in public. `auth.users` owns authentication. UUID PKs, database-assigned `created_at timestamptz`, immutable actor IDs and explicit FKs apply to every table. Unless explicitly excepted, **all FKs use ON DELETE RESTRICT**, including auth-user references. No implicit CASCADE/SET NULL on trust history.

Mutable roots have revision, updated_at, deleted_at and protected lifecycle fields. Immutable payloads reject UPDATE/DELETE through guard triggers; only a separately authorized retention process may erase/redact after withdrawing dependents. Subject/company/actor identity cannot be reassigned. Money uses numeric(14,2), currency and explicit pay period; APIs use decimal strings. Hours are nonnegative, period end≥start. Null means unknown. JSON is limited to bounded schema-versioned snapshots; identities, authority, verification, sharing and consent are relational.

## 2. P0A relation inventory

Every identifier below is an FK to the named entity; all composite FK targets must have matching UNIQUE constraints. UQ means UNIQUE. The role/policy/lifecycle matrices later in this document cover every table listed here.

| Table | Fields and mandatory integrity |
|---|---|
| profiles | id PK/FK auth.users; display_name, locale, time_zone; account_state active/suspended/deletion_pending; root fields. Owner edits display fields only |
| capability_assignments | id; subject_id, capability authority_operator/review_operator/reviewer/privacy_operator; granted_by, purpose, expires_at, revoked_at. Protected operator assignment; no editable JWT metadata as authority |
| companies | id, name, identity_label demo_provisioned/manual_reviewed; root fields. Creation is not company authority |
| company_memberships | (company_id,subject_id) PK; current_decision_id, revision. Protected projection/lock row, not the historical approval |
| company_membership_decisions | id, company_id, subject_id, sequence, previous_decision_id; approve/revoke; requested_role representative; approver_id, method, assurance_label, reviewed_evidence_refs, reason, policy_version, effective_at, expires_at. Immutable; UQ(company_id,subject_id,id), UQ(company_id,subject_id,sequence). Current/previous composite FKs stay within membership; approver≠subject |
| skills | id, stable_slug, definition_version, label, definition, successor_skill_id; UQ(slug,definition_version). Material meaning immutable; new meaning requires new ID. Cosmetic corrections audited |
| profile_skills | (worker_id,skill_id) PK, declared_at. Declaration only |
| offers | id, worker_id, company_id nullable, current_version_id; root fields |
| offer_versions | id, offer_id, worker_id, sequence, previous_version_id; canonical_text, normalization_version, text_hash, terms_schema_version, terms JSON, terms_hash, material_diff. UQ(offer_id,id), UQ(offer_id,sequence), UQ(id,worker_id); immutable |
| offer_findings | id, offer_version_id, worker_id, stable_code, field_id, kind missing/ambiguous/attention, explanation, origin manual/rule. AI origin/run FK added only with AI module. Immutable; composite version/subject FK |
| clarification_questions | id, offer_version_id, worker_id, finding_id nullable, supersedes_question_id nullable, text, origin. Immutable from creation; edit means new row. Finding and successor references stay on same offer version/subject |
| question_answers | id, question_id, offer_version_id, author_id, text, supersedes_answer_id nullable, attribution worker_recorded/counterpart. Immutable; successor stays on exact question; recorded answer never impersonates employer |
| agreements | id, worker_id, company_id, current_version_id, effective_version_id nullable; root lifecycle open/ended. No duplicate root draft/proposed/confirmed state |
| agreement_versions | id, agreement_id, worker_id, company_id, sequence, previous_version_id, source_offer_version_id; representative_id, authority_decision_id; terms, unresolved_items, answer_refs, shared_question_ids, schema_version, content_hash; workflow_state draft/proposed/confirmed/declined/superseded/withdrawn. Payload immutable; only guarded state/timestamps mutable. UQ(agreement_id,id), UQ(agreement_id,sequence), UQ(id,worker_id,company_id,representative_id,authority_decision_id) |
| agreement_confirmations | id, agreement_version_id, participant_role worker/employer, actor_id, authority_decision_id nullable only for worker, content_hash, unresolved_set_hash, acknowledged_item_ids, decision confirm/decline, confirmed_at. UQ(version,participant_role); actor matches frozen participant, employer authority FK equals version's decision. Immutable |
| work_records | id, worker_id, company_id, agreement_id, current_version_id; root fields. P0A requires an agreed context; unrelated self-reported work is future |
| work_record_versions | id, work_record_id, worker_id, company_id, sequence, previous_version_id, agreement_version_id, representative_id, authority_decision_id; role, period, hours, tasks with stable IDs, approved_skill_map, content_hash; workflow_state draft/submitted/confirmed/rejected/superseded/withdrawn. Payload immutable from creation. UQ(root,id), UQ(root,sequence), UQ(id,worker_id,company_id,representative_id,authority_decision_id) |
| work_confirmations | id, work_record_version_id UNIQUE, worker_id, company_id, representative_id, authority_decision_id; decision confirm/dispute, content_hash, decision_at, reason. UQ(id,worker_id,company_id,representative_id,authority_decision_id); composite FK binds all actor/subject/authority fields to work version; representative≠worker. One authoritative counterpart decision per version |
| skill_evidence | id, worker_id, kind work (challenge added with Prove), origin_key UNIQUE, work_confirmation_id, previous_evidence_id nullable, basis_group_key, occurred_at, mapping_policy_version, lifecycle active/withdrawn, withdrawal_reason. UQ(id,worker_id,kind,work_confirmation_id). Basis/payload immutable |
| evidence_skills | (evidence_id,skill_id) PK; subject_id, task_refs (criterion_refs with Prove), mapping_policy_version. Frozen at issuance; composite subject FK; guard validates mapping against exact immutable basis |
| work_verification_assertions | id, evidence_id, worker_id, kind CHECK work, work_confirmation_id, company_id, verifier_id, authority_decision_id, policy_version, issued_at, expires_at, revoked_at/reason. Composite FK to evidence binds kind/subject/basis; composite FK to work confirmation binds subject/company/verifier/authority. Partial UQ(evidence_id,policy_version) WHERE revoked_at IS NULL. No ambiguous confirmation FK or process verifier |
| trust_cases | id; agreement_version_id OR work_record_version_id OR authority_decision_id, exactly one typed target (evaluation target added with Prove); opened_by, reason, opened_at, resolved_at nullable. One unresolved case per target using partial UQ. Immutable target/reason; guarded closure only |
| review_assignments | id, case_id (or submission_id with Prove, XOR), reviewer_id, assigned_by, reason, conflict_declaration, policy_version, accepted_by/accepted_at nullable, expires_at, revoked_at. Immutable target/actor; one assigned-reviewer acceptance or refusal, then revocation only; content access requires accepted_at |
| trust_case_resolutions | id, case_id UNIQUE, assignment_id, resolver_id, outcome dismiss/uphold/correction_required, rationale, resolved_at. Immutable; eligible independently assigned reviewer. Closure never rewrites confirmations or un-revokes assertions |
| work_passports | id, worker_id UNIQUE, title; root fields |
| work_passport_items | id, passport_id, worker_id, evidence_id, disclosure_summary, added_at, removed_at; UQ(passport_id,id), partial UQ(passport_id,evidence_id) WHERE removed_at IS NULL; evidence subject matches owner. Summary immutable; changing it removes old selection and creates a new item ID requiring new grants |
| passport_field_registry | (projection_version,evidence_kind,field_code) PK, value_type. Immutable deployment-curated rows; exact codes in §7 |
| passport_item_fields | (item_id,projection_version,evidence_kind,field_code) PK; registry FK and item/evidence-kind consistency |
| passport_grants | id, passport_id, worker_id, recipient_id NOT NULL, projection_version, expires_at, revoked_at; UQ(passport_id,id). Frozen scope; named recipient only in P0A |
| passport_grant_items | (grant_id,item_id) PK, passport_id; composite FKs bind both to same passport; immutable |
| passport_grant_fields | (grant_id,item_id,projection_version,evidence_kind,field_code) PK; FKs to grant item and registry; version matches grant; subset of selected item fields |
| audit_logs | id, actor_id or controlled DB actor identity, action, informational target/version IDs, request_id, db_time, changed_field_names, reason_code, retention_class. Immutable; no raw employment content |
| command_receipts | (actor_id,command,idempotency_key) PK; request_hash, result_ids, response_code, expires_at. Immutable; reauthorize replay |
| rate_limit_buckets | (subject_hash,operation,window_start) PK, count, expires_at. Shared atomic counters |
| privacy_requests | id, subject_id, kind export/delete, state, requested_at, handled_by, completed_at, retention_case_reference. Scoped tracked workflow |

Authority is active only when decision=approve, effective_at≤DB time, not expired, membership.current_decision_id equals that decision, and subject/company are active. Approval/revocation appends a decision and moves pointer under membership lock; reason and assurance are durable. A reapproval never overwrites the historical basis. Ordinary departure blocks future access/actions but does not invalidate historically truthful confirmations. A fraud case on authority immediately suppresses all derived badges through live eligibility joins; uphold revokes affected assertions, dismissal unblocks only otherwise eligible never-revoked assertions. Demo provisioning is visibly `demo_provisioned`, never legally verified company office.

Historical assertion eligibility uses approval validity **at the DB-stamped confirmation time**, exact typed basis and absence of fraud/case/revocation affecting the assertion; it does not require the confirmer to remain a current employee. New actions/access require current authority. Approval effective_at is assigned DB time (no backdating); expiry must be later. Retrospective invalidity is expressed by an authority case/revocation of assertions, not rewriting dates. Trust-case appeals create a new case linked by previous_case_id, constrained to the same typed target; no second open case, and previous resolvers are disqualified from the appeal.

## 3. Optional immutable challenge chain (P0B-Prove or P1)

| Table | Contract |
|---|---|
| challenge_templates | id, current_version_id, root lifecycle; retirement controlled |
| challenge_versions | id, template_id, sequence, previous_version_id, immutable brief/rubric schema/hash, assistance_policy/version, allowed_resources, exposure label, published_at; UQ(template,id), UQ(template,sequence) |
| challenge_attempts | id, worker_id, template_id, challenge_version_id, prior_attempt_id, draft_text, started_at, submission_id nullable, revision, deleted_at; prior attempt same subject/template; editable before submission only |
| challenge_submissions | id, attempt_id UNIQUE, worker_id, challenge_version_id, canonical_response, response_hash, normalization_version, rubric_hash, assistance_policy_version, authorship_attestation, declared_assistance, allowed_resources_snapshot, identity_assurance, submitted_at; UQ(attempt,id), UQ(id,worker_id,response_hash). Immutable; retakes create attempts |
| challenge_evaluations | id, submission_id, worker_id, submission_hash, assignment_id, reviewer_id, sequence, supersedes_evaluation_id, criterion_results, decision supported/insufficient/needs_review, policy_version. Composite FK to submission includes subject/hash; supersedes same submission; UQ(submission,id), UQ(submission,sequence), UQ(id,worker_id,reviewer_id). Human evaluations only |
| challenge_verification_assertions | id, evidence_id, worker_id, kind CHECK challenge, challenge_evaluation_id, verifier_id, policy_version, issued_at, expires_at, revoked_at/reason. Composite FK to evidence binds kind/subject/evaluation; typed evaluation FK binds reviewer/subject. Same unrevoked uniqueness as work assertion |

On admission add challenge_evaluation_id to evidence with exact XOR(work_confirmation_id,challenge_evaluation_id) and kind CHECK; add matching composite UQs, typed case target and assignment submission target. Submission validates/copies hashes of exact published version. Evaluation cannot target draft_text. Assistance declaration, timing, identity assurance, task exposure and integrity concerns accompany evidence; no covert monitoring. Retired/leaked tasks cannot start new attempts; already observed conditions remain visible. AI drafts, if later built, use a separate typed draft table, never human evaluations.

## 4. Optional consent and AI relations (P0B-AI or P1)

| Table | Contract |
|---|---|
| processing_consents | id, subject_id, purpose offer_analysis_external, provider_id, provider_config_digest, region_scope, policy_version, disclosure_digest, ui_version, granted_at, revoked_at. Immutable scope; terminal revocation; explicit action separate from registration/storage |
| ai_runs | id, subject_id, operation, consent_id, status queued/running/succeeded/failed/cancelled, attempt_no, claimed_by, lease_hash, lease_until, next_attempt_at, execution timestamps, prompt_digest, schema_version, normalization_version, validation_policy_version, model/provider digest, input_hash, safe usage/error metadata. No polymorphic input-ID bag |
| offer_ai_inputs | run_id PK/FK, offer_version_id, subject_id, consent_id; composite FKs tie subject/run/offer/consent. Deferred trigger requires exactly one input row for offer.extract_analyze at commit |
| offer_analyses | id, run_id UNIQUE, offer_version_id, subject_id, result/schema; typed composite FK to offer_ai_inputs; immutable. AI findings reference this exact run/version |

Enqueue, claim, retry and dispatch require active exact-purpose/provider/region consent. Revocation locks consent, cancels queued/running jobs and prevents new leases/results. Completion checks consent, active subject, typed input, lease ownership/expiry/hash and validated result. Already transmitted provider requests may continue; late results after revocation are discarded. Earlier completed results remain private until retention/deletion processing. New consent does not restart old jobs. See AI_SYSTEM for dispatch race handling and disclosure.

## 5. Complete pointer and state invariants

Every version family requires UQ(parent,id), UQ(parent,sequence), composite current/previous/supersedes FKs. Previous sequence must be smaller, checked by guard trigger, preventing cycles. Deferred constraint triggers validate pointers and legal state at COMMIT. A populated active root cannot commit a null current pointer. No owner/company drift across children.

| Aggregate | Pointer and state authority |
|---|---|
| Membership | current/previous decision use company+subject+id; latest decision controls computed authority |
| Offers | current/previous bound to offer; latest sequence current; root only open/archived |
| Agreements | current/effective/previous bound to agreement; state resides on version. Effective points to most recent dual-confirmed version, retained during pending amendment; moving effective marks old version superseded atomically |
| Work | current/previous bound to work record; state on version only; selected confirmed agreement has same subject/company/frozen representative/authority |
| Prove | challenge version parent matches template; attempt version same template; prior attempt same subject/template; submission pointer same attempt; evaluation supersession same submission |
| Questions/answers | Question successor same source offer version; answer successor same question; agreement answer refs must match source version/subject |
| Evidence | Replacement same subject/kind/basis group; old evidence withdrawn; no grant inheritance |
| Passport | Item/grant/field composite FKs bind same passport, subject, kind and registry version |

P0A fixes representative within an agreement. A different representative requires a new agreement and fresh confirmations; withdraw the old pending work record and create a new work record under the new agreement. Do not move a work root's agreement_id or transfer confirmations/evidence. Reapproval of the same person permits a new version within the same agreement and a corrected work version under that new authority basis. Work submission uses an effective confirmed version; later amendments do not rewrite historical submitted work. Pending amendment never removes the prior effective pointer. Open agreement cases block new work confirmation and suppress derived verification until resolution.

| Command / actor | Precondition | Authoritative transition and atomic effects |
|---|---|---|
| decide_membership / authority operator | independent active capability, expected membership revision | append approve/revoke decision, move pointer, audit/receipt |
| append_offer / owner | current revision/version | immutable version + deterministic diff, current pointer, audit |
| create_question/answer / owner or scoped counterpart | exact shared source/question for counterpart | append only; never modify terms |
| propose_agreement / worker | current draft, valid complete terms/unresolved schema, active frozen authority | draft→proposed; exact hash and shared question set fixed |
| decide_agreement / frozen participant | current proposed, exact content/unresolved set, no prior role decision, current authority | append unique role decision; any decline→declined; two confirms→confirmed and move effective/supersede prior; no reused acceptance |
| amend_agreement / worker | agreement open, expected current | append draft/current; old pending proposal superseded; old effective unchanged |
| submit_work / worker | current draft, valid agreed context and exact active authority, no blocking case | draft→submitted; explicit counterpart sharing |
| decide_work / frozen counterpart | current submitted, actor≠subject, exact authority still current, no decision/case | one decision; confirm→confirmed + issue_work_evidence; dispute→rejected + typed case; audit/receipt |
| correct_work / worker | expected current, same work period/root | append new draft/current; old→superseded; withdraw old evidence/revoke assertions. New period is new root |
| submit_challenge / subject | editable attempt, eligible published task, attestations | append immutable submission; set pointer, lock draft |
| evaluate_submission / assigned independent reviewer | exact response/rubric/hash, valid mapping | append evaluation; eligible result issues challenge evidence; corrected evaluation withdraws old evidence/assertions |
| open_case / scoped participant/operator | authorized typed target, no open case | append case; live eligibility immediately false for target/descendants; no confirmation edits |
| resolve_case / independent reviewer | active assignment, unresolved case | append one resolution; dismiss removes block only; uphold/correction_required revokes affected assertions/withdraws evidence. Never un-revoke |
| revoke_assertion / owner withdrawal or scoped reviewer | typed authorized basis/reason | terminal revoked_at, audit; replacement needs fresh eligible basis |
| select/share/revoke / passport owner | valid owned items/fields/recipient/revision | validated selection/grant; revocation terminal; no automatic widening |
| delete/withdraw / owner/privacy operator | scoped request and retention case | disable/tombstone, revoke shares, suppress evidence, cancel AI; later erasure separate |

All omitted transitions fail. End/withdraw commands are owner-controlled on roots, disallow new proposals/submissions, retain historical decisions, and audit; they never retroactively declare work false. A declined/rejected decision cannot change to confirm: create a new version. Account/authority/case eligibility is checked on every read as well as command.

Transaction order: validate identity → lock subject/account, membership, agreement, work, evidence/case/passport in that fixed order (sort same-type IDs) → compare expected version/revision → recheck relationships and policy → guarded mutations → audit + receipt → commit. Revocation, case creation, deletion and confirmation use intersecting locks. Retry serialization/deadlock failures boundedly using idempotency. No authorization solely before a transaction.

`issue_work_evidence` is internal to decide_work, not client-callable: derive subject, actual task/skill map, confirming actor, exact authority and policy; check confirm decision/no blocking case; insert unique `work:<confirmation-id>:<mapping-policy>`, evidence_skills and typed work assertion; audit/receipt in same transaction. `issue_challenge_evidence` derives from eligible human evaluation/frozen submission/rubric. Neither accepts arbitrary trusted skills/verifier/status. Evidence mappings never UPDATE. Replacement withdraws/revokes old chain and creates new chain atomically. Notifications are post-commit and out of P0.

## 6. SQL roles, grants and complete RLS contract

### Role ownership and default denial

`fw_schema_owner` is NOLOGIN, used for migrations only. ENABLE and FORCE RLS on every private table. anon, authenticated, service_role, PUBLIC and worker login roles have **no private schema/table/sequence grants**. Only api is exposed through PostgREST. Client roles get api USAGE and the exact EXECUTE list in API §3–5. Revoke default PUBLIC EXECUTE and inherited/default grants for every migration owner. No service-role key is used by web, workers or operators.

The offline infrastructure/migration identity can administer DDL and bootstrap capability rows; it is explicitly outside the runtime RLS threat boundary. Do not attempt bootstrap as a constrained runtime executor or claim FORCE RLS constrains the infrastructure administrator. Schema ownership/DDL access is never delegated to runtime identities.

RPCs use SECURITY DEFINER, fixed empty search_path, qualified objects, no dynamic SQL and fixed minimal DTOs. Separate function owners are NOLOGIN NOBYPASSRLS, not table owners: `fw_user_exec`, `fw_authority_exec`, `fw_review_exec`, `fw_ai_exec`, `fw_privacy_exec`, `fw_projection_exec`, `fw_policy_exec`. No browser/login role may SET ROLE into them. Each has only table/column verbs below. All runtime paths therefore still encounter RLS. No exposed views in P0A. Private active-membership view uses security_invoker=true and only underlying executor access; future views require the same review.

Grants and policies are separate checks ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)); function owner/search-path/EXECUTE behavior follows [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html). These references support mechanisms, not proof the proposed policies already work.

### Predicates used by policies

U=auth.uid() from validated JWT; never user metadata. A=U nonnull and active profile. O=row subject/worker=U plus A and active roots. R=U is version's frozen representative, exact current active authority equals version decision, and version explicitly proposed/submitted. C(cap)=A + protected unexpired capability + JWT aal2. V= C(reviewer) + current independent assignment to exact case/submission + accepted conflict declaration. S=active grant/owner/root, U=recipient (owner for preview only), same-passport item, valid registry/selection/grant field intersection.

For child/case rows, O/R/V derive through their typed parent FK, never an informational audit target or arbitrary JSON ID. Work-evidence INSERT predicate is A plus a matching eligible work_confirmation whose representative_id=U and whose complete subject/company/authority tuple matches the new evidence/assertion; it is **not** owner-only O, since the legitimate confirmer differs from the worker. Review issuance similarly requires V on the exact evaluation/submission and checks resulting subject/skill map. The profile bootstrap INSERT exception uses a valid nonanonymous auth UID equal to new.id, no preexisting profile and DB-fixed active defaults; A cannot require a profile that has not yet been created.

Policy helpers owned by fw_policy_exec read only profile identity/state, capability scope/expiry, company tombstone, membership pointer/decision validity, assignment actor/target/conflict fields. Helper-role SELECT policies allow nonnull authenticated U over those limited columns; no writes and no returned private rows. Helpers return booleans/validated authority IDs only; EXECUTE granted only to executor roles. Those helper policies do not call A/C or themselves, avoiding recursive RLS. Nested definer functions retain auth.uid. Custom worker authentication uses allowlisted session_user, not caller-set JWT claims.

For descendant/root and sharing predicates, also grant fw_policy_exec **metadata columns only** on offers/agreements/work_records/work_passports (id,subject/company,current/effective IDs,deleted_at), work_passport_items and selection/grant tables (IDs,subject/recipient,registry codes,expiry/removal/revocation), evidence/assertions (IDs,subject,basis,lifecycle/expiry/revocation), and cases/resolutions (typed target and open/closed outcome). No terms, raw text, disclosure summaries, reasons or answers. A helper-owned `can_project_row(row_id,kind)` evaluates whether at least one live owner/recipient grant authorizes that row; same U-only, nonrecursive metadata policy applies inside helper. The projection body further restricts to the **requested grant** and its exact fields. Never implement S by querying the same protected grant table under fw_projection_exec and recursively invoking S. This helper grant is an explicit SELECT-only exception to the executor matrix, not client access. Executors receive private schema USAGE for their listed objects; helpers/internal issuance get EXECUTE only for their calling executor family.

### Per-table policy/privilege matrix

**For every table below, direct anon/authenticated/service_role/PUBLIC/worker-login SELECT, INSERT, UPDATE, DELETE is DENY.** Matrix entries apply only to the named NOLOGIN executor behind a bounded RPC. Unlisted verbs are DENY. I uses WITH CHECK; U uses USING(old) AND WITH CHECK(new), column grants and immutable-key guards. D is explicitly listed only where allowed. This fixes raw-table versus DTO ambiguity.

| Table(s), each inherits row | Executor SELECT | Executor INSERT/UPDATE/DELETE | Required deny tests |
|---|---|---|---|
| profiles | user: own id+A; policy helper columns | user I own bootstrap; U own display fields; privacy account-disable only | B's profile, forged account state |
| capability_assignments | policy metadata; authority/review own relevant capability metadata | offline bootstrap only grants; privacy U revocation during disable; no public grant RPC | JWT admin/self-grant, changed scope |
| companies | user A: provisioned id/name/assurance only; authority C(authority_operator); policy metadata | authority I/U scoped company metadata under C | Creating company grants no membership |
| company_memberships, company_membership_decisions | policy validity metadata; authority C; user own/scoped counterpart metadata | authority I decision + I/U membership pointer under C and independence; decision U/D denied | Edit approval, cross-company pointer |
| skills | user A catalog | offline catalog migration only | Broaden existing evidence skill |
| profile_skills | user O | user I/U/D O, valid skill | Worker B write |
| offers, offer_versions, offer_findings | user O; AI only leased typed input (below) | user I O; root U current/lifecycle; versions/findings U/D denied; AI I grounded findings on completion | Employer raw read, fake AI finding |
| clarification_questions, question_answers | user O or R + explicit shared question/source match | user I own question; answers I O/R with derived author; U/D denied | Unshared question, edit after answer |
| agreements, agreement_versions, agreement_confirmations | user O/R; review V scoped case | user I O, confirmations exact participant; root U pointers/end; version U workflow only; confirmation U/D denied | Wrong actor/hash, pointer crossing |
| work_records, work_record_versions, work_confirmations | user O/R; review V scoped case | user I O; confirmation I R; root U pointer/lifecycle; version U workflow only; confirmation U/D denied | Self-confirm, two decisions, stale authority |
| skill_evidence, evidence_skills, work_verification_assertions | user O; projection S fixed fields; review V; AI none | user I internal work issuance; review I eligible replacement; user/review U withdrawal/revocation only; mapping U/D denied | Forged skill/basis, un-revoke |
| trust_cases, trust_case_resolutions | user O/R safe case DTO; review V basis or C(review_operator) minimal assignment-target metadata; authority scoped authority case | user I O/R case; authority I authority case under C; review I resolution V; case U resolved_at only | Second open case, conflicted resolution |
| review_assignments | review C(review_operator) or assigned reviewer metadata; policy helper | review I/revoke under C(review_operator); assigned reviewer U one acceptance/conflict declaration or refusal, no target edit | Self-assignment, wrong target |
| work_passports, work_passport_items, passport_item_fields | user O; projection S limited fields | user I/U root O; item U removed_at only; selection I/D O | Wrong owner/evidence, changed shared summary |
| passport_field_registry | user/projection A fixed fields | deployment-curated only | Wildcard/unknown field/version |
| passport_grants, passport_grant_items, passport_grant_fields | user O; projection S | user I O + validated scope; grant U revoked_at only; child U/D denied | Cross-passport, expired/wrong recipient |
| audit_logs | user safe own summaries; authority/review scoped action metadata; privacy case scoped | each executor I own operation-derived actor/DB time only; U/D denied | Actor spoof, raw content, audit edit |
| command_receipts | each executor own actor+command family | each I own command; privacy D expired only | Replay after authorization revoked |
| rate_limit_buckets | executor derived operation key only | atomic I/U own key; privacy D expired | Direct RPC bypass of quota |
| privacy_requests | user O; privacy C(privacy_operator) scoped request | user I own; privacy U handling state | Arbitrary user export/purge |
| challenge_templates, challenge_versions (Prove) | user A published; review C(review_operator) | review I publish; template U pointer/retire; version U/D denied | Change published rubric |
| challenge_attempts, challenge_submissions (Prove) | user O; review V(submission) | user I O; attempt U draft/pointer only; submission U/D denied | Post-submit edit/hash swap |
| challenge_evaluations, challenge_verification_assertions (Prove) | user O; review V; projection S assertion only | review I eligible human decision/issuance; assertion U revoke; evaluation U/D denied | Own/employer review, wrong submission |
| processing_consents (AI) | user O; AI leased-run consent metadata | user I explicit own consent, U terminal revocation only | Storage permission used as consent |
| ai_runs, offer_ai_inputs, offer_analyses (AI) | user O safe DTO; AI lease-scoped input | user I enqueue, U own cancel; AI U lease/state, I validated result; input/result U/D denied | Unleased offer, late lease, revoked consent |

Additional retention exception: privacy executor can SELECT/delete/redact table rows only within a registered authorized privacy case for that subject and approved retention closure. Its restrictive RLS requires that scope; it has no generic table-read/SQL endpoint. Immutable guards require this executor plus case and prior dependent withdrawal/audit. Do not grant unrestricted privacy DELETE merely because a table appears in this matrix.

Implementation must expand each table group into named policies per role/verb (not one broad ALL policy). For UPDATE use both USING(old-row predicate) and WITH CHECK(new-row predicate), with protected-column grants/guards so ownership cannot move. For immutable INSERT parents, repeated-row UQs and exact composite FKs are required even if RLS permits the owner. Tests assert expected catalog policy names/commands and the absence of extra permissive policies; policy OR-composition must not silently widen access. Definer creation and revocation of default EXECUTE occur in the same migration transaction, avoiding a briefly exposed function.

Optional worker `fw_ai_worker` is a database LOGIN with EXECUTE only on ops.claim_offer_run/dispatch_offer_run/complete_offer_run/fail_offer_run. Owner fw_ai_exec may claim eligible consented jobs; input RLS joins typed input→run where claimed_by=session_user and live lease/consent; completion checks returned random lease secret hash. No authority, review, assertion or arbitrary offer read rights. All quotas also run inside RPCs: direct Supabase access cannot bypass Next.js rate limits.

## 7. Passport and Work DNA projections

Registry passport.v1 work fields exactly: skill_label, evidence_kind, observation_date, task_summary, confirmation_method, authority_assurance, verification_status. Prove's versioned registry adds challenge_title, criterion_summary, assessment_conditions. No wildcard, arbitrary JSONPath, salary, contact, dispute reason, raw source or attachment. task_summary comes from explicit bounded owner disclosure_summary, not raw work text; preview requires inspection. Registry values use fixed constructors; no to_jsonb(source-row) fallback.

`api.passport_projection(grant_id,mode)` is the **one** database-backed function for owner preview and recipient reads, owned by fw_projection_exec. Mode changes authorized caller only. It intersects grant items, current item fields, grant fields, exact registry version and eligible evidence/assertions with same-parent FKs. Removed items/fields narrow old grants; new selections never widen them. Changed shared summaries require new grant/selection, not retroactive substitution. Disputed/withdrawn/revoked material is excluded from shared projection and labeled privately. New database/DTO columns never become output automatically. Golden tests prove that by adding synthetic secret fields. No-store on all responses.

`dna.v1` returns individual observations with scope, task/criterion, date, assurance, status and rules_version. Supported count requires active evidence, eligible typed confirmed/human-reviewed basis, unrevoked/unexpired assertion, active owner/root and no open case on basis/agreement/authority. Group work by work_record_id, challenge by template_id; repeated versions/attempts do not increase independent breadth. Conflicts remain visible individually; no averaging unrelated rubrics. Age is displayed; no universal expiry threshold is invented. Declared/unknown/disputed/revoked/withdrawn evidence does not count as verified. Recipient summaries count only granted evidence, never private global totals.

## 8. Supabase Storage policy contract

P0A/P0B are text-only. Create no FAIRWORK user buckets or storage.objects allow policies; no upload/download/signing endpoints. Assert no public FAIRWORK bucket and deny anon/authenticated list/get/insert/update/delete on attempted FAIRWORK object paths. Approved design assets remain public application assets, not employment uploads. Do not change Supabase's internal storage schema ownership.

Before P2, introduce typed upload_reservations(owner, exact immutable bucket/key, parent/subject, state reserved/quarantine/ready/rejected/deleted, expiry, size/hash/scan result). `fw-quarantine` and `fw-private` are private buckets. Anon all verbs deny. Authenticated quarantine INSERT only for exact owned active unexpired reservation/key with no existing object; quarantine SELECT/UPDATE/DELETE deny. Private SELECT only owner + ready reservation + active parent; private INSERT/UPDATE/DELETE deny. No upsert, broad prefix-only permission or public list. Isolated scanning/retention services verify content before promotion; cannot issue verification. Passport/employer attachments remain disabled pending a separate grant design. Test object APIs and signing paths, path spoofing, MIME/size, owner revocation and overwrite. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) is a separate policy surface.

## 9. Lifecycle and migrations

Every table in §§2–4 belongs to a class below. All creation times are DB-generated; workflow updates also set updated_at. FKs default RESTRICT. No active-root access after deletion; no retained trust claim without retained verifiable basis.

| Tables / class | Mutability and retention |
|---|---|
| profiles, companies, offers, agreements, work_records, work_passports, challenge_templates, challenge_attempts | Root lifecycle: revision/updated_at/deleted_at; privacy operator handles approved deletion; disable/grants/evidence/jobs first |
| company_membership_decisions, offer_versions, offer_findings, clarification_questions, question_answers, agreement_versions, agreement_confirmations, work_record_versions, work_confirmations, evidence_skills, challenge_versions, challenge_submissions, challenge_evaluations, trust_case_resolutions | Immutable payload; only explicit version workflow state/timestamps mutable. Retain with related trust record + approved dispute period; privacy erasure in dependency order, invalidate evidence first |
| capability_assignments, company_memberships, skill_evidence, work_verification_assertions, challenge_verification_assertions, trust_cases, review_assignments, work_passport_items, passport_grants, processing_consents | Controlled lifecycle only: pointers, withdrawal, expiry/revoke, case closure. Protected domain operators; no general delete API; privacy purge after retention review |
| skills, passport_field_registry | Versioned catalog; restricted while referenced; deployment curator |
| profile_skills, passport_item_fields | Owner selection insert/delete; never deletes underlying evidence |
| passport_grant_items, passport_grant_fields | Frozen scopes; privacy purge after grant expiry/revocation retention |
| ai_runs, offer_ai_inputs, offer_analyses | Run lease/state mutable; input/result immutable; privacy owner. Proposed 30-day run metadata only if no retained result/reference needs it |
| audit_logs | Append-only; trust transitions retained for record/assertion life + approved dispute period. Security-only logs proposed 90 days, operational request logs 14 days; compensating events, no edits |
| command_receipts, rate_limit_buckets, privacy_requests | Receipts 24h; expired counters purged; privacy requests retained through fulfillment/dispute policy; only allowed state updates |

Actor erasure removes contact/display data and disables accounts; keep pseudonymous profile IDs only where justified shared history needs FK integrity. Physical auth-user deletion follows explicit unlink/redaction or approved retention completion; UUID pseudonymization is not automatically irreversible anonymization. Real employment data requires signed-off jurisdiction/retention decisions. Synthetic fixture reset and account/export retention follow MVP_PLAN D-10; restore replays deletions/revocations before traffic. Synthetic actors must remain labeled as simulations; different UUIDs do not prove different humans (MVP_PLAN D-05).

Migration order: identity/authority/audit/limits → manual offers/questions → agreements → work/evidence/cases → passport; optional modules only in a separately approved post-competition change. Each migration includes RLS/grants/RPC EXECUTE, immutable guards, constraints, indexes and direct-role allow/deny tests. No SQL is executed in Stage 1.

Indexes: all PK/UQs and FK policy joins; owner lists(worker_id,created_at,id); authority(company_id,subject_id,sequence); assertion(evidence_id) partial revoked_at IS NULL; one-open-case partial indexes per typed target; grants(recipient_id,expires_at); reviewer(reviewer_id,expires_at); optional AI(status,next_attempt_at,lease_until). Review EXPLAIN on representative bounded datasets for owner lists, authority, assertions, shares and queue; intentional small-table scans acceptable, unbounded nested scans are not. Never bypass RLS to improve a plan.

Migration acceptance: all private relations RLS+FORCE; zero raw client grants; no PUBLIC EXECUTE/default leak; no unexpected views/buckets/BYPASSRLS/runtime ownership; authorized RPC succeeds; wrong actor/subject/parent fails; all illegal state transitions fail; immutable skill mapping, revoked consent, stale lease and role-separation tests. This is a future acceptance contract, not a claim of passing runtime tests.

## 10. Future model preserved without P0 tables

P1: skill_categories (add nullable skills.category_id at the same migration); source_snapshots with immutable source-kind/privacy constraints; company_signals linked to claim-specific support; jobs/job_versions/job_requirements/job_sources; recommendations with exact requirement/evidence snapshot and rules version; notifications recipient-owned. Source states/confidence and private-to-public prohibition follow AI_SYSTEM §6. Public source kinds require owner NULL plus approved publisher/usage policy; private user/internal kinds require owner NOT NULL and private visibility. PostgreSQL CHECK constraints enforce that partition. Provenance remains immutable; conflicting claims coexist.

Job versions use same-parent version FKs and immutable requirement snapshot/hash; saved matches reference exact version, not a changing job root. No separate competing job_matches scoring table; company_sources is derived through signals until unattached sources need an explicit join. P2 adds typed upload reservations/scan states, employer_feedback bound to exact work version with response/dispute, and automated privacy fulfillment. P3 adds curated versioned career_paths, public API scopes and additional verification categories only with separate assurance policy/typed basis. No general-purpose polymorphic assertion table is reintroduced.
