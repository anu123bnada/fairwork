# ORYQEN 22-module acceptance matrix (28 October 2026)

This is a strict reading of `ORYQEN_V1_MASTER_SPECIFICATION.md`. A release-gate pass is **not** a completed module: the gate proves that what exists
does not regress. A module is judged against every sub-feature named in its specification paragraph.

## Definitions

| Status | Meaning |
|---|---|
| COMPLETE | Every sub-feature in the specification paragraph is implemented (frontend, backend, database where needed), covered by automated tests including security tests, and exercised in a real-stack journey. Hosted verification and production keys are tracked separately as *production blockers*. |
| PARTIAL | Real, tested slices exist; one or more named sub-features are missing and could be built locally. |
| NOT BUILT | No working implementation. |
| BLOCKED | The remaining required work cannot be done without an external input (licensed data, provider approval); everything buildable locally is built. |

## Exact count

| COMPLETE | PARTIAL | NOT BUILT | BLOCKED | Total |
|---|---|---|---|---|
| **1** (18) | **20** | **0** | **1** (19) | 22 |

Evidence base: tracker, test report, failure register (28 entries, none OPEN), `release-results/`, and the passing real-stack harness (212 checks).
The previous report called four modules "implemented locally" (04, 09, 13, 18). Re-read against the specification text, 04, 09 and 13 each name
sub-features that are not built (listed below), so they are PARTIAL here.

## Per-module matrix

Abbreviations: **FE** frontend, **BE** backend, **DB** database, **Sec** security verification, **Tests** automated evidence, **Journey** real user journey.

