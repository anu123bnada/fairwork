# ORYQEN architecture (as built, 25 October 2026)

This describes the code in the repository, not intended future work. Older design
documents (`ARCHITECTURE.md`, `ARCHITECTURE_BASELINE.md`, `SECURITY.md`) describe the
original plan; where they differ, this file and the code win.

## Stack

Next.js 16 (App Router) with React 19 and TypeScript; Supabase Auth and PostgreSQL;
Zod 4 for validation; authored CSS (Tailwind is not installed); Vitest for unit and
SQL tests (an in-process PostgreSQL, PGlite, runs the real migrations); Playwright for
browser tests. Optional server-only Gemini (or OpenAI) provider, disabled by default.

## Request path

Browser component -> `appRequest` (`src/features/authority/client.ts`, handles network
failure, timeout, gateway HTML and malformed envelopes without retrying writes) ->
Next route handler under `src/app/api/v1/**` -> `apiResponse` wrapper (private, no-store
responses, consistent error codes) -> same-origin check on writes, strict Zod parse ->
`createServerSupabase` user client with the caller's session -> `supabase.rpc(...)` on
an `api.*` function.

Routes never take an actor identity from the client; identity is the verified session.
Unknown JSON fields are rejected (`strictObject`).

## Database model

- Browser roles have no direct grants on private tables. Only `api.*` RPC functions are
  executable by `authenticated`, each with an explicit grant and an empty search path.
- Functions are `SECURITY DEFINER`, owned by a restricted executor role
  (`fw_user_exec`: no login, no superuser, no bypass of row security).
- Private tables have row-level security enabled **and forced**; policies key on
  `private.request_uid()` and `private.is_active()` (suspended accounts are denied).
- History tables are append-only by trigger (`day3_reject_history_mutation`): updates and
  deletes are rejected for the database role used by the app. This is a policy-level
  guarantee, not a cryptographic or blockchain ledger; a database owner can still alter
  data.
- Writes carry an idempotency key and an expected revision, so retries are safe and
  concurrent edits fail with `VERSION_CONFLICT`.
- 35 local migrations in `supabase/migrations`, pinned by hash for local startup in
  `scripts/prepare-local-development.mjs`. Staging has 32 (through
  `20261024053156_private_guidance_history`); the three sprint migrations
  (`202610250001_offer_lifecycle`, `20261025100610_private_offer_drafts`,
  `20261025140000_private_employment_history`) are not deployed there.

## Feature map (code location)

| Area | API | Notes |
|---|---|---|
| Identity, sessions, recovery, MFA | `/api/v1/auth/*`, `/api/v1/me` | Supabase Auth; registration gated by `AUTH_REGISTRATION_ENABLED` |
| Offers, assessment, history, lifecycle | `/api/v1/offers/*` | rule-based baseline; archive/restore and decisions are actor-private |
| Private offer drafts | `/api/v1/offers/drafts` | immutable revisions, no organization needed |
| Employment history | `/api/v1/me/employment-history` | private, always `self_reported`; no sharing path |
| Companies, organizations, claims | `/api/v1/companies`, `/organizations` | stored records only; no external registry |
| Agreements, workflows | `/api/v1/agreements`, `/agreement-workflows` | versioned; acknowledgments are records, not legal signatures |
| Work records, evidence, integrity | `/api/v1/work-*` | require an agreement-backed basis |
| Passport and sharing | `/api/v1/passport*` | named-recipient grants, revocable |
| Disputes, appeals | `/api/v1/work-cases`, `/case-followups` | independent reviewer checks |
| Notifications, privacy requests | `/notifications`, `/privacy-requests` | in-app only; requests are recorded, not auto-fulfilled |
| Opportunities | `/api/v1/opportunities` | persisted listings and preferences, rules matching; no live job feed |
| Guidance assistant | `/api/v1/guidance` | rules-based, private history |
| Admin/operator | `/api/v1/admin`, `/operator/*` | capability plus MFA enforced server-side |

## AI path

`/api/v1/offers/analyze` -> consent check (exact provider/model/policy hash) -> server
redaction -> budget quota -> one fixed-host provider call (25 s timeout, no redirects, no
cache, no tools) -> Zod validation -> exact-quote and numeric-token grounding -> response
labeled advisory. `aiConfiguration()` returns null unless all of `ORYQEN_AI_ENABLED`,
`ORYQEN_AI_POLICY_APPROVED`, an approval reference, region, data-use text, key and model
are set; the shipped configuration keeps AI off, and deterministic rules remain the
baseline. See `docs/GEMINI_PROCESSING_GATE.md`.

## Runtime configuration

`.env.example` lists every variable. Server-only: `APP_ORIGIN`, `FAIRWORK_DATA_MODE`,
`ORYQEN_AI_*`, `GEMINI_*`, `ORYQEN_TELEMETRY_DB_URL`. Browser-safe:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
