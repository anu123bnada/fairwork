# FAIRWORK 2.0 — Bounded AI and evidence intelligence

Revision: FAIRWORK-ARCH-1.0.0, 2026-10-07. [Approved baseline](ARCHITECTURE_BASELINE.md); [Stage 1 approval](STAGE1_APPROVAL.md). No AI provider, prompts, retrieval service or evaluation tests exist. P0A works entirely with manual terms/findings and deterministic rules. Live offer AI and Prove are both excluded from the approved solo competition baseline. Retained P0B-AI/P0B-Prove names identify future P1 contracts, not features admitted during the 14 days. Human-reviewed Prove does not depend on AI. No provider, worker, consent UI or external data dispatch is provisioned in P0A; future provider abstraction and explicit consent remain mandatory.

## 1. Authority and operation boundaries

AI may extract or suggest; it cannot change agreed terms, approve memberships, create human evaluations, confirm work, issue/revoke assertions, publish shares, hire/reject people, execute submitted code or message anyone. Database transactions derive trusted identities and policies. AI confidence is not verification. All offers, websites and submissions are untrusted data, including embedded instructions.

| Operation | Input/output boundary | Delivery and fallback |
|---|---|---|
| offer.extract_analyze | One consented immutable offer version → typed fields, grounded findings, draft questions | P1 only; P0A uses manual fields plus deterministic missing-field checks |
| challenge.evaluate_draft | Frozen submission/rubric/assistance conditions → criterion draft observations | P1, no human-table or assertion writes; human review remains separate |
| challenge.generate_draft | Curated skill/rubric constraints → unpublished challenge draft | P3, human publication required |
| company.extract_claims | Permitted public source snapshots → claim candidates with specific support | P2, unknown/conflicting facts preserved; no invented company facts |
| job.extract_requirements | Source job snapshot → requirements and explicitly stated values | P2, no inferred salary as stated fact |
| matching.explain | Deterministic authorized coverage → explanation referencing reason IDs | P2; cannot change coverage/ranking; deterministic text fallback |
| career.suggest | Consented goals/evidence gaps/curated pathways → explained suggestions | P3; no guaranteed outcomes; rule-based version post-competition P1 |

Candidate intelligence is a consented evidence projection, not unrestricted profiling. LinkedIn is official permission-based future integration only; no scraping or dependency.

## 2. Explicit external-processing consent

The user must see purpose, sent data categories, named provider/configuration, processing region scope, policy/retention/training disclosure, limitations, and that refusal preserves manual workflow. Separate unambiguous action creates immutable processing_consents scope, policy/disclosure/UI versions, granted_at, subject and provider config digest. Do not infer consent from sign-in, storing an offer, clicking a generic save button or third-party counterpart participation.

Consent is checked transactionally at enqueue, claim, retry, dispatch authorization and result acceptance. The typed offer_ai_inputs row binds consent, owner and offer version; run owner cannot be substituted. Provider/purpose/region/disclosure changes require a new explicit grant. Worker identity is a narrow database login and has no service-role or unrelated data access.

Revocation sets revoked_at, cancels queued/running jobs and rejects later completions under the same locks as dispatch/complete. It prevents subsequent **dispatch authorizations**. A dispatch authorization is recorded immediately before the external network call; request cancellation is best effort if revocation races after that point. Database commit and network transmission cannot be made atomic: an already authorized/in-flight transmission may reach the provider after withdrawal. State that explicitly; do not promise recall or instant provider deletion. Worker rechecks cancellation immediately before send, aborts where possible, never retries under revoked consent and discards results received after revocation. Retain minimal consent/dispatch metadata under the approved accountability policy. Earlier accepted results remain owner-private until deletion/retention handling; regrant does not resume old runs.

Synthetic demos use the same consent control path. Provider terms/region/budget and user disclosure must be approved before enabling any external processing; real employment data additionally requires the real-data release gate. Employer-provided content may involve third-party personal data, so minimize/redact unnecessary contacts and never send unrelated records “for context.”

## 3. Provider abstraction, typed inputs and execution state

