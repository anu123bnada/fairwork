# FAIRWORK 2.0 — Architecture and assessment

Revision: FAIRWORK-ARCH-1.0.0, 2026-10-07. [Approved baseline](ARCHITECTURE_BASELINE.md); [Stage 1 approval](STAGE1_APPROVAL.md). Documentation only. [Master](FAIRWORK_MASTER_SPEC.md), [database](DATABASE.md), [security](SECURITY.md), [API](API.md), [AI](AI_SYSTEM.md), [plan](MVP_PLAN.md), [resolution](ARCHITECTURE_REVIEW_RESOLUTION.md).

## 1. Observed repository state

Original inspection 2026-10-06: `C:/Users/vehiv/Desktop/fairwork` contained README.md (5,933 bytes) and Git metadata only. Main tracked origin/main, HEAD c6efc3c (“docs: define FAIRWORK 2.0 product vision”), prior5306ad1. Remote https://github.com/anu123bnada/fairwork.git. No application, dependencies, framework, schema, configuration, tests, CI or deployment. README read fully. Per-command safe.directory was needed; no global Git setting changed.

Correction inspection 2026-10-07: seven specs and independent ARCHITECTURE_REVIEW.md are present under untracked docs; still no app. All seven documents and all 26 review findings were reread. The review is historical evidence and remains unchanged. This assessment covers this checkout, not uninspected remote branches/services. No fetch, deployment or production credential access is claimed. That was the pre-closure state; the subsequent FAIRWORK-ARCH-1.0.0 baseline closes M-01 with a documentation-only Git boundary. The original review and final verification remain unchanged historical records.

Prior Figma metadata: file5mFuLmt00uZP7Osp3ezM0z page0:1,390×844 screens including onboarding68:6475/6507/6540, language68:6572, phone sign-in68:6613, OTP68:6646, welcome68:6678, home68:6729 and notification variant68:8705. Subsequent detailed reads hit the tool limit. Fonts/colors/accessibility are not audited; no screen redesigned. MVP_PLAN D-02/D-03/D-07 now record the auth, evidence-copy and English-only competition decisions; exact visual inspection remains implementation work.

## 2. Architecture decisions

| ID | Decision and consequence |
|---|---|
| ADR-01 | One Next.js App Router/React strict-TypeScript app; modular code, not monorepo/microservices |
| ADR-02 | Supabase Auth/Postgres; Storage disabled for P0 user data, planned private pipeline later. SQL migrations/generated types authoritative |
| ADR-03 | Server service/DTO boundary over user-JWT **RPC-only** domain access. No browser raw-table reads/writes; no exposed domain views |
| ADR-04 | Immutable authority, offer/agreement/work/submission decisions and typed assertion bases; guarded projections, no full event-sourcing framework |
| ADR-05 | Private ownership plus exact relationship sharing; one registry-backed passport projection for preview/recipient |
| ADR-06 | Independent NOLOGIN RPC executor owners, FORCE RLS, narrow human capabilities and optional leased-worker login; no service-role runtime shortcut |
| ADR-07 | Solo manual P0A and deterministic evidence/diffs; both AI and Prove excluded during 14 days. No discovery/matching/career |
| ADR-08 | External AI purpose/provider consent, typed input relations, validated result and bounded worker; no automatic verification |
| ADR-09 | Existing Figma unchanged; extensions use inspected visual language and documented accessibility/security corrections |
| ADR-10 | Vercel Hobby for eligible personal/non-commercial demo, one hosted Supabase Free synthetic project in Singapore, isolated local test/reset databases; local rehearsal fallback; no production project or provisioning in Stage 1 |

Pin supported Node/Next/TypeScript/Supabase dependency versions at implementation, not based on assumed installation. Tailwind optional for faithful tokens; no generic dashboard kit. Avoid vector databases, queue clusters, ORM migration duplication and public API infrastructure until a measured need.

## 3. Runtime boundaries (proposed)

```text
Browser → Next.js routes/server components → safe DTO/domain services
                    → Supabase validated caller JWT → api.* narrow RPC
                         → distinct NOLOGIN executor + FORCE RLS
                         → private tables / typed FKs / guarded transitions

Privileged human → MFA + protected capability → exact privileged RPC
Optional AI worker (separate login) → ops lease functions → consented input
                                  → provider → validated completion
Passport owner preview / recipient → same projection function
P0 Storage: no user buckets or object access
```

Function ownership and RLS are both required. No raw table privilege is granted to authenticated merely to make a definer function work; executor roles have explicitly scoped table/column privileges and remain subject to RLS. Policy helpers use nonrecursive minimal identity/authority reads. Database §6 lists every P0/admitted-P0B table and verb; API lists EXECUTE grants. Every new relation/function/view requires inventory/policy/tests before exposure.

