# ORYQEN implementation register

Written 9 Nov 2026 from the repository itself: branch `integration/final-release`, commit `fa13cfe` (later commits only change this file). Evidence counted that day: 62 database migrations, about 100 API routes under `src/app/api/v1`, 160 unit and integration test files (1,055+ tests), 84 browser specs (662 tests in CI), 21 app screens (`src/app/app/[screen]/page.tsx`), an Android project (`mobile/poc`) and a Windows Electron project (`desktop`). This register replaces assumptions with those facts. Older trackers (`ORYQEN_22_MODULE_ACCEPTANCE.md`, `ORYQEN_MASTER_DELIVERY_TRACKER.md`) are partly stale; this file wins.

## How to read the statuses
Implementation status uses: IMPLEMENTED, PARTIALLY IMPLEMENTED, UI ONLY, BACKEND MISSING, DATABASE MISSING, NOT IMPLEMENTED, BLOCKED BY EXTERNAL DEPENDENCY. (No module is "IMPLEMENTED BUT BROKEN": no confirmed regression is open; the full browser suite passes on CI.) Every row also answers four separate questions:

| Question | Meaning here |
|---|---|
| Integration configured | the external service it needs is set up where it runs |
| End-to-end tested | exercised through real HTTP, a real database and a real browser (the local real-stack harness, 263 checks) |
| Production verified | proven on a hosted environment as a signed-in user. **Nothing is production verified.** Staging has only anonymous checks (smoke 24/0/5, rendering 10/10) |
| Blocked | needs an owner decision, credential or outside party |

"Production" below means the hosted staging site `https://oryqen-staging.vercel.app`; no production environment exists.

## Part 1: the 22 modules
Latest CI: all steps passed on `2682b17` (typecheck, lint, 1,055 unit and integration tests, PostgreSQL suites, E2E 662 passed, build). Local real-stack harness: 263 PASS, 0 FAIL.

