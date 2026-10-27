# ORYQEN authentication audit (27 Oct 2026)

Scope: registration and confirmation, invitations, sign-in, password reset (request, email, callback, update), sessions and sign-out, redirects, token handling.
Read-only against hosted systems: auth settings were read with `supabase config diff` (names and URLs only) and aggregate flags from `auth.users` (no addresses or tokens).
Nothing hosted was changed.

## Root causes (evidence)

| # | Symptom | Root cause | Evidence | Status |
|---|---|---|---|---|
| A1 | Opening a reset email link shows the recovery page with "Check the supplied fields." | **Application defect.** The recovery page read only `#token_hash=` from the link. Supabase's default recovery email (`{{ .ConfirmationURL }}`, the template the staging project evidently uses) redirects with `#access_token=...&refresh_token=...&type=recovery`. With no `token_hash` the page posted `{ tokenHash: null }`; the route's schema rejected it (`VALIDATION_FAILED`, message "Check the supplied fields.") | Code: `recovery-form.tsx` before the fix; reproduced deterministically by `tests/e2e/auth-links.spec.ts` (default-fragment link) and by the real local GoTrue run in `scripts/test-local-recovery-default-link.mjs`, which builds the exact default link | **Fixed** (`5c18059`) |
| A2 | An invitation link opened the landing page instead of onboarding | Supabase redirects invitations to the project **Site URL** (the site root), carrying `#access_token=...&type=invite`. Nothing on the landing page handled an authentication fragment, and the confirmation page deliberately rejects any type other than `signup`/`email` | Hosted config read: `auth.site_url = https://oryqen-staging.vercel.app` (root = landing page). Behaviour reproduced in `auth-links.spec.ts` ("lands on the site root") | **Fixed**: a root-page forwarder sends `recovery`/`invite` fragments to `/auth/recover` (set a password, then sign in) and `signup` fragments to `/auth/confirm`. The fragment is never read, stored or sent by the forwarder |
| A3 | Dashboard shows the invited user as "Waiting for verification" | **Not an application or database defect.** All 5 staging users have `email_confirmed_at` set; the invited user is confirmed, has a password and has signed in. The label is the dashboard's, not the database's state | `select` over `auth.users` flags only: 5 total, 1 invited, 0 unconfirmed, 0 invited-and-unconfirmed, 2 with a recovery email sent | **Closed, informational**. Owner check: refresh the Users page |
| A4 | Browser release gate crashes and timeouts | Environment: headless Chromium out-of-memory crashes (`0xe0000008`) with about 1.4 GB free RAM; later a transient DNS outage broke the Windows build | Failure register F-32..F-34; third gate: `browser-journeys` 385/385 | **Resolved as environment**; see test report |

Also found (not a defect in the app): hosted `auth.minimum_password_length = 6`. The app enforces 12 for self-service sign-up and reset, but an account created from the dashboard can have a 6-character password. Owner action in `OWNER_ACTIONS.md`.

## Flows: expected and observed

| Flow | Expected | Observed after the fix | Evidence |
|---|---|---|---|
| Registration, then email confirmation | Link needs an explicit click (opening it consumes nothing); `token_hash` (type `email`) or the default `signup` fragment; confirmed non-anonymous user and matching session before cookies are committed; then profile creation | As expected; unchanged | existing `verification-context.spec.ts`, `registration.spec.ts`, `auth-onboarding.spec.ts`, real-stack harness |
| Invitation | Open the link, choose a password, sign in, create the profile | Root link forwarded to `/auth/recover`; invitation wording; only an account that was actually invited is accepted as `invite` | `auth-links.spec.ts`, `recovery-session.test.ts` |
| Sign-in | Email and password, MFA step-up when enrolled, missing profile routes to profile creation | Unchanged | `auth-release-regressions.spec.ts` |
| Reset request | Never reveals whether an address exists; fixed same-origin redirect; only validated continuation hints | Unchanged | `recovery.test.ts` |
| Reset callback | Click required; one-time link; MFA cannot be bypassed; password change signs out every session | Accepts `token_hash` and the default fragment; every other shape gets a specific, translated explanation | `recovery-context.test.ts` (9), `recovery-session.test.ts` (8), `auth-links.spec.ts` (15), real local runs |
| Expired / used / malformed / missing links | Plain explanation, a way to request a new email, nothing consumed, no secret echoed | As expected, in four languages | `auth-links.spec.ts`, `recovery-session.test.ts` |
| PKCE `?code=` | Cannot be completed (the server started the reset, so this browser has no code verifier) | Reported as "cannot be completed here" with a new-email option | `recovery-context.test.ts` |
| Redirect allowlist | Callback pages must be on the Supabase allowlist | Staging allows `https://oryqen-staging.vercel.app/**` and two preview hosts. Production origin is not listed | hosted config read |
| Sign-out, protected routes, authorization | Unauthenticated access fails closed; sessions are refreshed by the proxy | Unchanged, covered by route matrix (74) and release gate | `route-matrix.spec.ts` |

## Security properties kept
- Tokens are accepted only from the URL **fragment**; any credential in the query string is refused (it would reach logs and referrers).
- The fragment is captured in memory and removed from the address bar before any click; a reload does not bring it back.
- A fragment's access token is untrusted: Supabase's Auth server must accept it (`getUser`), the refresh token must rotate to the **same** confirmed, non-anonymous account, the account must actually have asked for the reset (or have been invited), and cookies are committed only after all checks pass. A rejected link leaves no session.
- Error bodies never contain provider messages, tokens or addresses. No service-role key is used anywhere.

## Not covered here
Session expiry/refresh timing is exercised by the existing proxy and release-gate journeys, not by a new test. Cross-browser behaviour was tested on Chromium only. Hosted email templates cannot be read by the CLI ("UNVERIFIED"), so the template in use is inferred from the observed link shape; the owner should confirm it (see `OWNER_ACTIONS.md`).