Internal adapter: StructuredModelProvider.generate(operation, immutableInputDTO, outputSchema, timeout, tokenBudget, requestId). One adapter suffices. Provider structured-output support is not a substitute for application/database validation. Prompts are operation-specific immutable versioned artifacts with SHA-256 digest. Record prompt digest, output schema, normalization/validation policy versions, exact configured model/provider config digest, consent ID, input hash, timestamps, safe errors, latency/token usage/cost estimate. General logs contain no raw prompts, offers or answers.

ai_runs contains metadata, state and lease. Typed offer_ai_inputs supplies FK-enforced input/owner/consent; no growing list of nullable generic input IDs. Future operations need their own typed input/result relations and policies before enablement. Output IDs/subjects/verifiers/timestamps from a model are ignored/rejected; server derives authority.

State contract:

| Transition | Guard and result |
|---|---|
| create→queued | Active exact consent, owner/input, quota and idempotency; atomic run+typed input |
| queued→running | Eligible next_attempt_at, active subject/consent; claim lease hash/expiry and session_user |
| running→running retry | Transient failure or expired lease within total attempt budget; rotate lease; recheck consent and input; prior lease cannot complete |
| running→succeeded | Exact live lease/session/input/hash + consent + schema/grounding/domain validation; result/findings/run/audit commit together |
| queued/running→cancelled | Consent withdrawal, account/source withdrawal, explicit cancellation; terminal, no accepted late result |
| running→failed | Exhausted budget or permanent validation/provider failure; safe categorized error |

Completed/failed/cancelled rows never transition back; manual retry creates a new linked run under current consent/quota. A new offer version does not retarget an old run: result stays attached to original input, UI explicitly labels older version. At most one accepted result per run. Refreshing a page cannot enqueue duplicates. Future AI activation requires a durable scheduled worker/recovery path; do not silently replace it with fire-and-forget server execution. If host capability is unavailable, fail admission and retain manual P0A.

Initial staging limits: offer20,000 characters, output4,000 tokens,25-second provider timeout, at most2 attempts total,5 new runs/hour and20/day/user plus global budget. Retry only transient429/5xx/timeouts or one bounded schema correction within that budget; no authorization/consent/policy retries. User sees genuine queued/running/failure states; no fake progress timer or silent fixture fallback.

## 4. Offer output and grounding

Schema offer-analysis.v1 contains exact offerVersionId and the fixed field set: salary, workingHours, overtime, paymentSchedule, responsibilities, employmentType, location, startDate, duration, benefits, deductions, termination, otherConditions. Each is `{state:stated/missing/ambiguous,value:typed-or-null,sourceSpans:[{start,end,quote}],explanation}`. Findings have code, fieldId, kind missing/ambiguous/attention, explanation, supporting spans and suggestedQuestion. No safe/unsafe or legal-compliance verdict.

Salary includes amount/currency/pay period/gross-net-unknown. Do not infer omitted currency, period, hours or tax basis from locale. Missing fields have null value and no spans; stated values need matching support; ambiguity may cite competing spans without choosing unsupported certainty. Canonical text normalization version is frozen on offer_version; offsets are Unicode code points, end-exclusive. Validate quote equality/bounds with one shared implementation, including Sinhala/Tamil; UTF-16 indices are not interchangeable.

Validation order: identity/consent → minimal immutable input → candidate schema → allowed keys/types/ranges → exact source/reference validity → numeric semantic support → domain policy → lease/consent recheck → atomic result commit. Invalid output never becomes successful. Missing-field checks and material term diffs are deterministic. Corrections create a new owner-attributed offer version; model results stay immutable. Suggested questions become immutable question rows only when accepted by the owner; subsequent edits create a replacement question.

## 5. Human challenge evidence and optional later AI drafts

Prove freezes a separate challenge_submissions row with exact challenge version/rubric/hash, canonical response/hash, assistance policy and declarations, allowed tools/resources, start/submitted times, identity assurance and task-exposure context. Human evaluation references submission ID/hash and independently accepted reviewer assignment. Known conflicts (subject, employer, authority approver, original disputed evaluator) are rejected; undeclared relationships remain a documented collusion limitation.