| # | Module | Status | Implemented (evidence) | Missing | Tests | Integration configured | Production verified | Blockers |
|---|---|---|---|---|---|---|---|---|
| 01 | AI Employment Intelligence | PARTIALLY IMPLEMENTED | Offer input by paste, screenshot, PDF, Word, manual (`offer-intake.tsx`, on-device readers); rules extraction and 20-point assessment; clause analysis; AI gateway with Gemini, OpenAI and self-hosted adapters, consent, redaction, budgets, breaker (`src/server/ai`); real-stage popup and report (`/app/report`, `/app/scan`); print to PDF | Persisted analysis jobs and a stored AI report (AI answers are deliberately not kept); server-built downloadable report; per-finding source labels for every category | unit, 7 + 4 browser (AI answer faked), CI; **real Gemini call verified locally** (API script and real browser, 9 Nov) | Local only (session variables). **Staging: AI OFF** | No | Owner's Google key and written approval; free quota; privacy terms |
| 02 | Employer and Company Intelligence | PARTIALLY IMPLEMENTED | GLEIF public-registry research with source and time, history (migration applied to staging), organization requests with independent operator review, company claims marked unverified | Other registries, official-website and domain research beyond recruiter domain proof, company report generation, evidence management UI | unit, real PG, harness | GLEIF needs no key | No | Registry API keys for others |
| 03 | Career Intelligence and Matching | PARTIALLY IMPLEMENTED | Preferences, explainable per-criterion matching, save and hide, comparison of up to four listings, saved-listing history (local migration, now applied to staging) | Career dashboard, skills-gap, pathways, recommendations from experience, progress tracking | unit, PGlite, browser, harness | n/a | No | None technical |
| 04 | Employment Offer Workspace | PARTIALLY IMPLEMENTED | Drafts, saved offers with revisions, notes, attached documents, comparison, archive and accept, history, search | Employer communication (no messaging), offer rejection tracking beyond decisions | PGlite, real PG, browser, harness | n/a | No | None technical |
| 05 | Digital Employment Agreements | PARTIALLY IMPLEMENTED | Versioned proposals, independent acknowledgement, decisions, expiry and reminders, history, integrity hash | Templates, clause editor, signature provider (no legal e-signature claim is made) | PGlite, real PG, browser | n/a | No | A signature provider and legal review |
| 06 | Evidence Vault and Work Records | PARTIALLY IMPLEMENTED | Private uploads with content sniffing, 5 MB limit, checksums, signed 60-second links, revoke and correction notes, links to work records and offers, work records with verification, audit | Malware scanning, orphan reconciliation, attaching files to disputes and shares | PGlite, real PG, browser, harness (local disk store) | Local disk store; staging bucket exists | No (signed-in use not exercised) | Hosted signed-in verification |
| 07 | Work Passport | PARTIALLY IMPLEMENTED | Verified-only Passport, named-recipient sharing and revocation, signed JSON, print-to-PDF copy, Trust Chain view, self-reported skills panel | Skills and achievements in a shared Passport, server-signed PDF | unit, real PG, browser, harness | Signing key is owner-held | No | Owner signing key |
| 08 | Employer and Organization Portal | PARTIALLY IMPLEMENTED | Organization requests and appeals, independent approval, team roster, company profile claims, listings under plans, recruiter confirmation queue, organization plans | Applicant management, candidate review, vacancy pipeline, employee records, organization analytics | real PG, browser, harness | n/a | No | None technical |
| 09 | Disputes and Appeals | PARTIALLY IMPLEMENTED | Cases with 12 categories, reviewer assignment with conflict checks, evidence references, follow-ups, appeals, notifications | Confidential file attachments, richer employer response workflow | real PG (34 case tests), browser, harness | n/a | No | None technical |
| 10 | Tamper-Evident Trust Ledger | PARTIALLY IMPLEMENTED | Append-only triggers, hash-bound term snapshots, global audit hash chain with admin verification, export log. It is a mutable database with detected tampering, **not a blockchain** | A stored claim ledger, external timestamping | real PG tamper tests | n/a | No | None technical |
| 11 | ORYQEN AI Copilot | PARTIALLY IMPLEMENTED | Rules-based Private guidance (deletable threads), Help assistant (new), fixed-rule interview and negotiation preparation | **Model-backed copilot**, tool actions, multilingual AI answers | unit, browser | AI off | No | Same AI approval, plus a new consent notice and schema |
| 12 | Security and Privacy | PARTIALLY IMPLEMENTED | Email confirmation, recovery that cannot bypass MFA, TOTP MFA, forced RLS on every private table, quotas, origin checks, security activity log (applied to staging), data export, privacy requests, deactivation, retention statement, secret scanner | Passkeys, executing account deletion, retention controls | PGlite, real PG, harness (tenant isolation, anonymous routes) | n/a | Anonymous checks only | Owner decisions on deletion policy |
| 13 | Administration and Governance | PARTIALLY IMPLEMENTED | Capability- and MFA-gated console (`/admin`): queues, settings, audit viewer and hash-chain check, AI provider status panel, export log | Account moderation, monitoring, platform analytics | PGlite (admin 27 tests), browser | n/a | Sign-in wall verified | Operator procedures |
| 14 | Multiplatform Experience | PARTIALLY IMPLEMENTED | Responsive web; Android Capacitor project compiles (debug and online variants); Windows Electron project (unsigned preview) | Device-verified Android run (emulator never booted on this RAM), signed release, **iOS: NOT IMPLEMENTED** | build, 15-screen axe checks | Debug-signed only | No | Owner's signing key, a device or more RAM, Apple developer account |
| 15 | Global Localization | PARTIALLY IMPLEMENTED | English, Sinhala, Tamil, German catalogs with computed coverage and fallback; locale-aware dates and currency | Native review of drafts; **new screens (CV, Help, Scan, Report, Analyze popup) are English only** | unit, browser per language | n/a | No | Native reviewers |
| 16 | Country-Aware Intelligence | PARTIALLY IMPLEMENTED | Germany: ArbZG, BUrlG, BGB 622 with quotes and source URLs; Sri Lanka explicitly unavailable | UK, US, Australia, Canada **NOT IMPLEMENTED**; Sri Lanka primary text | unit, browser | n/a | No | Official sources and counsel review |
| 17 | Recruiter Scam Intelligence | PARTIALLY IMPLEMENTED | Rule-based scam and clause checks, private user reporting with reviewer triage, recruiter confirmation, domain-control proof | Correction procedure for a named party, hosted DNS verification | unit, real PG, harness | n/a | No | None technical |
| 18 | Verifiable Credentials and QR | IMPLEMENTED (local, test key) | Ed25519 issue, list, revoke, public status, published keys, QR and `/verify` page | Production key; employer-side views | unit, real PG, harness | **No production key** | No | Owner's issuer key and domain |
| 19 | Salary Intelligence | BLOCKED BY EXTERNAL DEPENDENCY | Pay-period normalization and a Compare pay panel using user-supplied dated rates | Sourced benchmark data, location comparison | unit, browser | n/a | No | A licensed or public benchmark source |
| 20 | Notifications and Timeline | PARTIALLY IMPLEMENTED | In-app notification feed with read state and preferences, derived reminders, employment timeline view | **True real-time push** (the feed refreshes by refetch on focus; `src/features/realtime/feed-sync.ts` states this), email and Android push, application updates | unit, browser (fixtures) | No push provider | No | Provider decisions |
| 21 | Developer API and Integrations | PARTIALLY IMPLEMENTED | Hash-only keys with scopes, limits and metering, signed webhooks (best effort), OpenAPI document | Persistent delivery queue, developer portal, activity-log view | unit, real PG, harness | Needs the credential signing key | No | Owner decisions |
| 22 | Entitlements and Business Infrastructure | PARTIALLY IMPLEMENTED | Plan catalog (essential protections never gated), operator-assigned user and organization plans, metering for credentials and listings | Billing, subscriptions, invoices, usage beyond two meters | unit, real PG | **No payment provider** | No | Payment provider, legal text, adult account holder |

