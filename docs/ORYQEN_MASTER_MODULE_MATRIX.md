# ORYQEN master module matrix (Phase 0 audit, 17 Nov 2026)

Prepared by Agent 1 (release lead) from the repository at `93f4432` on `exhibition/dev-nov10`, the staging deployment at `b0e78d0` and the linked staging database (read-only catalog queries). **No code, data, deployment or setting was changed to produce this document.** No secret is quoted; the database project reference and all keys are deliberately omitted.

**Evidence legend.** **[V]** verified by me on 17 Nov 2026, method named. **[V13]** verified in the 13 Nov audit (`docs/ORYQEN_PRODUCTION_PROGRAM_AUDIT_20261113.md`) and **not re-run today**. **[R]** reported to me by the owner (a script they ran); I did not observe it. **[D]** stated in the repository's own documents, not re-verified. **[U]** unknown.

**Feature classes** (as the directive defines them): **PR** production-ready and independently verified; **IMP** implemented but not fully verified; **PART** partially implemented; **UI** UI only; **SIM** simulated or placeholder; **NOT** not implemented; **BLK** blocked by an external provider, legal requirement or infrastructure dependency.

## 0. Verdict

**0 of 24 modules are production-ready.** ORYQEN is a well-tested, security-conscious staging system with a strong database authorization model. It is not a prototype made of screens: 103 API routes, 67 migrations and about 1,150 passing automated tests are real. But no module meets the bar "works end to end on production architecture with independent verification", because no production environment exists, nothing has been verified on hosted infrastructure with independent accounts, there has been no independent security test, and several modules depend on providers, data licences or legal text that only the owner can obtain.

| Module-level status | Count | Modules |
|---|---|---|
| Production-ready and independently verified | **0** | none |
| Implemented, not fully verified | **9** | 4, 6, 7, 9, 10, 13, 18, 21, 23 |
| Partially implemented | **13** | 1, 2, 3, 5, 8, 12, 14, 15, 16, 17, 20, 22, 24 |
| Simulated or placeholder at its core | **1** | 11 |
| Not implemented at its core (blocked by data) | **1** | 19 |
| **Total audited** | **24** | |

## 1. Actual project state (Task 1)

### 1.1 Git, worktrees, backups
| Item | Finding | Evidence |
|---|---|---|
| Current branch and commit | `exhibition/dev-nov10` at `93f4432` | [V] `git` |
| Branch roles | Dev branch `exhibition/dev-nov10` is 326 commits ahead of `main` (`7b97b74`, 23 Oct, 0 behind). Staging branch `release/oryqen-oct27` = `b0e78d0`. **There is no production branch or production deployment.** | [V] `git rev-list`, `git ls-remote` |
| Remote branches | `main`, `release/oryqen-oct27`, `exhibition/dev-nov10`, `integration/final-release`, `feature/oryqen-release-parallel` | [V] |
| Registered worktrees (10, all preserved) | main checkout; `fairwork-release` (`deploy/staging-cherry` at `b0e78d0`, the staging cherry-pick lane); `fairwork-android-agent` and `fairwork-windows-agent` (both `de645ec`); `fairwork-offer`, `fairwork-qa`, `fairwork-ui` (`feature/oryqen-*-parallel`); `fairwork-ui-agent` (`agent/ui-exhibition`); **`fairwork-ui-replication` (`agent/ui-replication`, Agent 6)**; one detached recovery worktree under `Documents\Codex\...\build-recovery` | [V] `git worktree list` |
| Uncommitted changes | `next-env.d.ts` (tooling-generated), untracked `.claude/`, two untracked 13 Nov documents (`ORYQEN_PRODUCTION_PROGRAM_REPORT_20261113.md`, `ORYQEN_REPOSITORY_PRIVACY_REMEDIATION_PLAN_20261113.md`), `landing/v6/next-env.d.ts`. Left alone deliberately. | [V] `git status` |
| Agent 6 work | `agent/ui-replication` has **2 commits not in the dev branch** (`1e36d1f` dashboard, `04670d8` six priority screens; 49 files, +749/-5, includes reference and before images). A dry-run merge into the current dev branch (`git merge-tree`) reports **no conflicts**. Its worktree has no uncommitted work. **Preserved, not integrated.** | [V] |
| Backups | Local git bundles `REPO-BACKUP-20261113` and `REPO-BACKUP-20261116` and `ROLLBACK-published-2026-11-12` in `ORYQEN-EXHIBITION-DELIVERABLES`; 8 logical staging backups under git-ignored `backups/` (latest `20261116-1234Z`, 138 tables, 911 rows). Hosted: daily WAL-G, **PITR disabled, no restore ever rehearsed** | [V] local; hosted [V13] |