Rubrics define stable criterion IDs, skill definition IDs, observable behaviors and ordinal levels. Evaluation records supported submission refs, rationale and uncertainty. Missing observation means not_assessed, not an invented failing score. Retakes are new attempts; corrections are new evaluations with old evidence withdrawn/assertions revoked atomically. Evidence states the conditions and exact task, not universal ability or unaided authorship. Compromised task versions are retired; no invasive proctoring or automatic plagiarism guilt.

Later challenge.evaluate_draft output uses its own typed AI draft table and FK to immutable submission, never challenge_evaluations human rows. A human can cite/revise it in a new attributed evaluation; AI cannot pick verifier identity or issue verification. Confidence labels insufficient/limited/supported require an explanation; they are not probabilities of skill. Authority and assertions remain the typed relations in Database §§2–3.

## 6. Work DNA, matching and provenance policy

Work DNA uses deterministic dna.v1 (Database §7): individual scope/date/assurance/status, supported observations across independent work roots/challenge templates, no averaging levels and no universal profile percentage. Conflicting observations remain visible; repeated versions/retakes do not inflate breadth. Unknown/declared/disputed/revoked/withdrawn evidence does not become verified support. Skill meaning changes create new skill IDs; historical evidence keeps original definition.

Post-competition worker matching uses requirement statuses supported/partial/not_observed/explicitly_unmet with evidence reasons. Not observed is not inability. If coverage is displayed, versioned weights essential2/desirable1 and support1/0.5/0 produce an explicitly labeled coverage ratio, not hiring suitability. No requirements means insufficient requirements, not100%. Hard eligibility separate; no protected-trait inference or automated hiring outcome. Persisted recommendation binds exact job description/requirement snapshot+hash, evidence refs and rule version; later job edits cannot reinterpret saved explanations. Employer search needs explicit worker consent/scopes and is P3.

Future source_snapshots enforce source kinds: user_text/user_document/internal_private require owner_id NOT NULL and visibility private; public_web/public_api require owner_id NULL plus permitted-public usage policy and publisher/reference/retrieval metadata. No UPDATE changes source kind/visibility; private→public promotion is prohibited in the model. A newly permitted public source must be independently acquired; user content is not relabeled public.

Claim state vocabulary: unverified (candidate, not publishable factual assertion), source_supported (valid claim-specific span/reference), contested (incompatible supported sources), reviewed (attributed human review decision), stale (freshness expired, derived flag retaining prior state). Confidence is an evidence descriptor: unsupported/direct_single/corroborated/contradictory with method/basis; never a raw model probability. reviewed does not mean government certification or certainty. New contrary support marks conflict, not overwrite; refresh adds snapshots. API returns source URL/ref, publisher, retrieved/observed dates, support reference, state, confidence basis and freshness. No private source joins in public company/job projections.

Retrieval is provider-adapter search/fetch → permission checks → source ranking → URL/provider-ID/content dedupe → extraction → validation → reasoning → claim candidates. Copies of one source are not independent corroboration. No arbitrary internal fetch, broad crawler or unlicensed redistribution. Company_sources remains derived via signals; no duplicate competing source/match systems.

## 7. Admission tests and failure honesty

Optional AI admission requires at least20 synthetic offers covering missing/conflicting numerical terms, Unicode spans, malicious instructions, unknown facts and provider failures. All accepted stated fields have valid references; zero invented monetary values in that corpus; invalid outputs fail safely; direct cross-user/consent/lease/budget tests pass. A small corpus is not universal accuracy proof; record limitations and measured results. P1 challenge AI needs separate human-annotated criteria tests and disagreement/appeal handling.

Failure UI preserves input and says analysis unavailable/could not validate; manual terms/questions remain fully functional. Fixture output is only in explicitly labeled isolated synthetic mode; never silently substituted for live output. Capability manifest in MASTER_SPEC is the single claim register. No AI claim is marked implemented until deployment and validation evidence exist. Prompt isolation/least privilege/validation follow [OWASP's defense-in-depth guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html); prompt wording alone is insufficient.
