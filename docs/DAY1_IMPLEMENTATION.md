# Day 1 implementation handoff

Current status: the hosted repairs are applied and all 16 catalog checks pass. See [DAY1_FINAL_VERIFICATION.md](DAY1_FINAL_VERIFICATION.md) for preserved-file evidence, the current one-command verifier, and the remaining authenticated/expiry gate. Earlier status entries below are historical.

Current follow-up: [DAY1_RPC_EXECUTE_REPAIR.md](DAY1_RPC_EXECUTE_REPAIR.md) prepares the narrow forward migration `202610090001` for the owner-confirmed anon/service_role RPC EXECUTE defect. Earlier migration files remain unchanged. Hosted application and verification require approval; Day 2 remains blocked.

Latest proposal (2026-10-09): the hosted `42501` cause is missing `auth` schema USAGE for both executor roles, and postgres lacks authority to grant it. The failed, unrecorded `202610080001` proposal is archived. Replacement `202610080002` uses two restricted private scalar Auth helpers without changing managed Auth privileges. See [DAY1_AUTH_CONTEXT_REPAIR.md](DAY1_AUTH_CONTEXT_REPAIR.md) for the current proposal, verification and approval gates. Day 1 hosted completion and Day 2 readiness remain pending; earlier entries below are historical.

Date: 2026-10-07. Baseline: `FAIRWORK-ARCH-1.0.0`, tag `fairwork-architecture-v1.0.0`, commit `c1dc8ab8e956819ce5af5f0f2c047e5cbee2d2f1`. The subsequent owner request authorizes Day 1 implementation and specifies a **13-day** sprint; the baseline's approximate 14-day schedule remains historical. This pass implements foundations only and stops before Day 2. No architecture contract, baseline tag or independent review was rewritten; no commit/push/deployment performed.

## Implemented

- Single Next.js 16.4.0 App Router / React 19.3.0 application, strict TypeScript 5.9.3, exact dependency pins and npm lockfile. No monorepo, Tailwind, ORM, queue or AI provider.
- Public/server environment validation, a supported unconfigured development state, secret-key rejection, synthetic-only data mode and startup validation. The technical checkpoint builds without provider credentials; protected endpoints fail closed.
- Supabase SSR 0.12.7 / supabase-js 2.117.3 browser/server factories, request-scoped server clients, cookie refresh Proxy, verified `getUser()` identity at protected route boundary, email/password sign-in and current-session sign-out handlers. No signup, SMS, recovery UI, service-role client or OAuth implementation.
- Strict Zod request/DTO validation, bounded JSON body reads, same-origin mutation checks, generic safe error envelopes/request IDs, private/no-store API responses and minimal redacted error logging.
- One initial migration with private profiles, protected capability assignments, audit logs, command receipts and atomic quota buckets. No future offer/work/evidence/challenge/AI tables. Read-only profile queries never create a profile.
- Exactly three `api` RPCs: `create_profile(jsonb)`, `get_me(jsonb)`, `update_profile(jsonb)`. Derived actor, strict key validation, caller-scoped RLS, optimistic revision, serialized writes, 24-hour receipts, replay reauthorization, audit and shared quotas. Same-key replay returns the current authorized DTO for the original profile ID without repeating the mutation/audit; it does not store personal response bodies.
- Semantic Button/FormField/PageShell/loading/error primitives. The root is explicitly a **technical checkpoint**, not a redesigned Welcome/Home screen. No product auth screen or general profile editor is claimed.
- Meaningful unit, PostgreSQL/WASM integration and Chromium smoke tests; separate scripts prepare the later test layers.

## Role and security boundaries

WORKER/EMPLOYER/ADMIN are context vocabulary, not editable credential fields. Every active profile can use its own worker identity. ADMIN context is derived only from protected, unexpired/unrevoked capabilities with `aal2`; profile/user metadata never grants it. EMPLOYER authority remains unavailable until Day 2 implements the exact immutable company membership/decision chain. There is no temporary employer/admin shortcut and no privileged operator HTTP command yet. TOTP configuration and capability predicates are prepared; hosted enrollment/provisioning are not tested.

