# ORYQEN release status (29 Oct 2026, written ahead of the 05:30 Asia/Colombo deadline)

This document is factual. "Hosted verified" means a real signed-in account passed the check on https://oryqen-staging.vercel.app; **nothing is hosted-verified yet** (see "Hosted authenticated testing").

## Checkpoint
| Item | Value |
|---|---|
| Staging branch | `release/oryqen-oct27` (batch 5 code pushed 29 Oct; see the latest commit and CI below) |
| Last CI | run 33 on `393ce1c`: success (run 32 passed after the lint and flaky-test fixes) |
| Staging Supabase | `jpvgsmzomlmowarlfkdl`, **58 of 58** migrations applied |
| Pending approval | none; batch 5 (migrations 24, 25, 26) was approved and applied, `docs/ORYQEN_MIGRATION_BATCH_5.md` |
| Hosted smoke / rendering | 24 pass, 0 fail, 5 warn / all rendered checks pass (28 Oct, after batch 4) |
| Production, `main`, Fairwork | untouched |

## Migrations
Applied to staging, each after a fresh Docker-free backup and restore rehearsal with post-checks (see the batch docs): the 19 pending at the start, then 20 research history, 21 vault evidence status, 22 vault revocation enforcement, 23 agreement expiry. Also applied 29 Oct: 24 dispute categories, 25 case evidence references, 26 audit hash chain.

## 22 modules (per `docs/ORYQEN_22_MODULE_ACCEPTANCE.md`)
Columns: I implemented, L locally tested, D deployed to staging, H hosted authenticated verified.

| # | Module | I | L | D | H | Notes |
|---|---|---|---|---|---|---|
| 01 | AI Employment Intelligence | partial | yes (gateway unit tests; one live synthetic Gemini call 28 Oct on gemini-3.1-flash-lite) | code yes, AI is off | no | Live private-data AI needs your policy approval and Vercel values. Rules-based analysis is never labelled as Gemini |
| 02 | Employer and Company Research | partial | yes | yes (saved history: migration 20) | no | Other registries need keys |
| 03 | Career Matching | partial | yes | yes | no | Skills-gap suggestions and recommendation history missing |
| 04 | Offer Intelligence Workspace | partial | yes | yes | no | Search covers all saved offers; notes and documents (migration 18) |
| 05 | Digital Agreement Center | partial | yes | yes (expiry and renewal: migration 23) | no | Clause editing, supporting documents, dispute linkage missing |
| 06 | Evidence Vault | partial | yes | yes (status, revocation, enforcement: migrations 21 and 22) | no | Third-party verification status, single-document export, malware scanning missing; hosted upload unverified |
| 07 | Work Passport | partial | yes | yes | no | Signed PDF and skills in a shared Passport missing |
| 08 | Organization and Recruiter Portal | partial | yes | yes | no | Roles recruiter, hiring manager and viewer are NOT built |
| 09 | Dispute and Appeals Center | partial | yes (categories and evidence references) | yes (migrations 24 and 25 applied 29 Oct) | no | Reviewer-only confidential file access and organization response workflow missing |
| 10 | Trust Ledger and Audit | partial | yes (hash chain with tamper detection, real PostgreSQL) | yes (export logging; hash chain, migration 26 applied 29 Oct, verifies ok on staging) | no | Export of a person's own event history missing |
| 11 | AI Career Copilot | partial | yes (rules-based) | yes | no | Model-backed copilot waits for AI approval |
| 12 | Security and Privacy | partial | yes | yes | no | Passkeys, account-deletion executor, security-event log view missing |
| 13 | Administration | partial | yes | yes | no | Account restriction and restoration already exist in the admin console (owner or administrator role, MFA, reason, optimistic revision check, cannot target administrators or oneself, written to the administrative audit); organization suspension also exists. Missing: operational monitoring and the console's forms, dialogs and detail panels are still English |
| 14 | Premium Multiplatform UX | partial | layout sweep with a mocked login (16 screens at 8 widths) | yes | no | Real signed-in screens unreviewed; keyboard and screen-reader audit missing |
| 15 | Localization | partial | yes (server messages in four languages) | yes | no | Drafts need native review |
| 16 | Country-Aware Guidance | partial | yes | yes | no | Germany only |
| 17 | Recruiter Scam Protection | partial | yes | yes | no | Correction procedure for a named party missing |
| 18 | Verifiable Credentials | complete with a test key | yes | yes | no | Production signing key is an owner ceremony |
| 19 | Salary Benchmarking | BLOCKED | n/a | n/a | n/a | Needs a licensed dataset; no data invented |
| 20 | Notifications and Timeline | partial | yes | yes (agreement expiry reminders) | no | Email and push not connected |
| 21 | Developer API | partial | yes | yes | no | Persistent delivery queue needs a worker decision |
| 22 | Sustainable Business Platform | partial | yes | yes | no | Wider metering and an admin overview of plans missing |

