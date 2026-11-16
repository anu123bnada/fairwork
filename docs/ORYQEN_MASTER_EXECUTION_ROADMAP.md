# ORYQEN master execution roadmap (Phase 0 audit, 17 Nov 2026)

Companion to `ORYQEN_MASTER_MODULE_MATRIX.md`, `ORYQEN_END_TO_END_ACCEPTANCE_MATRIX.md`, `ORYQEN_SECURITY_REMEDIATION_PLAN.md`, `ORYQEN_ANDROID_PLAYSTORE_READINESS.md` and `ORYQEN_PARALLEL_AGENT_ASSIGNMENTS.md`. It supersedes the roadmap in `ORYQEN_PRODUCTION_PROGRAM_AUDIT_20261113.md` and adds modules 23 and 24.

**Honesty notes.** Effort figures are **judgment from the repository's actual state**, not measurements; they assume a team of about six parallel agents or engineers, owner decisions within one week of being asked, and external parties responding in normal time. Calendar time is dominated by **external lead items**, not by engineering. Costs are given only where I know them; everything else says "quote needed". Nothing here is started.

## 1. Where we are (one paragraph)
The platform's core is real and unusually well-guarded at the database level (verified again today: 100/100 forced RLS, 143 pinned `security definer` functions, private storage, anonymous 401s). **0 of 24 modules are production-ready**, **0 of 12 end-to-end journeys pass**, **no production environment exists**, and nothing has been verified on hosted infrastructure with independent accounts. Two modules are not what their names promise: module 11 is a fixed-rule demo and module 19 has no data. Modules 23 and 24 (built 16 Nov) are real rule-based features with hosted saving proven through the API, but they use an editorial requirements framework, a thin course catalog and one internal listing source; no AI and no outside platform is connected.

## 2. Critical blockers (everything else waits on or around these)
| # | Blocker | Type | Gates |
|---|---|---|---|
| B1 | No production or pre-production environment | Infrastructure (owner decisions on region, domain, budget) | Phase 2 onward, Android, launch |
| B2 | Synthetic multi-role test accounts and capabilities do not exist | Owner action in the test environment | All hosted journeys, SEC-C2 |
| B3 | No Terms, Privacy Policy, data-controller identity, erasure approval | Legal (counsel) | Registration, Play listing, SEC-C4, modules 5, 16, 17, 22 |
| B4 | Email: default sender only | Provider and domain | Registration, notifications, account recovery at scale |
| B5 | AI provider contract and written processing policy | Provider and legal | Modules 1, 11, and "AI" in 23 and 24 |
| B6 | Licensed or official datasets (occupation, salary, Sri Lanka rules, registries) | External sources | Modules 3, 16, 19, 23; Sri Lanka launch |
| B7 | External opportunity sources need platform authorization (LinkedIn partner-restricted, Meta and Fiverr no documented path) | External | Module 24 beyond internal listings |
| B8 | Employer verification is a demonstration authority | Product and legal decision | Modules 2, 8; employer journeys |
| B9 | Independent security test not booked | Vendor | Launch gate |
| B10 | Android identity: application id, domain, keystore custody, Play account, icons, privacy URL | Owner | Any Play release |
| B11 | Development machine at 99% disk and low RAM | Local resource | More than 2 or 3 concurrent agents, emulator runs |

## 3. Owner decisions needed in week 1 (each unblocks something)
1. Production region and domain (one-way for Android and Windows).
2. Whether the repository becomes private (`ORYQEN_REPOSITORY_PRIVACY_REMEDIATION_PLAN_20261113.md`).
3. Legal counsel engagement and data-controller structure.
4. Email provider and sender domain.
5. AI: go or no-go for launch; if go, provider and written policy approval.
6. Employer verification method for launch (registry match, document check, manual operator review).
7. Launch scope: free-only (module 22 relabelled) or payments; Sri Lanka first and which other countries.
8. Opportunity sources for module 24: which are pursued, who applies for approvals.
9. Budget for environments, monitoring, device testing, pentest.
10. Who holds the Android upload key and the Play account.

## 4. Phases

Durations are elapsed weeks from the day the phase starts, with the parallel team above.