All five tables have ENABLE + FORCE RLS and a separate NOLOGIN schema owner. Nonowner/NOBYPASSRLS user and policy executors own only their functions. Metadata-only helper policies are nonrecursive. Anon, authenticated, service_role and PUBLIC receive no private schema/table access. Only authenticated receives the three exact RPC EXECUTE grants. Migration credentials are offline; no app runtime can SET ROLE into an executor. Initial audit/receipt immutability and terminal capability revocation guards are installed. Future privacy retention work must add its scoped exception; Day 1 has no purge endpoint.

Auth cookies are managed by Supabase SSR; browser-capable SSR sessions are not claimed to be HttpOnly. XSS remains a relevant session risk: render untrusted values as text, preserve the server/client import boundary, and add the reviewed deployment CSP with the actual product screens. No client secrets or private domain tables are exposed. Auth delivery, password abuse controls and project settings still require the owner configuration below; app domain quotas do not replace Auth's own rate limits.

## Structure

```text
src/app/                      Technical checkpoint, errors, /api/v1 routes
src/components/fairwork/       Semantic reusable primitives
src/features/identity/         Strict input/DTO schemas and context vocabulary
src/lib/                      Safe errors, env parsing, browser Supabase factory
src/server/                   Server-only env, Supabase, HTTP and identity boundary
src/types/database.ts         Narrow Day 1 RPC transport types
src/proxy.ts                  Cookie refresh, no authorization shortcut
src/instrumentation.ts        Startup config validation
supabase/config.toml          Local synthetic stack configuration
supabase/migrations/           Initial identity SQL migration
tests/unit/                   Validation/auth/error unit tests
tests/integration/            Actual PostgreSQL/WASM roles/RLS/RPC tests
tests/e2e/                    Unconfigured production-build Chromium smoke tests
```

`database.ts` is explicitly hand-authored narrow transport typing, not falsely labeled generated. Once Supabase is running, `npm run db:types` writes `src/types/database.generated.ts`; review it and replace the narrow transport import deliberately. Do not expose raw generated private tables to browser code.

## Install and run

Use Node satisfying `^22.13.0 || ^24.0.0 || >=26.0.0` and npm. This pass ran on Node 26.3.0 / npm 11.16.0. Node 24 is a suitable supported line; a hosted runtime must be verified separately.

