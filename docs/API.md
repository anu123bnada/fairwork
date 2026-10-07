# FAIRWORK 2.0 — API and RPC contract

Revision: FAIRWORK-ARCH-1.0.0, 2026-10-07. [Approved baseline](ARCHITECTURE_BASELINE.md); [Stage 1 approval](STAGE1_APPROVAL.md). No endpoint/function exists. P0A is mandatory; P0B-AI/Prove contracts below are P1 references, excluded from the approved solo competition baseline. Their routes/functions/EXECUTE grants are absent in P0A. P0A operator and privacy commands may use a minimal authenticated operator surface; no management dashboard is required (MVP_PLAN §1). Database §6 is authoritative for grants/RLS; Database §5 for transitions. P1+ endpoints are not built during the 14 days.

## 1. Boundary and conventions

Use same-origin `/api/v1` Next.js handlers and a shared domain layer. Read/write RPCs use the caller's validated Supabase JWT; all raw private table access is denied even to authenticated clients. There are no public domain views. RPCs enforce authorization and quotas themselves, because a client can call the exposed Supabase API without Next.js. A hidden URL, server action or UUID is not an access control.

Validate Supabase session identity with supported SDK verification, active account, protected capability/membership and resource relationship. Never accept owner/actor/verifier/role/status/timestamp fields as authority. IDs selecting counterparts or resources are merely references and must resolve against protected rows. Reject extra keys. Same-origin cookie mutations require Origin/CSRF protection; safe cookies, allowed redirects, no wildcard credentialed CORS. Server components and preview routes use the same authorization service.

Success `{data,meta:{requestId,schemaVersion,nextCursor?}}`; failure `{error:{code,message,fieldErrors?},meta:{requestId}}`. No SQL/provider internals or private existence leakage. UUIDs, ISO UTC dates, decimal-string money/currency/period. Default list 20/max50 with stable created_at,id cursor. Sensitive responses `Cache-Control: private, no-store`, excluded from Next.js/CDN shared caches.

## 2. Validation, concurrency and errors

Every mutating aggregate command accepts expectedRevision and expectedVersionId when a version exists. Conflicting pointers/state return 409; never retry by silently substituting the latest version. Commands with durable effects require Idempotency-Key, scoped by actor and command, with request hash. Same key/different body fails; same key/same body reauthorizes and returns original IDs. Receipts expire after 24h; domain UQs preserve long-term uniqueness. No sensitive cached response body.

Database transactions use Database §5 lock order, validate exact typed FKs/authority/consent, append immutable payloads, move guarded projections, and insert audit/receipt atomically. Client-supplied hashes are compared to DB-computed hashes, not trusted. RPC body, RLS and constraints all enforce their respective boundaries.

| HTTP | Codes / handling |
|---|---|
| 400 | INVALID_JSON/INVALID_CURSOR; malformed input |
| 401 | AUTH_REQUIRED/SESSION_EXPIRED |
| 403 | ACTION_FORBIDDEN/MFA_REQUIRED; accessible target, forbidden action |
| 404 | NOT_FOUND for missing or inaccessible target |
| 409 | VERSION_CONFLICT/INVALID_TRANSITION/IDEMPOTENCY_CONFLICT/AUTHORITY_CHANGED/CONSENT_REVOKED |
| 413/415 | PAYLOAD_TOO_LARGE/UNSUPPORTED_MEDIA_TYPE |
| 422 | VALIDATION_FAILED/UNRESOLVED_SET_MISMATCH/CONSENT_REQUIRED |
| 429 | RATE_LIMITED/AI_BUDGET_EXCEEDED, Retry-After |
| 503/500 | SERVICE_UNAVAILABLE/INTERNAL_ERROR with safe request ID |

Limits initially: reads 120/min/user, writes30/min, share creation10/hour, shared reads60/min/recipient. Text offers20,000 characters; body64KB. Supabase auth uses provider throttles plus destination/IP abuse controls and no account-existence disclosure. Quotas are database atomic, not process-memory only. AI has separate optional budget controls.

## 3. P0A public RPC allowlist and HTTP mapping

