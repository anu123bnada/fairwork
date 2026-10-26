# ORYQEN master delivery tracker (22-module vision)

Authority: `docs/ORYQEN_V1_MASTER_SPECIFICATION.md`. Last updated 26 October 2026 on branch
`feature/oryqen-sprint-oct25`. Older trackers (`ORYQEN_FINAL_RELEASE_TRACKER.md`, test report,
known limitations, hosted approval pack, signing guide) remain valid and are referenced, not replaced.

**Status words:** NOT STARTED / PARTIAL / IMPLEMENTED / VERIFIED / BLOCKED. "Evidence" is local
(unit, SQL, browser fixtures, real local Supabase). **No module has hosted (HTTPS production)
verification, so nothing is marked VERIFIED without that qualifier.** "IMPLEMENTED (local)" means
UI, backend, database, authorization, validation, errors and automated tests all exist and pass locally.

## The signature innovation: Trust Chain, read model PARTIAL (built 26 Oct)

**Built:** a read-only Trust Chain (`GET /api/v1/trust-chain`, `src/features/trust/`, Passport screen) derived from the
authorized records: work records (with decisions, evidence references, content/evidence hashes, withdrawals,
corrections, retractions), agreement acknowledgments, and self-reported employment entries. For every claim it answers:
what is claimed, who provided it, who verified it and how and when, what evidence supports it, whether it is still valid
(state, expiry, who ended it and why), whether it can be challenged (and where), and who can see it and where to revoke
access. Assurance is always stated in words: reviewed by an employer representative / acknowledged by both parties /
self-reported / not reviewed. Reviewed claims carry the demo-authority caveat. Records the caller only reviews as an employer
representative are excluded. 20 unit tests (builders, route) and 3 browser tests.

**Not built:** a stored claim ledger. The chain stores nothing, so it adds no integrity guarantee beyond the source
records' hashes and append-only rules; claims have no expiry; offer acknowledgments have no event timestamps; it does not
yet include Passport grants as claims, evidence files (none exist), disputes as linked events, or employer-side views. It was
not exercised against real database rows (it reuses the already-validated service schemas); the real-stack harness needs
a step for it.

**Credentials** now build on it (`docs/ORYQEN_CREDENTIALS_DESIGN.md`). The Trust Chain has been **run on real database rows** by the real-stack harness (5 checks).

## Module status