```powershell
cd C:\Users\vehiv\Desktop\fairwork
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Leaving both Supabase values empty intentionally displays the unconfigured checkpoint; it does not authenticate or simulate successful database operations. Partial/malformed configuration fails validation. Restart/rebuild after changing public environment variables. Never copy real passwords or secret keys into `.env.example` or Git.

| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Browser-safe Supabase project URL; HTTPS, or loopback HTTP locally |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Browser-safe publishable key, or legacy/local anon JWT; secret/service-role keys rejected |
| APP_ORIGIN | Server-only exact origin for cookie mutations; local default http://localhost:3000, HTTPS hosted |
| FAIRWORK_DATA_MODE | Server-only; synthetic only for this baseline |

There is no application service-role, database-owner or AI-provider environment variable. `.gitignore` excludes environment files except the empty example, dependencies, build output, browser reports and local Supabase state.

## Initial Supabase setup — historical result from 2026-10-07

At the initial verification, no project credentials were supplied and Docker was not installed in this execution environment. The installed Supabase CLI also encountered the sandbox restriction on creating the owner's `.supabase` configuration directory. The hosted configuration and partial live verification on 2026-10-08 below supersede that configuration blocker. Do not overwrite the now-configured `.env.local` or reset the hosted database.

For the preferred isolated local path:

1. Install/start Docker Desktop with a working container engine. Run commands as the project owner so the CLI can create its normal per-user configuration directory.
2. From the project root run `npm run db:start`, then `npm run db:reset`. **Reset is only for the disposable local synthetic database**, not a shared/hosted environment. The supplied config exposes only `api`, disables public/anonymous signup, SMS and Storage, and enables TOTP. It does not seed accounts automatically.
3. Read the local project URL and publishable/anon key from `npx supabase status`; put only those public values into `.env.local`. Keep Auth/admin/DB secrets out of the application.
4. Through local Studio's offline user management, provision distinct synthetic worker A/B, employer/test-actor and operator accounts with strong passwords kept outside Git. Mark email confirmation using the trusted provisioning tool; don't add a public confirmation bypass. Use only invented employment/identity content and owner-controlled demo login identifiers.
5. Sign in via the email/password handler, then call `POST /api/v1/me` as that authenticated account to create its minimal profile. Provisioning may exercise this endpoint; no signup/profile-management UI is included. Do not populate protected fields from Auth metadata.
6. Verify real Auth cookies, refresh/expiry/sign-out, PostgREST exposure/grants, A/B denial, direct RPC validation/quotas and actual database catalog. Enroll operator TOTP before any future privileged command. Day 2 adds named offline capability bootstrap/audit and the immutable employer-authority workflow; do not bypass those gates today.

For a later hosted synthetic project, apply the migration using the approved offline migration workflow, expose only `api` in Data API settings, disable public/anonymous signup, keep buckets empty with no user Storage allow policy, configure exact URLs/origins and Auth abuse limits, and provision only synthetic actors. `config.toml` is a **local** configuration; it does not configure a hosted project automatically. Do not run `db reset` against hosted data, deploy publicly, or accept real employment records merely because the local build passes.

The migration creates `fw_schema_owner`, `fw_user_exec`, `fw_policy_exec`, and private/api schemas; apply once via migration history on a fresh isolated project. It grants only offline `postgres` membership in those roles. Do not apply it to an unrelated/shared database or work around permission failures using runtime credentials.

## Day 1 HTTP surface

| Method/path | Body / behavior |
|---|---|
| POST /api/v1/auth/sign-in | `{email,password}`; Supabase password flow, generic credential errors, tokens only in SDK-managed cookies |
| POST /api/v1/auth/sign-out | `{}`; current-session sign-out |
| GET /api/v1/me | No selectors/query parameters; exact own DTO, no bootstrap |
| POST /api/v1/me | `{displayName,locale:"en",timeZone}` plus UUID `Idempotency-Key` header |
| PATCH /api/v1/me | Same display fields plus `expectedRevision`, UUID `Idempotency-Key` header |

Mutations require JSON and an exact `Origin: APP_ORIGIN`; browsers send the origin automatically. Extra role/actor/state fields are rejected. Direct RPC callers pass `{request:{...fields,idempotencyKey}}`; `get_me` uses `{request:{}}`. RPCs independently enforce authentication, authorization, strict input and quotas. Domain auth is separate from Supabase Auth: a valid session for a suspended profile cannot access/rebootstrap its profile.

## Figma record

Read-only inspection of file `5mFuLmt00uZP7Osp3ezM0z`, sign-in node `68:6613`, returned high-fidelity context and screenshot. Recorded text tokens: Manrope 400/700, primary `#0b1b33`, secondary `#66728a`, link `#1e4fff`, heading 26px. Manrope is bundled through the font package, not fetched at build/runtime from Google. Existing full-screen background/logo/field/button artwork was inspected but is not embedded into a replacement screen. The primitives retain native controls/focus until their exact Figma styling is integrated. No pixel-perfect claim, new design system, new navigation, Figma write or product screen rebuild.

## Checks and limits