Every RPC below resides in api. `authenticated` gets EXECUTE only for the listed exact signatures, with function body checks; anon/PUBLIC/service_role/worker logins get none. Function owner defaults fw_user_exec except projection and privileged families in §4. No raw DML privileges. Functions use fixed DTOs and search_path, no generic arbitrary resource query/update. Supabase Auth is separate from this domain allowlist.

Signature convention for this inventory: every api entry is `api.<listed_name>(request jsonb) RETURNS jsonb`; request has a distinct strict schema per function (reads without parameters take `{}`). ops AI entries use the same single JSON argument convention with lease/run fields, but different role grants. Thus grants name `(jsonb)` explicitly and no overload inherits permission. This is a transport convention, not a generic command dispatcher: no operation/table name in the body. DB checks reject extra fields and enforce typed UUID/numeric/enumeration casts. Internal helper/issuance functions are separately typed and not exposed.

| HTTP route | RPC | Input/output and authorization |
|---|---|---|
| POST /me; GET /me; PATCH /me | create_profile; get_me; update_profile | Bootstrap exact authenticated nonanonymous UID once, DB-fixed defaults; reads never create rows; own displayName/locale/timeZone/revision allowlist |
| GET /skills; PUT /me/skills | list_skills; set_declared_skills | Fixed taxonomy and own declarations; no evidence score |
| GET /me/work-dna | get_work_dna | Own dna.v1 observation groups with rulesVersion and limitations |
| GET /me/agreements; GET /me/work-records | list_my_agreements; list_my_work_records | Explicit owner/eligible counterpart rows, safe paginated DTO |
| POST /offers | create_offer | text/companyRef? → root+immutable v1; owner derived |
| GET /offers/{id}; GET /offers/{id}/versions | get_offer; list_offer_versions | Owner only; no employer raw source access |
| POST /offers/{id}/versions | append_offer | text, typed manual terms, expected state → version/diff; unknown changed terms material by default |
| POST /offers/{id}/findings | create_manual_finding | version/field/kind/text → attributed manual finding; no AI origin accepted |
| GET /offers/{id}/questions | list_questions | Owner, or exact proposed source and shared question IDs for counterpart |
| POST /offers/{id}/questions | create_question | exact offer version/finding?/supersedes?/text; immutable; editing creates another question ID |
| POST /questions/{id}/answers | answer_question | exact immutable question/text/supersedes?; derived actor; worker_recorded distinct from counterpart |
| POST /agreements | create_agreement | source version/company/representative/terms/unresolved/answer refs/sharedQuestionIds → draft; owner only, exact approved authority snapshotted |
| POST /agreements/{id}/versions | amend_agreement | terms/unresolved/answer refs/sharedQuestionIds + expected state → draft version; worker only in P0A |
| POST /agreements/{id}/propose | propose_agreement | current version + expectedHash/state → proposed; worker explicitly shares the already frozen question set |
| GET /agreements/{id} | get_agreement | Current proposal plus effective confirmed terms; exact participants only; no raw offer |
| POST /agreements/{id}/confirmations | decide_agreement | version, decision, expectedHash, acknowledgedUnresolvedIds, expected revision → attributed role decision |
| POST /work-records | create_work_record | effective agreement version/role/period/hours/tasks/skill map → immutable draft; worker only |
| POST /work-records/{id}/versions | correct_work_record | corrected payload + expected state → new draft; old evidence withdrawn/assertions revoked atomically |
| POST /work-records/{id}/submit | submit_work | current version/expected state → submitted; exact frozen counterpart/authority validated |
| GET /work-records/{id} | get_work_record | Owner or still-authorized frozen counterpart of explicitly submitted version |
| POST /work-records/{id}/confirmations | decide_work | version, confirm/dispute, expectedHash, reason?, expected state → unique decision; confirm internally issues typed evidence |
| GET /evidence/{id} | get_evidence | Owner private history; assigned reviewer minimal case basis through separate review read |
| POST /work-records/{id}/disputes; POST /agreements/{id}/disputes; POST /evidence/{id}/disputes | open_work_case; open_agreement_case; open_evidence_case | Exact scoped participant; evidence route resolves its typed immutable basis; no arbitrary polymorphic target |
| GET /passport | get_passport | Private owner selection and safe evidence status |
| PUT /passport/items | select_passport_items | own evidence IDs/registry field codes/disclosure summary/revision; reject unknown fields |
| POST /passport/grants | grant_passport | known named recipient, selected items/fields, projectionVersion, expiresAt → frozen grant |
| GET /passport/grants/{id}/preview; GET /shared-passports/{id} | passport_projection | Same function, owner-preview or recipient mode; identical field constructors; owner mode cannot be used by recipient |
| DELETE /passport/grants/{id} | revoke_passport_grant | Owner; terminal idempotent revocation |
| POST /me/export; POST /me/deletion-request | request_export; request_deletion | Reauthenticated owner → tracked request ID, not a promise of automated fulfillment |

