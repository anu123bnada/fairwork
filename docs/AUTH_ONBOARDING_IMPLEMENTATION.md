# ORYQEN authentication and onboarding

> Updated 24 October 2026: signup now also supports the default Supabase email callback without custom SMTP or template edits. See [Default email confirmation compatibility](DEFAULT_EMAIL_CONFIRMATION.md). The custom-template requirement below describes the earlier implementation.

Implemented 2026-10-23. No deployment, push, database migration, RLS change, or hosted provider setting change is included.

## Completed flows

- `/sign-in`: existing secure sign-in with a visible Create account entry, destination-aware registration/recovery links, and an email-verification recovery link after an error.
- `/register`: worker/employer selection, name/email/password/confirmation fields, validation, busy/error states, progress steps, truthful email-request state, and resend verification.
- `/auth/confirm`: explicit confirmation POST (never consume links on GET), expired-link guidance, resend form, token removal after confirmation, and preserved destination.
- `/register/profile`: editable display-name prefill from untrusted display-only signup metadata, time-zone selection, and existing idempotent profile creation. Workers continue to the authenticated introduction; employers continue to their workspace. An explicitly requested authorized record takes priority.
- `/app/employer`: onboarding instructions, existing organization request submission, independent review status and actionable next steps for pending, rejected, active and inactive memberships. Existing company-profile editing and offer authorization remain in place.
- `/forgot-password` and `/auth/recover`: email-request and password-update confirmation panels, back navigation, preserved destination, and existing MFA enforcement.
- `/app/settings`: password-recovery entry; existing secure sign-out retained with stale offer-selection cleanup only after successful sign-out.

## Design

Inspected existing auth/product components, styles and a rendered 390px sign-in screenshot before implementation. Reused Manrope, original background SVG and shield artwork, translucent inputs/cards, rounded geometry and blue buttons. Auth layouts now expand to a 520px centered card on larger screens. No new UI library or Tailwind migration was introduced: this repository uses the existing authored CSS system.

## Security and backend boundaries

- Existing Supabase signup, password sign-in, explicit token verification, recovery, session cookies, profile RPCs and organization APIs remain the source of truth.
- New `POST /api/v1/auth/resend` uses Supabase signup resend, same-origin checking, the existing registration feature gate, bounded strict input, generic account-existence responses, no-store responses and provider rate limits. The client adds a one-minute repeat-request guard; provider limits remain authoritative.
- Registration and recovery accept an optional canonical `continuation` query made only from existing validated participant UUIDs, allowlisted product screen names and `workspace=employer`. Arbitrary redirect URLs, duplicate hints, roles and privileges are rejected. The continuation is independently sanitized again when building provider callbacks. Protected pages such as Settings also preserve their destination through the public sign-in gate.
- Signup metadata contains only `display_name`. It is editable display content and is never read for permissions. No employer role, verified flag, membership, or operator capability is assigned at signup.
- Organization decisions and current authority are read from the existing authenticated API. Local synthetic approval is explicitly distinguished from real employer verification.

## Provider prerequisites and remaining backend blockers

Registration remains disabled unless `AUTH_REGISTRATION_ENABLED=true`. It still requires explicit `APP_ORIGIN`, configured public Supabase credentials, email signup enabled, mandatory email confirmation, and anonymous signup disabled. No feature flag was changed in `.env.local`.

The earlier `PRODUCTION_READINESS_20261023.md` audit reported hosted email auto-confirm enabled. That is a documented provider-policy blocker; this implementation did not reconfigure or re-audit the hosted project.

Hosted email delivery was not exercised. Before activating on a hosted environment, verify SMTP delivery and the redirect allowlist for the canonical `/auth/confirm` and `/auth/recover` callbacks, including their validated continuation query strings. The existing email templates must use `{{ .RedirectTo }}#token_hash={{ .TokenHash }}` so continuation survives opening a link on another device and the bearer hash stays out of request URLs. A hardcoded callback template will lose the continuation. Use separate registration and recovery templates with their respective callbacks.

Independent organization approval still requires an authorized reviewer. Real employer/registry verification is not connected. The UI cannot replace these backend or operational prerequisites, and never reports them as completed.

## Changed files

- UI routes: `src/app/register/page.tsx`, `src/app/register/profile/page.tsx`, `src/app/auth/confirm/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/sign-in/information/page.tsx`.
- UI components/styles: `src/components/fairwork/auth-link.tsx`, `auth.css`, `sign-in-screen.tsx`, `secure-sign-in-form.tsx`, `registration-form.tsx`, `recovery-form.tsx`, `saved-offers.tsx`, `organization-requests.tsx`, `product-app.tsx`.
- API routes: `src/app/api/v1/auth/register/route.ts`, `resend/route.ts`, `recovery/route.ts`.
- Server/validation/navigation: `src/server/registration.ts`, `src/server/recovery.ts`, `src/features/identity/auth-navigation.ts`, `registration-schema.ts`, `recovery-schema.ts`, `src/features/offer/participant-path.ts`.
- Tests: `tests/unit/registration.test.ts`, `tests/unit/recovery.test.ts`, `tests/unit/participant-path.test.ts`, `tests/e2e/registration.spec.ts`, `tests/e2e/auth-onboarding.spec.ts`, `tests/e2e/oryqen.spec.ts` (updated desktop width expectation and retained the original mobile-width assertion).

## Verification

Browser tests use isolated synthetic transport fixtures; they do not establish hosted email delivery or real employer verification.

- `npm test`: 52 files passed; **376 tests passed, 17 native-PostgreSQL-only tests skipped**. No database schema changes were made. Dedicated native database runners were not rerun for this UI change.
- Final `npm run typecheck` and `npm run lint`: passed. `git diff --check`: passed. Generated Next.js configuration changes were removed; dependency, CI, environment and database files are unchanged.
- Optimized production build: passed through `scripts/test-browser.mjs`, including TypeScript and static-page generation. Registration is enabled only in this isolated process and public Supabase configuration is blank.
- `AUTH_REGISTRATION_ENABLED=true node scripts/test-browser.mjs`: **107 Chromium tests passed**, including the complete existing product suite, nine new auth/onboarding cases, mobile transport/offline tests, and the original visual/readability matrix. Log: `test-results/day2-browser.log`; build log: `test-results/day2-browser-build.log`.
- New registration screenshots: `test-results/auth-registration-320.png`, `test-results/auth-registration-768.png`, `test-results/auth-registration-1440.png`. Original and updated sign-in were also visually inspected. Responsive checks reported no horizontal overflow.
- Earlier sandbox attempts failed because Vitest temporary modules were inaccessible and Turbopack could not create junctions. Checks were rerun outside the sandbox. An overlapping build/test attempt exhausted memory; final verification runs sequentially.
