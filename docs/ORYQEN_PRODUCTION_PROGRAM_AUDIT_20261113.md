# ORYQEN international production program: first deliverable (13 Nov 2026)

Prepared by the release engineering lead from the repository at `fa685bc` (`exhibition/dev-nov10`), the staging deployment at `7709513` (`release/oryqen-oct27`), the linked staging database (read-only catalog queries), GitHub settings and the Vercel dashboard. No code, data, deployment or setting was changed to produce this document.

**Evidence legend.** **[V]** verified by me on 12-13 Nov 2026 with the method named. **[D]** documented in the repository's own reports and not re-verified by me. **[A]** assumption. **[U]** unknown.

## 0. Verdict

ORYQEN is **not production-ready and cannot honestly be launched publicly today**. It is a well-tested, security-conscious staging system with a strong database authorization model. Strictly applying the directive's rule ("never declare a module production-ready without evidence"), **0 of 22 modules are Class A**.

| Class | Count | Modules |
|---|---|---|
| A. Production-ready, verified with evidence | **0** | none |
| B. Partially implemented | **20** | 01-10, 12-18, 20-22 |
| C. Demo/simulated | **1** | 11 (AI Career Copilot: fixed-rule demo) |
| D. Missing at its core | **1** | 19 (benchmark data; a user-supplied comparison tool exists) |

The limiting factors are not mainly code. They are: no production environment at all, no multi-role verification on hosted infrastructure, no independent security test, no legal text, no provider approvals (AI, email, signing), and data and legal sources that must come from outside the team (salary benchmarks, country rules).

## 1. Current-state technical audit

### 1.1 Verified facts