| Check | Result |
|---|---|
| Dependency installation | Fresh `npm ci` passed in `C:\Users\vehiv\Desktop\fairwork` with locked exact versions |
| Typecheck | Passed, strict TypeScript and generated Next route types |
| Lint | Passed, zero warnings |
| Unit | 10 tests passed: config, hostile input, CSRF, body bounds, safe errors, Auth token/identity boundary |
| Integration | 12 tests passed in PGlite: migration, roles/grants/FORCE RLS, catalog policy inventory, own-only access, escalation denial, NULL validation, revision/replay/audit, capabilities/MFA/revocation, suspension, quotas |
| Production build | Passed, Next.js/Turbopack |
| Browser E2E | 2 Chromium smoke tests passed against production build, runner exit 0 in separate-server mode: accessible unconfigured checkpoint and fail-closed API behavior |
| Dependency audit | Zero reported vulnerabilities, including development dependencies, at the time of this pass |
| Initial live Supabase/Auth/PostgREST/Storage check (2026-10-07) | Was blocked by owner configuration; see 2026-10-08 partial hosted results below |
| Multi-connection concurrency / hosted recovery | Not established by PGlite; later full-stack gates |

Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, and `npm run build`. For the **unconfigured** browser smoke suite leave Supabase variables empty, then run `npx playwright install chromium` and `npm run test:e2e`. The suite owns port 3000; stop another dev server first. There is no placeholder test counted as a pass for live Supabase. PGlite uses real PostgreSQL execution but a test-only Supabase auth/JWT shim and one connection; no shim is deployed in the migration/app.

In this Windows sandbox, Playwright's automatic server teardown stalled after both assertions passed. The verified alternative is to run `npm run start` in a separate terminal, then set `$env:PLAYWRIGHT_EXTERNAL_SERVER='1'` and run `npm run test:e2e` in the test terminal. This mode leaves server lifecycle with its owning terminal; stop that server with Ctrl+C afterward. Clear the variable with `Remove-Item Env:PLAYWRIGHT_EXTERNAL_SERVER` to restore automatic server management. The reported browser results refer to the separate-server mode, not the interrupted runs.

ESLint 10 uses core, TypeScript and React Hooks rules. `eslint-config-next` was removed after its transitive glob dependency produced an unfixed high-severity development audit finding; no downgrade of Next or forced dependency override was used. Next builds still enforce framework compilation/server-only boundaries. Recheck the audit when dependencies change.