Root archive/end/withdraw actions use exact `archive_offer`, `end_agreement`, `withdraw_work`, `withdraw_evidence` RPCs (POST corresponding resource action). Owner only with expected revision; cease new transitions, preserve immutable history; work/evidence withdrawal suppresses dependent badges/shares. No generic delete-table RPC.

Evidence issuance functions issue_work_evidence/issue_challenge_evidence are internal and **not granted to any client role**. Work confirmation is unique on work_record_version_id, not actor/version. Changing representative requires a new agreement and new work record in P0A after withdrawing old pending work; never change the old work root's agreement. Reapproving the same representative requires a new agreement version and corrected pending work version. Prior decisions/evidence are never transferred.

## 4. Privileged human commands and function ownership

These are narrow api functions executable by authenticated JWTs only after C(capability), verified aal2 and independent-actor checks. Normal authenticated users receive 403; table RLS still applies under their NOLOGIN function owners. No admin browsing or arbitrary SQL/body operation.

| HTTP operator route / RPC | Owner | Checks and output |
|---|---|---|
| POST /operator/companies / provision_company | fw_authority_exec | authority_operator; synthetic/approved label, no membership implied |
| POST /operator/membership-decisions / decide_membership | fw_authority_exec | authority_operator, subject≠approver, evidence refs/reason/policy/assurance; append immutable decision; expected membership revision |
| POST /operator/authority-cases / open_authority_case | fw_authority_exec | authority_operator, precise decision/reason; no access to downstream raw offers |
| POST /operator/review-assignments / assign_review | fw_review_exec | review_operator, typed case/submission, independent candidate, conflict declarations, reason/policy; immutable assignment |
| POST /operator/review-assignments/{id}/revoke / revoke_review_assignment | fw_review_exec | review_operator, scoped assignment; future access removed |
| GET /reviews; GET /reviews/{id} / list_review_assignments; get_review_basis | fw_review_exec | Reviewer sees only current assigned target/minimum needed content |
| POST /reviews/{id}/accept / accept_review_assignment | fw_review_exec | Assigned reviewer explicitly declares no conflict; refusal revokes assignment access |
| POST /cases/{id}/resolution / resolve_case | fw_review_exec | Independently assigned reviewer, exact target, decision/rationale; one immutable resolution, atomic lifecycle effects |
| POST /operator/privacy/{requestId}/process / process_privacy_request | fw_privacy_exec | privacy_operator, MFA, registered request/retention case; fixed export/delete workflow, safe receipt; no user-chosen SQL or object paths |

Capability bootstrap is an offline operator/migration procedure with documented named approver, MFA and audit; no public capability-grant RPC. Changing function signature requires a new privilege review. Function owners get only the table/column permissions in Database §6. `passport_projection` alone is owned by fw_projection_exec. Policy helpers belong to fw_policy_exec and are callable only by executor roles; no browser access.

## 5. Optional module commands

### P0B-AI (or P1)

Explicit consent UI names purpose, data categories, provider/region/config, retention/training disclosure, policy version and consequence of refusal. Manual workflow remains usable. No checked-by-default or bundled consent.

| HTTP / RPC | Contract |
|---|---|
| POST /processing-consents / grant_processing_consent | Explicit subject action; server validates displayed disclosure digest/version and configured provider scope; create immutable grant |
| GET /processing-consents / list_processing_consents | Own scope/history; no provider secrets |
| DELETE /processing-consents/{id} / revoke_processing_consent | Own consent; terminal revocation and queued/running cancellation in transaction |
| POST /offers/{id}/analyses / enqueue_offer_analysis | Exact owned version + consentId, active scope, budget, idempotency →202 run reference |
| GET /ai-runs/{id} / get_ai_run | Own safe status/error/result ref; failed is not successful analysis |
| GET /offers/{id}/analyses/{analysisId} / get_offer_analysis | Own exact parent/version and validated result |