### 1.2 Architecture
| Layer | Finding | Evidence |
|---|---|---|
| Frontend | Next.js 16.4.1 (App Router), React 19.3, TypeScript, zod 4. 456 source files, 19 pages; the signed-in product is one dynamic route `/app/[screen]` rendering client components from `src/components/fairwork`. Design system in `ui-v2.css` plus per-feature CSS. i18n catalogs: English, Sinhala, Tamil, German. | [V] filesystem, `package.json` |
| Backend/API | Next.js route handlers: **103 routes** under `/api/v1/*` in 33 groups (vault 13, offers 10, auth 10, recruiter 8, developer 7, operator 7, organizations 4, others fewer). Every mutating route is policed by a static test (`tests/unit/api-route-audit.test.ts`): same-origin check, response envelope, no raw bodies, no client-supplied identity or role. | [V] filesystem; test passes in the 179-file suite run on 16 Nov [V] |
| Data | Supabase Postgres 17.11 (staging, `UTC`). Browser never touches tables: all access is through **143 `security definer` functions in schema `api`**, backed by 100 `private` tables. | [V] catalog |
| Database | **67 migrations**, 67 recorded on staging, latest `20261116090000` (applied 16 Nov with owner approval). | [V] `schema_migrations` |
| Auth and authorization | Supabase Auth (email and password, TOTP MFA, recovery); registration is **off unless `AUTH_REGISTRATION_ENABLED=true`**. Server resolves identity from the session; capabilities are database-held; admin console MFA-gated. | [V] code; MFA/recovery behavior [D] |
| Storage | One private bucket `evidence-vault`, 5 MiB limit, no storage policies (all access via signed URLs issued by server RPC). No malware scanning. | [V] catalog |
| AI execution paths | Gateway `src/server/ai` supports Gemini, OpenAI and self-hosted providers. A provider is usable only when `ORYQEN_AI_ENABLED` and `ORYQEN_AI_POLICY_APPROVED` are `true` and a per-provider written approval reference, region, data-use text, key and model are set; per-person consent receipts; redaction; budgets; breaker. **On staging AI is OFF** (the hosted script reports "UNCONFIGURED, nothing invented"). The rules-based assessment engine (20 criteria) is the real analysis path today. | [V] code; staging state [R] 17 Nov |
| Android | Capacitor 8.5.3 **wrapper of the hosted site** in `mobile/poc` (no static export, no native logic). `compileSdk` 36, `targetSdk` 36, `minSdk` 24, AGP 8.13.0, Gradle 8.14.3. Development package id `org.fairwork.localpoc`. Release variant exists but is **disabled** unless an owner-supplied application id and https origin are passed. See `ORYQEN_ANDROID_PLAYSTORE_READINESS.md`. | [V] build files |
| Windows | Electron shell in `desktop/` (unsigned installer, default icon) | [D] |
| Web deployment | Vercel; **two projects (`fairwork`, `oryqen`) both build every commit**; staging alias `oryqen-staging.vercel.app` serves `b0e78d0`, a Preview environment. No `vercel.json`. | [V] GitHub status contexts; project settings [U] |
| Tests | 141 unit files, 38 integration (PGlite plus real-PostgreSQL SQL suites), 104 e2e specs (Playwright, Chromium), 4 hosted scripts, 6 admin-browser specs, 2 live-provider tests. Last full `vitest run`: **179 files, 1,154 passed, 17 skipped, 0 failed** (16 Nov). | [V] |
| CI | One workflow `verify` on **Windows only**: install, brand and OCR prep, typecheck, lint, `npm test`, Android POC verification, five embedded-PostgreSQL suites, isolated Playwright suite, admin browser suite, build, staging package. Green on `edada27`, `046634d`. Takes 20 to 25 minutes. | [V] `gh run list` |
| Staging vs production configuration | Staging: Supabase project `oryqen-staging` (ap-southeast-1), registration and AI off. **Production: does not exist** (no project, no Vercel production environment, no domain). Vercel environment-variable scopes and Supabase Auth dashboard settings were not inspected. | [V13] / [U] |
| External integrations (actual status) | GLEIF company registry: **connected** (read-only lookups, source and time shown) [D]. AI providers: **not connected** (off). Email: **Supabase default sender only**; no production sender domain. Push: **none**. Payments: **none** (no billing offered). E-signature: **none**. Malware scanning: **none**. LinkedIn, Facebook, Instagram, Fiverr: **not connected, no authorization** (see module 24). Salary and occupation datasets: **none**. | [V] code, [V] hosted script |

