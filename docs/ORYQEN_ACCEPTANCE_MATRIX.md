# ORYQEN functional acceptance matrix (29 Oct 2026)

Baseline: staging commit `202a927` (CI run 39 green, Vercel deployed). Migration 27 is **not applied**. AI processing of private data is **off**.

## How to read the evidence levels
| Level | Meaning | Counts as E2E PASS? |
|---|---|---|
| **H** | Real hosted staging, real Supabase Auth account, real persisted data (Agent 5 suite `tests/hosted`, `scripts/run-hosted-browser-journeys.mjs`) | **Yes** |
| **P** | Real PostgreSQL (disposable server, real RLS, SECURITY DEFINER `api.*` RPCs, executor roles) driven through the real server code | Backend only |
| **B** | Production-build browser tests with network stand-ins shaped like the real API replies | No (layout/behaviour only) |
| **U** | Unit tests | No |

Hosted results so far: Agent 5 reported PASS 13 / FAIL 0 / NOT RUN 8 on an earlier build; it has **not** been run against `202a927` and no dedicated staging account existed at the time of writing. So **no module can be marked E2E PASS today**. Ratings below are: **PARTIAL** = backend proven (P) and screen proven (B) but hosted E2E not run or only partly covered; **NOT TESTED** = no hosted evidence and thin backend evidence; **FAIL** = known broken (none known at this commit).

## Hosted journeys that exist (what H can currently prove)
`tests/hosted/journeys.spec.ts`: session is real and survives reload; second tab shares the session; anonymous profile is refused by the API; home dashboard renders from real data; each main screen loads without an error banner; notifications answer for this account only; work-record / Passport / offers / cases read APIs answer without a server error; offer form validates before sending; offer analysis API reports the AI gateway honestly; **save a private offer draft and read it back (writes, opt-in `--writes`)**; case review fails closed; sign-out ends the session.

**Hosted coverage gaps (no H test exists yet):** registration, agreement creation/approval, work-record create/confirm, Passport share link, dispute creation with evidence, organization flows, credentials. These need new hosted journeys that create and clean up their own synthetic data.

