# ORYQEN 22-module acceptance matrix (28 October 2026)

This is a strict reading of `ORYQEN_V1_MASTER_SPECIFICATION.md`. A release-gate pass is **not** a completed module: the gate proves that what exists
does not regress. A module is judged against every sub-feature named in its specification paragraph.

## Definitions

| Classification | Meaning |
|---|---|
| COMPLETE AND VERIFIED | Every sub-feature named in the specification paragraph is implemented (frontend, backend, database where needed) and covered by automated tests including security tests and a real-stack journey. Hosted verification and production keys are listed separately as production blockers. |
| IMPLEMENTED BUT NOT FULLY VERIFIED | Every sub-feature exists, but a required kind of verification (live provider, device, hosted service) has not happened. |
| PARTIALLY IMPLEMENTED | Real, tested slices exist; named sub-features are missing and could be built locally. |
| NOT IMPLEMENTED | No working implementation. |
| BLOCKED BY EXTERNAL DEPENDENCY | Everything buildable locally is built; the remaining requirement cannot be met without an external input (licensed data, provider approval). |

## Exact count out of 22

| COMPLETE AND VERIFIED | IMPLEMENTED BUT NOT FULLY VERIFIED | PARTIALLY IMPLEMENTED | NOT IMPLEMENTED | BLOCKED BY EXTERNAL DEPENDENCY |
|---|---|---|---|---|
| **1** (module 18) | **0** | **20** | **0** | **1** (module 19) |

The previous report called four modules "implemented locally" (04, 09, 13, 18). Re-read against the specification text, 04, 09 and 13 each name
sub-features that are not built (listed below), so they are partially implemented. A release-gate pass is evidence that nothing regressed, not
evidence that a module is complete.

### The ten most important remaining gaps

1. **Live AI needs the owner's model choice and policy approval** (modules 01, 11): the integration is verified live with synthetic text on `gemini-3.1-flash-lite`; the configured `gemini-3.8-flash` was overloaded (503) when probed; the written AI policy approval is missing, so real-user processing stays off.
2. **The Copilot is rules-based** (11): interview preparation, negotiation questions and multilingual explanations are not built.
3. **Hosted services are unverified** (06, 12, 17): Supabase Storage, hosted Auth/email and DNS egress from the host.
4. **Salary benchmarks have no licensed data source** (19).
5. **Work Passport lacks a signed PDF and skills/achievements in sharing** (07).
6. ~~Offer workspace lacks supporting documents and review notes~~ done (04); only server-side search across all offers remains.
7. **Agreements lack clause management, side-by-side diff and expiry reminders** (05); no employment timeline (20).
8. **Disputes lack confidential attachments and richer categories** (09); a named recruiter has no correction procedure for a report (17).
9. **Passkeys, retention controls and an account-deletion workflow** are not built (12); administrative exports are not logged (10); no abuse reports (13).
10. **Remaining English surfaces and one-language engines**: administration console, developer, organization and company screens, jurisdiction law text, guidance replies, server messages (15).

## Per-module matrix

Abbreviations: **FE** frontend, **BE** backend, **DB** database, **Sec** security verification, **Tests** automated evidence, **Journey** real user journey.