### 1.3 Verified changes against the 13 Nov audit
| Item | 13 Nov | 17 Nov | Evidence |
|---|---|---|---|
| Migrations on staging | 66 | 67 | [V] |
| RLS | 100/100 enabled and forced | **unchanged: 100/100**, 0 tables without forced RLS, 0 direct anon or authenticated INSERT/UPDATE/DELETE/TRUNCATE grants | [V] |
| `api` functions | 143, all pinned `search_path`, 2 anon-executable | **unchanged**: 143, 0 unpinned, only `credential_status` and `developer_key_check` anon-executable, 0 PUBLIC-executable; 0 `private` functions executable by anon or authenticated | [V] |
| `npm audit --omit=dev` | 0 vulnerabilities | **1 moderate**: `next` 16.4.1 (range 16.3.0 to 16.4.4), information disclosure across root params when a `use cache` function is called through `unstable_cache()`; fix 16.4.6. The repo uses neither `use cache` nor `unstable_cache`, so the advisory is probably not reachable, but the upgrade is cheap and should be taken | [V] `npm audit`, `grep` |
| CSP | no `script-src` or `default-src` | **unchanged** (only `frame-ancestors`, `object-src`, `base-uri`, `form-action`) | [V] `curl -I` |
| Branch protection | none | **required check `verify` on all three branches, force push and deletion blocked, admins not enforced, no required PR review**; secret scanning and push protection **enabled**; Dependabot security updates **disabled**; repository still **public**; **no pull request has ever been opened** | [V] `gh api` |
| Staging AI | off | off | [R] |

## 2. The 24-module inventory (Task 2)

Notation per module: **Status** (module level); **Features** classified PR / IMP / PART / UI / SIM / NOT / BLK; then existing, missing, dependencies, Android, security, integrations and the acceptance evidence required before the module may be called production-ready. "Hosted proof" means exercised signed in on staging with the independent accounts the module needs. Unless stated, **hosted proof is not done**. Everything marked IMP has automated tests that pass in CI [V]; none has independent verification.

### 1. AI Employment Intelligence: **PART**
- **Features.** Paste, scan (on-device OCR), PDF/Word intake: IMP. 20-criterion rules-based assessment, clause and missing-term findings, report with limits: IMP. AI gateway (Gemini, OpenAI, self-hosted) with consent, redaction, budgets, breaker: IMP, **never run live on hosted**. AI-generated analysis: **BLK** (provider contract, written approval, key, model).
- **Backend/DB.** `offers/*` (10 routes), analysis history, AI consent and notice migrations. **Screens.** Add offer, Scan, Check, Report. **Android.** same web screens; OCR and camera behavior on devices untested [U].
- **Missing.** Evaluation set, cost dashboard, live AI proof. **Security.** Redaction, strict output schemas, no content in audit; prompt-injection defenses are by design but not red-teamed [D].
- **Acceptance.** AI-on results schema-valid with every quote grounded across a 200-document evaluation set, measured precision; budget cap enforced in a failure test; consent withdrawal stops sending; rules path remains when AI is off.

