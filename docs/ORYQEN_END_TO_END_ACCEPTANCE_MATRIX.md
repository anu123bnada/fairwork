# ORYQEN end-to-end acceptance matrix (Phase 0, 17 Nov 2026)

Companion to `ORYQEN_MASTER_MODULE_MATRIX.md`. Each journey below is a **real user journey that must pass on production-like infrastructure with real backend persistence and real authorization**, using independent accounts where the journey involves more than one person. A journey is **PASS** only when every step passes and the listed evidence is stored. Fixture-backed browser runs (stand-ins for the API) never count.

**Evidence legend.** **[V]** verified by me on 17 Nov 2026; **[R]** reported to me by the owner from a script they ran on 16-17 Nov (I did not observe it); **[F]** fixture only; **[U]** not verified. **Status values:** PASS, PARTIAL (some steps proven), NOT RUN, BLOCKED (cannot run until a dependency exists).

## 0. Test-account matrix (needed to run any journey)
| Account | Role and capabilities | Needed by journeys | Exists today |
|---|---|---|---|
| W1 | Worker, MFA optional | all worker journeys | One staging account (the owner's); synthetic test accounts not created |
| W2 | Second worker (isolation) | 4, 5, 6, 7, 9 | No |
| E1, E2 | Employer representatives of one organization, two independent approvers | 2, 4, 6, 7, 8, 10 | No |
| E3 | Representative of a different organization (tenant isolation) | 8 | No |
| R1 | Independent dispute reviewer (capability) | 7 | No |
| A1, A2 | Two admins with second factor (separation of duties) | 12 | No |
| D | Developer with API keys | integrations | W1 only |
All accounts must be synthetic (`example.test` addresses or a dedicated test domain), created by the owner with Auto Confirm, passwords never shared with an agent. Capabilities for test accounts are granted by the owner in the **test** environment only.

**Environment for acceptance:** a pre-production Supabase project and Vercel environment that mirrors production configuration (see roadmap Phase 1). Staging (`oryqen-staging`) may be used for early runs but is not an acceptable final environment because it has PITR off, default email and a Preview deployment.

## 1. Worker registration, onboarding and profile creation
- **Steps.** Open registration (flag on) → enter email and password → receive confirmation email from the production sender → confirm → sign in → complete `/register/profile` (name, locale, time zone) → optional MFA enrolment → land on dashboard → sign out and sign in again.
- **Authorization checks.** Registration disabled returns 403 when the flag is off; anonymous `/api/v1/me` is 401; profile readable only by its owner; a client-supplied user id is refused (422).
- **Persistence checks.** Profile row exists with revision 1; edit with the wrong revision fails; locale persists across sessions.
- **Evidence.** Hosted script output, screenshots of each step on a phone and a desktop, email headers showing SPF/DKIM pass, DB row count diff.
- **Status.** PARTIAL: sign-in, profile read, sign-out proven on hosted [R]; registration and email confirmation **NOT RUN** (registration flag off; Supabase default sender; no production sender domain). **BLOCKED** on email provider and domain.

## 2. Employer registration and verification
- **Steps.** E1 signs up as a worker → requests an organization (name, statement) → admin or independent approvers review → organization becomes authorized → E1 posts a listing → E2 (second approver) approves a membership change.
- **Authorization checks.** A requester cannot approve their own request; one approver alone cannot complete a two-approver action; E3 cannot read or change E1's organization; **verification method is real** (registry match or document check), not the demonstration authority.
- **Persistence checks.** Request, decision and audit rows exist and are hash-chained.
- **Evidence.** API authorization suite results, audit-log excerpts, cross-tenant denial transcript.
- **Status.** NOT RUN on hosted (needs E1/E2/E3). Local PGlite proves approval logic [V13]. **Verification is a demonstration authority (`demo-authority.v1`)**, so the "verification" part is **SIM** and **BLOCKED** on a decision about the real method (registry, document, or manual review by an operator).

## 3. Offer submission and AI analysis
- **Steps.** W1 pastes (or scans) an offer → rules-based analysis returns criteria with quotes → W1 saves the offer, adds notes and a decision → with AI enabled and consent given, W1 requests AI analysis → result validates against the schema and every quote appears in the source → consent withdrawal stops sending.
- **Authorization checks.** Another worker cannot read the offer (404); AI call without consent is refused; AI off returns UNCONFIGURED, never invented text.
- **Persistence checks.** Offer, revisions and analysis history persist; deletion removes them.
- **Evidence.** Analysis outputs on the 200-document evaluation set; provider request logs showing redacted text only; budget-cap failure test.
- **Status.** PARTIAL: AI-off honesty proven on hosted [R]; rules analysis proven in CI and local browser [V13]; saving an offer on hosted needs an organization (NOT RUN). **AI path BLOCKED** on provider contract, written approval, key and evaluation set.

## 4. Agreement creation and acceptance
- **Steps.** E1 proposes an agreement version on W1's offer → W1 reviews, compares with the previous version, acknowledges or declines → expiry and renewal handled → integrity hash recorded.
- **Authorization checks.** Neither side can acknowledge on behalf of the other; a third account sees nothing; expired proposals cannot be accepted.
- **Persistence checks.** Version chain, hash and decision rows; audit entries.
- **Evidence.** Two-account hosted transcript; hash recomputed independently.
- **Status.** NOT RUN on hosted (needs W1 + E1). Logic proven locally [V13]. **No e-signature exists** (and none is claimed); legally binding signing is **BLOCKED** on provider and counsel.

## 5. Evidence upload, retrieval and deletion
- **Steps.** W1 uploads a file → it is listed → signed download returns identical bytes → W1 adds a correction note, revokes, reinstates → W1 deletes it → a W2 attempt to fetch it returns 404 → (target) malware scan result gates availability.
- **Authorization checks.** Cross-user access denied; signed URL expires in 60 s; oversize (>5 MiB) and disallowed types refused.
- **Evidence.** Byte-for-byte hash comparison, 404 transcript for W2, storage object listing before and after deletion.
- **Status.** PARTIAL: single-account upload, same-bytes download, status flow and delete **PASS on hosted** [R 17 Nov]; the foreign-document 404 in that run was a probe, not an independent account. **Malware scanning NOT implemented.** Cross-user proof NOT RUN.

## 6. Work Passport generation and verification
- **Steps.** W1 records work hours with evidence → E1 verifies the record → record appears in W1's Passport as employer-verified → W1 shares with a named recipient for a limited time → recipient verifies the signed copy → W1 revokes → recipient receives nothing.
- **Authorization checks.** Unverified entries never appear as verified; a revoked or expired share returns nothing; W2 cannot read W1's passport.
- **Evidence.** Verifier output on the signed JSON; share-revocation transcript.
- **Status.** NOT RUN on hosted (needs an employer account). Passport fixture rendering only [F]. **Production signing key ceremony BLOCKED.**

## 7. Dispute submission and resolution
- **Steps.** W1 raises a case in one of 12 categories with evidence references → reviewer R1 (independent of both parties) is assigned → follow-ups → decision → W1 files an appeal → a different reviewer decides.
- **Authorization checks.** A reviewer with a conflict cannot be assigned; parties see only their own parts; appeal cannot be decided by the original reviewer.
- **Status.** NOT RUN on hosted (needs R1 capability and three accounts). 34 real-PostgreSQL tests pass [V13]. **Confidential attachments and organization response NOT implemented.**

## 8. Employer portal workflows
- **Steps.** E1 creates a listing → W1 applies → E1 reviews applicants (minimal sharing) → shortlist or decline → W1 sees the status → E3 attempts to read E1's applicants (must fail).
- **Evidence.** API authorization suite across roles; cross-tenant denial transcript.
- **Status.** NOT RUN on hosted. Cross-company isolation proven on PGlite only [V13]. Staging has **0 published listings**.

## 9. Career goal creation and gap analysis (Module 23)
- **Steps.** W1 opens the Career gap analyzer → chooses a goal and enters skills with evidence levels → sees gaps, qualifications and the roadmap → changes goal → reloads and sees the saved profile → deletes it.
- **Authorization checks.** Profile readable only by its owner; unknown keys and unsafe links refused; nothing shown as verified.
- **Evidence.** Hosted API script step 23/24, browser journey on staging, screenshots on phone and desktop.
- **Status.** PARTIAL: save, read back, update, stale/unknown-key/wrong-status/unsafe-link refusal and delete **PASS on hosted via the API** [R 17 Nov]; screens render in local browser tests with a stand-in API (11/11) [V]; **not yet seen signed in on staging**. Occupation data is an editorial reference framework (**SIM-class**).

## 10. Learning recommendations and progress tracking (Module 23)
- **Steps.** W1 opens a recommended course (the link opens on the provider) → marks started, then completed with an optional certificate link → the gap recalculates → reloads and sees progress.
- **Evidence.** Link-freshness check log; hosted record read-back showing the progress array.
- **Status.** PARTIAL: progress persists on hosted via the API [R]; recalculation proven in unit and local browser tests [V]; links last opened 16 Nov (they go stale: needs a scheduled checker); catalog covers only web development and data analysis roles.

## 11. Opportunity discovery, saving and feedback (Module 24)
- **Steps.** E1 publishes a listing → W1 opens Opportunity intelligence → sees the listing ranked with per-criterion reasons, matching skills and missing requirements → likes, saves, hides, marks not relevant or applied → ordering changes → W1 resets feedback.
- **Evidence.** Hosted listing publish, ranked output, feedback record read-back and deletion; (target) one external source ingested with provenance.
- **Status.** PARTIAL: feedback persistence proven on hosted via the API [R]; ranking and explanations proven in unit and local browser tests [V]; **no listing exists on staging**, so the live ranked list has not been seen. **External platforms: none connected (BLOCKED).** **Scheduled refresh NOT implemented.**

## 12. Admin governance and moderation
- **Steps.** A1 signs in with a second factor → reviews queues → makes a setting change → A2 independently reviews → admin export and chain verification run → every action appears in the audit log; non-admin access to `/admin` and `/api/v1/admin/*` is refused.
- **Evidence.** Audit-chain verification output; separation-of-duties transcript.
- **Status.** NOT RUN on hosted. 27 DB and 14 admin-browser tests pass [V13]. **Account moderation tooling NOT implemented.**

## Summary
| # | Journey | Hosted status |
|---|---|---|
| 1 | Worker registration and onboarding | PARTIAL (sign-in only), BLOCKED on email |
| 2 | Employer registration and verification | NOT RUN; verification is SIM |
| 3 | Offer submission and AI analysis | PARTIAL; AI BLOCKED |
| 4 | Agreement creation and acceptance | NOT RUN; no e-signature |
| 5 | Evidence upload, retrieval, deletion | PARTIAL (one account) |
| 6 | Work Passport | NOT RUN |
| 7 | Dispute and resolution | NOT RUN |
| 8 | Employer portal | NOT RUN |
| 9 | Career goal and gap analysis | PARTIAL (API proven; screens not seen on staging) |
| 10 | Learning recommendations and progress | PARTIAL |
| 11 | Opportunity discovery and feedback | PARTIAL; no listing, no external source |
| 12 | Admin governance and moderation | NOT RUN |

**0 of 12 journeys PASS. 6 are PARTIAL (1, 3, 5, 9, 10, 11) and 6 are NOT RUN (2, 4, 6, 7, 8, 12).** Parts of journeys 1, 2, 3, 4, 6, 11 are additionally BLOCKED on a provider, legal or data decision. Counting rule: PARTIAL means some steps are proven on hosted infrastructure and the rest are not; it is never rounded up.
