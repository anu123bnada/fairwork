# October 27 auth release investigation

Inspected October 25, 2026 on `release/oryqen-oct27`, HEAD `6ad6b83` before these uncommitted changes. No deployment, push, hosted migration or hosted environment edit was performed. Existing backup/untracked files were preserved.

## Findings and limits

- `src/server/http.ts:7`: every auth/profile mutation requires an exact Origin match to APP_ORIGIN and rejects Sec-Fetch-Site: cross-site. Missing Origin, another Preview hostname, localhost configuration on a hosted build, or a production/staging mismatch produces application ACTION_FORBIDDEN before Auth is called. Do not fix this by trusting Host/X-Forwarded-Host or allowing all vercel.app domains.
- `src/server/registration.ts:8`: registration, resend and confirmation require the exact string AUTH_REGISTRATION_ENABLED=true. Missing, uppercase, whitespace or false produces ACTION_FORBIDDEN. Sign-in does not read this flag.
- `src/app/api/v1/auth/sign-in/route.ts:18`: after password authentication, account_access returning disabled also produces ACTION_FORBIDDEN and clears the new local session. Provider credential/confirmation failures produce AUTH_REQUIRED/401, provider 429 produces RATE_LIMITED, provider 5xx produces SERVICE_UNAVAILABLE. RPC error, malformed account-access DTO or cleanup failure produces 503. Thus the registration flag alone cannot explain simultaneous sign-in and registration 403s.
- `src/lib/env.ts:39`: origin defaults to http://localhost:3000 only when absent, must equal its URL origin exactly (no trailing slash/path/query/credentials), and permits HTTP only on localhost/127.0.0.1. Invalid configuration produces 503. Registration additionally requires explicit APP_ORIGIN and HTTPS under NODE_ENV=production. FAIRWORK_DATA_MODE accepts only synthetic or supabase; supabase validates public credentials early. It does not select a mock backend for auth/profile routes. Admin runtime reporting separately hardcodes synthetic and is not proof of effective configuration.
- `src/server/registration.ts:22`: settings fetch failure/non-OK/malformed settings, disabled signup, auto-confirm enabled, email disabled, or anonymous users not explicitly false causes 503. Signup provider 5xx and an unexpected auto-confirm session also cause 503. Registration uses a nonpersistent client and never installs cookies.
- `src/app/api/v1/auth/confirm/route.ts:8`: confirmation validates a confirmed, non-anonymous user. Token-hash verification or access-token validation plus refresh rotation must return a matching user/session before commitCookies. Failure discards staged cookies. Arbitrary provider exceptions currently fall through to generic INTERNAL_ERROR/500; they do not explain a profile 503.
- `src/server/supabase.ts:25`: RPCs use schema api. SSR cookies are host-local, SameSite=Lax, path=/, Secure in production, and use async Next cookies(). Route handlers allow writes; Server Components are read-only. `src/proxy.ts` refreshes /api/v1/me and /admin routes; each protected handler revalidates identity. Switching between staging and production does not transfer the session.
- `src/server/identity.ts:15`: getUser verifies identity before RPC. Auth 5xx yields 503; absent/invalid/anonymous identity yields 401. `src/lib/errors.ts:21` translates controlled database messages, maps 42501 to 403, and maps all other database/PostgREST errors to 503. Therefore application 503 can wrap upstream 406. A successful HTTP response with a wrong DTO shape yields INTERNAL_ERROR/500, not 503.
- `supabase/migrations/202610070001_identity_foundation.sql:251`: create_profile returns one scalar jsonb object, not SETOF/table rows. It validates input, locks per caller, consumes quota, preserves idempotency, inserts profile/audit/receipt atomically, then returns profile_dto. The auth-context migration replaces managed Auth helper calls while preserving authorization; the RPC EXECUTE migration revokes public/anon/service-role access. Existing function presence alone does not verify exposed schemas, ACLs, deployed body or schema-cache state.
- `src/components/fairwork/registration-form.tsx:62`: confirmation moves to profile creation; the profile request sends a UUID idempotency header. Sign-in routes needs_profile to /register/profile. The product provider loads GET /api/v1/me before marking the real session ready. It treats backend errors as unavailable rather than fabricating a profile.

## Live checks performed

Only empty JSON objects were POSTed, without credentials, to registration and sign-in. These cannot pass input validation or create accounts.