### 2. Employer and Company Intelligence: **PART**
- **Features.** GLEIF registry research with source and timestamp, saved history: IMP. Organization claims shown as unverified: IMP. Other registries, claim-vs-registry comparison, company reports: **NOT**; registry licences for other countries: **BLK**.
- **Backend/DB.** `research/*`, `companies`, research history table. **Security.** SSRF-guarded fetch, per-user limits. **Acceptance.** Registries of the launch countries integrated; each result carries source, timestamp, freshness; contradictions surfaced; no unverified claim rendered as verified.

### 3. Career Intelligence and Matching: **PART**
- **Features.** CV Builder, CV analyzer (rules), explainable listing match, preferences, saved-listing history: IMP (hosted API PASS, one account [R]). Skill-gap explorer, Career assistant (fixed rules): **SIM** (a labelled sample framework). Labour-market occupation taxonomy: **BLK** (licensed or official dataset).
- **Backend/DB.** `cv`, `opportunities`, `records`. **Acceptance.** Sourced taxonomy with licence recorded; gap output cites it; sample data removed from the production build.

### 4. Employment Offer Workspace: **IMP**
- **Features.** Drafts, revisions, notes, documents, comparison, decisions: IMP (PGlite, real PostgreSQL, CI browser). Hosted organization journey: not run (needs an organization the account may use; NOT RUN in every hosted script).
- **Acceptance.** Two-account journey on production-like infrastructure; export and restore of an offer set.

### 5. Digital Employment Agreements: **PART**
- **Features.** Versioned proposals, independent acknowledgement, decisions, expiry and renewal, integrity hash, side-by-side comparison: IMP. Clause editor, templates, supporting documents, dispute linkage: **NOT**. **E-signature: NOT (and none is claimed); BLK** (provider decision, counsel).
- **Acceptance.** Counsel-reviewed templates; provider integration with audit evidence; a signed agreement verifiable independently; two-account hosted journey.

### 6. Evidence Vault and Work Records: **IMP**
- **Features.** Private uploads, signed 60 s downloads, deletion, correction notes, resolve, revoke, reinstate, owner-only: IMP, **hosted API PASS with one account** [R 17 Nov: upload, same-bytes download, delete, status flow, foreign document answers 404]. Malware scanning: **NOT**. Attach to disputes or shares: **NOT**.
- **Backend/DB.** `vault/*` (13 routes), vault events, work evidence. **Android.** WebView file chooser path untested on device. **Acceptance.** Malware scan before availability; cross-user 404 proven on hosted with two accounts; restore of deleted evidence per policy.

### 7. Work Passport: **IMP**
- **Features.** Verified-only passport, named-recipient time-limited sharing, revocation, signed JSON, print copy: IMP. Signed PDF, skills in shared passport: **NOT**. Employer-verified record on hosted: not run (needs an employer account).
- **Dependency.** Production signing key (**BLK**: key ceremony). **Acceptance.** Employer-verified record appears; revoked or expired share returns nothing; independent verifier validates the signed copy.

### 8. Employer and Organization Portal: **PART**
- **Features.** Requests, independent approval, roster, listings, applicant management with minimal sharing, cross-company isolation (PGlite): IMP. **Employer verification is a demonstration authority (`demo-authority.v1`), not a real identity or registry check: SIM.** Recruiter permissions, team changes: **NOT**. Never used signed in as an organization on staging.
- **Acceptance.** Real verification method chosen and implemented; two independent approvers proven on hosted; cross-tenant read attempts all denied in an API authorization suite.

### 9. Disputes and Appeals: **IMP**
- **Features.** 12 categories, reviewer assignment with conflict checks, follow-ups, appeals (34 real-PostgreSQL tests): IMP. Confidential attachments, organization response workflow: **NOT**. Hosted: needs independent reviewer capability (NOT RUN).
- **Acceptance.** Conflict-of-interest and independence enforced on hosted with three accounts; SLA tracking; counsel review of process wording.

