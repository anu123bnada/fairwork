# ORYQEN parallel agent assignments (Phase 0, 17 Nov 2026)

Defines isolated workstreams, ownership, dependencies and deliverables so that agents can work in parallel **without two agents modifying the same file**. Agent 1 (release lead, integration owner) is the only agent that merges into release branches or deploys. Nothing here has been started: Phase 0 stops at the audit.

## 1. Ground rules (apply to every agent)
1. **One worktree and one branch per agent.** Branch names `agent/<workstream>`; worktrees live beside the repository. Existing worktrees are preserved (section 5). No agent works in the main checkout.
2. **One writer per path.** A path has exactly one owning workstream (section 3). To change a path you do not own, write a request in `docs/requests/<from>-to-<owner>-<topic>.md` (one paragraph: what, why, acceptance). The owner makes the change or declines in writing.
3. **Hot files are integration-only.** These files collide by nature and are edited **only by Agent 1 during integration** (or by the named owner when the file is the subject of their sprint, announced in advance): `src/components/fairwork/product-app.tsx` (screen registry), `src/app/app/[screen]/page.tsx` (screen list), `src/features/navigation/destinations.ts`, `src/features/offer/participant-path.ts`, `src/i18n/messages.ts`, `scripts/prepare-local-development.mjs` (migration hash list), `package.json` and `package-lock.json`, `.github/workflows/*`. A feature agent that adds a screen ships the component and a short "wiring note"; Agent 1 applies the registry lines at merge.
4. **Migrations only through Backend.** Any change under `supabase/migrations` is written or reviewed by the Backend and Database agent and by Security (RLS review). Version prefixes are allocated by Agent 1 (one agent, one sequence) to prevent two agents inventing the same timestamp.
5. **Never weaken** security, RLS, authentication, authorization or tests. A test may change only when the behavior it pins changed deliberately (like the migration count test on 16 Nov), with the reason in the commit.
6. **Before every handoff to Agent 1:** `npm run typecheck`, `npm run lint`, the **full** `npx vitest run` (not a subset: on 16 Nov a partial local run missed two CI failures), the relevant Playwright specs, and the secret scanner. The branch state must be pushed and every artifact named in the handoff.
7. **No agent deploys, force-pushes, deletes branches or worktrees, applies a migration to any hosted database, or touches production.** Hosted changes require Agent 1 and the owner's written approval (the apply procedure and backup guard are in `scripts/apply-staging-migrations.mjs`).
8. **No secrets** in files, logs, reports or chat. Test accounts are synthetic and created by the owner.
9. **Evidence or it did not happen.** A task is done only when its acceptance evidence (section 4 and the roadmap) is attached.

## 2. Workstreams, owners and deliverables
| WS | Name | Agent | Mission |
|---|---|---|---|
| A | Backend and database | Agent 2 | Data model, RPCs, migrations, erasure and retention, audit, performance |
| B | Frontend and design | **Agent 6** (dedicated reference-accurate UI) | Design system, screens, accessibility, localization, integration of the replication work |
| C | Android (and desktop shells) | Agent 7 | Signed AAB, push, device matrix, Play readiness, Windows signing |
| D | AI and intelligence | Agent 5 | AI gateway, evaluation, intelligence modules 1, 2, 3, 11, 16, 19, 23, 24 |
| E | Security and QA | Agent 3 (security) and Agent 8 (QA) | Isolation suite, hosted journeys, load, accessibility, pentest liaison, release evidence |
| F | Integrations and infrastructure | Agent 4 | Production and pre-production environments, secrets, email, monitoring, backups, external connectors |
| 0 | Release lead and integrator | **Agent 1** | Merge, CI gate, deployment, registry files, roadmap, go or no-go evidence |