Normal requests derive identity from validated caller JWT, never from body fields. Separate request-scoped clients prevent session leakage. Client code imports only safe DTO/schema modules; secret-bearing services are server-only. Next.js data-access boundaries follow [official data-security guidance](https://nextjs.org/docs/app/guides/data-security). There is no ambient background service-role client.

## 4. Modules and repository layout

Proposed only: src/app for routes/layouts/errors; src/components/fairwork for Figma-derived primitives; src/features/{identity,offers,agreements,work,evidence,passport}; src/server/{auth,db,audit}; src/lib for shared safe schemas/formatting; supabase/{migrations,tests,seed.sql}; tests/{unit,integration,e2e}; docs; approved public assets; package/lockfile/tsconfig/.env.example. Add optional challenges or ai/jobs modules only after a separately approved post-competition scope change. No empty apps/packages structure.

Identity owns current accounts and immutable company-authority chain. Offers own source/version/diff and immutable questions. Agreements own terms/unresolved hashes and participant acceptance. Work owns frozen submissions and unique counterpart decision. Evidence owns immutable skill mapping, typed assertions, disputes and dna.v1 eligibility. Passport owns explicit item/field grants and a single projection. Operations own redacted audit, shared limits and tracked privacy cases. Optional Prove owns frozen brief/submission and independent reviews; optional AI owns consented bounded processing. Discovery/matching/career remain future modules.

Module consistency crosses one SQL transaction where needed: confirmation→evidence/mapping/assertion→audit/receipt; correction→withdraw/revoke→replacement; consent revoke→cancel jobs. Live eligibility joins suppress disputed/fraudulent/revoked material even before any housekeeping finishes. Notifications are post-commit and future. No in-memory event bus for durable trust state.

## 5. Frontend and data flow

Preserve routes/presentation for welcome, home, add offer, check, questions, agreement, work and passport. URLs may be `/offers/new`, `/offers/[id]/check`, `/offers/[id]/questions`, `/agreements/[id]`, `/work/[id]`, `/passport`, `/shared/[grantId]`; these are not a new navigation design. Auth routes follow the recorded competition choice in MVP_PLAN D-02; no public registration/delivery/recovery flow is a P0 dependency. Prove/analysis/discovery routes are gated and absent or truthfully prototype-labeled when not implemented.

Manual P0A cannot show fake AI analyzing state. Optional Analyzing screen reflects a real persisted job. Every exposed state needs loading/empty/validation/error/permission/stale-version behavior, accessible keyboard/focus/labels and responsive testing. Guards improve UX; SQL/API enforce authorization. Personal/shared content is no-store, not shared server/CDN cache. Preview and recipient call identical field projection; do not implement independent serializers.

Exact terms and unresolved item sets are canonical-hashed and both parties explicitly acknowledge them. Company authority binds frozen decision IDs; a change does not silently replace counterpart authority. Current versus effective agreement pointers are distinct; root state does not duplicate version state. Database §5 is the transition authority, including cases and terminal revocation.

## 6. Optional processing and future provider abstractions

Live AI is excluded from P0A. In a separately approved future scope, one dedicated worker with narrow ops EXECUTE claims durable consented runs with lease expiry and bounded retry; host scheduler/recovery support must pass admission. It rechecks consent immediately before dispatch and at completion. Dispatch is an external side effect; revocation cannot guarantee recall after dispatch authorization. No claim of atomic network+database transactions. Results reference exact old input even if owner creates a newer version.

Future retrieval search/fetch adapters return permission metadata, source identity/URL, retrieval time/hash and bounded content; pipeline rank/deduplicate/extract/validate/reason preserves provenance. No arbitrary fetch/crawler or LinkedIn scraping. Future persisted job matching binds requirement snapshot/hash and rules version. Private source kinds cannot be relabeled public; controlled confidence/state definitions are in AI_SYSTEM.

## 7. Deployment, operations and audit

P0 uses isolated local development/test databases and one hosted synthetic competition project, with distinct local/hosted credentials. The hosted project is the demo/rehearsal environment, not production; previews never target real data. Do not require four hosted projects on a free budget. Before production, add separate staging/production projects and secrets. D-06 fixes host/region and manual export/restore strategy, with account access and restore proof as implementation/deployment checks. Environment contract: Supabase public URL/publishable key, allowed origin, server-only capability/DB-worker credentials when needed, provider key only if optional AI enabled, quota configuration and manifest feature gates. No privileged key under NEXT_PUBLIC_. Startup rejects accidental fixture/live mode confusion. Migration/DB owner credentials stay offline; optional worker cannot approve authority or issue assertions.

CI later checks types/lint, domain tests, direct-role catalog/grant/RLS/transition tests, E2E, secret scans and fixed projection output. Migration tests start empty and upgrade prior state; additive schema before compatible app deployment; never edit already-applied history. Recovery uses reviewed restore/forward fix and replays tombstones/revocations before traffic. Competition recovery uses encrypted manual exports plus versioned migrations and synthetic seed/reset; rehearse restoration before deployment. No paid managed backup/PITR or availability guarantee is assumed.

Audit uses database time and append-only role permissions, compensating events and minimal metadata. Retain trust audit with related assertion/record plus approved dispute period;90 days applies only to separately classified security events. Synthetic release/rehearsal checkpoints export protected audit; real data requires a separate protected export/backup boundary and retention policy. Infrastructure administrators can still tamper; no notarization claim. Track latency, failures, authorization denials and optional costs without employment text. Inspect representative query plans before resorting to caches or elevated credentials.

## 8. Correction completion and readiness

All HIGH findings are addressed as explicit architecture contracts, not tested implementations. SQL roles/FKs/guards still need actual migration proofs. Applicable Day 0 choices are resolved in MVP_PLAN; ARCHITECTURE_BASELINE and STAGE1_APPROVAL identify the approved Git boundary. Real employment data is separately blocked on pre-production policy decisions. Verdict **READY** for the approved solo architecture, subject to non-blocking implementation proof and release gates. No Stage 2 work is started. See resolution for counts, issue-by-issue decisions, consistency checks and limitations.
