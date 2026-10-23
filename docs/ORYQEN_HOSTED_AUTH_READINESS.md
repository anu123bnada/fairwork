# P0 hosted authentication readiness — October 16, 2026

**Status: local integration preparation implemented; hosted activation blocked and
not authorized. No hosted account, session or application record was created by
this task. No migration, provider-setting change, deployment, commit or push ran.**

## Read-only hosted evidence

`test-results/hosted-auth-readiness-1792138604429.json` records checks at
2026-10-16 08:16 UTC against the already configured and linked Supabase project.
Project values, credentials, response bodies and raw CLI diagnostics are omitted.

| Check | Observed result |
| --- | --- |
| Public URL/key configuration | Present; hosted HTTPS URL and publishable-key shape valid; linked project matches. |
| Auth `/auth/v1/settings` | HTTP 200; email/password enabled, email confirmation required, anonymous signup disabled. |
| Public registration | Disabled at the provider. Application registration flag also absent/disabled. |
| PostgREST `/rest/v1/`, `Accept-Profile: api` | HTTP 401 without a user JWT. Reachable and denied; this does **not** establish authenticated RPC/schema availability. |
| Migration history | Read-only linked CLI JSON inventory returned four applied versions and six missing versions below. No unexpected recorded versions. |
| Canonical application origin | Configured local origin; no verified hosted HTTPS Next.js origin. |
| Site URL, redirect allowlist, SMTP/template, TOTP provider configuration | Hosted administrative configuration not retrieved/changed; requires owner inspection. Public settings do not prove these. |
| Hosted catalog/RLS drift | Not certified by migration history. Version records do not prove current function bodies, grants or policies. |

The initial sandbox network/CLI-path attempts are retained separately. Approved
unrestricted retries performed only GET requests and `migration list --linked
--output-format json`. The new readiness script defaults to local-only inspection;
network access requires `--network`. It never runs migrations or Auth writes.

## Required migration inventory

All ten existing migrations are required for the requested end-to-end journey.
**No new migration was created or edited.** Local SHA-256 values are in the readiness
report; review these exact files before any separately approved application.

| Version | Local file | Hosted history |
| --- | --- | --- |
| 202610070001 | identity_foundation | Applied |
| 202610080002 | identity_auth_context | Applied |
| 202610090001 | identity_rpc_execute | Applied |
| 202610090002 | demo_authority | Applied |
| 202610100001 | day3_offer_agreement | **Missing** |
| 202610120001 | agreement_participant_read | **Missing** |
| 202610140001 | versioned_agreements | **Missing** |
| 202610140002 | work_records | **Missing** |
| 202610140003 | work_integrity_passport | **Missing** |
| 202610150001 | work_case_review | **Missing** |

Existing read-only catalog scripts remain the pre/post-change evidence sources:
`scripts/day1-hosted-catalog.sql`, `day2-hosted-catalog.sql`,
`day3-hosted-preflight.sql`, `day3-hosted-catalog.sql`,
`agreement-read-catalog.sql`, `day4-catalog.sql`, `day5-catalog.sql`,
`day6-catalog.sql`. Later SQL includes the case-related RLS/grant contract in its
existing integration tests. Do not present old Day 3-only migration instructions
as the current six-migration queue. Do not repair migration history or overwrite
applied SQL to make a check pass.

## Local integration and security boundary

Existing sign-in is the same-origin JSON `POST /api/v1/auth/sign-in`, strict
email/password input and `signInWithPassword`. SSR cookies persist the session;
`/api/v1/me` proxy refreshes claims, and protected handlers independently call
`getUser` and reject missing/anonymous identities before user-scoped RPCs. Cookie
options remain Secure in production, SameSite=Lax and path `/`; responses remain
private/no-store. Server auth/API files do not import browser fixtures or use the
browser smoke flag to grant identity. The smoke flag selects a local build folder,
not an authentication bypass. No service-role key is used.

The database remains authoritative: private schemas/tables, FORCE RLS, scoped
executor functions, active profile checks, immutable receipts, exact revision/hash
checks, participant checks and Passport suppression remain intact. Worker/employer
separation is **two Auth subject IDs plus an independently reviewed active company
membership**, not a registration role selector or editable user metadata.
`authority_operator`, `review_operator`, `reviewer`, `privacy_operator` capabilities
are protected assignments, not self-service account types.

Existing authenticator enrollment/list/challenge/verify endpoints are unchanged.
Operator actions require AAL2 and the specific live capability; membership decisions
remain independently authorized. Ordinary worker login is not relabelled as MFA.
Four-digit SMS, phone registration and SMS resend are not implemented.

New local functionality:

- `POST /api/v1/auth/register`, gated by `AUTH_REGISTRATION_ENABLED=true`. Rejects
  unknown role/identity fields, requires 12–128 character passwords, checks provider
  email/confirmation/signup/anonymous settings before signup, and uses only the
  canonical redirect. Production requires explicit HTTPS `APP_ORIGIN`.