### Phase 0 close-out (this week, 3 to 5 days)
- **Work.** (a) Integrate Agent 6's `agent/ui-replication` into a new `integration/phase-0` branch (dry-run merge has no conflicts), full CI, visual acceptance against the nine references, then promote; (b) upgrade `next` to 16.4.6 or later (SEC-M1); (c) require one independent review on release branches and enable Dependabot security updates (SEC-H1); (d) pin tests for CORS and the 422-versus-401 ordering (SEC-M3, SEC-L1); (e) environment and account inventory including the second Vercel project and Supabase project (SEC-M6); (f) start the external lead items (counsel, data licences, AI contract, email domain, pentest vendor, Play account); (g) free disk and agree the worktree strategy (B11).
- **Depends on:** nothing external except owner decisions 2 and 3 to 5 being initiated.
- **Parallel:** all of (a) to (g) are independent except (a) before any WS-B screen work.
- **Acceptance / evidence:** green CI on the integration branch and on `main`-bound candidate; `npm audit --omit=dev` clean; branch protection read-back showing required review; inventory document; Agent 6 acceptance note with before and after screenshots; owner receipt for each lead item.
- **Rollback:** the integration branch is discarded (not the work) if it fails; release branches are untouched until green.

### Phase 1 Foundation (weeks 1 to 4)
- **Work.** Production and pre-production Supabase and Vercel projects, separate secrets and scopes, protected previews, custom domain with TLS; migration procedure with dry-run, ordered apply, reverse scripts and a restore point; PITR and a **restore drill** with recorded RTO and RPO; storage bucket backup; monitoring, alerting, error tracking, uptime checks, status page, incident runbook and one drill; email sender domain and provider with bounce handling; edge rate limits and bot controls on auth, upload and AI routes; CI hardening (second OS or browser job, required checks, AAB job skeleton, SBOM); registration anti-abuse settings.
- **Depends on:** B1, B4 and owner decisions 1, 4, 9.
- **Parallel:** WS-F leads; WS-A prepares migration reversal tooling; WS-E designs the isolation suite meanwhile.
- **Sequential inside the phase:** environments before secrets scoping before restore drill before monitoring drill.
- **Acceptance / evidence:** catalog check on pre-production identical to section 1 of the security plan; restore drill report; alert-fires-in-drill record; SPF/DKIM/DMARC headers; green CI including the new jobs.
- **Rollback:** infrastructure as written definitions; each change recorded before and after; Vercel instant rollback verified once; database restore tested, not assumed.
- **Effort:** 4 to 6 person-weeks.

### Phase 2 Hosted verification (weeks 2 to 8)
- **Work.** Create synthetic accounts W1, W2, E1 to E3, R1, A1, A2; port the local real-stack journeys to hosted for all modules; build the **cross-tenant isolation suite** (every route and every `api` RPC, horizontal and vertical); run the 12 journeys in the acceptance matrix; fix defects found; screens of modules 23 and 24 verified signed in; record evidence for each module.
- **Depends on:** Phase 1 pre-production, B2.
- **Parallel:** per-module journeys can run in parallel once accounts exist; fixes route to the owning workstream.
- **Acceptance / evidence:** all 12 journeys PASS with stored transcripts; isolation suite green; a defect register with zero open critical or high items.
- **Rollback:** failed fixes revert on their agent branch; no hosted data of real users exists in this phase.
- **Effort:** 6 to 8 person-weeks plus fixes.

### Phase 3 Capability completion (weeks 3 to 14)
Work items (each with its owner workstream); items marked "blocked" cannot finish before their dependency:
| Item | WS | Depends on | Effort |
|---|---|---|---|
| Account deletion and erasure end to end, retention policy (SEC-C4) | A | counsel | 2 to 3 pw |
| Email and push notifications with consent, bounce handling, opt-out | A, C, F | Phase 1 email, Firebase | 2 to 3 pw |
| Malware scanning for evidence | A, F | scanner choice | 2 pw |
| Agreements: clause editor, templates, e-signature integration | A | provider, counsel | 8 to 12 pw (legal-dependent) |
| Dispute attachments and organization response | A | none | 3 pw |
| Webhook delivery queue and dead-letter | A, F | none | 2 pw |
| Real employer verification method | A | decision B8 | 3 to 5 pw |
| Signing key ceremony and production credentials | F, A | owner | 1 pw |
| AI: provider integration, evaluation set, prompt-injection set, cost caps, kill switch, model-backed Copilot | D | B5 | 6 to 8 pw |
| Module 23: sourced occupation taxonomy, course catalog per launch role, link-freshness job, hosted browser journey, localization | D, B | B6 | 4 to 6 pw |
| Module 24: ingestion framework, first authorized external source, deduplication, freshness, scheduled refresh with last/next run, deletion of imported data | D, F | B7 | 4 to 6 pw once a source is authorized |
| Sri Lanka country rules with sources and counsel | D | B6 | 3 to 6 pw |
| Demonstration surfaces gated or removed in the production build, with a failing test if reachable | B, 1 | none | 1 pw |
| Reference-accurate UI for the remaining screens, English-only screens localized | B | native reviewers | 6 to 10 pw |
- **Acceptance / evidence:** per item, the acceptance line in the module matrix, with stored evidence; no sample or invented data reachable in the production build (automated test).
- **Rollback:** every migration has a written reverse script and runs behind a restore point; feature flags default off; AI has a kill switch.