### Workstream A: Backend and database (Agent 2)
- **Owns:** `supabase/migrations/**` (writing; Agent 1 allocates versions), `src/server/**` **except** `src/server/ai/**`, `src/server/net/**` (WS-F), `src/server/integrations/**` (WS-F), and the intelligence server folders listed under WS-D; `src/app/api/v1/**` for modules 4, 5, 6, 7, 8, 9, 10, 12, 13, 18, 20, 21, 22 (offers, agreements*, vault, passport, work-*, organizations, operator, admin, credentials, trust-chain, notifications, developer, entitlements, privacy-requests, security-events, platform-notices, auth, me); `src/features/{offer,vault,work,records(kind-agnostic core),trust,authority,credentials,developer,entitlements,privacy,admin,cases,agreements*,employers?}` server-side schemas and logic.
- **Deliverables:** account deletion and erasure (SEC-C4); retention policy and tooling; notifications backend for email and push (with WS-F, WS-C); malware-scan hook for uploads (with WS-F); agreement clause editor and e-signature integration backend (blocked on provider); dispute attachments and organization response; webhook delivery queue; real employer verification method (blocked on decision); performance indexes from load findings.
- **Depends on:** WS-F environments; legal decisions (counsel); Agent 3 security review of every migration.

### Workstream B: Frontend and design (Agent 6)
- **Owns:** `src/components/**` (all UI and CSS), `src/app/**` pages and layouts (not `api/`), `src/i18n/**` including `messages.ts` and translation review artifacts, `public/**` (brand assets), design documents, `playwright.replica.config.ts` and `tests/e2e/replica-*.spec.ts`.
- **Starting point (preserved, not yet integrated):** branch `agent/ui-replication` (`1e36d1f` dashboard; `04670d8` Check, Vault, Passport, Employer, Career, Opportunities replication). A dry-run merge into the current dev branch has **no conflicts**. Integration sequence is in the roadmap (Phase 0 close-out): Agent 1 merges it into a **new integration branch** (not directly into the dev branch), runs the full CI, Agent 6 and the owner review the result against the nine reference images, and only then is it promoted. Its replacement of the shell must keep the two new screens, the migration-count and "Find work" count tests green (update the pinned numbers deliberately).
- **Deliverables:** reference-accurate screens for all modules; mobile-first layouts; accessibility pass (manual screen-reader audit with WS-E); localization hooks for the English-only screens (modules 23 and 24) and native-reviewer workflow; removal or production-gating of demonstration surfaces (module matrix section 4).
- **Depends on:** nothing for the replication; WS-D/WS-A components that add screens must hand over wiring notes.

### Workstream C: Android and desktop shells (Agent 7)
- **Owns:** `mobile/**`, `desktop/**`, `scripts/android-*`, `scripts/verify-android-poc.mjs`, `playwright.android-local.config.ts`, `docs/ORYQEN_ANDROID*.md`, `docs/ORYQEN_RELEASE_SIGNING.md`, `docs/ORYQEN_WINDOWS_RELEASE_NOTES.md`.
- **Deliverables:** release variant built as a signed **AAB** in a protected CI environment; FCM push with consent (with WS-A and WS-F); native value for the WebView policy risk; device and Android 16 matrix; Play Console assets and data-safety draft (with counsel); Windows signing configuration.
- **Depends on:** owner decisions (application id, domain, keystore custody, Play account, icons); production backend (WS-F); account deletion (WS-A).

### Workstream D: AI and intelligence (Agent 5)
- **Owns:** `src/server/ai/**`, `src/features/{analysis,careers,opportunities,research,salary,guidance,jurisdiction,cv,cover-letter,scan,scam,recruiter,help}/**`, `src/server/{research,opportunities*,cv,recruiter}/**` and the matching `src/app/api/v1/{research,career-assistant,opportunities,cv,guidance,recruiter}` routes, `tests/live/**`. UI components for these modules are written by WS-B; WS-D supplies data contracts and copy.
- **Deliverables:** AI provider integration with contract and written policy approval references (blocked), a 200-document evaluation set and prompt-injection red-team set, cost caps and kill switch; model-backed Copilot behind consent; Sri Lanka country rules with sources and counsel review (blocked on sources); sourced occupation taxonomy and salary dataset integration (blocked on licences); course-catalog freshness checker for module 23; opportunity ingestion framework and the first genuinely authorized external source with scheduled refresh for module 24 (blocked on source authorization); deduplication and freshness checks.
- **Depends on:** WS-F for secrets, schedulers and connector runtime; WS-A for migrations; owner for providers and licences.