### 10. Tamper-Evident Trust Ledger: **IMP**
- **Features.** Append-only triggers, hashed snapshots, global hash chain with admin verification, tamper tests: IMP (local, CI). It is not a blockchain and does not claim to be. External timestamping, scheduled verification with alerting: **NOT**.
- **Acceptance.** Scheduled chain verification with alerting; tamper drill on a restored copy.

### 11. ORYQEN AI Copilot: **SIM**
- **Features.** Shipped assistant is a fixed-rule DEMO (Career assistant) labelled as such: SIM. Model-backed path through the consented gateway exists in code (`/api/v1/career-assistant`), **off**, never verified live: IMP-unverified; **BLK** (provider, approval).
- **Acceptance.** As module 1 plus conversation retention and deletion, and an evaluation set for harmful or legal-advice drift.

### 12. Security and Privacy Infrastructure: **PART**
- **Features.** Forced RLS everywhere, origin checks, quotas, MFA, data export, privacy requests, security activity, secret scan: IMP/PR-at-database-level (verified live today, see the security plan). Executed account deletion and erasure: **NOT**. Passkeys: **NOT**. Independent test: **NOT**. Cross-user isolation on hosted: **NOT** verified.
- **Acceptance.** Erasure workflow with legal sign-off; second-account isolation suite on hosted; penetration test with no open high findings.

### 13. Administration and Governance Center: **IMP**
- **Features.** MFA-gated console, queues, settings, audit viewer, chain check (27 DB tests, 14 admin browser tests): IMP. Account moderation, operational monitoring: **NOT**. Never used signed in on staging.
- **Acceptance.** Two operators on hosted; separation of duties proven; every admin action audited.

### 14. Premium Multiplatform Experience: **PART**
- **Features.** Responsive web, axe checks on 15 screens in two color schemes, design system v2, phone navigation: IMP. **Reference-accurate replication (Agent 6): built on `agent/ui-replication`, not integrated.** Android and Windows are **thin wrappers**, debug-signed and unsigned: PART. iOS: **NOT**. Manual screen-reader audit: **NOT**.
- **Acceptance.** Release-signed builds, store-ready identity, device matrix runs, manual accessibility audit, Agent 6 work integrated and visually accepted.

### 15. Global Localization: **PART**
- **Features.** English, Sinhala, Tamil, German catalogs: IMP. Sinhala and Tamil are machine-assisted drafts: **not reviewed**. Screens added in the last weeks (including the two new career screens) are **English-only by explicit exception** in the coverage test.
- **Acceptance.** Native review sign-off per language; coverage test with no English fallback on launch screens.

### 16. Country-Aware Employment Intelligence: **PART**
- **Features.** Germany rules with quoted sources and dates: IMP. Other countries state their limitation: IMP. **Sri Lanka (the launch market): NOT; BLK** (official sources, counsel). UK, US, Australia, Canada: NOT.
- **Acceptance.** Per country: sourced, dated, counsel-reviewed rules with a staleness alarm. Sri Lanka first.

### 17. Recruiter Scam Intelligence: **PART**
- **Features.** Wording and domain indicators, private reporting with triage, recruiter confirmation and domain proof, live demo on `/try`: IMP. Right-of-reply and correction procedure for a named party: **NOT**. Hosted DNS egress: unverified.
- **Acceptance.** Right-of-reply workflow; defamation-safe wording reviewed by counsel; no verdict language.

### 18. Verifiable Credentials and QR: **IMP**
- **Features.** Ed25519 issuance, revocation, public status, QR, published keys, tamper tests: IMP. Staging reports the signing key as configured [R 17 Nov]; **production key ceremony and custody: BLK/NOT**.
- **Acceptance.** Key in managed secret storage with rotation and revocation procedure; public key set pinned; issuance verified on hosted by an independent verifier.

### 19. Salary Intelligence and Benchmarking: **NOT at its core**
- **Features.** Normalization and comparison against reference points the person adds themselves (with source type and date): IMP. **Any benchmark data: NOT; BLK** (licensed or public dataset). The UI invents no figures.
- **Acceptance.** Sourced dataset with licence, freshness and geography; the UI refuses to show a benchmark without a source.