| # | Module | Status | Built | Missing from the specification | FE / BE / DB | Sec | Tests | Journey | Production blockers |
|---|---|---|---|---|---|---|---|---|---|
| 01 | AI Employment Intelligence | PARTIALLY IMPLEMENTED | Paste, OCR, PDF, manual intake; 20-criterion assessment (translated); AI analysis panel (translated); multi-provider gateway with consented fallback, breaker, budgets; saved analysis history | ~~DOCX intake~~ **done: .docx read on the device, no upload, no new dependency; legacy .doc refused**; AI used in agreements; live generation **verified on 28 Oct** through the application's real provider code with synthetic text on `gemini-3.1-flash-lite` (SUCCESS in 13 s, validated structured output); the configured `gemini-3.8-flash` answered 503 UNAVAILABLE (provider high demand) on the same day | Ready / ready / ready | Consent, redaction, hash-pinned policy, no content in audit | Unit, PGlite+real PG, browser, gateway unit (17) | Browser with fixtures; **live Gemini call with synthetic text passed (28 Oct, `gemini-3.1-flash-lite`)** | Choose a stable model (the configured one is overloaded); written AI policy approval |
| 02 | Employer & Company Research | PARTIALLY IMPLEMENTED | GLEIF with citations, timestamps, freshness, contradictions, per-user limits | Persisted research history; other registries (need keys); claim-vs-registry comparison | Ready / ready / n/a | SSRF-guarded fetch | Unit, browser, live GLEIF 3/3 | Live GLEIF verified earlier | Keys for further registries |
| 03 | Career Matching | PARTIALLY IMPLEMENTED | Listings, preferences, saved/hidden, explainable matching (translated) | Opportunity comparison, skills-gap suggestions, recommendation history | Ready / ready / ready | RLS | Unit, PGlite, browser, real-stack | Real-stack | none |
| 04 | Offer Intelligence Workspace | PARTIALLY IMPLEMENTED | Create, draft, edit, analyze, compare, archive/restore, decisions, employer linkage, analysis history, revision history, **downloadable offer summary in the chosen language, search by role and decision filter over loaded offers (new)** | Server-side search across all offers (search and decision filter cover loaded offers only). **Private review notes and supporting documents added (migration 18; PGlite + real PG + real-stack journey passed)** | Ready / ready / ready | RLS, idempotency | Unit, PGlite, browser, real-stack | Real-stack | none |
| 05 | Digital Agreement Center | PARTIALLY IMPLEMENTED | Versioned proposals, acknowledgements, accept/decline, amendments, audit, dispute-free review; translated | Clause management (editing individual clauses), expiry reminders (no expiry date exists on agreements), supporting documents, dispute linkage. **Read-only side-by-side comparison of any two saved versions added** | Ready / ready / ready | Immutable versions, hashes | Unit, PGlite+real PG, browser, real-stack | Two-account real-stack | none |
| 06 | Evidence Vault | PARTIALLY IMPLEMENTED | History, work records, private uploads, signed 60 s links, deletion, private links to records | Correction requests and revocation of evidence, verification status on documents, export of single documents, malware scanning | Ready / ready / ready | Content-sniffing, owner-only RLS | Unit, PGlite+real PG, browser, real-stack (disk store) | Real-stack with disk store | **Hosted Storage unverified**; owner creates bucket and key |
| 07 | Work Passport | PARTIALLY IMPLEMENTED | Verified records, named-recipient time-limited sharing, revocation, field controls, Trust Chain; translated; **QR code for an active recipient link and print/save-as-PDF copy (new)** | Signed PDF rendering (a **signed, offline-verifiable JSON copy now exists**, usable once the owner's signing key is installed; print-to-PDF copy is not a certificate), skills/achievements in shared Passport, profile-level QR verification (a QR for the recipient link exists; it grants nothing without the named account) | Ready / ready / ready | Recipient-scoped RLS | Unit, PGlite+real PG, browser, real-stack | Real-stack | none |
| 08 | Organization & Recruiter Portal | PARTIALLY IMPLEMENTED | Org requests and independent approval, roster, recruiter confirmation queue, domain proof, organization plans | Recruiter accounts, role permissions beyond representative, team changes | Ready / ready / ready | Authority-checked RPCs | Unit, PGlite+real PG, browser, real-stack | Real-stack | none |
| 09 | Dispute & Appeals Center | PARTIALLY IMPLEMENTED | Cases, reviewer assignment with conflict checks, follow-ups, appeals, decisions (translated) | Categories beyond four reason codes, confidential attachments, org response workflow | Ready / ready / ready | Independent reviewer, MFA | Unit, PGlite+real PG, browser, real-stack | Real-stack | none |
| 10 | Trust Ledger & Audit | PARTIALLY IMPLEMENTED | Append-only triggers, hashed snapshots, admin audit, Trust Chain, **checksummed export of administrative records (new; builder unit-tested, console button not exercised in a browser because it needs a real admin session)**, **written threat model (`ORYQEN_TRUST_LEDGER_THREAT_MODEL.md`, new)** | ~~Export not written to the audit trail~~ **done (migration 19: each export is recorded with resource, count, completeness, filter names and checksum, before the file is delivered)**; cross-record hash chain; export for ordinary users' own event history | Partial / ready / ready | Immutability tests on real PG | Unit, real PG | Real-stack | none |
| 11 | AI Career Copilot | PARTIALLY IMPLEMENTED | Rules-based private guidance, history, deletion (translated) | Model-backed copilot and multilingual chat answers. **Interview and negotiation preparation added as fixed-rule, four-language guidance from an offer's own checklist (not model-backed, not legal advice)** | Ready / ready / ready | Private, deletable | Unit, browser | Real-stack | Same AI approval as 01 |
| 12 | Security & Privacy | PARTIALLY IMPLEMENTED | Auth, email verification, recovery, MFA, RLS, quotas, origin checks, data export (17 sections), privacy requests (translated), secrets scan, route audit | Passkeys, executing account deletion (requests are reviewed by a privacy operator; erasing append-only records is deliberately a reviewed, separate step), security-event log view. **Retention statement added (what is kept, erased automatically, revocable or erasable only by request)** | Ready / ready / ready | Route audit, RLS, 0 production vulns | Unit, real PG, browser | Real-stack | Hosted auth/email sender |
| 13 | Administration | PARTIALLY IMPLEMENTED | Capability+MFA queues, settings, audit, gateway panel, plan assignment, **checksummed record export, abuse-report review queue (in Settings for reviewers and now also in the admin console under Cases & moderation)** | Account moderation, operational monitoring; the console's navigation, filters, tables and export are now translated, while its forms, dialogs and detail panels are still English | Ready / ready / ready | Capability gated | PGlite+real PG, browser | Real-stack | Hosted operator procedures |
| 14 | Premium Multiplatform UX | PARTIALLY IMPLEMENTED | Responsive screens, axe checks (15 screens × 2 schemes), route matrix 74/74 | Manual screen-reader/keyboard audit; Android and Windows visual review on devices | Ready / n/a / n/a | n/a | Browser (route matrix, a11y) | Browser | Devices |
| 15 | Localization | PARTIALLY IMPLEMENTED | en/si/ta/de catalogs (1,310 strings; Sinhala 1,297, all machine-assisted drafts); id-keyed assessment and rule texts; most worker journeys translated | English: guidance replies, developer access, org/company screens, profile editor, public pages, admin console forms and dialogs (shell translated), jurisdiction law text, server messages; drafts need native review | Partial / n/a / n/a | n/a | Unit (pins), browser per language | Browser | Native reviewers |
| 16 | Country-Aware Guidance | PARTIALLY IMPLEMENTED | Germany rules with quotes/sources/dates; unsupported-country limitation | Other countries; Sri Lanka primary text; counsel review | Ready / ready / n/a | n/a | Unit, browser | Browser | Legal sources |
| 17 | Recruiter Scam Protection | PARTIALLY IMPLEMENTED | Wording and domain indicators; Recruiter Identity & Affiliation Verification with employer decisions and live evidence; **private user reporting flow with reviewer triage and write-back (new)** | Correction procedure for a named party; hosted DNS egress unverified | Ready / ready / ready | SSRF guard, RLS, requester hidden | Unit, PGlite+real PG, browser, real-stack | Real-stack | Hosted DNS/HTTP egress |
| 18 | Verifiable Credentials | **COMPLETE AND VERIFIED** (test key) | Issuer identity, Ed25519 issuance, expiry, revocation, public status, QR, browser verification, privacy-controlled sharing, plan allowance | none | Ready / ready / ready | Key never in repo, tamper/forgery tests | Unit, PGlite+real PG, browser, real-stack with throwaway key | Real-stack | **Production signing key** (owner ceremony) |
| 19 | Salary Benchmarking | **BLOCKED BY EXTERNAL DEPENDENCY** | Normalization, currencies, periods, hours, dated sourced comparison, translated panel | Source-backed benchmark datasets, freshness, geographic context | Ready / ready / n/a | No invented data | Unit, browser | Browser | Licensed dataset |
| 20 | Notifications & Timeline | PARTIALLY IMPLEMENTED | In-app feed (translated), preferences, reminders for credentials, recruiter retention, pending decisions | Agreement expiry reminders (agreements carry no expiry date yet; **reminders for Passport links the person shared that end within 14 days added**), email and push. **Employment timeline view added (self-reported jobs and work records in date order, each keeping its own status)** | Ready / ready / ready | Case items never hideable | Unit, browser | Browser | Email/push provider |
| 21 | Developer API | PARTIALLY IMPLEMENTED | Scoped keys, verify endpoint, limits, metering, signed webhooks, OpenAPI document | Persistent delivery queue (decision needed, see `ORYQEN_DEVELOPER_API.md`), more scopes/events, org keys | Ready / ready / ready | Hash-only keys, SSRF guard | Unit, PGlite+real PG, browser, real-stack | Real-stack | Worker/cron decision |
| 22 | Sustainable Business Platform | PARTIALLY IMPLEMENTED | Worker and organization plans, operator assignment, enforced allowances, honest no-billing statement | Wider usage metering, enterprise entitlements, admin overview of plans | Ready / ready / ready | Append-only, conflict-of-interest rule | Unit, PGlite+real PG, browser, real-stack | Real-stack | Payment provider (optional) |

## What changed since the previous audit

Added this session: recruiter identity verification, Vault-to-record links, organization plans with enforced allowance, locale-aware assessment and rule
findings, sign-in/registration/recovery and many more screens translated, accessibility checks, route matrix, notification preferences and reminders,
OpenAPI document, export of recruiter/privacy/sharing data, real-stack harness now exercising vault, credential and developer journeys.

## Next engineering order (no owner input needed)

1. Record each administrative export in the audit trail (module 10).
2. Agreement and verification expiry reminders and an employment timeline (modules 05, 20).
3. Move the report queue into the admin console and add a correction path (modules 13, 17).
4. Translate the administration console and server-generated messages (modules 13, 15).
5. Passkeys feasibility, retention controls and the account-deletion workflow (module 12).
6. Offer search, supporting documents and review notes (module 04).

## Owner checklist (consolidated)

See `ORYQEN_PRODUCTION_READINESS_AUDIT.md` section 3. None of the items blocks local engineering; items 1–6 block hosted testing, item 7 blocks real-user AI,
item 8 blocks signed Windows and Android releases.
