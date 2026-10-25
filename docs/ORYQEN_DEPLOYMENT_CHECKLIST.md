# ORYQEN deployment checklist

Status: **prepared, not executed.** Nothing was deployed, linked or changed in Supabase,
Vercel or DNS. Every box below needs a named human owner and explicit approval first.
Do not claim hosted acceptance until section 6 is completed.

## 1. Before anything

- [ ] Commit the working tree on a reviewed branch (currently all sprint work is
      uncommitted, including three new migrations and `package.json`/lockfile `zod`
      pin). Remove or ignore `src/server/identity.ts.bak`.
- [ ] Run: `npm ci`, `npm run typecheck`, `npm run lint`, `npx vitest run`,
      `npm run build`, and `npm run test:e2e:isolated` with
      `AUTH_REGISTRATION_ENABLED=true`. Record counts in `docs/ORYQEN_TEST_REPORT.md`.
- [ ] Node version satisfies `engines` (`^22.13 || ^24 || >=26`).

## 2. Supabase (staging first, then production)

- [ ] Take a database backup and record its location.
- [ ] Review the three migrations not yet on staging, by hash:
      `202610250001_offer_lifecycle.sql`, `20261025100610_private_offer_drafts.sql`,
      `20261025140000_private_employment_history.sql`. All are additive; none drops or
      renames existing objects.
- [ ] Apply with the owner-approved procedure (never `config push`). Confirm
      `supabase migration list` shows 35 versions matching the repository.
- [ ] Confirm every private table has RLS enabled and forced; confirm `anon` cannot
      execute the new RPCs (`api.offer_drafts`, `api.employment_history`,
      offer lifecycle function).
- [ ] Auth settings: site URL = production origin; redirect allow-list contains only
      `https://<origin>/auth/confirm` and recovery callback; confirmation email template
      and SMTP delivery verified; decide on leaked-password protection (owner).
- [ ] Never place a service-role key or database owner credential in the app
      environment.

## 3. Environment variables (host secret store)

| Variable | Value for hosted | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | project URL | public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key | public; inlined at build time |
| `APP_ORIGIN` | exact `https://<origin>` | must match browser `Origin` or all writes return 403 |
| `FAIRWORK_DATA_MODE` | `supabase` | `synthetic` is the local default |
| `AUTH_REGISTRATION_ENABLED` | `true` only after email delivery is approved | default `false` |
| `ORYQEN_AI_ENABLED` / `ORYQEN_AI_POLICY_APPROVED` | `false` | change only after owner approval per `docs/GEMINI_PROCESSING_GATE.md` |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `ORYQEN_AI_*` | unset while AI is off | never `NEXT_PUBLIC_` |
| `ORYQEN_TELEMETRY_DB_URL` | optional, restricted writer role | not an owner/service credential |

## 4. Vercel (if used; no `vercel.json` exists, defaults apply)

- [ ] Framework preset Next.js; build `npm run build`; Node version per `engines`.
- [ ] Set variables above for Production and Preview separately; Preview must not use
      production data.
- [ ] Add the production domain; confirm HTTPS and that HSTS is present in responses
      (the app does not set it).
- [ ] Routes use server runtime (`force-dynamic`); do not set them to Edge without
      testing `pg`/Supabase compatibility.
- [ ] Do not deploy from a dirty working tree; deploy a tagged commit.

## 5. Security headers and logging

- [ ] Verify response headers match `next.config.ts` (nosniff, DENY framing, CSP,
      Referrer-Policy, Permissions-Policy) with `curl -I`.
- [ ] Confirm logs contain no tokens, offer text or AI response bodies.

## 6. Hosted acceptance (all must pass with two controlled accounts)

1. Register, receive real confirmation email, create profile, sign in, sign out, sign in.
2. Save an offer draft; reload; edit to revision 2.
3. Add an employment entry; reload; edit; confirm it shows "Self-reported".
4. Second account sees none of the first account's drafts or entries.
5. Archive/restore an offer; record a decision.
6. Cross-origin POST is refused (403).
7. Simulate API failure; the UI shows a recoverable error.
8. 390 px, 768 px and 1440 px layouts show no overflow on the main screens.

## 7. Rollback

Application: redeploy the previous tag. Database: additive tables are retained; never
delete revision history. If Auth settings were changed, restore the recorded old values.

## 8. Explicitly out of scope until approved

Live AI processing, hosted demo seeding, production signup, native Android release.