| # | Module | Status | Built | Missing from the specification | FE / BE / DB | Sec | Tests | Journey | Production blockers |
|---|---|---|---|---|---|---|---|---|---|
| 01 | AI Employment Intelligence | PARTIAL | Paste, OCR, PDF, manual intake; 20-criterion assessment (translated); AI analysis panel (translated); multi-provider gateway with consented fallback, breaker, budgets; saved analysis history | DOCX intake; AI used in agreements; live generation unverified (configured model quota-exhausted) | Ready / ready / ready | Consent, redaction, hash-pinned policy, no content in audit | Unit, PGlite+real PG, browser, gateway unit (17) | Browser with fixtures; **no live Gemini call this session** | Gemini quota or model change; written AI policy approval |
| 02 | Employer & Company Research | PARTIAL | GLEIF with citations, timestamps, freshness, contradictions, per-user limits | Persisted research history; other registries (need keys); claim-vs-registry comparison | Ready / ready / n/a | SSRF-guarded fetch | Unit, browser, live GLEIF 3/3 | Live GLEIF verified earlier | Keys for further registries |
| 03 | Career Matching | PARTIAL | Listings, preferences, saved/hidden, explainable matching (translated) | Opportunity comparison, skills-gap suggestions, recommendation history | Ready / ready / ready | RLS | Unit, PGlite, browser, real-stack | Real-stack | none |
| 04 | Offer Intelligence Workspace | PARTIAL | Create, draft, edit, analyze, compare, archive/restore, decisions, employer linkage, analysis history, revision history | Free-text search and filters beyond view; supporting documents; review notes; export summaries | Ready / ready / ready | RLS, idempotency | Unit, PGlite, browser, real-stack | Real-stack | none |
| 05 | Digital Agreement Center | PARTIAL | Versioned proposals, acknowledgements, accept/decline, amendments, audit, dispute-free review; translated | Clause management and side-by-side diff, expiry reminders, supporting documents, dispute linkage | Ready / ready / ready | Immutable versions, hashes | Unit, PGlite+real PG, browser, real-stack | Two-account real-stack | none |
| 06 | Evidence Vault | PARTIAL | History, work records, private uploads, signed 60 s links, deletion, private links to records | Correction requests and revocation of evidence, verification status on documents, export of single documents, malware scanning | Ready / ready / ready | Content-sniffing, owner-only RLS | Unit, PGlite+real PG, browser, real-stack (disk store) | Real-stack with disk store | **Hosted Storage unverified**; owner creates bucket and key |
| 07 | Work Passport | PARTIAL | Verified records, named-recipient time-limited sharing, revocation, field controls, Trust Chain; translated | QR-based profile verification, PDF export, skills/achievements in shared Passport, credential verification page link-up | Ready / ready / ready | Recipient-scoped RLS | Unit, PGlite+real PG, browser, real-stack | Real-stack | none |
| 08 | Organization & Recruiter Portal | PARTIAL | Org requests and independent approval, roster, recruiter confirmation queue, domain proof, organization plans | Recruiter accounts, role permissions beyond representative, team changes | Ready / ready / ready | Authority-checked RPCs | Unit, PGlite+real PG, browser, real-stack | Real-stack | none |
| 09 | Dispute & Appeals Center | PARTIAL | Cases, reviewer assignment with conflict checks, follow-ups, appeals, decisions (translated) | Categories beyond four reason codes, confidential attachments, org response workflow | Ready / ready / ready | Independent reviewer, MFA | Unit, PGlite+real PG, browser, real-stack | Real-stack | none |
| 10 | Trust Ledger & Audit | PARTIAL | Append-only triggers, hashed snapshots, admin audit, Trust Chain, **checksummed export of administrative records (new; builder unit-tested, console button not exercised in a browser because it needs a real admin session)**, **written threat model (`ORYQEN_TRUST_LEDGER_THREAT_MODEL.md`, new)** | Export is not itself written to the audit trail (needs an admin command and migration); cross-record hash chain; export for ordinary users' own event history | Partial / ready / ready | Immutability tests on real PG | Unit, real PG | Real-stack | none |
| 11 | AI Career Copilot | PARTIAL | Rules-based private guidance, history, deletion (translated) | Model-backed copilot, interview preparation, negotiation questions, multilingual answers | Ready / ready / ready | Private, deletable | Unit, browser | Real-stack | Same AI approval as 01 |
| 12 | Security & Privacy | PARTIAL | Auth, email verification, recovery, MFA, RLS, quotas, origin checks, data export (17 sections), privacy requests (translated), secrets scan, route audit | Passkeys, retention controls, account-deletion workflow (requests only), security-event log view | Ready / ready / ready | Route audit, RLS, 0 production vulns | Unit, real PG, browser | Real-stack | Hosted auth/email sender |
| 13 | Administration | PARTIAL | Capability+MFA queues, settings, audit, gateway panel, plan assignment | Abuse reports, account moderation, operational monitoring, translated console | Ready / ready / ready | Capability gated | PGlite+real PG, browser | Real-stack | Hosted operator procedures |
| 14 | Premium Multiplatform UX | PARTIAL | Responsive screens, axe checks (15 screens × 2 schemes), route matrix 74/74 | Manual screen-reader/keyboard audit; Android and Windows visual review on devices | Ready / n/a / n/a | n/a | Browser (route matrix, a11y) | Browser | Devices |
| 15 | Localization | PARTIAL | en/si/ta/de catalogs (1,310 strings; Sinhala 1,297, all machine-assisted drafts); id-keyed assessment and rule texts; most worker journeys translated | English: guidance replies, developer access, org/company screens, profile editor, public pages, admin console, jurisdiction law text, server messages; drafts need native review | Partial / n/a / n/a | n/a | Unit (pins), browser per language | Browser | Native reviewers |
| 16 | Country-Aware Guidance | PARTIAL | Germany rules with quotes/sources/dates; unsupported-country limitation | Other countries; Sri Lanka primary text; counsel review | Ready / ready / n/a | n/a | Unit, browser | Browser | Legal sources |
| 17 | Recruiter Scam Protection | PARTIAL | Wording and domain indicators; Recruiter Identity & Affiliation Verification with employer decisions and live evidence | **User reporting flow**; hosted DNS egress unverified | Ready / ready / ready | SSRF guard, RLS, requester hidden | Unit, PGlite+real PG, browser, real-stack | Real-stack | Hosted DNS/HTTP egress |
| 18 | Verifiable Credentials | **COMPLETE** (local, test key) | Issuer identity, Ed25519 issuance, expiry, revocation, public status, QR, browser verification, privacy-controlled sharing, plan allowance | none | Ready / ready / ready | Key never in repo, tamper/forgery tests | Unit, PGlite+real PG, browser, real-stack with throwaway key | Real-stack | **Production signing key** (owner ceremony) |
| 19 | Salary Benchmarking | **BLOCKED** | Normalization, currencies, periods, hours, dated sourced comparison, translated panel | Source-backed benchmark datasets, freshness, geographic context | Ready / ready / n/a | No invented data | Unit, browser | Browser | Licensed dataset |
| 20 | Notifications & Timeline | PARTIAL | In-app feed (translated), preferences, reminders for credentials, recruiter retention, pending decisions | Agreement/verification expiry reminders, employment timeline view, email and push | Ready / ready / ready | Case items never hideable | Unit, browser | Browser | Email/push provider |
| 21 | Developer API | PARTIAL | Scoped keys, verify endpoint, limits, metering, signed webhooks, OpenAPI document | Persistent delivery queue (decision needed, see `ORYQEN_DEVELOPER_API.md`), more scopes/events, org keys | Ready / ready / ready | Hash-only keys, SSRF guard | Unit, PGlite+real PG, browser, real-stack | Real-stack | Worker/cron decision |
| 22 | Sustainable Business Platform | PARTIAL | Worker and organization plans, operator assignment, enforced allowances, honest no-billing statement | Wider usage metering, enterprise entitlements, admin overview of plans | Ready / ready / ready | Append-only, conflict-of-interest rule | Unit, PGlite+real PG, browser, real-stack | Real-stack | Payment provider (optional) |

## What changed since the previous audit

Added this session: recruiter identity verification, Vault-to-record links, organization plans with enforced allowance, locale-aware assessment and rule
findings, sign-in/registration/recovery and many more screens translated, accessibility checks, route matrix, notification preferences and reminders,
OpenAPI document, export of recruiter/privacy/sharing data, real-stack harness now exercising vault, credential and developer journeys.

## Next engineering order (no owner input needed)

1. Record each administrative export in the audit trail (module 10).
2. Agreement and verification expiry reminders and an employment timeline (modules 05, 20).
3. User reporting flow for suspicious recruiters (module 17).
4. Translate the administration console and server-generated messages (modules 13, 15).
5. Passkeys feasibility, retention controls and the account-deletion workflow (module 12).
6. Offer search, supporting documents, review notes and export summaries (module 04).

## Owner checklist (consolidated)

See `ORYQEN_PRODUCTION_READINESS_AUDIT.md` section 3. None of the items blocks local engineering; items 1–6 block hosted testing, item 7 blocks real-user AI,
item 8 blocks signed Windows and Android releases.
