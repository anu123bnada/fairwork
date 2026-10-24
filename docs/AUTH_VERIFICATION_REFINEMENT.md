# Authentication refinement and verification investigation

> Update, 24 October 2026: default Supabase signup callbacks are now supported locally without custom SMTP or template edits. The template requirement and unsupported-implicit-flow descriptions below are historical. See [Default email confirmation compatibility](DEFAULT_EMAIL_CONFIRMATION.md) for the current implementation and settings.

Base: production commit `7b97b74`. Investigation: 23 October 2026. No deployment, provider configuration, schema, or RLS changes were made.

## Implementation

- `src/components/fairwork/auth-shell.tsx`, `auth.css`, `auth-composition.css`: shared responsive shell, branded desktop side panel at 900px+, centered form capped at 440px, single-column tablet/mobile, tighter spacing. Existing supplied logo assets and blue/cyan styling are retained; unrelated product screens are unchanged.
- `src/components/fairwork/registration-form.tsx`: missing/malformed/provider-expired links display recovery instructions without offering an unusable confirmation button. Valid tokens still require an explicit click. Resend requests show a 60-second disabled countdown after acceptance or HTTP 429. Existing generic responses do not assert delivery or disclose account existence.
- `src/features/identity/verification-context.ts`: accepts exactly one syntactically valid email token from query or fragment; rejects ambiguous tokens, recovery types, provider errors and unsupported implicit/PKCE callback formats. Client validation never establishes authentication.
- `src/app/api/v1/auth/confirm/route.ts`: confirmation now requires a session as well as a confirmed, non-anonymous user returned by Supabase.
- `scripts/inspect-auth-email-configuration.mjs`: repeatable read-only CLI/public-page investigation with sanitized output; no template bodies, addresses or credentials are printed.
- Regression files: `tests/unit/verification-context.test.ts`, `tests/unit/registration.test.ts`, `tests/e2e/verification-context.spec.ts`, `tests/e2e/auth-onboarding.spec.ts`, `tests/e2e/registration.spec.ts`, `tests/e2e/oryqen.spec.ts`. They cover context parsing, session requirements, missing/invalid/expired recovery, resend limits and contrast, destination preservation and responsive geometry.

## Trace and evidence

1. Registration posts validated credentials, display-only name metadata and allowlisted continuation to the existing registration API. The server checks Supabase signup policy and constructs `emailRedirectTo` from `APP_ORIGIN`; user input cannot supply a redirect origin. Signup uses a stateless client and never installs a session.
2. Supabase is responsible for creating the account and sending the email. A generic application response deliberately does not establish whether an address exists or whether mail arrived.
3. The email must link to the application's confirmation page with an unconsumed `token_hash`. Reading that page does not consume the token; confirmation is a same-origin POST using `verifyOtp({ token_hash, type: "email" })`. Expired/replayed tokens fail authentication. The SSR client writes the resulting session cookies; no session token is returned in JSON.
4. After success, the URL token is removed and the allowlisted destination passes to `/register/profile`. Profile creation uses the existing authenticated API/RPC and authorization. Employer selection grants no membership, verification or operator privileges.

The fresh read-only network check (`scripts/hosted-auth-readiness.mjs --network`, captured 2026-10-23T15:34:06Z) reached the configured hosted project's Auth settings and confirmed:

| Check | Result |
| --- | --- |
| Local linked project matches configured Auth project | Pass |
| Email/password signup enabled | Pass |
| Email confirmation required | Pass |
| Anonymous signup disabled | Pass |
| Local registration feature flag | Enabled |
| Synthetic employment-data restriction | Enforced |
| Local canonical HTTPS application origin | Blocked |
| SMTP delivery | User observed a real verification email during manual testing; no new email was sent during this investigation |
| Actual email template | Unverified; CLI comparison did not expose template bodies |
| Hosted Site URL | Matches `https://oryqen.vercel.app` (read-only CLI comparison) |
| Hosted redirect allowlist | Contains `https://oryqen.vercel.app/**`, covering the callback routes and continuation queries |
| Production environment values and browser session from a real email | Unverified |

Sanitized evidence: `test-results/hosted-auth-readiness-1792769647700.json`. The local origin finding does **not** establish that the deployment is misconfigured. The earlier readiness document's auto-confirm finding is historical; the fresh hosted check now passes mandatory confirmation.

Additional read-only evidence: `test-results/auth-email-configuration-1792770425707.json`, captured 2026-10-23T15:47:04Z using `scripts/inspect-auth-email-configuration.mjs --network`. Production `/register` and `/auth/confirm` both returned HTTP 200. The currently deployed confirmation page still renders its confirmation action without a token; the local change fixes this. No email request or token exchange was made against production. The user explicitly requested no additional signup/resend requests to personal inboxes.