### Workstream E: Security and QA (Agents 3 and 8)
- **Owns:** `tests/**` for shared harnesses, `tests/hosted/**`, a new `tests/isolation/**`, `tests/load/**`, `scripts/test-hosted-*`, `scripts/verify-hosted-*`, `scripts/scan-secrets.mjs` and its allowlist, `playwright.hosted.config.ts`, `docs/ORYQEN_SECURITY*`, `docs/ORYQEN_ACCEPTANCE*`. **Feature owners write and own the unit and integration tests of their own features** (`tests/unit/<feature>*`); QA owns anything cross-cutting.
- **Deliverables:** the synthetic account set and the multi-account hosted journeys (all 12 in the acceptance matrix); the cross-tenant isolation suite (SEC-C2); load, performance and soak tests; cross-browser and device matrix runs; manual accessibility audit with WS-B; pentest vendor scoping and liaison; weekly security review of every migration and authorization change (a veto on merge).
- **Depends on:** pre-production environment (WS-F); synthetic accounts (owner); feature freeze on authorization code before the pentest.

### Workstream F: Integrations and infrastructure (Agent 4)
- **Owns:** `.github/workflows/**` (changes land through Agent 1), Vercel and Supabase environment definitions, `scripts/preflight-*`, `scripts/apply-*`, `scripts/backup-*`, `src/server/net/**`, new `src/server/integrations/**` and `src/app/api/v1/integrations/**`, `docs/runbooks/**`, monitoring and alerting configuration, n8n or scheduler definitions.
- **Deliverables:** production and pre-production Supabase and Vercel environments with separate secrets; PITR and a restore drill; email sender domain and provider; monitoring, alerting, error tracking, status page and incident runbook; edge rate limits; malware-scanning service; scheduler for module 24 refresh and the course-link checker; connector runtime and consent and deletion plumbing for external platforms.
- **Depends on:** owner decisions (region, domain, vendors, budget).

### Agent 1: Release lead and integrator
- **Owns:** release branches (`release/*`, `integration/*`, `main`), the hot files in rule 3, version allocation for migrations, `docs/ORYQEN_MASTER_*`, `docs/ORYQEN_*_REPORT*`, release notes, the deployment lane (`fairwork-release` worktree) and go or no-go evidence.
- **Process:** (1) each agent hands over a pushed branch with the checklist in rule 6; (2) Agent 1 merges into a new `integration/phase-N` branch **with no fast-forward of release branches**; (3) full CI on that branch; (4) if red, the owning agent fixes on its branch; (5) after green, staging deploy by cherry-pick or fast-forward with a source-tree comparison as done on 16 Nov; (6) production only with explicit written owner approval.

## 3. Collision matrix (who may edit what, at a glance)
| Path | Owner | Others |
|---|---|---|
| `supabase/migrations/**` | A (writes), 3 (reviews), 1 (version numbers) | request only |
| `src/server/ai/**`, intelligence features and routes | D | request only |
| `src/server/**` core, non-intelligence API routes | A | request only |
| `src/server/net/**`, `src/server/integrations/**` | F | request only |
| `src/components/**`, `src/app/**` (pages), `src/i18n/**`, `public/**` | B | wiring notes to 1 |
| `mobile/**`, `desktop/**` | C | request only |
| `tests/hosted/**`, `tests/isolation/**`, `tests/load/**`, hosted scripts | E | request only |
| `tests/unit/<feature>*`, `tests/integration/<feature>*` | the feature's owner | E may add cross-cutting tests |
| `.github/workflows/**`, release branches, hot files | 1 (F proposes) | request only |