| Area | Fact | Evidence |
|---|---|---|
| Repository | 325 commits since 6 Oct 2026; `exhibition/dev-nov10` = `fa685bc`; `release/oryqen-oct27` = `7709513`; `main` = `7b97b74` (23 Oct, **313 commits behind**) | [V] `git`, `gh` |
| Stack | Next.js 16.4.1, React 19.3, TypeScript, Supabase (Postgres, Auth, Storage), zod 4, Capacitor Android shell, Electron Windows shell, Playwright and Vitest | [V] `package.json` |
| Size | 480 source files, 103 API routes, 19 pages, 66 migrations, 150 documents | [V] filesystem |
| Tests in repo | 139 unit files, 37 integration files, 100 e2e specs, 4 hosted scripts, 6 admin-browser specs, real-PostgreSQL SQL suites | [V] filesystem |
| Browser regression on `74b39cc` | **739 tests: 725 passed, 14 skipped, 0 failed**; the 14 are registration-gated specs, re-run with registration enabled: 24/24 passed | [V] local run 12-13 Nov |
| CI | Green on `74b39cc`, `fa685bc`, `4e06dd2`, `7709513` (typecheck, lint, vitest, 5 PostgreSQL suites, isolated browser suite, admin browser, build, secret scan) | [V] `gh run list` |
| Dependencies | `npm audit --omit=dev`: **0 vulnerabilities** | [V] today |
| Secrets | Repo scanner: 0 unexplained findings over 1,232 files. History scan for key patterns: 4 hits, all benign (a minified wasm match, one obviously fake `not…` fixture, throwaway `127.0.0.1` local-dev DB URLs). No private keys, JWTs or provider keys found | [V] today; values never printed |
| Database, staging | **100/100 tables RLS enabled and forced**; 0 anon or authenticated direct DML; 143 `SECURITY DEFINER` functions in `api`, **all with pinned `search_path`**; only **2** executable by `anon` (`credential_status`, `developer_key_check`, both intended public checks); 0 executable by `PUBLIC`; 96 functions in `private` with 0 anon or authenticated execute | [V] read-only catalog queries |
| Migrations, staging | 66 of 66 applied, including `20261112100000_ai_assistant_notice.sql` | [V] `migration list --linked`, catalog |
| Storage, staging | One bucket `evidence-vault`, **private**, 5 MiB limit | [V] catalog |
| Staging users | 7 accounts, 0 anonymous | [V] catalog (counts only) |
| HTTP surface, staging | Anonymous API calls return 401, cross-origin POST returns 403, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`; CSP contains only `frame-ancestors`, `object-src`, `base-uri`, `form-action` (**no `script-src`/`default-src`**) | [V] curl |
| Route audit | A static test fails the build if a mutating route lacks the same-origin check, bypasses the response envelope, reads raw bodies, or trusts a client-supplied user id, role or capability | [V] `tests/unit/api-route-audit.test.ts` read |
| Bypass check | No test-mode or smoke flag exists in application source; data mode and origin are validated at startup; AI is fail-closed unless `ORYQEN_AI_ENABLED` and `ORYQEN_AI_POLICY_APPROVED` are both `true` | [V] code read |
| Staging deployment | Alias `oryqen-staging.vercel.app` serves `release/oryqen-oct27` at `7709513`, Ready, environment **Preview** | [V] Vercel dashboard |
| Downloads | Public APK (4,121,028 B, `8d4a1e1b…53cc8f`) and Windows installer (121,261,243 B, `bd27ed2f…b393e3`) match their published checksums; a clean APK rebuild is byte-identical | [V] re-downloaded and hashed |
| Installed-app test | Rebuilt Windows installer: silent install and launch pass (5/5) against staging. Android install not tested (emulator needs 12 GB free; C: has 4.3 GB) | [V] |

### 1.2 Verified gaps and corrections to earlier reports

1. **The GitHub repository is public** [V]. Source, migrations, threat models and security reviews are world-readable. **Branch protection is off on all three working branches, secret scanning and push protection are disabled, Dependabot security updates are off, and no pull request has ever been opened** [V]. The directive's gate "reviewed changes" has therefore never been exercised.
2. **Staging backups:** daily WAL-G enabled, **PITR disabled, no physical backups listed** [V]. A restore has never been rehearsed against hosted data [D].
3. **My first static scan reported 25 `private` tables without RLS. That was a false positive** of my own parser; the live catalog shows all 100 with RLS enabled and forced. Recorded so the same mistake is not repeated.
4. `ORYQEN_PRODUCTION_READINESS_AUDIT.md` (28 Oct) is stale on several points: the migrations are no longer pending (66 applied), a private Storage bucket now exists on staging, and the module counts changed. This document supersedes it.
5. Two Vercel projects (`fairwork` and `oryqen`) both build every commit [V, GitHub status contexts]. Purpose of `fairwork` is [U].
6. The Supabase organization holds seven projects; besides `oryqen-staging` there is an active `Fairwork` project (created 7 Oct, `ap-south-1`) whose role is [U] and which must not be mistaken for production.
7. CI runs on Windows only with Chromium only; no hosted, performance, load or cross-browser tests run in CI [V workflow read].
8. **Full local unit and integration run (13 Nov, Windows, IST): 175 of 176 files passed; 1,131 tests passed, 17 skipped, 3 failed**, all three in `tests/integration/admin-db.test.ts`. Cause reproduced [V]: the test builds its date window from the **UTC** date while the in-process PostgreSQL session uses the **machine's timezone**, so on a non-UTC machine in the hours after local midnight the window excludes the records just created. With `TZ=UTC` the same file passes (28 passed, 3 skipped). The hosted staging database reports `TimeZone = UTC` [V], and CI runs in UTC and is green, so this is **not a product defect**. It is a test-portability weakness (P3): the harness should pin its database timezone to UTC like production. No test was changed.
9. **Signed-in screens on staging were not re-reviewed live in this audit** [U]; the earlier 17-pass signed-in run of 10 Nov used one account [D].

### 1.3 Not inspected (stated plainly)

Vercel project settings (the dashboard session expired during the audit): production branch, domains, environment variable names and scopes [U]. Supabase Auth dashboard settings (email sender, rate limits, MFA enforcement) [U]. Anything requiring a second authorized account.

## 2. The 22-module matrix

Classes: **A** production-ready with evidence, **B** partially implemented, **C** demo/simulated, **D** missing. Tests quoted are in-repo suites passing in CI [V] unless marked [D]. "Hosted proof" means exercised signed in on staging with the independent accounts the module needs; for all modules except as noted it is **not done** [D].

### 01 AI Employment Intelligence (B)
- **Works:** paste, scan (on-device OCR), PDF and Word intake; 20-criterion rule-based assessment; clause and missing-term findings; report with limits; consented AI gateway code (Gemini, OpenAI, self-hosted) with budgets and breaker.
- **Backend/DB:** `offers/analyze`, analysis history tables, AI consent and notice migrations (applied).
- **Security:** consent receipts, redaction, strict output validation, no content in audit.
- **Dependencies:** AI provider key, written policy approval, model choice (configured model overloaded on 28 Oct).
- **Missing:** no real AI on staging; no evaluation set; no cost dashboard.
- **Acceptance:** AI-on results are schema-valid and every quote grounded across a 200-document evaluation set with measured precision; budget cap enforced in a failure test; consent withdrawal stops sending; rules path remains available when AI is off.

### 02 Employer and Company Intelligence (B)
- **Works:** GLEIF research with source and time, saved history, organization requests, unverified claims.
- **Missing:** other registries, claim-versus-registry comparison, company reports.
- **Dependencies:** registry keys or licences. **Security:** SSRF-guarded fetch, per-user limits.
- **Acceptance:** at least the registries of the launch countries integrated; each result carries source, timestamp and freshness; contradictions surfaced; no unverified claim ever rendered as verified.

### 03 Career Intelligence and Matching (B)
- **Works:** CV builder, CV analyzer, explainable listing matching, saved history, preferences, skill-gap explorer.
- **Defect/limit:** roles and skills are a **sample framework**, not labour-market data.
- **Dependency:** sourced occupation dataset. **Acceptance:** sourced taxonomy with licence recorded; gap output cites it; sample data removed from the production build.

### 04 Employment Offer Workspace (B)
- **Works:** drafts, revisions, notes, documents, comparison, decisions (PGlite, real PostgreSQL, CI browser).
- **Hosted proof:** not run (needs an organization the account may use). **Acceptance:** two-account journey on production-like infrastructure; export and restore of an offer set.

### 05 Digital Employment Agreements (B)
- **Works:** versioned proposals, independent acknowledgement, decisions, expiry, integrity hash, side-by-side comparison.
- **Missing:** clause editor, templates, supporting documents, dispute linkage. **No e-signature, and none is claimed.**
- **Dependencies:** e-signature provider decision, legal review. **Acceptance:** counsel-reviewed templates; provider integration with audit evidence; a signed agreement verifiable independently.

### 06 Evidence Vault and Work Records (B)
- **Works:** private uploads, signed 60 s downloads, deletion, correction, revocation (signed-in staging PASS, one account).
- **Missing:** malware scanning, attach to disputes or shares. **Acceptance:** malware scan before availability; cross-user 404 proven on hosted with two accounts; restore of deleted evidence per policy.

### 07 Work Passport (B)
- **Works:** verified-only Passport, named-recipient time-limited sharing, revocation, signed JSON, print copy.
- **Missing:** signed PDF, skills in shared Passport; employer verification untested hosted. **Dependency:** production signing key. **Acceptance:** employer-verified record appears; revoked or expired share returns nothing; independent verifier validates the signed copy.

### 08 Employer and Organization Portal (B)
- **Works:** requests, independent approval, roster, listings, applicant management with minimal sharing, cross-company isolation (PGlite).
- **Missing:** recruiter role permissions, team changes; never used signed in as an organization on staging.
- **Acceptance:** two independent approvers on hosted; cross-tenant read attempts all denied in an API authorization suite.

### 09 Disputes and Appeals (B)
- **Works:** 12 categories, reviewer assignment with conflict checks, follow-ups, appeals (34 real-PostgreSQL tests).
- **Missing:** confidential attachments, organization response workflow. **Acceptance:** conflict-of-interest and independence enforced on hosted with three accounts; SLA tracking.

### 10 Tamper-Evident Trust Ledger (B)
- **Works:** append-only triggers, hashed snapshots, global hash chain with admin verification, tamper tests. It is not a blockchain.
- **Missing:** external timestamping. **Acceptance:** scheduled chain verification with alerting; tamper drill on a restored copy.

### 11 AI Career Copilot (C)
- **Reality:** the shipped assistant is a fixed-rule DEMO. A model-backed path exists in code since `74b39cc`, **off** until provider and approval are configured; never verified live.
- **Dependencies:** AI approval, consent schema, provider contract. **Acceptance:** same as 01 plus conversation retention, deletion, and an evaluation set for harmful or legal-advice drift.

### 12 Security and Privacy (B)
- **Works:** forced RLS (verified), origin checks, quotas, MFA, data export, privacy requests, security activity, secret scan.
- **Missing:** passkeys, executed account deletion, cross-user isolation on hosted, independent test.
- **Acceptance:** erasure workflow with legal sign-off; second-account isolation suite on hosted; pentest with no open high findings.

### 13 Administration and Governance (B)
- **Works:** MFA-gated console, queues, settings, audit viewer, chain check (27 DB tests, 14 admin browser tests).
- **Missing:** account moderation, operational monitoring; never used signed in on staging. **Acceptance:** two operators on hosted; separation of duties proven; every admin action audited.

### 14 Multiplatform Experience (B)
- **Works:** responsive web; axe checks on 15 screens in two colour schemes; Android and Windows are **thin wrappers of the hosted site** (debug-signed APK with a `localpoc` package id; unsigned installer with the default icon). No iOS.
- **Acceptance:** release-signed builds, store-ready identity, device matrix runs, manual screen-reader audit.

### 15 Global Localization (B)
- **Works:** English, Sinhala, Tamil, German catalogs. **Limit:** Sinhala and Tamil are machine-assisted drafts; screens added in the last weeks are English-only.
- **Acceptance:** native review sign-off per language; coverage test with no English fallback on launch screens.

### 16 Country-Aware Guidance (B)
- **Works:** Germany rules with quotes, sources and dates; other countries state their limitation honestly.
- **Gap against "international":** UK, US, Australia, Canada and **Sri Lanka** (the primary market) are absent. **Dependency:** official sources and counsel. **Acceptance:** per country, sourced rules, dated, counsel-reviewed, with a staleness alarm.

### 17 Recruiter Scam Intelligence (B)
- **Works:** wording and domain indicators, private reporting with triage, recruiter confirmation and domain proof, live demo on `/try`.
- **Missing:** correction procedure for a named party; hosted DNS egress unverified. **Acceptance:** right-of-reply workflow; defamation-safe wording reviewed by counsel; no verdict language (verified in demo).

### 18 Verifiable Credentials and QR (B)
- **Works:** Ed25519 issuance, revocation, public status, QR, published keys, tamper tests.
- **Dependency:** **production signing key ceremony**. **Acceptance:** key in managed secret storage with rotation and revocation procedure; public key set pinned; issuance on hosted.

### 19 Salary Intelligence and Benchmarking (D at its core)
- **Works:** normalisation and a comparison against reference points the person adds themself, with source type and date. No salary data is invented.
- **Missing:** any benchmark data. **Dependency:** licensed or public dataset. **Acceptance:** sourced dataset with licence, freshness and geography; the UI refuses to show a benchmark without a source.

### 20 Notifications and Timeline (B)
- **Works:** in-app feed with preferences, derived reminders, employment timeline. Refetch-based; no Realtime.
- **Missing:** email and push; unified event timeline. **Dependency:** email and push providers. **Acceptance:** delivery with bounce handling and opt-out proven on production sender domain.

### 21 Developer API and Integrations (B)
- **Works:** scoped hash-only keys, verify endpoint, limits, signed webhooks, OpenAPI (key create/revoke passes on staging).
- **Missing:** persistent delivery queue, developer portal, organization keys. **Acceptance:** retried, ordered webhook delivery with dead-letter handling; per-key rate limits under load.

### 22 Sustainable Business Platform (B)
- **Works:** plan catalog, operator-assigned plans, metering; no billing offered, none claimed.
- **Missing:** billing, subscriptions, invoices. **Dependency:** payment provider, tax and legal text. **Acceptance:** either a launch decision to ship free-only (and the module relabelled) or a reviewed payment integration with refunds and tax handling.

## 3. Release blockers

Definitions follow the directive. "Gate" means required by the directive regardless of defect.

### P0: critical security, data-loss or privacy risks (must be resolved or proven before any real user data)
| ID | Issue | Evidence |
|---|---|---|
| P0-1 | **No production environment exists** (no production Supabase project, no production Vercel environment, no domain); staging serves as the only hosted system and is a Preview environment | [V] |
| P0-2 | **No rehearsed backup and restore**; PITR off on staging; no restore drill | [V] / [D] |
| P0-3 | **Cross-user and cross-tenant isolation never tested on hosted infrastructure with independent accounts** (proven only on local PostgreSQL) | [D] |
| P0-4 | **No independent security test** (directive gate) | [D] |
| P0-5 | **Account deletion and erasure not executed** while personal data would be collected from real users in multiple jurisdictions | [D] |

### P1: core functionality or governance preventing a safe public launch
| ID | Issue |
|---|---|
| P1-1 | Public repository with **no branch protection, no pull-request review, secret scanning and push protection off** [V]; the "reviewed changes" gate cannot be met |
| P1-2 | No Terms of Service or Privacy Policy; no support channel; legal data-controller identity undecided [D] |
| P1-3 | Email: only Supabase's default sender; no production sender domain, no bounce or rate planning; registration disabled by design until fixed [D] |
| P1-4 | Monitoring, alerting, error tracking, uptime checks and an incident process do not exist for hosted systems [D] |
| P1-5 | Hosted verification of the independent-account modules is missing for 05, 07, 08, 09, 13, 17 (agreements, passport verification, organizations, disputes, admin, recruiter) [D] |
| P1-6 | AI: no provider contract, no policy approval, no evaluation set, no cost controls on a real provider; the model-backed Copilot is unverified [D] |
| P1-7 | Credential signing key not generated; production key custody undefined [D] |
| P1-8 | "International" scope: only Germany rules exist; Sri Lanka, the primary market, has none [V] |
| P1-9 | Module 19 has no benchmark data; module 3 uses a sample framework [V] |
| P1-10 | Release artifacts: debug-signed Android with a development package id; unsigned Windows installer; no iOS [V] |
| P1-11 | Malware scanning absent for uploaded evidence [D] |
| P1-12 | No load or performance testing; no capacity plan [D] |

### P2: important missing production capabilities
CSP has no `script-src` or `default-src` [V]; native-speaker review of Sinhala and Tamil [D]; Realtime not implemented (refetch only) [D]; passkeys [D]; webhook delivery queue [D]; confidential dispute attachments [D]; agreement clause editor and e-signature [D]; CI limited to Windows and Chromium, no WebKit/Firefox or device matrix [V]; account moderation tooling [D]; manual assistive-technology audit [D]; client-side OCR and PDF paths have no documented memory or time limits on low-end devices [A].

### P3: improvements that can follow launch
Pin the PGlite session timezone to UTC in the admin integration tests so they pass on non-UTC developer machines (section 1.2, item 8); consolidate the two Vercel projects; merge or retire the 313-commit-behind `main` and stale local branches and agent worktrees (9 worktrees are registered); reduce the 150-document sprawl into one maintained register; add SBOM generation; developer portal; extra registries beyond launch countries.

## 4. Production architecture and infrastructure gap analysis

| Component | Today | Required for production | Gap |
|---|---|---|---|
| Hosting | One Vercel project serving staging as Preview; second unexplained project | Dedicated production project and environment, production branch rule, custom domain with TLS, protected preview deployments | Create; [U] current settings |
| Database | Single Supabase project `oryqen-staging` (ap-southeast-1) | Separate production project, region chosen against data-residency decisions, network restrictions, least-privilege roles, PITR | Create; decide region |
| Migrations | 66 applied to staging by CLI | Reviewed, ordered, dry-run against a production-sized copy, forward-only with rehearsed rollback | Process and rehearsal |
| Secrets | Vercel environment variables; none in repo [V] | Managed secret store, rotation schedule, per-environment scoping, no secret reachable by preview builds | Define and audit |
| Backups and restore | Daily logical script for staging; WAL-G daily, PITR off | PITR, tested restores with recorded RTO and RPO, storage bucket backups | Enable and drill |
| Storage | Private `evidence-vault` bucket, 5 MiB | Lifecycle, malware scanning, versioning, backup, signed-URL TTL review | Build scanning pipeline |
| AI | Gateway built, off | Provider contract and data-processing terms, region, budgets with hard caps, evaluation harness, kill switch | Contract and evals |
| Email and notifications | Supabase default sender; in-app only | Authenticated sender domain (SPF, DKIM, DMARC), provider, bounce and complaint handling, push service | Choose and implement |
| Verification and signing | Test Ed25519 key; no e-signature provider | Key ceremony, managed custody, rotation and revocation; e-signature vendor if the module requires it | Ceremony and vendor |
| Monitoring and response | Local telemetry only | Error tracking, uptime, latency and RLS-error dashboards, alert routing, on-call, status page, incident runbook | Build from scratch |
| Release and artifacts | Manual pushes by one person to a branch that feeds staging | Protected branches, PR review, required checks, signed tags, release notes, reproducible builds, artifact signing | Governance |
| Mobile and desktop | Wrapper apps, debug-signed and unsigned | Application ids, keystore and certificate custody, store accounts, update channel | Owner decisions |
| Abuse and DDoS | App-level quotas [D]; no WAF or edge rules verified [U] | Rate limits at the edge, bot controls on auth and upload routes | Verify and add |

## 5. Independent security review plan

1. **Scope and independence.** An external team with no involvement in the build. Written scope, rules of engagement, test accounts for every role, a dedicated pre-production environment mirroring production configuration. No testing against live user data.
2. **Workstreams.** (a) Authentication and session management, MFA, recovery flows. (b) Authorization: every route and every `api` RPC against every role, horizontal and vertical escalation, tenant isolation, RLS bypass attempts, `SECURITY DEFINER` review. (c) Business-logic abuse: agreement and dispute state machines, share grants, credential issuance. (d) File handling: upload, content sniffing, signed URLs, malware. (e) AI: prompt injection, data exfiltration, consent bypass, cost abuse. (f) Server-side request forgery in research, webhooks and domain proof. (g) Web: CSP, XSS, CSRF, clickjacking, dependency and supply chain. (h) Mobile and desktop wrappers: navigation policy, deep links, local storage. (i) Infrastructure and secrets: Vercel and Supabase configuration, IAM, backups.
3. **Inputs already available.** The route-audit suite, the catalog queries used here (re-runnable), the threat model for the ledger, and the existing two-account hosted scripts.
4. **Exit criteria.** Zero open critical or high findings, medium findings with accepted written risk, retest of every fix by the testers, report retained as a release artifact.
5. **Cadence.** Pentest on the release candidate; repeat after any change to authorization, migrations or signing; dependency and secret scanning continuously.

## 6. Dependency-aware roadmap and critical path

External lead items must **start first** because they dominate the calendar:
1. Legal counsel engagement (Terms, Privacy, data-controller structure, erasure, country rules, recruiter right-of-reply). **Gates P1-2, P0-5, modules 05, 16, 17, 22.**
2. Licensed salary and occupation data sources. **Gates modules 03, 19.**
3. AI provider contract and written processing policy. **Gates 01, 11.**
4. Email sender domain and provider. **Gates registration, 20.**
5. Penetration-test vendor booking.
6. Native Sinhala and Tamil reviewers.
7. Store accounts, signing keystore and certificate (needs an adult account holder or registered company).

| Phase | Work | Depends on |
|---|---|---|
| 1. Foundation (wk 1-4) | Branch protection, PR review, secret scanning, CI hardening; production Supabase and Vercel; secrets model; PITR and restore drill; monitoring and alerting; migration procedure | owner decisions on region, domain |
| 2. Hosted verification (wk 3-8) | Multi-role test accounts; port the local real-stack journeys to hosted for all 22 modules; second-account isolation suite; fix findings | Phase 1 staging parity |
| 3. Capability completion (wk 4-14) | Email and push; account deletion and retention; malware scanning; agreement clause editor and e-signature; dispute attachments; webhook queue; AI evaluation set and cost controls; Sri Lanka rules | counsel, providers |
| 4. Data modules (wk 4-20, external) | Benchmark and occupation datasets; further country rules | licences |
| 5. Quality gates (wk 10-16) | Load and performance testing; cross-browser and device matrix; manual accessibility audit; native translation review | Phases 2-3 |
| 6. Independent security test (wk 12-18) | Pentest, fixes, retest | feature freeze on authorization code |
| 7. Release readiness (wk 16-20) | Release-signed apps, final acceptance run, rollback rehearsal, go or no-go | all above |

**Critical path:** counsel and data licensing, then capability completion that depends on them, then the pentest on a frozen release candidate, then rollback rehearsal and the go or no-go decision. Engineering tasks are not the critical path.

## 7. Effort estimate (estimates, with uncertainty)

Assumes 6-8 parallel engineers or agents plus the external parties above, and owner decisions within one week of being asked.

| Workstream | Estimate |
|---|---|
| Production infrastructure, monitoring, backup drills, governance | 4-6 person-weeks |
| Hosted multi-role verification and fixes | 6-8 |
| Email and push | 2-3 |
| Account deletion and retention tooling | 2-3 |
| Malware scanning, evidence lifecycle | 2 |
| Agreements: clause editor, templates, e-signature integration | 8-12 (legal-dependent) |
| Disputes attachments and organization response | 3 |
| AI: provider integration, evaluation set, cost controls, model-backed Copilot | 6-8 |
| Salary and occupation data integration | 3-4 once licensed; licensing 4-12 weeks external, uncertain |
| Country rules (per country, including counsel) | 3-6 each; Sri Lanka first |
| Load, performance, accessibility, device testing | 4-6 |
| Mobile and desktop signed releases | 3-5 (iOS adds 6-8) |
| Localization review | 2-3 internal, external reviewers in parallel |
| Independent security test and remediation | 4-6 including vendor lead time |

**Calendar estimate:** about **16-22 weeks to a controlled public launch** with the parallel team, if external items start immediately; **roughly 10-14 months** if done sequentially by a single team. Salary data and additional countries may extend beyond this window: they are limited by third parties, not effort. These figures are judgement, not measurement.

## 8. Release acceptance checklist (all must be true)

- [ ] Every module: Class A with written acceptance criteria met and evidence linked.
- [ ] Production environment separate from staging; production database separate; no shared secrets.
- [ ] Required CI green on the exact release commit; branch protection and at least one independent reviewer on every merged change.
- [ ] All migrations dry-run and applied in order; catalog check shows RLS enabled and forced on every table, no unexpected anon grants, all `SECURITY DEFINER` functions with pinned `search_path`.
- [ ] Hosted two-account (and where needed three-account) isolation suite passes for every role.
- [ ] Independent security test complete; zero open critical or high findings; retest recorded.
- [ ] Backup restore rehearsed with recorded RTO and RPO; rollback plan rehearsed end to end.
- [ ] Monitoring, alerting and incident procedures tested with a drill.
- [ ] Terms, Privacy Policy and erasure process approved by counsel; support channel live.
- [ ] Email sender authenticated; bounce handling verified.
- [ ] AI: policy approval reference, cost caps, evaluation results, kill switch tested; or AI declared off and labelled.
- [ ] Signing keys and release signing in managed custody; artifact checksums published.
- [ ] Load test at 3x expected launch traffic meets agreed latency and error budgets.
- [ ] Accessibility: automated and manual audits pass; localization reviewed for each supported language.
- [ ] No fake, sample or invented data reachable in the production build.
- [ ] Final written release approval by the owner.

## 9. Recommended team and agent assignments

Worktrees and directories are owned exclusively to avoid conflicting commits.

| Role | Owns | Depends on |
|---|---|---|
| **Agent 1: Release lead and integrator** | `main` and release branches, CI, branch protection, release notes, go or no-go evidence, this register | none |
| **Agent 2: Platform and infrastructure** | production Vercel and Supabase, secrets, backups, monitoring, IaC, runbooks | owner decisions |
| **Agent 3: Security and database** | `supabase/migrations`, RLS and RPC audits, isolation suites, pentest liaison | Agent 2 environments |
| **Agent 4: Workflow modules** | agreements, disputes, passport, organizations (modules 05, 07, 08, 09) | Agent 3 for migrations, counsel |
| **Agent 5: Intelligence modules** | modules 01, 02, 03, 11, 16, 19 and the AI gateway | AI contract, data licences |
| **Agent 6: Frontend, accessibility and localization** | shared UI, accessibility, translations, copy | native reviewers |
| **Agent 7: Mobile and desktop** | `mobile/` and `desktop/`, signing, stores | owner accounts and keys |
| **Agent 8: QA and performance** | hosted journeys, cross-browser and device matrix, load tests | Agent 2 |
| **Owner / external** | legal counsel, data licensors, pentest vendor, native reviewers, adult account holder, final approval | n/a |

Rules: one writer per directory; migrations only through Agent 3; production changes only through Agent 1 with written approval; nothing is marked Class A without a linked evidence record.

## 10. Facts, assumptions, unknowns

- **Verified today:** everything marked [V] in section 1.1 and 1.2.
- **Assumptions:** effort ranges, the parallel-team size, that external vendors respond within normal lead times, and that client-side OCR limits are undocumented.
- **Unknown:** Vercel project settings and environment variable scopes; Supabase Auth dashboard configuration; the purpose of the `fairwork` Vercel project and the `Fairwork` Supabase project; whether any real user data exists outside staging; the intended production region and domain; the signed-in state of the five staging screens.

## 10a. Change applied after this audit (13 Nov 2026, owner-approved)

On `main`, `exhibition/dev-nov10` and `release/oryqen-oct27`: required status check `verify`, force pushes and branch deletion blocked, administrator bypass left on so the owner's push-then-CI workflow is unchanged. Secret scanning and push protection enabled on the repository. **Not yet done:** required pull-request review (P1-1 remains partly open until a second reviewer exists), Dependabot security updates, and the public-versus-private decision. Read back and confirmed [V].

## 11. Immediate no-regret actions (reversible, need approval)

1. Enable branch protection with required CI on `exhibition/dev-nov10`, `release/oryqen-oct27` and `main`; enable secret scanning and push protection.
2. Decide whether the repository should be public.
3. Name the production Supabase region and domain.
4. Start the legal, data-licence, AI-contract, email and pentest-vendor conversations in parallel.
5. Free disk space on the build machine (C: is 99% full) so emulator and build work can continue.
