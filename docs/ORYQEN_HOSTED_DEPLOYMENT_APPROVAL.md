# ORYQEN hosted deployment approval pack (26 Oct 2026)

Nothing in this document has been executed against any hosted system. Local evidence only.
No push, deployment or hosted-database change has been made. Approval is requested, not assumed.

## 1. The seven pending migrations

Apply in this order. Each runs in one transaction and starts with a guard that requires the
`postgres` identity. All seven were applied cleanly, in order, to the **real local Supabase
PostgreSQL** (39 migrations total) and exercised through the real role/privilege path. The
in-memory test database did **not** catch one privilege error that real PostgreSQL did (fixed
in the roster migration), so real-Postgres application is the meaningful check.

| # | Migration | What it does | Touches existing data/objects? | Data-loss risk |
|---|---|---|---|---|
| 1 | `202610250001_offer_lifecycle` | New private table (archive/decision events), `api.offer_lifecycle`; **replaces `api.list_offers`** | Replaces one function (adds response fields and a `view` parameter) | None to data. **Compatibility risk**: see section 2 |
| 2 | `20261025100610_private_offer_drafts` | New immutable table and `api.offer_drafts` | No | None |
| 3 | `20261025140000_private_employment_history` | New immutable table and `api.employment_history` | No | None |
| 4 | `20261026100000_guidance_thread_deletion` | New receipts table; **replaces the immutability trigger on `private.guidance_turns`** with one that allows deletes only inside `api.guidance_delete`; adds a delete grant and policy on that table; adds `api.guidance_delete` | Yes: one trigger, one grant, one policy on `guidance_turns` | No data is deleted by the migration. Afterwards a user can delete **their own** conversations (intended, irreversible, receipt kept) |
| 5 | `20261026110000_list_offers_backward_compat` | Re-defines `api.list_offers` so requests without `view` get the original response shape and all offers | Replaces the function from migration 1 | None |
| 6 | `20261026120000_saved_analysis_history` | New immutable table and `api.analysis_history` | No | None |
| 7 | `20261026130000_company_team_roster` | `private.company_team` (owned by `fw_policy_exec`, temporary schema CREATE grant revoked afterwards) and `api.company_team` | No table changes | None |

(You asked about four migrations. Seven are pending: the original four, plus three added in this
session: the compatibility fix (5) and the saved-analysis (6) and team-roster (7) features.)

A scan for `DROP TABLE/COLUMN/SCHEMA`, `TRUNCATE`, `ALTER ... DROP/RENAME` and `UPDATE ... SET`
across these files found none. The only `DELETE` statement is inside the user-triggered
`api.guidance_delete`.

## 2. Compatibility with the currently hosted application

The hosted app (`https://oryqen.vercel.app`) is **older than this branch** (`/downloads` is 404,
the landing page has no release cards). Its offer-list parser is strict and predates lifecycle
fields (`src/features/offer/list-schema.ts` at commit `57d87e5`).

| Code | Database | Result |
|---|---|---|
| Old hosted app | After migrations 1 only | **Saved-offer lists break (503)**: the response gains fields the strict parser rejects |
| Old hosted app | After migrations 1 and 5 (all seven) | Works. Requests without `view` receive the original shape. Covered by `offer-lifecycle-db.test.ts` and a real-Postgres call |
| New code | Old database | Offer lists break (the new UI sends `view`, which the old function rejects); new features return errors |
| New code | All migrations | Works (browser and database tests) |

**Therefore: apply all seven migrations first (together, in order), verify the old app still lists
offers, then deploy the new code.** Never apply migration 1 alone, and never deploy code first.
Migrations 2-4, 6 and 7 are invisible to the old app. Migration 4 changes only a trigger
(updates and deletes outside the new function are still refused).

## 3. Backup and rollback

Before anything: take a database backup (Supabase dashboard backup or `supabase db dump`, using
an owner-held credential; point-in-time recovery if the plan has it) and record its identifier.
Only two **existing** objects change: `api.list_offers` (a function) and the trigger/grant/policy
on `private.guidance_turns`. Every other change creates new, initially empty objects.