## Matrix
| # | Module | Routes / API | Database | Evidence now | Rating | Missing backend / gap |
|---|---|---|---|---|---|---|
| 01 | AI Employment Intelligence | `/api/v1/offers/analyze`, `/api/v1/guidance` | `ai_*` gateway tables, consent records | U/P gateway; one synthetic live Gemini call (28 Oct); H: analysis API honest | PARTIAL | Live private-data AI **blocked on owner policy approval**; no hosted consented synthetic request yet |
| 02 | Employer and Company Research | `/api/v1/research`, `/api/v1/companies` | saved research history (m20) | P, B | PARTIAL | Other registries need keys |
| 03 | Career Matching | `/api/v1/opportunities` | yes | P, B | PARTIAL | Skills-gap suggestions, recommendation history |
| 04 | Offer Intelligence Workspace | `/api/v1/offers` (+drafts, analyze), `/app/add-offer`, `/app/check`, `/app/questions` | offers, revisions, notes/docs (m18) | P, B; H: draft save/readback (opt-in) | PARTIAL | Highest priority for H: manual+paste+file intake → save → reopen → findings, with real reload |
| 05 | Digital Agreement Center | `/api/v1/agreements`, `agreement-workflows`, `agreement-expiries` | m23 expiry | P, B | PARTIAL | Clause editing, supporting documents, dispute linkage; **no H test** |
| 06 | Evidence Vault | `/api/v1/vault`, `work-evidence` | m21/22 | P, B | PARTIAL | Third-party verification status, single-document export, malware scanning; hosted upload unverified |
| 07 | Work Passport | `/api/v1/passport`, sharing | yes | P, B; H: read answers | PARTIAL | Signed PDF; skills in shared Passport; H share-link test missing |
| 08 | Organization and Recruiter Portal | `/api/v1/organizations`, `recruiter` | yes | P, B | PARTIAL | Roles recruiter / hiring manager / viewer **not built** |
| 09 | Dispute and Appeals Center | `/api/v1/work-cases`, `case-followups` | m24/25 | P, B; H: fails closed | PARTIAL | Reviewer-only confidential file access; organization response workflow; H dispute creation missing |
| 10 | Trust Ledger and Audit | `/api/v1/trust-chain` | hash chain m26 (verifies ok on staging) | P | PARTIAL | Own event history export; **UTC pin m27 authored, not applied** |
| 11 | AI Career Copilot | `/api/v1/guidance` | yes | P, B (rules-based) | PARTIAL | Model-backed copilot waits for AI approval |
| 12 | Security and Privacy | `/api/v1/privacy-requests`, `auth` | yes | P, B | PARTIAL | Passkeys, account-deletion executor, security-event log view |
| 13 | Administration | `/api/v1/admin`, `operator` | yes | P, B | PARTIAL | Needs staging operator account for H |
| 14 | Premium Multiplatform UX | all `/app/*` | n/a | B layout sweeps; H: screens load | PARTIAL | Real signed-in screens unreviewed visually; keyboard/screen-reader audit |
| 15 | Localization | catalogs en/si/ta/de | n/a | B, U | PARTIAL | Drafts need native review |
| 16 | Country-Aware Guidance | `/api/v1/guidance` | yes | P, B | PARTIAL | Germany only |
| 17 | Recruiter Scam Protection | `/api/v1/reports`, `recruiter` | yes | P, B | PARTIAL | Correction procedure for a named party |
| 18 | Verifiable Credentials | `/api/v1/credentials` | yes | P, B | PARTIAL | Production signing key is an owner ceremony |
| 19 | Salary Benchmarking | n/a | n/a | n/a | NOT TESTED (BLOCKED) | Needs licensed dataset; nothing invented |
| 20 | Notifications and Timeline | `/api/v1/notifications` | yes | P, B; H: answers for this account only; **new:** background refresh (B) | PARTIAL | Email/push not connected; true push needs Realtime design (below) |
| 21 | Developer API | `/api/v1/developer` | yes | P | PARTIAL | Persistent delivery queue needs a worker decision |
| 22 | Sustainable Business Platform | `/api/v1/entitlements` | yes | P | PARTIAL | Wider metering; admin plan overview |

Priority queue (by user value × missing evidence): 1 registration/sign-in (H), 2 offer create→persist→rules findings (H), 3 agreements (H new), 4 work records (H new), 5 Passport share (H new), 6 disputes + evidence (H new), 7 notifications freshness (this slice), 8 organization roles (backend work).

## Real-time design decision
The browser has **no Supabase client**. Every read goes through authenticated Next.js API routes that call `SECURITY DEFINER` RPCs under forced RLS. Native Supabase Realtime (`postgres_changes`) would need the browser to hold a Supabase session and `SELECT` grants/RLS policies on private tables, which would weaken the current isolation model. A server-side alternative is Realtime **Broadcast on private per-user channels**, which needs an RLS policy on `realtime.messages` and a trigger/publisher: that is a **hosted migration and requires owner approval** (not requested in this slice).

Implemented now, with no migration and no new exposure: `useLiveRefresh` (`src/features/live/`) refreshes a person's own data through the existing authenticated API reads on tab-visible, window focus, network return, and a 45 s visible-tab timer with exponential backoff (cap 5 min). A failed check is disclosed ("may be out of date"), offline is disclosed, and the last good data stays on screen. Wired into the notification feed and the dashboard offers/work-record reads. Covered by `tests/unit/live-refresh.test.ts` and `tests/e2e/live-refresh.spec.ts` (stand-ins, not hosted evidence).

Proposed next step needing owner approval: private Broadcast channel per user (`user:<uuid>`) with an RLS policy limiting `realtime.messages` to that user, fed by a trigger on the notification/event table; the client would then call `useLiveRefresh`'s refresh on each message, keeping polling as fallback.