## Part 2: the expanded tool collection (honest inventory)
Legend: **DONE** = implemented and locally end-to-end tested; **PARTIAL** = a real slice exists; **NOT BUILT** = nothing implemented. A menu item never counts. Where a tool needs AI it is also blocked until the owner configures a provider.

**Career Studio.** AI CV Builder: PARTIAL (CV Builder, no AI writing). CV Analyzer: NOT BUILT. ATS Compatibility Checker: NOT BUILT (the CV prints as plain single-column text only). Cover Letter Studio: NOT BUILT. Portfolio Builder: NOT BUILT. Skills Inventory: PARTIAL (self-reported skills panel, CV skills). Skill Assessment, Skill Gap Analyzer, Career Roadmap, Career Path Explorer, Career Progress Tracker: NOT BUILT.

**Opportunity Studio.** Smart Job Matching: PARTIAL (explainable matching). Advanced Job Search: PARTIAL. Remote Work Finder: PARTIAL (work-arrangement preference only). Opportunity Comparison: DONE. Saved Opportunities: DONE (with private history). Employer Discovery: PARTIAL (company research). Interview Preparation Studio: PARTIAL (fixed-rule preparation in guidance). Global Job Explorer, Internship, Freelance, Scholarship and Training Finders, Recruiter Discovery, Application Tracker, Interview Tracker, Application Assistant, Follow-up Assistant: NOT BUILT (there is no live job source; ORYQEN only shows organization-created listings and never invents jobs).

**Trust Studio.** Offer Intelligence Scanner: DONE (screenshot scan and report). Missing Information Detector: DONE. Recruitment Scam Detector: DONE (rules). Offer Comparison: DONE. Contract Intelligence: PARTIAL (clause analysis of any pasted text). Fairness Analyzer: PARTIAL (20-point rules). Employer Verification, Recruiter Verification, Company Research Center: PARTIAL. Employment Risk Reports: PARTIAL (report screen, print to PDF). Salary Fairness Checker: PARTIAL (no benchmark data). Employment Rights Information: PARTIAL (Germany only). Trust History: PARTIAL (Trust Chain). Verification Report Generator: NOT BUILT.

**Employment Studio.** Offer Management, Agreement Manager, Version History, Work Records, Work Evidence Manager, Work Verification Requests, Disputes, Appeals, Resolution Tracking: DONE (local). Agreement Builder: PARTIAL (no templates or clause editor). Employment Timeline: PARTIAL. Digital Signing Workflow: NOT BUILT (confirmations are recorded; no signature provider; no legal claim). Task and Milestone Tracker: NOT BUILT.

**Professional Identity Studio.** My Work Passport, Verified Experience, QR Verification, Passport Sharing, Experience Verification: DONE (local). Credential Wallet: PARTIAL. Reference Management: PARTIAL (CV references only). Verification History: PARTIAL. Achievement Wallet, Professional Reputation: NOT BUILT.