## 4. Dependencies and what runs in parallel
**Can start immediately in parallel (no external dependency):** B (integrate replication, localization hooks, demo-surface gating), A (erasure design and migrations, upload scan hook, webhook queue), D (evaluation harness, course-link checker, ingestion framework with the internal source, taxonomy interface), E (isolation suite design, load test design, accessibility audit plan), C (AAB build in CI with a throwaway id, device matrix plan), F (inventory and decisions memo, pre-production environment, restore drill, monitoring), and the owner-facing external starts (counsel, data licences, AI contract, email domain, pentest vendor, Play account).
**Must wait:** E's hosted journeys wait for F's pre-production and the synthetic accounts; C's store work waits for the owner's identity decisions and A's account deletion; D's AI-on work waits for the provider contract; module 24 external sources wait for platform authorization; the pentest waits for a feature freeze on authorization code and a green isolation suite; production waits for every gate in the roadmap.
**Sequential bottleneck:** migrations (one reviewer, one version sequence) and integration merges (Agent 1). Plan for this by batching migrations weekly.

## 5. Existing worktrees and branches (all preserved, none deleted)
| Path | Branch | Commit | Proposed role |
|---|---|---|---|
| `fairwork` | `exhibition/dev-nov10` | `93f4432` | Agent 1 main checkout and dev integration |
| `fairwork-release` | `deploy/staging-cherry` | `b0e78d0` | Agent 1 staging deployment lane only |
| `fairwork-ui-replication` | `agent/ui-replication` | `04670d8` | **Agent 6 continues here** (WS-B) |
| `fairwork-android-agent` | `agent/android-exhibition` | `de645ec` | Agent 7 (WS-C); first action: merge or rebase onto the current dev branch (no force) |
| `fairwork-windows-agent` | `agent/windows-exhibition` | `de645ec` | Agent 7 (desktop); same base as above |
| `fairwork-ui-agent` | `agent/ui-exhibition` | `e879ac6` | Superseded by Agent 6; keep as reference |
| `fairwork-offer`, `fairwork-qa`, `fairwork-ui` | `feature/oryqen-*-parallel` | old | Reference only; harvest anything still unmerged before retiring (owner decision) |
| `...build-recovery` (detached) | `10b81d9` | | Recovery reference; do not touch |
New worktrees to create at Sprint 1 start (Agent 1 creates them, not the agents): `agent/backend-db`, `agent/ai-intel`, `agent/security-qa`, `agent/infra-integrations`.

## 6. Local resource constraint
The development machine has **about 6 to 8 GB free on C: (99% used; 6.4 GB by `df` and 7.67 GB by PowerShell at different moments of the same hour)**. Each worktree normally needs its own dependency tree (`node_modules`) and build output. The plan therefore needs one of: more disk, junctioning `node_modules` read-only where branches share `package-lock.json`, or limiting concurrent worktrees. Agents that run the full browser suite also need several GB of free RAM (the Android emulator was blocked by RAM twice). **Resolve this before launching more than two or three concurrent agents.** Sizes measured on 17 Nov are in section 7.

## 7. Measured on 17 Nov 2026
- Dependency trees present on disk: the main checkout and **6 of the 8 other worktrees** (`fairwork-offer`, `-qa`, `-release`, `-ui`, `-ui-agent`, `-ui-replication`); `fairwork-android-agent` and `fairwork-windows-agent` have none. Each tree has 212 top-level packages. **The size of a tree was not measured** (a recursive size scan of `node_modules` did not finish in several minutes on this machine) and I will not guess it.
- Other local weight: `.next` 353 MB, `test-results` 20 MB, `release-artifacts` 120 MB in the main checkout (I cleared 2.8 GB of `.next` and `test-results` on 14 Nov, which is why free space rose).
- **Implication.** Adding new worktrees each with a full `npm ci` is likely to exhaust the remaining space. Before Sprint 1, the owner should free disk (or add a drive), retire dependency trees of worktrees that are reference-only (`fairwork-offer`, `-qa`, `-ui`, `-ui-agent`; nothing deleted without the owner's approval), and agents should share one machine only if RAM allows (the Android emulator failed twice on RAM).
