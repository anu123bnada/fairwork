# Default Supabase signup confirmation compatibility

Updated 24 October 2026 (Asia/Colombo). This supersedes the earlier requirement to customize the Confirm signup template for registration.

## Finding

The user reports that the production dashboard requires custom SMTP before templates can be edited, and that a real signup email was delivered. No additional signup or resend emails were sent for this work.

ORYQEN calls `supabase.auth.signUp` through a stateless `supabase-js` client, with `emailRedirectTo` pointing to `/auth/confirm` and an allowlisted continuation query. It does not initiate PKCE or store a code verifier. Supabase's standard confirmation email links to its `/auth/v1/verify` endpoint. After verification, the implicit flow returns credentials in the browser fragment:

```text
https://oryqen.vercel.app/auth/confirm?workspace=employer
#access_token=<JWT>&refresh_token=<opaque-token>&token_type=bearer&type=signup&expires_in=...
```

This is one URL; the line break is for readability. Format confirmed against the installed SDK behavior and [Supabase's implicit-flow documentation](https://supabase.com/docs/guides/auth/sessions/implicit-flow) and [Auth endpoint documentation](https://github.com/supabase/auth#endpoints). The user's actual email/token was not accessed or consumed. The previous implementation explicitly rejected this fragment, explaining the compatibility gap even when delivery and provider verification succeed.

## Implemented behavior

Both formats use the existing `/auth/confirm` UI and same-origin `POST /api/v1/auth/confirm` endpoint:

| Callback | Processing |
| --- | --- |
| Default `#access_token=...&refresh_token=...&token_type=bearer&type=signup` | Browser captures the fragment in component memory, strips it from history, and waits for an explicit confirmation click. Server calls `getUser(accessToken)` against the configured project, requires a confirmed non-anonymous identity, validates/rotates the refresh token with `refreshSession`, and requires matching identities and a returned session. Only then are SSR cookies committed. |
| Existing `#token_hash=...` (legacy query form also accepted) | Browser captures and strips it, waits for a click, and server calls `verifyOtp` with fixed type `email`. A confirmed non-anonymous user and matching session are required before cookie commit. |
| Missing, malformed, duplicate, mixed-format, provider-expired, wrong-purpose or unsupported code callback | No automatic authentication. Clear recovery/sign-in guidance. No provider text or credentials are rendered. |

Credentials are not persisted in localStorage/sessionStorage, placed in navigation URLs, returned in JSON, or logged. The default callback's fragment is never sent in a GET request. A legacy token already supplied in a query string necessarily reaches the initial request; fragment links remain preferable. After capture, reloading the page deliberately loses credentials and offers recovery rather than retrieving them from persistent storage.

Authentication cookies are staged in memory. Failed token validation, mismatched users, unconfirmed/anonymous users, missing sessions, provider limits or exceptions do not commit staged cookies. Successful confirmation returns only `{ confirmed: true }`. Existing cookies retain the existing secure-in-production, SameSite=Lax, root-path policy.

The client advances only after that response, preserving allowlisted destinations into profile setup. It does not trust fragment expiry hints, user metadata, a decoded JWT, or the presence of tokens as proof of authentication. Profile and workspace APIs retain existing identity, membership, MFA, authorization and RLS checks; no privileges are granted by registration.

Expired/invalid access tokens are rejected instead of silently installing the refresh token's account. If an access token has expired while the user waited, sign-in or a new email is required. A valid access token combined with another user's refresh token is rejected before cookie commit. Token rotation follows Supabase's existing refresh/reuse rules.

## Settings

**No custom SMTP or template edit is required for this registration fix.** Keep the default Confirm signup email. Keep email confirmation enabled and anonymous signup disabled. Do not replace the default link with a plain application URL.

The prior read-only investigation established Site URL `https://oryqen.vercel.app` and redirect allowlist entry `https://oryqen.vercel.app/**`. Those cover the confirmation callback and continuation queries. The deployment still needs `APP_ORIGIN=https://oryqen.vercel.app`, registration enabled, and the intended public Supabase project configuration. No dashboard/Vercel setting was changed.

PKCE `?code=...` callbacks remain unsupported because this registration mechanism does not generate/store a verifier. Accepting arbitrary codes without their verifier would not be a valid fix. Switching future signups to PKCE would be a separate coordinated change, including handling links opened in a different browser. The existing password-recovery flow was not changed by this signup-specific fix.

Supabase's built-in email service limits still apply; compatibility does not change deliverability limits. See [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp). Custom SMTP can be configured later for production delivery needs without being a prerequisite for interpreting the current signup callback.

## Changed files

- `src/features/identity/registration-schema.ts`, `verification-context.ts`: bounded, strict callback contracts and fragment parsing.
- `src/components/fairwork/verification-store.ts`, `registration-form.tsx`: per-page capture, URL scrubbing, explicit confirmation and safe recovery.
- `src/server/supabase.ts`: staged cookie writes, preserving existing callers' behavior.
- `src/app/api/v1/auth/confirm/route.ts`: verified default-session import and retained OTP verification.
- `tests/unit/registration.test.ts`, `verification-context.test.ts`, `verification-store.test.ts`, `confirmation-cookies.test.ts`: provider validation, negative cases, navigation cleanup and actual SSR cookie serialization/readback with mocked Auth transport.
- `tests/e2e/verification-context.spec.ts`, `registration.spec.ts`, `auth-onboarding.spec.ts`, `callback-navigation.spec.ts`: both callbacks, immediate URL cleanup, destination preservation, browser Back, failure and recovery.

## Validation and limits

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`, plus final build type-check) | Pass |
| ESLint (`npm run lint`) | Pass |
| Unit suite | 253 tests passed across 44 files |
| Identity, auth-context and authority integration suites | 36 tests passed across 3 files using local PostgreSQL/WASM |
| Full isolated Playwright suite | 115 passed, including Chromium and Android browser checks |
| Final rebuild and focused auth suite after the navigation guard | 24 passed, including the new browser Back regression |
| Optimized production build | Pass |
| `git diff --check` | Pass |

Full browser log: `test-results/default-confirmation-full-browser.log`. Final focused run/build logs: `test-results/day2-browser.log`, `test-results/day2-browser-build.log`. The isolated runner stopped its own server and restored temporary generated-type configuration changes.

Auth-provider transport fixtures test application behavior and SSR cookie handling, not a newly delivered production email. No real email credentials, production mutations, push or deployment were used. A final real inbox-to-production-session check must wait until the user approves deployment and a controlled live test. The user's previously observed email delivery is not represented as a tested production callback round trip.