### 20. Notifications and Employment Timeline: **PART**
- **Features.** In-app feed with preferences, derived reminders, employment timeline: IMP (refetch, no Realtime; hosted feed loads, 0 items [R]). Email and push: **NOT; BLK** (providers, sender domain). Unified event timeline: PART.
- **Acceptance.** Delivery with bounce handling and opt-out proven on the production sender domain.

### 21. Developer API and Integrations: **IMP**
- **Features.** Scoped hash-only keys, verify endpoint, limits, signed webhooks, OpenAPI: IMP; **hosted: key create, use, revoke PASS** [R]. Persistent webhook delivery queue, developer portal, organization keys: **NOT**.
- **Acceptance.** Retried, ordered webhook delivery with dead-letter handling; per-key rate limits under load.

### 22. Entitlements and Business Infrastructure: **PART**
- **Features.** Plan catalog, operator-assigned plans, metering; hosted plan check PASS (`worker_free`, no billing) [R]: IMP. Billing, subscriptions, invoices: **NOT; BLK** (payment provider, tax, legal text). None is claimed.
- **Acceptance.** Either a launch decision to ship free-only (and relabel the module) or a reviewed payment integration with refunds and tax handling.

### 23. AI Career Gap Analyzer and Personalized Learning Path: **IMP**
- **Features.** Career goal profile persisted in the private records service, gap analysis with self-reported / demonstrated / proof-described levels (nothing ever shown verified), roadmap, progress, 17 free courses whose links were opened on 16 Nov: IMP (14 unit, 3 DB, 11 local browser tests; **hosted API PASS** save/read/update/refuse/delete [R 17 Nov]). It is **rules-based, not AI**: the "AI" in the module name is **not delivered** (AI generated explanations: **BLK**).
- **Limits.** Requirements are an editorial reference framework (9 roles, not labour-market data: **SIM-class data**); courses exist only for web development and data analysis; no Coursera/edX; English only; the new screens have **not been seen signed in on staging**.
- **Acceptance.** Sourced occupation taxonomy; course catalog per launch role with link-freshness job; learning outcomes never presented as qualifications; hosted browser journey; localization.

### 24. AI Opportunity Intelligence: **PART**
- **Features.** Transparent matching of real ORYQEN listings against goal, skills and preferences with per-criterion explanation: IMP (unit, browser). Feedback (like, dislike, save, hide, not relevant, applied) with reset, persisted privately: IMP (hosted API PASS [R]). Connection center with honest states: IMP (UI). **Outside platforms: none connected** (LinkedIn's Job Posting API is partner-restricted and was not accepting new partners on 16 Nov; Meta and Fiverr: no documented permitted path found): **BLK**. **Scheduled refresh (hourly, daily): NOT**, nothing scheduled. Staging has **0 published listings**, so live recommendations are empty there. No AI.
- **Acceptance.** At least one genuine external source with authorization and rate-limit compliance; deduplication and freshness checks; scheduled refresh with last-run and next-run times; deletion of imported data on request.

## 3. Module counts by feature class (all 24)
These counts classify the **major features** listed above (a feature appears once). They are a reading aid, not a precise measure.

| Class | Approx. features |
|---|---|
| PR (production-ready, independently verified) | 0 |
| IMP (implemented, tests pass, not independently or hosted-with-multiple-accounts verified) | about 55 |
| PART | about 12 |
| UI only | about 2 (connection center buttons, Windows/Android shells) |
| SIM (simulated, placeholder, sample data, demo authority) | 6: Career assistant, sample career framework, employers-demo, demo center, Day-3 demo route, demonstration organization authority |
| NOT (not implemented) | about 30 |
| BLK (external provider, legal or data dependency) | about 14 |

## 4. Surfaces that must not reach production as they are
Sample or demonstration content reachable in the build today: `/app/career-explorer`, `/app/career-assistant`, `/app/employers-demo`, `/app/demo` (Demo center, loads clearly marked sample records), `/try` public demo hub, `/day3` legacy route, the demonstration organization authority and the `demo_provisioned` assurance label on listings. All carry on-screen labels today. **Acceptance gate:** a build flag or removal so none is reachable in production, plus a test that fails if one is.