**Totals:** fully complete 1 of 22 (module 18, on a test key). Modules with any hosted-verified journey: 0. Blocked: 1 (module 19).

## Hosted authenticated testing (release-critical blocker)
- Script: `scripts/test-hosted-worker-journeys.mjs` signs in through the real sign-in API with a hidden password prompt and runs the worker journeys; it now includes evidence correction and revocation and research history. It has not been run against staging because it needs an account.
- Smallest owner action: in the Supabase dashboard create two test accounts with Auto Confirm User, run the script, and send the printed lines (`docs/ORYQEN_TEST_ACCOUNT_WORKFLOW.md`). Two-account journeys (agreements, expiry, disputes, recruiter) also need capabilities that only the owner may grant.
- Requested journeys: login and session persistence NOT RUN; offer creation and analysis NOT RUN; research history NOT RUN; agreement creation, expiry and renewal NOT RUN (needs two accounts); evidence correction, revocation and attachment enforcement NOT RUN; work records and Passport NOT RUN; notifications NOT RUN; data export NOT RUN; cross-account isolation verified only by database tests on disposable PostgreSQL with two accounts, not on staging.

## Windows and Android (staging-connected)
| Artifact | Location | SHA-256 | Status |
|---|---|---|---|
| Windows installer | `release-artifacts/windows-staging/ORYQEN-Preview-0.1.0-x64-Setup.exe` | `bd27ed2fec1c6c15e32929de57db89bac6f758c73d6da3f318c206e02eb393e3` | Unsigned testing build, unpublished. Installed, launched, 5 of 5 checks, uninstalled cleanly (re-run 28 Oct). Real sign-in and session persistence NOT TESTED |
| Android APK | `release-artifacts/android-staging/ORYQEN-Online-Preview-1.0.0-staging-debug.apk` | `8d4a1e1bda942d74940824695d4ab85629813dc3b7def6974cd586057053cc8f` | Debug-signed, unpublished. Installed on the emulator, launched, 3 of 3 checks. No physical device; real sign-in NOT TESTED |

Both load the staging origin from build configuration, so web changes reach them without a rebuild. No download link exists and none was fabricated.

## Gemini AI
The gateway, consent, redaction, budgets and breaker exist and are unit-tested; one live synthetic call succeeded on 28 Oct. **Live processing of private employment text is OFF and stays off.** Approval package: `docs/ORYQEN_AI_APPROVAL_PROPOSAL.md` (model, region limits, retention up to 55 days, cost about $0.0033 per analysis). It needs your written approval and the `ORYQEN_AI_*` and `GEMINI_API_KEY` values set by you in Vercel.

## Known limitations and open risks
- No hosted authenticated verification of any feature.
- Recruiter roles are not implemented. (Account restriction and restoration are implemented; an earlier note that moderation was missing was wrong, corrected here.) Legal pages are not written (`docs/ORYQEN_LEGAL_DECISIONS.md`).
- Layout verified with a mocked login only. Windows and Android are unsigned or debug builds.
- Docker Desktop was unstable earlier. Staging backups use the Docker-free scripts `scripts/backup-staging-logical.mjs` and `scripts/restore-check-logical-backup.mjs`. The restore rehearsal covers `private` data; `auth` data is backed up and counted but not restored in the rehearsal.

## UI recovery sprint (29 Oct, staging only, no migrations)
Redesigned and deployed: the signed-in **Home** (two-column dashboard on desktop: hero with greeting and next action, right rail with Work Passport, reminders, recent activity, quick links; main column with saved offers, work records, pay comparison, company research; single column on mobile), the **sidebar** (ORYQEN mark, the four main tabs, a "More" group linking to job opportunities, agreements, concerns and cases, private guidance, notifications and settings, all existing working screens), an **offer-journey step marker** on add offer, review, questions and agreement (labels existing screens only), reference/ID tools and organization search moved into a collapsed "advanced" section with a note that independent workers need no organization, and the saved-offers panel no longer prints raw validation text. All text is in four languages.
Not done: grouping the long add-offer form into essentials and optional terms (attempted, broke 17 existing browser tests that fill the collapsed fields, reverted), redesign of work records and Passport screens, the guided analysis flow beyond the step marker, and real signed-in visual review (the owner's recording was not available to me; layout was checked with a mocked login). No AI findings are invented anywhere; live AI remains off.
Evidence: layout sweep (16 screens at 8 widths), desktop layout, accessibility (axe, light and dark), workspace access, product and visual suites passed on the committed build; lint and 639 unit tests passed.