### Phase 4 Data and external integrations (weeks 2 to 20, external)
Licensing and approvals run in parallel with everything: occupation and salary datasets, registries beyond GLEIF, platform authorizations for module 24, e-signature and payment vendors if chosen. **Calendar is set by third parties**; engineering effort is the integration only (3 to 4 pw per dataset once licensed). Items that are not approved by the launch date ship **labelled as unavailable**, never simulated.

### Phase 5 Quality gates (weeks 10 to 16)
Load and performance at 3x expected launch traffic with agreed latency and error budgets; soak; cross-browser (WebKit, Firefox) and device matrix; manual accessibility audit (screen reader, keyboard); native Sinhala and Tamil review; chaos checks (provider outage, database failover). **Depends on:** Phases 2 and 3. **Effort:** 4 to 6 pw plus external reviewers. **Evidence:** reports retained as release artifacts.

### Phase 6 Independent security test (weeks 12 to 18)
Vendor tests a frozen release candidate in pre-production (scope in the security plan). **Depends on:** feature freeze on authorization code, isolation suite green. **Acceptance:** zero open critical or high, mediums with written risk acceptance, retest recorded. **Effort:** 4 to 6 pw including remediation and vendor lead time.

### Phase 7 Release readiness and launch (weeks 16 to 22)
Release-signed web, Android AAB and Windows builds; final acceptance run of all 12 journeys on the release candidate; **rollback rehearsal end to end**; go or no-go meeting with all evidence; Play internal testing, then closed testing, then production with a staged rollout; production deployment **only with explicit written owner approval**. **Acceptance:** the release checklist in section 8 of the 13 Nov audit, plus the Play checklist in the Android document.

## 5. What runs in parallel and what cannot
**Parallel from day 1:** Phase 0 items; legal, data, AI-contract, email and vendor lead items; B (replication and localization hooks); A (erasure design, scan hook, webhook queue); D (evaluation harness, link checker, ingestion framework on the internal source); C (AAB in CI with a throwaway id); E (isolation-suite design).
**Strictly sequential:** environments before hosted verification; hosted verification before the pentest; frozen release candidate before the pentest; pentest before launch; migration writing, review and numbering (one lane); integration merges (Agent 1); store review stages.
**Longest chain (critical path):** counsel and data licences, then the capability work that depends on them (erasure, Sri Lanka rules, taxonomy), then the pentest on the frozen candidate, then rollback rehearsal and go or no-go. Engineering is not the critical path.

## 6. Effort summary (updated for modules 23 and 24)
| Workstream | Person-weeks |
|---|---|
| Infrastructure, monitoring, backups, governance (Phase 1) | 4 to 6 |
| Hosted verification and fixes (Phase 2) | 6 to 8 |
| Backend capability (erasure, notifications, scanning, agreements, disputes, queue, verification, key ceremony) | 23 to 31 |
| AI and intelligence (including modules 23 and 24, Sri Lanka rules) | 17 to 26 |
| Frontend and design completion (Agent 6 line) | 6 to 10 |
| Android and desktop signed releases, push, device matrix | 5 to 8 |
| Quality gates (Phase 5) | 4 to 6 |
| Security test and remediation (Phase 6) | 4 to 6 |
| Integration, release management (Agent 1) | 6 to 8 spread over the program |
| **Total** | **about 75 to 109 person-weeks** |
**Calendar:** about **16 to 22 weeks** to a controlled public launch with a team of about six if external items start in week 1, **10 to 14 months** if done sequentially by one team. Data-dependent modules (19 and other countries) can extend past this window; they ship labelled unavailable if the data is not licensed in time.