## Supabase dashboard / deployment checks still required

1. In Vercel's **Production environment variables**, verify `APP_ORIGIN=https://oryqen.vercel.app` and `AUTH_REGISTRATION_ENABLED=true`, with the intended hosted project's public Supabase variables. The deployed values were not inspected. Supabase **Authentication → URL Configuration → Site URL** already matches `https://oryqen.vercel.app`; its existing `https://oryqen.vercel.app/**` redirect entry covers these callbacks. No redirect change is required based on this evidence. If tightening the allowlist, use the exact `/auth/confirm` and `/auth/recover` URLs plus corresponding `?*` continuation patterns on that same HTTPS host, and verify query-bearing links before removing the current entry. [Redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls).
2. In **Email Templates → Confirm signup**, the link for this implementation must use `<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Confirm my email</a>`. Keep password recovery in its separate template/callback. A hardcoded Site URL loses continuation; the default `ConfirmationURL` consumes the token at Supabase and can return an implicit session fragment this application does not ingest. This is a configuration hypothesis until the actual template is inspected. [Email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates).
3. Keep **Authentication → Providers → Email → Confirm email** enabled, email signup enabled, and anonymous sign-ins disabled (all passed the hosted public-policy check). Inspect custom SMTP / Send Email hook configuration and provider delivery logs. Confirm sender-domain authentication and suppression/bounce status. Supabase's built-in mail service is restricted to project-team addresses and is unsuitable for general production delivery; configure a suitable mail provider if not already configured. Disable link tracking that rewrites confirmation links. A received email proves one delivery, not general deliverability. [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
4. Inspect **Authentication → Rate Limits** and the email OTP expiry. The UI's 60-second cooldown is advisory; provider limits remain authoritative and may last longer. Never disable limits or email confirmation to make a test pass. [Rate-limit documentation](https://supabase.com/docs/guides/auth/rate-limits).
5. Using an authorized controlled inbox, register once, inspect Auth and SMTP logs, confirm actual arrival and the callback host/path, then click the newest link. Verify session cookies, profile persistence and destination in the deployed app. Test a replay, an expired link, and a resend after the configured cooldown. Do not paste tokens into logs or issue reports.

The exact confirmation link fragment expected after changing the template is `https://oryqen.vercel.app/auth/confirm#token_hash=<opaque hash>`, or `https://oryqen.vercel.app/auth/confirm?workspace=employer#token_hash=<opaque hash>` when continuing employer setup. The recovery template should use the same `RedirectTo`/`TokenHash` expression with link text "Reset my password"; the recovery API supplies `/auth/recover`. Do not hardcode the callback in either template. If a Send Email hook is enabled, its implementation must produce this same link contract; editing a dashboard template alone may not change hook-generated mail.

Inspect the received email's link locally without sharing the token. A `/auth/v1/verify?...` link or one containing `access_token`/`refresh_token` is not this application's expected direct-token template. A plain `/auth/confirm` link lacks verification context. A `#token_hash=` link has the expected shape, but only Supabase can establish validity and expiry. The hosted template's actual contents remain a manual check; no mismatch has been proven.

Browser API fixtures validate UI behavior, not email sending or a real hosted session. Further live inbox tests are deferred at the user's request. No template, dashboard or Vercel setting was changed.

## Validation

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, including final test/inspection-script changes |
| `npm run test:unit -- --maxWorkers=1` | 240 tests passed across 42 files |
| `AUTH_REGISTRATION_ENABLED=true npm run test:e2e:isolated` | Final run: 111 tests passed, including Chromium and Android browser projects |
| Optimized `next build` inside the isolated runner | Pass; route generation and TypeScript passed |
| `git diff --check` | Pass |
| Visual inspection | Registration, confirmation and inbox/resend screenshots reviewed at 320px and 1440px; layout assertions also pass at 768px |

The initial browser run exposed duplicate hidden welcome copy and a stale resend assertion; both were corrected before the full passing rerun. A visual resend contrast issue was also corrected and is covered by a contrast regression. The runner restored its temporary generated-type configuration changes and stopped its own server.

Final browser/build logs: `test-results/day2-browser.log`, `test-results/day2-browser-build.log`. Visual artifacts: `test-results/auth-registration-320.png`, `auth-registration-768.png`, `auth-registration-1440.png`, `auth-confirm-320.png`, `auth-confirm-1440.png`, `auth-inbox-320.png`, `auth-inbox-1440.png`.

These are local checks; no GitHub CI run, push or deployment was initiated. Native database integration tests were not rerun for this UI/callback change. No schema, authorization or RLS policy changed.