| Host | Registration | Sign-in | Meaning |
| --- | --- | --- | --- |
| oryqen.vercel.app | 422 VALIDATION_FAILED | 422 VALIDATION_FAILED | Canonical origin guard passed; registration flag passed at the time checked. No proof of Auth, SMTP or RPC success. |
| oryqen-staging.vercel.app | 401, code 401, no app request ID | Same | Access barrier; application behavior inaccessible. Inspect Vercel Deployment Protection using an authorized browser. |

Production check request IDs: registration `555c068c-b4c7-4f89-a9f1-8bc124ab7ad8`; sign-in `b34d2d14-804a-467e-b15d-b5d973b0d34f`.

Local .env.local has APP_ORIGIN=http://localhost:3000, FAIRWORK_DATA_MODE=synthetic and AUTH_REGISTRATION_ENABLED=true. Public Supabase variables are present; values were not printed. Local settings are not evidence of Vercel settings. There is no local .vercel project binding. Hosted logs, branch-scoped environment configuration and deployed commit have not been verified.

## 406 decision procedure

The real installed Supabase SDK test observes Content-Profile: api, Content-Type: application/json, no explicit Accept header (normal fetch */* negotiation), and the session bearer token. No .single()/.maybeSingle() is called. The scalar DTO is accepted as an object; arrays, null and wrappers are rejected.

Read the upstream code, not only HTTP 406:

- PGRST106: api is absent from exposed schemas/db-schemas. Check Supabase Data API exposed schemas. Existing SQL functions do not establish exposure.
- PGRST107: invalid Accept media type. Inspect the failing request's Accept header and compare deployed client code.
- PGRST116: singular response requested with zero/multiple rows. Investigate the deployed call/header and function return type. Do not add .single() or unwrap arbitrary arrays as a speculative repair.
- A database exception normally carries a SQLSTATE (for example P0001 or 42501); custom PT406 or raised PGRST errors can explicitly choose 406. Inspect actual function definitions privately if the code indicates this. No inspected identity migration raises custom 406.

Reference: https://docs.postgrest.org/en/stable/references/errors.html

The old diagnostic incorrectly read status from error; the SDK returns it beside error. The fix logs that top-level status, a bounded structured code, command, phase and app-generated requestId. No email, input, token, row contents, provider message/details/hint or stack is logged. A response_schema phase distinguishes successful-but-invalid DTOs from upstream errors. This is an observability fix, not a claimed repair of the unconfirmed hosted 406.

## Environment and deployment checklist (owner action; do not automate deployment)

1. In Vercel, inspect the deployment behind oryqen-staging.vercel.app. Verify project/root directory, Preview environment, Git branch release/oryqen-oct27 and commit SHA. Confirm the staging alias actually points to that deployment. Preserve Deployment Protection; use an authorized Vercel browser session to test.
2. Inspect branch-specific Preview overrides as well as generic Preview variables. Configure the following exact names; do not paste secrets into chat:

| Variable | Preview: release/oryqen-oct27 | Production, only when separately approved |
| --- | --- | --- |
| APP_ORIGIN | https://oryqen-staging.vercel.app | https://oryqen.vercel.app |
| AUTH_REGISTRATION_ENABLED | true (exact lowercase string) | true after provider/email readiness |
| FAIRWORK_DATA_MODE | supabase | supabase |
| NEXT_PUBLIC_SUPABASE_URL | Staging project's HTTPS root URL, no path/query/credentials | Production project's HTTPS root URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Matching staging publishable key, or supported legacy JWT with role=anon | Matching production public key |
| NODE_ENV | Let Next/Vercel set production for Preview builds too | production |

No SUPABASE_URL, SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY fallback is read. Never use sb_secret_ or service-role keys. NEXT_PUBLIC variables are baked in at build time; changing dashboard variables requires a new approved build/deployment. VERCEL_URL and VERCEL_BRANCH_URL are not origin allowlists in this application. Use the canonical staging hostname for the entire flow, including email return. Do not test mutations on a generated Preview hostname unless it is deliberately configured as that deployment's canonical APP_ORIGIN.

3. In the matching Supabase staging project, inspect Data API exposed schemas: api must be included; private/auth must remain unexposed. Compare applied migration versions with the repository, including identity foundation, auth context, RPC execute and account_deactivation (account_access). Do not apply all migrations blindly to cure 406. Review drift and select a repair based on the actual error code.
4. Inspect Auth settings: signup enabled, email provider enabled, email confirmations enabled, anonymous sign-in disabled, minimum password length at least 12. The settings endpoint must report disable_signup=false, mailer_autoconfirm=false, external.email=true, external.anonymous_users=false. Local config.toml intentionally disables signup and is not proof of hosted settings.
5. Configure staging Auth Site URL as https://oryqen-staging.vercel.app. Permit the exact /auth/confirm callback and query-bearing continuations used by the app on this host (narrow host/path glob if needed); avoid unrestricted domain wildcards. Review the actual email template: default confirmation redirects may supply access/refresh fragments; a custom token-hash template must target this app's supported /auth/confirm flow. Verify SMTP delivery using a controlled test inbox; do not disable confirmation to bypass delivery trouble.
6. After reviewing the code changes, approve a Preview-only deployment. Check the deployed SHA includes the diagnostic change. No production promotion until the staging flow below passes.
7. Run through a fresh controlled test account on the canonical staging origin: registration 200 verificationRequired; email delivery; confirmation 200 with Secure/Lax session cookies; sign out and sign in before profile creation (profileRequired=true); POST /api/v1/me with a UUID Idempotency-Key returns the DTO; same-key/same-body retry succeeds without duplicate audit/receipt; GET /api/v1/me returns the same profile; dashboard/welcome loads; sign out/sign in again and verify persistence. Check unconfirmed credentials are denied. Do not export an unsanitized HAR or share confirmation URLs, tokens or cookie values.
8. If profile fails, capture UTC timestamp, deployment SHA, browser response status/code and X-Request-Id. Filter Vercel runtime logs for that ID and ORYQEN_PROFILE_RPC_DIAGNOSTIC. Correlate command/code/status with Supabase Gateway request time. Inspect Accept and Content-Profile only, never copy Authorization. Share only the structured code/status/phase/ID. Apply the corresponding repair only after review.

## Read-only staging SQL checks

Run in the correct staging SQL editor. These inspect metadata only; they neither call create_profile nor alter grants/configuration. Null current_setting output is inconclusive: dashboard and effective PostgREST configuration remain authoritative.

```sql
begin read only;
select version from supabase_migrations.schema_migrations order by version;
select current_setting('pgrst.db_schemas', true) as session_exposed_schemas;
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result_type, p.proretset,
       p.prosecdef, pg_get_userbyid(p.proowner) as owner, p.proconfig,
       md5(p.prosrc) as body_hash,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='api' and p.proname in ('create_profile','get_me','update_profile','account_access');
select has_schema_privilege('authenticated','api','USAGE') as api_usage;
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='private' and c.relname in ('profiles','audit_logs','command_receipts','rate_limit_buckets');
rollback;
```

Expected RPC result is jsonb, proretset=false, fixed empty search_path, security definer with intended restricted executor ownership; authenticated execute true, anon/service_role execute false. Tables retain enabled and forced RLS. Inspect private helper definitions/ACLs in the dashboard if the upstream code indicates a database permission or runtime failure. Do not grant broad schema/table access or use a service key to bypass these checks.

## Local validation

Completed in this investigation: npm run typecheck PASS; npm run lint PASS; npm test PASS (62 files, 446 passed, 17 skipped; 195.73 seconds); git diff --check PASS. Focused auth/profile run: 54 passed. The initial focused run encountered a new-test syntax error (fixed) and Windows sandbox temporary-module ENOENT errors; rerun outside that sandbox passed. Full tests also ran outside the sandbox. Build, browser E2E, hosted SMTP and authenticated hosted flow were not run. Skipped tests are not counted as successful verification.

```powershell
git status --short --branch
npm run typecheck
npm run lint
npm test
# Optional build and browser suite after the above, with local test configuration:
npm run build
npm run test:e2e:isolated
```

The unit transport suite uses the real installed SSR/Auth/PostgREST SDKs with a fake fetch boundary. PGlite integration tests execute SQL, RLS, grants, receipts and audits in a disposable in-memory database. Neither proves hosted email delivery, PostgREST configuration, Vercel cookies or deployed migration parity. A full hosted flow remains a release blocker until verified.