- Signup uses a non-persistent public-key client. It never installs or serializes a
  session; unexpected auto-confirm sessions fail closed. Existing/new account
  outcomes use the same verification-required response. Provider messages are not
  exposed; rate limits and failures map to existing safe errors.
- `POST /api/v1/auth/confirm` explicitly consumes an email token hash with
  `verifyOtp(type: email)` and installs the normal SSR session cookies. It accepts
  no role, arbitrary redirect or verification-type injection. No SMS is involved.
- `/register`, `/auth/confirm`, `/register/profile`: small pages using the existing
  AuthShell. Disabled by default. Confirmation requires a click/POST, not page GET
  or prefetch. The custom template puts the bearer hash in the URL **fragment**,
  avoiding server URL logs/referrers; it is removed on successful verification.
- A confirmed user creates their profile through the existing idempotent
  `/api/v1/me` command. `/register/profile` can be reopened after navigation/reload;
  it does not bypass authentication. Existing profiles should use sign-in; no
  automatic overwrite or reactivation is added.
- The secondary sign-in information page conditionally links to controlled
  registration. Original sign-in/onboarding layouts and all design assets remain
  unchanged. It continues to disclose synthetic employment-data restrictions.

Reference: the confirmation uses Supabase's documented server-side `token_hash` /
`verifyOtp` approach, with an explicit POST and fragment transport adaptation.
[Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[password authentication](https://supabase.com/docs/guides/auth/passwords),
[Next.js server confirmation example](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).
No PKCE/OAuth callback or arbitrary `next` URL was added; those flows are not used
by this registration design.

## Environment and configuration checkpoint

Application environment names only:

- `NEXT_PUBLIC_SUPABASE_URL` — already present.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — already present; never a secret/service key.
- `APP_ORIGIN` — present locally; needs the approved canonical HTTPS application origin.
- `FAIRWORK_DATA_MODE` — present; remains `synthetic`. A real Auth account does not
  authorize real employment data or a production employer-verification claim.
- `AUTH_REGISTRATION_ENABLED` — **new, absent/disabled**; example defaults to false.

No new secret is needed in the application. CLI credential environment names
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, `DATABASE_URL` were absent, but the
already-linked CLI had sufficient saved read-only access to list migrations.
Do not copy CLI/database credentials into application environment variables.

**Prepared, NOT applied provider setup** (after explicit owner approval):

1. Choose the intended HTTPS Next.js application origin. Set provider Site URL to
   that origin and exact redirect allowlist entry `<APP_ORIGIN>/auth/confirm`.
   Do not use wildcard redirects or an invented hosted URL.
2. Keep email confirmation required, anonymous signup disabled and TOTP enabled.
   Configure and verify real email delivery/SMTP, sender identity and signup rate
   limits. If CAPTCHA is required, integrate it before public activation; this
   slice has no CAPTCHA UI/token support. Do not disable abuse controls to pass.
3. Update the signup email template link to:
   `<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Confirm your ORYQEN email</a>`.
   This matches the prepared fragment-only confirmation page. Default implicit
   token-fragment templates are not interchangeable with this flow. Verify the
   delivered link against email scanning/tracking and actual expiration behavior.
4. Enable provider email signup and the application flag only for the approved
   controlled integration window. The existing local `supabase/config.toml` is
   intentionally unchanged and still disables signup; it must not be pushed as
   an unreviewed replacement for hosted settings.

Public production activation remains blocked by real-data policy, production
terms/privacy/retention, verified employer authority policy, recovery/email-delivery
and abuse-control validation. Existing authority remains explicitly
`demo_provisioned` / `demo-authority.v1`; no real employer verification is fabricated.

## Executable two-account test

Safe now, no network or mutation:

```powershell
node scripts/test-hosted-two-accounts.mjs --plan
node scripts/hosted-auth-readiness.mjs
```

Authorized read-only recheck:

```powershell
node scripts/hosted-auth-readiness.mjs --network --migration-list
```

**Do not run the following until separately authorized hosted writes and all
prerequisites are satisfied:**

```powershell
node scripts/test-hosted-two-accounts.mjs --execute-approved-hosted-writes --readiness=<fresh-readiness-report-path>
```

The runner requires a clean interactive terminal, explicit approval acknowledgement,
HTTPS canonical origin, matching linked project, synthetic mode, enabled registration
and a matching readiness report less than one hour old with no missing/unexpected
migrations and unchanged local migration hashes. It accepts passwords and real inbox
confirmation links via hidden prompts. No screenshots, traces, storage-state files,
emails, passwords, tokens or provider bodies are written to its report.

It creates two distinct real Auth accounts and verifies each through its real inbox,
creates separate profiles, signs out/in, checks cookie identity after browser reload,
and verifies an existing authenticator factor if one is present. It then pauses for
an authorized operator's **separately approved** synthetic company/membership review;
it cannot create an operator, bootstrap capabilities or grant employer membership.
This prerequisite may require an existing third operator account; that account is
not either agreement participant by implication.

The executable command journey then creates an employer offer, reads it as worker,
creates/proposes an agreement, acknowledges exact unresolved sets and confirms from
each account. It asserts one party alone does not make it effective, then creates
and submits work, asserts worker self-verification is denied, verifies the exact
revision as employer, checks private eligible Passport history and rejects injected
Passport owner IDs. Both sessions sign out and must then be denied private reads.
It does not use HTTP fixtures or direct SQL grants.

**Only the plan and script syntax were executed here. The hosted journey has not
run and has no PASS claim.** Its runtime behavior still requires hosted verification.
Two account subjects do not themselves prove two independent humans. Natural token
expiry/refresh, new-factor enrollment/recovery and revocation are additional gates;
the existing Day 1/2 verifiers document those cases. On failure, created records
remain for review; no automatic deletion/reset or cleanup is performed.

## Local test evidence

| Check | Result |
| --- | --- |
| Affected auth tests first | 27 passed after sandbox temp-module failure retry; final hardened cases **29 passed**, four files, `hosted-auth-affected-final.log`. |
| Initial regression | 209 passed, 14 native-only skipped; `hosted-auth-regression.log` / `.json`. |
| Final regression | **211 passed, 14 native-only skipped**, 25 files; `hosted-auth-regression-final.log` / `.json`. Counts overlap with focused tests. |
| Affected browser tests | **8 passed**, `hosted-auth-browser-final.log`: registration, explicit confirmation, profile reload, invalid token, existing sign-in/operator/MFA. Uses HTTP fixtures; no hosted writes. Initial selector ambiguity fixed and retained in earlier log. |
| Script plan/syntax | Network-free plan and `node --check` for the three new `.mjs` scripts passed. |
| Typecheck | **PASS**, `hosted-auth-typecheck.log`. |
| Lint | **PASS, zero warnings**, `hosted-auth-lint-final.log`; one script-style expression fixed after initial lint. |
| Normal production build | **PASS**, `hosted-auth-build.log`; new confirmation/registration routes compiled, no deployment. |
| Native database/Android | Not rebuilt or rerun for this auth integration slice. Historical passes are not fresh evidence. |

Exact commands used for focused tests and regression:

```powershell
npm test -- tests/unit/registration.test.ts tests/unit/auth.test.ts tests/unit/authority.test.ts tests/unit/foundation.test.ts
npm test -- --reporter=default --reporter=json --outputFile=test-results/hosted-auth-regression-final.json
$env:AUTH_REGISTRATION_ENABLED='true'
npm run test:e2e:isolated -- tests/e2e/registration.spec.ts tests/e2e/authority.spec.ts
# The enabled flag above belonged only to that isolated child shell.
npm run typecheck
npm run lint
npm run build
```

## Files and preservation

New files: `src/server/registration.ts`,
`src/features/identity/registration-schema.ts`,
`src/app/api/v1/auth/register/route.ts`, `src/app/api/v1/auth/confirm/route.ts`,
`src/components/fairwork/registration-form.tsx`, `src/app/register/page.tsx`,
`src/app/register/profile/page.tsx`, `src/app/auth/confirm/page.tsx`,
`scripts/hosted-auth-readiness.mjs`, `scripts/hosted-two-account-flow.mjs`,
`scripts/test-hosted-two-accounts.mjs`, `tests/unit/registration.test.ts`,
`tests/e2e/registration.spec.ts`, and this document.

Existing files changed: `.env.example` (disabled flag documentation),
`src/app/sign-in/information/page.tsx` (truthful conditional registration link),
`scripts/test-browser.mjs` (pass through focused Playwright filters),
`CONTINUE_HERE.md` (handoff). Existing sign-in, MFA, server session factory, proxy,
RLS/schema/migrations, Figma assets and Android project were preserved.
Pre-task snapshot: `test-results/oryqen-rollback-1792138337589/` (338 source files
and previous APK). `test-results/hosted-auth-preservation.json` records **334/338
baseline source files unchanged**, four intentional changes, no missing files or
unexpected changes; previous APK hash also unchanged.

## Explicit approval checkpoint / next exact task

Stop here. The user must approve the **six named missing migrations**, any provider
signup/SMTP/template/redirect changes, intended application origin/deployment, and
creation of the two test accounts/sessions plus synthetic business records before
those mutations can run. Operator provisioning/membership review needs its own
authorized actor and evidence; registration cannot substitute for it.

Next exact task: review this inventory and the six migration hashes; obtain a
current owner-reviewed catalog/RLS preflight and an approved HTTPS origin, then
request approval for that specific integration window. After approved configuration
and migrations are applied by the authorized operator, rerun read-only readiness
and execute the two-account runner. Do not mark hosted persistence or authentication
complete until the intended environment actually passes.