Rollback (text only, not run; use the owner's SQL access as `postgres`):

- **Disable a feature without losing data**: `revoke execute on function api.<name>(jsonb) from authenticated;`
  for `offer_lifecycle`, `offer_drafts`, `employment_history`, `guidance_delete`, `analysis_history`,
  `company_team`. New tables keep their rows; never delete user revision history.
- **Restore the original offer list**: re-run the `create or replace function api.list_offers` from
  `supabase/migrations/202610180002_offer_workspace.sql` (lines 7-27). Do this only together with
  reverting to the old application code.
- **Restore guidance immutability**:
  `drop policy guidance_delete on private.guidance_turns; revoke delete on private.guidance_turns from fw_user_exec;
  drop trigger guidance_immutable on private.guidance_turns;
  create trigger guidance_immutable before update or delete on private.guidance_turns
  for each row execute function private.day3_reject_history_mutation();`
  Conversations a user already deleted cannot be restored except from the backup.
- **Application**: redeploy the previous Vercel deployment (instant). The database stays compatible
  with the old app as long as migration 5 is in place.

Preflight on the target (read-only): confirm the roles `fw_user_exec`, `fw_policy_exec`,
`fw_schema_owner` exist, the 32 prior migration versions are recorded (through
`20261024053156_private_guidance_history`), and run the existing catalog scripts
(`scripts/day*-hosted-catalog.sql`). Applying through `supabase db push` requires the `postgres`
role; never `config push`.

## 4. Hosted target identity (unresolved: needs the owner)

| Item | Evidence | Status |
|---|---|---|
| Supabase project | Two refs appear in the repo: `cqjxsafeodslmyoqftdj` (Mumbai; `docs/DAY3_HOSTED_PREFLIGHT.md`; the ref in the local `.env.local`) and `jpvgsmzomlmowarlfkdl` ("oryqen-staging", 32 migrations, seen via a connector on 25 Oct) | **The owner must state which project the hosted app uses**. Compare the project name, ref and region in the Supabase dashboard before any change |
| Vercel project | No `.vercel` link in the repo; the deployed host is `oryqen.vercel.app` | **Owner to confirm the project name and that its production branch/commit is the intended one**. The branch to deploy: `feature/oryqen-sprint-oct25` (local, not pushed) |
| Deployed commit | Unknown; older than `24283ad` | Owner to confirm |

## 5. Environment variables (names only, set in Vercel; never commit values)

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN`
(exact `https://` origin), `FAIRWORK_DATA_MODE` (`supabase`).
Authentication: `AUTH_REGISTRATION_ENABLED` (keep `false` until email delivery is approved).
AI (keep disabled): `ORYQEN_AI_ENABLED`, `ORYQEN_AI_POLICY_APPROVED`, `ORYQEN_AI_POLICY_APPROVAL_REF`,
`ORYQEN_AI_PROVIDER`, `ORYQEN_AI_PROCESSING_REGION`, `ORYQEN_AI_DATA_USE`, `GEMINI_MODEL`, `GEMINI_API_KEY`.
Optional: `ORYQEN_TELEMETRY_DB_URL` (restricted writer role; use a pooler, its role allows 4 connections),
`NEXT_PUBLIC_WINDOWS_URL`, `NEXT_PUBLIC_APK_URL`, `NEXT_PUBLIC_PLAY_STORE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`.
Never set: any service-role key, database owner URL or password in application settings.

## 6. Approval checklist

- [ ] Owner confirms the Supabase project (ref, name, region) and the Vercel project.
- [ ] Backup taken; identifier recorded.
- [ ] Read-only preflight on the target passes (roles present; 32 prior migrations recorded).
- [ ] Owner approves applying migrations 1-7 together, in order, as `postgres`.
- [ ] After applying: the old app still lists saved offers (employer and worker).
- [ ] Owner approves pushing the branch and deploying; `APP_ORIGIN` equals the production origin.
- [ ] Hosted acceptance with two controlled accounts (`docs/ORYQEN_DEPLOYMENT_CHECKLIST.md` section 6).
- [ ] Auth settings reviewed: redirect URLs, email template and SMTP, leaked-password protection (owner choice).

## 7. Unresolved blockers (not fixable without the owner)

1. Hosted target identity (section 4).
2. Production domain and application ID decisions, approved logo/icons, signing certificate and keystore (`docs/ORYQEN_RELEASE_SIGNING.md`).
3. Gemini: request shape unproven (503 under load), AI policy approval absent; AI stays off.
4. Email delivery for registration is unverified on hosted infrastructure.
5. Telemetry connection limit under serverless concurrency (pooler or higher limit).
6. Browser acceptance on a physical Android device and a signed Windows install is not done.
7. Not built: billing/entitlements; member names in the team roster (needs a reviewed column grant);
   self-service team changes (they stay operator-reviewed); scanned-PDF reading (use the screenshot reader).