**Professional Workroom.** Goal Manager, Task Manager, Project Workspace, Milestone Planner, Deliverable Manager, Team Collaboration, Document Workspace, AI Task Assistant, Progress Analytics, Approval Workflows, Outcome Tracker: all NOT BUILT (Priority 3).

**AI Intelligence Center.** The shared orchestration layer exists for **one** use case: the gateway in `src/server/ai` (provider abstraction, consent, redaction, budgets, circuit breaker, strict output validation, telemetry) serves offer analysis, so "Offer Intelligence AI" and "Contract Intelligence AI" are PARTIAL (verified live locally, off on staging). Career, CV, Opportunity, Employer, Recruitment Risk, Fairness, Salary, Skill, Interview, Document, Work, Localization Intelligence AI and an AI ORYQEN Copilot: NOT BUILT. Each would be a new consent notice and a new grounded schema on the same gateway.

## Part 3: the offer-intelligence journey, step by step (directive section 6)
| Step | Status | Evidence or gap |
|---|---|---|
| 1 Authenticate | DONE | real Auth, MFA, harness |
| 2 Upload a document | PARTIAL | images, PDFs and Word files are **read on the device and never uploaded** (a privacy choice) |
| 3 Validate the file | DONE | type, size, dimension and content checks |
| 4 Store securely | NOT BUILT for analysis input | by design the source file is not kept; the Evidence Vault stores files the person chooses to keep |
| 5 Create a processing job | NOT BUILT | analysis runs inside one request; no job table or queue |
| 6 Extract text | DONE | on-device reader, PDF and Word readers, live seconds shown |
| 7 AI analysis through a configured provider | DONE when configured | verified locally on made-up text; off on staging |
| 8 Validate and save findings | PARTIAL | findings are validated strictly; AI answers are **not saved** (policy decision); rules analyses can be saved to history |
| 9 Processing updates | DONE | real stages in the popup (no fake progress) |
| 10 Report in the workspace | PARTIAL | report screen exists; after a reload it is rebuilt from saved terms with the rules only |
| 11 Revisit the report | PARTIAL | saved offers and analysis history yes; AI report no |
| 12 Download | PARTIAL | print or save as PDF; no server-built file |
| 13 Audit record | PARTIAL | consent receipts and telemetry without content; no per-analysis audit entry the person can browse |

A persisted AI report (steps 5, 8, 11) is a **policy decision for the owner**: storing offer text and model answers contradicts the current "nothing is kept" promise in the AI gateway design.

## Part 4: real-time, AI and security status
- **Real-time:** no Supabase Realtime subscription exists in the app. Notifications refresh by refetch (on load, focus and retry) and are labelled that way. A Realtime authorization migration was proposed earlier and never applied. Real-time is NOT IMPLEMENTED and not verified.
- **AI:** the provider gateway is real; a live Gemini call on made-up text succeeded locally (`gemini-3.1-flash-lite`, about 21 s, validated, every quote grounded); the configured `gemini-3.8-flash` timed out. Staging has no AI configuration. No other AI tool exists.
- **Security checks done:** forced RLS and owner-only policies on every new table (PGlite and real PostgreSQL tests; hosted catalog check after applying three migrations), anonymous route and API denial (real stack and hosted), tenant isolation by API, MFA-aware recovery, secret scanner (0 findings), consent receipts before any send, strict output validation, SSRF-guarded research fetches, upload content sniffing.
- **Not done:** an external penetration test, load testing, signed-in hosted security checks, dependency audit refresh this session.

## Part 5: database migrations
62 migrations in `supabase/migrations`; **all 62 are recorded on `oryqen-staging`** (verified 8 Nov after a backup and an owner-approved apply). Pending anywhere: none. Production: no project chosen.

## Part 6: remaining blockers and required credentials
Needed from the owner: a Google Gemini key and written AI approval entered in Vercel (steps in `ORYQEN_AI_SETUP_STEPS.md`); a credential signing key; an Android keystore and a device; staging test accounts for signed-in hosted checks; decisions on AI report retention, account deletion, plans and pricing; legal text and an adult account holder for payments and app stores; a LinkedIn developer application (`ORYQEN_LINKEDIN.md`); licensed salary benchmark data; official sources for the UK, US, Australia and Canada rules.

## Part 7: what a "yes" on exhibition readiness would need
Not met today: signed-in hosted verification, real AI on staging, a rehearsed visitor path, demo accounts, an Android device run. Everything else in `ORYQEN_EXHIBITION.md` stands.