Mechanism references: [Next installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework), [PGlite execution](https://pglite.dev/docs/). These support the mechanisms, not a claim of hosted verification.

## Day 2 prerequisites and stopping point

The owner has reported completing hosted project/account configuration. Authenticated live verification and hosted catalog checks remain prerequisites, as detailed below, along with review of this uncommitted change. Begin Day 2 only on a subsequent user instruction. Day 2 can extend the identity foundation with the immutable company-authority chain, offline named capability provisioning/MFA and its direct-role tests. Do not add a mutable employer/admin role field or public capability-grant endpoint. Real-data, deployment and optional-module gates from Stage 1 remain in force. The 13-day target does not relax security or introduce optional features.

Known limits: no product screens, employer authority, operator workflow, offers, agreements, work evidence, passport, external AI, Prove, privacy automation or real-data readiness is implemented. The private-data app is not release-ready merely because Day 1 checks pass. No real user data or secrets are included.

Initial repository review (2026-10-07): 42 new source/configuration/test/handoff files and README modified; nothing staged or committed. All 12 existing architecture/review documents remained byte-identical, and HEAD/baseline tag still resolved to the commit above. `git diff --check` passed. Environment files, dependencies, build/cache output and browser reports were ignored; the new tracked-candidate files contained no real provider credentials. The initial test server was stopped after verification.

## Live hosted verification — 2026-10-08 (Asia/Colombo)

**Status: COMPLETE WITH REMAINING OWNER ACTION. Ready to commit: NO, pending authenticated live and catalog verification.** Configuration is no longer the blocker; owner-local account entry is needed to finish verification. No provisioned account passwords were available to the agent, and none were requested in chat.

Owner-reported facts: hosted project created; migration `202610070001` pushed and local/remote migration lists synchronized; synthetic users provisioned; only `api` exposed; exactly the three intended functions exposed; automatic new-table exposure disabled. Migration history, authenticated surface and automatic-exposure configuration have not been independently verified against the hosted catalog.

Direct execution used the actual hosted URL/publishable key from `.env.local` in memory and the running local Next.js app at `http://localhost:3000`. No secret values were printed. The public runner completed **28 PASS, 7 UNVERIFIED, 0 FAIL** (exit 2 intentionally denotes incomplete coverage). Its sanitized results are in ignored `test-results/day1-hosted-public.json`.

| Hosted check | Factual result |
|---|---|
| Project connection | PASS: hosted HTTPS Auth settings reachable; local checkpoint reports configured |
| Auth configuration | PASS: settings report public signup disabled, anonymous users disabled, email provider enabled |
| Valid synthetic login and browser cookie session | UNVERIFIED: requires owner-entered credentials |
| Invalid credentials | PASS: generated nonexistent account rejected through Next.js with HTTP 401, generic AUTH_REQUIRED message and private/no-store; no provider internals or session payload returned. Wrong password for an existing account remains UNVERIFIED |
| Profile creation, read, update, revision/idempotency | UNVERIFIED on hosted data; local PostgreSQL tests passed |
| A/B isolation and protected role/capability escalation | UNVERIFIED with hosted authenticated users |
| Public Data API table access | PASS: all five private table names under `api` return 404/PGRST205; `private`, `public`, `auth`, `storage`, `graphql_public` schema selectors return 406/PGRST106 |
| Anonymous RPC execution | PASS: all three known RPC calls denied with 401/403 and 42501; anonymous OpenAPI enumeration denied |
| Unauthenticated app endpoints | PASS: GET, POST and PATCH `/api/v1/me` return 401/AUTH_REQUIRED; GET has private/no-store |
| Mutation Origin | PASS: missing and foreign Origin return 403/ACTION_FORBIDDEN |
| Sign-out and refresh-token revocation | UNVERIFIED: requires a real authenticated test session |
| Exact authenticated PostgREST surface | UNVERIFIED: public probes cannot prove the authenticated allowlist. Unknown RPC probe returned 404/PGRST202 |
| Hosted catalog/RLS/grants/triggers/migration history | UNVERIFIED: no privileged database connection used. Read-only owner query supplied |
| Natural session expiry and automatic application refresh | UNVERIFIED; no claim based on initial cookie or explicit provider-refresh checks |
| Hydration observation | PASS in clean Chromium: no observed hydration warning or reported injection attributes; source/server HTML also contain none of `bis_skin_checked`, `__processed_*`, `bis_register`. Consistent with extension injection; not proof of which extension caused the owner's warning |

Local checks rerun with hosted public configuration: typecheck PASS; lint PASS; unit **10 passed**; integration **12 passed** in PGlite; production build PASS. These local tests are not substituted for authenticated hosted verification. No application code, migration, security setting, UI or baseline document changed during this verification. No commit or push.

### Finish the owner-local checks

New verification files: `scripts/verify-day1-hosted.mjs` and `scripts/day1-hosted-catalog.sql`. The runner passed syntax/lint checks and its credential-free live path was executed. The interactive path has been inspected but remains UNVERIFIED until run with owner input. The catalog query's 11 assertions were syntax/behavior checked against the local migrated PostgreSQL fixture with synthetic migration history; all passed there, **not** on the hosted database.

Keep the configured Next.js application running at APP_ORIGIN (currently localhost:3000). In another interactive PowerShell terminal:

```powershell
cd C:\Users\vehiv\Desktop\fairwork
npx playwright install chromium
node scripts/verify-day1-hosted.mjs
```

The browser install command is only needed once. If reusing this agent's existing browser download, set `PLAYWRIGHT_BROWSERS_PATH` to `C:\Users\vehiv\Documents\Codex\2026-10-06\files-mentioned-by-the-user-fairwork\work\playwright-browsers` instead. Enter two distinct ordinary synthetic users, preferably without existing profiles, into the **hidden email/password prompts**. Never put their values in command arguments, source, `.env`, shell history or chat. Do not run under a terminal transcript, debugger, request recorder or HTTP capture. No screenshots, tracing, storage-state files or credential reports are enabled. JavaScript secrets live only in process memory; the runner does not claim cryptographic memory erasure.

The interactive run exercises real browser cookie login/reload, two independent profiles, updates/replays/stale revisions, cross-user selector/mutation rejection, direct RPC injection, authenticated schema enumeration, user-metadata escalation with a freshly refreshed JWT, app sign-out and refresh-token revocation. It only asserts the fixed DTO/denial behavior; hosted catalog predicates still require the separate query. Existing profiles cause creation to be marked UNVERIFIED, so use fresh synthetic accounts to cover that check.

Test side effects are explicit: new synthetic profiles remain; profile updates/restoration advance revisions and retain audit/receipt history; previously absent metadata probe keys are restored as null (inert keys may remain). Original display fields and previous metadata values are restored when possible. Cleanup failures are reported as FAIL; inspect/revoke the affected synthetic sessions locally if interrupted. Existing access JWTs may remain valid until expiry after sign-out; the test asserts browser-cookie removal and refresh revocation, not immediate universal JWT invalidation.

Results contain only named verdicts and fixed notes in ignored `test-results/day1-hosted-interactive.json`. Exit 1 means a failure/interruption; exit 2 means at least one UNVERIFIED check, including the separate catalog/expiry gates; exit 0 means every emitted check passed. A nonzero result is not permission to weaken a policy. Share only this sanitized verdict file, never raw browser/network output.

In the hosted Supabase SQL Editor, run `scripts/day1-hosted-catalog.sql` as the owner. It opens a read-only transaction and selects only 11 catalog PASS/FAIL results: history, table owners/FORCE RLS, executor properties/membership, schema/table/column/function privileges, RPC signatures/search paths, API relations, policy inventory and enabled invariant triggers. It selects no user rows, credentials or tokens and changes no schema. Share only those verdicts. This is a targeted invariant check, not a full schema-equivalence or concurrency proof.

Remaining owner action: execute the interactive runner and catalog query, review their verdicts and resolve any failures before marking the live pass complete. The owner's running app was left running. Stop here; Day 2 is not authorized by this verification request.

### Reported reload failure — diagnostic correction (2026-10-08)

The owner-run interactive verdict confirms User A's password sign-in, initial browser session cookie, session decoding, application sign-out, cookie removal and refresh-token rejection passed. It then reports `cookie survives browser reload` failed. That old check accepted only profile HTTP 200/404 and recorded no response status/error. It conflated any profile/backend failure with cookie loss. The original verdict cannot establish whether the hosted response was an authentication, authorization, database or service failure.

Reproduction before edits: the exact original predicate returned false for an HTTP 503 fixture even with a retained cookie and valid identity. This proves a verifier reporting defect, not the cause of the original hosted response. No cookie, SSR, proxy, sign-in, API, schema or grant change was made on that evidence.

The verifier now reports browser-cookie retention separately from profile endpoint availability; it retains the HTTP status for non-JSON errors, logs only allowlisted application/database codes, and runs direct read-only Auth identity/get_me probes if the profile endpoint fails. Only 404/NOT_FOUND qualifies for profile bootstrap; an arbitrary routing 404 no longer qualifies. Secrets, raw provider messages and response bodies are excluded. All failed/unverified checks remain failed/unverified; no success criterion was relaxed.

Added `scripts/profile-probe.mjs`, its TypeScript declaration and `tests/unit/profile-probe.test.ts`. Four regression cases cover backend-vs-auth errors, genuine domain-not-found vs routing 404, and redaction. After these edits: typecheck PASS; lint PASS; unit 14 passed; integration 12 passed; production build PASS. SameSite=Lax and the existing Secure policy remain unchanged.

**The original hosted response's underlying cause remains UNVERIFIED.** The owner-local diagnostic rerun is required because credentials were not supplied to the agent and the old verdict omitted the necessary evidence. Run `node scripts/verify-day1-hosted.mjs` locally with hidden credential entry, then share only its sanitized verdicts. This correction is safe to rerun; it is not a claim that an application session bug has been reproduced or fixed. No commit, push or Day 2 work.