## 7. External costs and dependencies (what the owner pays or procures)
| Item | Cost basis | Notes |
|---|---|---|
| Legal counsel (Terms, Privacy, controller structure, erasure, country rules, recruiter right of reply, e-signature validity) | **Quote needed** | Longest external lead |
| Independent penetration test | **Quote needed** | Book now; vendor lead time |
| Hosting and database (production plus pre-production), PITR, bandwidth | **Plan pricing to be confirmed** | Supabase and Vercel plan limits and add-ons must be checked against expected traffic |
| Email provider and sender domain; domain registration and TLS | **Quote or plan pricing** | Needed before registration |
| Monitoring, error tracking, status page | **Plan pricing** | |
| AI provider usage and any evaluation labelling | **Usage-based; set hard caps** | Only if AI ships |
| Salary, occupation and registry datasets | **Licence quotes** | May be free (official statistics) or paid |
| Native Sinhala and Tamil reviewers | **Quote** | |
| Device testing (physical devices or a device cloud) | **Purchase or plan pricing** | Needed for Android 14 to 16 and low-RAM phones |
| Google Play developer account | one-time registration fee (**confirm** current amount and account-type rules) | Owner or registered company holds it |
| Windows code-signing certificate | **Certificate pricing** | Only if the Windows app ships |
| E-signature and payment vendors | **Quote** | Only if chosen |
| Developer machine disk and RAM | hardware | Blocker B11 |

## 8. Recommended first implementation sprint (Sprint 1, about 5 working days)
Goal: **close Phase 0 and make Phase 1 and 2 startable**, without touching production.
1. **Integrate Agent 6's work** through `integration/phase-0` with full CI and visual acceptance (WS-B, Agent 1).
2. **Security hygiene PRs** (WS-E, Agent 1): `next` upgrade; required review and Dependabot; CORS and 422-ordering tests.
3. **Owner decisions meeting** on section 3 and kick off all external lead items the same day.
4. **Environment memo and pre-production creation** (WS-F): inventory, decide region, create pre-production, secrets model, PITR on, first restore drill.
5. **Synthetic account set** created by the owner in pre-production; first hosted two-account journeys (agreements, evidence isolation) written by WS-E.
6. **Erasure design and migrations drafted** (WS-A) for counsel review; no hosted apply.
7. **Android AAB in CI** with a throwaway id and an unsigned artifact check (WS-C), plus the device and disk plan (B11).
8. **Module 23 and 24 follow-ups that need no external input** (WS-D, WS-B): signed-in browser journey on staging, localization hooks, course-link checker, gating of demonstration surfaces.
**Sprint 1 exit evidence:** green CI on the integration branch; pre-production catalog check; restore drill report; signed-in journeys 9 to 11 run on staging; list of owner decisions with answers; updated module matrix.

## 9. Rollback requirements (all phases)
- **Code:** every release is a tagged commit; Vercel instant rollback to the previous deployment is proven once in Phase 1; the pre-sprint bundle backups are kept.
- **Database:** every migration ships a written reverse script, is applied only after a fresh logical backup (the apply script already refuses without one) and, in production, a PITR restore point; forward-only is the default, reverse is for emergencies. Example already recorded: the 16 Nov career migration reverses by deleting rows of the two new kinds, then restoring the previous constraint and function definitions.
- **Storage:** bucket backup before any lifecycle or scanning change.
- **Secrets and keys:** rotation procedure and break-glass access written before first use; no key shared between environments.
- **Feature flags:** AI, registration, scheduled refresh, external sources and push default **off** and each has a kill switch.
- **Mobile:** staged rollout with halt and promote-previous; every AAB and checksum kept.
- **Go or no-go:** a written rollback rehearsal on the release candidate is itself a release gate.

## 10. Acceptance gates for launch (summary; full list in section 8 of the 13 Nov audit)
All 24 modules classified production-ready with linked evidence or explicitly shipped **off and labelled**; 12 of 12 journeys PASS on the release candidate; isolation suite green; independent test with no open critical or high; restore and rollback rehearsed; monitoring drilled; counsel-approved legal text and erasure; email authenticated; AI approved and capped or declared off; signing keys in managed custody; load test passed; accessibility and localization reviewed; no sample or invented data reachable; written owner approval.