| # | Module | Status | Evidence (local) | Main gaps |
|---|---|---|---|---|
| 01 | AI Employment Intelligence | PARTIAL | Paste, screenshot OCR, **PDF text extraction**, manual entry; 20-criterion deterministic assessment; **Gemini provider contract fixed and proven live with synthetic text** (`gemini-3.1-flash-lite`: SUCCESS in 5.3 s, 4 grounded warning signs; `npm run test:live:gemini`); saved immutable analysis history; consent, redaction, numeric grounding | AI stays disabled by policy (no approval); configured `gemini-3.8-flash` hits quota; no DOCX; AI not yet used in agreements or the assistant |
| 02 | Global Employer Intelligence | PARTIAL | **GLEIF registry provider with real data** (live: Commercial Bank of Ceylon PLC, LK; Siemens AG, DE), cited sources, timestamps, freshness, contradiction and outdated findings, no scores, per-user limit, cache; organization requests with operator review | Research history not persisted; no comparison of employer claims against registry; no recruiter-legitimacy checks; no Companies House or other registries (need API keys) |
| 03 | Intelligent Career Discovery | PARTIAL | Listings, preferences, saved/hidden choices, explainable field matching (existing, tested) | No opportunity comparison, skills-gap suggestions or recommendation history |
| 04 | Offer Intelligence Workspace | IMPLEMENTED (local) | Create, drafts, edit, compare, decisions, archive/restore, history, analysis history; SQL, API and browser tests; real-stack harness (70 checks passed earlier this week) | Free-text search, supporting documents, notes, export |
| 05 | Digital Agreement Center | PARTIAL | Versioned proposals, independent acknowledgments, decisions, history; no legal-signature claim | Clause editor, side-by-side diff, amendments, expiry reminders, documents, dispute links |
| 06 | Employment Evidence Vault | PARTIAL | Employment history (self-reported, revisioned), agreement-backed work records, text evidence, corrections | **No file storage or signed URLs**; certificates and letters; export and deletion |
| 07 | ORYQEN Work Passport | PARTIAL | Verified Passport, named-recipient sharing with revocation, export; owner-only self-reported skills panel; **Trust Chain panel** | QR proof, PDF export, credential verification page, skills in shared Passport |
| 08 | Organization & Recruiter Portal | PARTIAL | Organization requests, independent operator approval, representative offers, **read-only team roster** | Recruiter accounts, roles beyond representative, team changes (operator-reviewed only) |
| 09 | Dispute & Appeals Center | IMPLEMENTED (local) | Cases, reviewer assignment with conflict checks, follow-ups, appeals, notifications; SQL and browser tests | Categories and confidential attachments; files |
| 10 | Trust Ledger & Audit Engine | PARTIAL | Append-only triggers, hash-bound term snapshots, integrity checks, admin audit; guarantees documented; **Trust Chain read model** over claims | No cross-record hash chain, no audit export, no stored claim ledger |
| 11 | AI Career Copilot | PARTIAL | Rules-based private guidance, **conversation deletion**, user-chosen offer context | No Gemini copilot, interview/negotiation prep, multilingual answers |
| 12 | Security & Privacy Command | PARTIAL | Auth, email confirmation, recovery, TOTP MFA, forced RLS, quotas, origin checks, telemetry; 0 production vulnerabilities | Passkeys, data export, retention controls, account-deletion workflow are requests only; rate limits are per-process and database quotas |
| 13 | Administration & Trust Operations | IMPLEMENTED (local) | Capability- and MFA-gated queues, settings, audit | Abuse reports, hosted operator procedures |
| 14 | Premium Multiplatform UX | PARTIAL | 13 screens checked at 390/768/1440 px, new panels styled consistently, landing with real release cards | Dark theme, WCAG audit, Android/Windows visual review |
| 15 | Global Localization Engine | PARTIAL | **New:** English, Sinhala, Tamil, German catalogs with computed coverage and English fallback; device-persisted switcher; locale-aware dates and currencies; pay-period normalization; unit + browser tests | **Coverage is 22 strings per locale (nav, settings, language screen, new panels); all else stays English**; translations are unreviewed drafts; server-side preference needs a migration; phone/address formats, localized notifications |
| 16 | Country-Aware Employment Intelligence | PARTIAL | **New:** Germany (ArbZG §3 daily time, §4 breaks) with exact quotes, URLs, retrieval dates, scope; Sri Lanka and all others show an explicit limitation | Only 1 supported country, 2 rules; source is an unofficial consolidation with no date; Sri Lankan primary text could not be retrieved |
| 17 | Recruiter Scam Protection | PARTIAL | Offer-text indicators (upfront fees, document retention) in rules and AI | Domain mismatch, impersonation checks, reporting |
| 18 | Verifiable Credentials & QR Proof | IMPLEMENTED (local, test key) | Ed25519 core; register + live status migration (real Postgres applied); issuing, list, revoke, public status and published-key endpoints; QR sharing and `/verify` page with browser-side verification; 46 new tests plus **real-stack harness: issue, replay, anonymous status, browser verification, revocation, forbidden actors (all pass)**; owner key ceremony script | **No production key**; owner decision on issuer domain; no employer-side views, audit export or key-rotation tooling; the only authority behind it is the demo policy, so every credential says so |
| 19 | Fairness & Salary Benchmarking | PARTIAL | **New:** pay-period normalization with explicit assumptions and same-currency or sourced-rate comparison (no invented rates) | Not yet in the UI; no benchmark datasets |
| 20 | Smart Alerts & Timeline | PARTIAL | In-app notification center and workflow notifications | Expiry reminders, email, Android push, preferences |
| 21 | Developer API & Integrations | NOT STARTED | — | Everything |
| 22 | Sustainable Business Platform | NOT STARTED | — | Entitlements model, metering, plans; no billing provider |

## Platform status

| Platform | Status | Notes |
|---|---|---|
| Web | Builds and passes tests locally | Hosted deployment is older than this branch; nothing deployed or migrated without approval |
| Windows (Electron) | Unsigned Preview installer exists | Production config refuses to build without certificate and approved icon (`docs/ORYQEN_RELEASE_SIGNING.md`) |
| Android (Capacitor) | Debug-signed preview APK; guarded release variant verified with an unsigned pipeline-check build | Application ID, domain, icons and keystore are owner decisions |

## Required end-to-end proofs (directive F)

| # | Proof | State |
|---|---|---|
| 1 | Synthetic offer, real Gemini response | **Done** through the app's own provider on `gemini-3.1-flash-lite`; configured model quota-blocked |
| 2 | Real company from an authorized source with cited evidence | **Done** (GLEIF; Sri Lanka and Germany) |
| 3 | Language switching renders localized screens | **Done** for the translated subset (browser test, screenshot reviewed) |
| 4 | Analysis with country-specific references | **Done** for Germany; Sri Lanka explicitly unavailable |
| 5 | Offer on web visible on Windows and Android | Not proven (needs hosted backend) |
| 6 | Android release installed, real authenticated workflow | Not done (no signed build, no device) |
| 7 | Windows release installed, real workflow | Not done (unsigned preview only) |
| 8 | Cross-account and cross-organization isolation | SQL tests and real-stack harness (local) |
| 9 | No API credentials in client packages | Static: provider keys are server-only; packaged-artifact grep done for the Preview installer earlier; Android release APK inspected |
| 10 | Signing status and artifact integrity | Documented: nothing is signed |

## Next batches (priority order)

1. ~~Trust Chain read model~~ done (see above); next: stored claim ledger with expiry, linked disputes and Passport grants.
2. ~~Verifiable credentials~~ built against a test key; remaining: production key from the owner, employer-side views, audit export.
3. Evidence Vault file storage with private bucket, signed short-lived URLs, malware and type validation.
4. Entitlements model (free worker protection tier fixed in code), usage metering, admin plan controls; no billing.
5. Research history persistence, employer-claim versus registry contradiction detection, recruiter checks.
6. Widen translation coverage and add native-speaker review; add a server-side locale preference migration.
7. More jurisdictions only from verified primary sources.