These user functions belong to fw_user_exec; no direct worker/table access. AI worker login has EXECUTE only on unexposed ops.claim_offer_run, dispatch_offer_run, complete_offer_run, fail_offer_run (owner fw_ai_exec); worker capabilities are not exposed through a general HTTP admin endpoint. Lease secret must match hash and session_user. No arbitrary input/subject ID read. Completion rechecks consent even if provider work started earlier. Costs:5 starts/hour and20/day/user, global budget, bounded retries.

### P0B-Prove (or P1)

User-owned functions: list_challenges, create_challenge_attempt, update_challenge_draft, submit_challenge, get_challenge_attempt (GET/POST/PATCH `/challenges` and `/challenge-attempts`). Submit takes exact version, authorship/assistance declaration and draft revision; returns immutable submissionId/hash. Draft update after submission fails.

Review functions (fw_review_exec): publish_challenge_version, retire_challenge_version for review_operator; evaluate_submission for accepted independent reviewer. POST `/challenge-submissions/{id}/evaluations` requires submissionId/hash, criterion results and assignmentId; references exact rubric and creates new immutable human evaluation. Corrections create a new evaluation and atomically replace evidence; AI drafts cannot enter this path. Prove tables/functions are absent if admission fails.

## 6. Terms, questions and acknowledgements

Terms schema `agreement-terms.v1` uses stable field IDs: salary.amount/currency/period/basis, hours.amount/period, overtime, payment_schedule, responsibilities, employment_type, location, start/end/duration, benefits, deductions, termination, other_conditions. Every required field has typed value or explicit unresolved entry. Each unresolved entry has stable item_id, field_id, issue_code, source_question_id?, source_finding_id?, explanation. IDs unique; references must match frozen source offer version; hash a canonically sorted unresolved set.

Confirmation hash covers terms, unresolved set, exact source/answer references, representative/authority, schema version and explicitly shared questions. Caller sends expectedHash and **exact acknowledged item ID set**, not a broad boolean. Database checks full set equality; empty set valid only if no unresolved entries. Nothing says unresolved terms are safe or legally sufficient. Answers are append-only attributed observations. A term changed after an answer requires a new agreement version/fresh confirmation, even if formatting classification is nonmaterial.

P0A counterpart/recipient identities are operator-provisioned synthetic accounts mapped to fixture IDs, not a searchable contact directory. Operator verifies each can sign in separately and records demo assurance; user selects only those consented participants. Invitations, public lookup, bearer links, uploads and OCR are post-competition. Storage P0 all-user-object operations deny per Database §8.

## 7. Required acceptance tests

Every route/RPC tests allowed actor and denied worker B/unrelated employer/former representative/unassigned reviewer/anon. Also call exposed RPCs directly with each JWT; test quota enforcement without Next.js and zero raw table/sequence/EXECUTE grants. Test immutable fields, composite child/parent FKs, content/unresolved hash mismatch, duplicate decisions, stale revisions, idempotent retries, case opening versus confirmation, authority revocation, projection unknown fields, private caches, MFA/capability refusal and privacy request scope. Optional modules add consent revocation at enqueue/dispatch/completion and frozen submission/conflicted-review tests. Tests are implementation requirements, not existing results.

## 8. Post-competition boundaries

P1 company/job read DTOs must return claim state unverified/source_supported/contested/reviewed with a separate derived stale flag, explained confidence descriptor, publisher/source URL or reference, retrieval/observation date and exact support. Public projections reject private source kinds regardless of requested company/job. Persisted match/recommendation returns jobVersionId, requirementSnapshotHash, evidence references and rulesVersion; later edits never retarget an old result. These endpoints have no current EXECUTE grant and require a new migration/policy/DTO review. No P1 work enters the 14-day P0 plan.

P1 bearer links need separate token/log/cache review; P2 retrieval/refresh may query only approved sources, no arbitrary fetchUrl endpoint. P2 storage follows exact reservation/quarantine policy in Database §8; upload/signing routes stay absent until it passes. P3 public API uses separately approved consent/scopes/revocation/quotas. No future endpoint can inherit raw table access or generic service-role credentials from P0.
