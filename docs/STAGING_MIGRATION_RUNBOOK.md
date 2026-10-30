# Staging database migration status (corrected 30 Oct 2026)

An earlier version of this note claimed 30 functions were missing on `oryqen-staging` (`jpvgsmzomlmowarlfkdl`). That was wrong: the
check used the public (anon) key, and PostgREST reports a function the anon role may not execute as "not found". The functions
exist and `authenticated` may execute them (verified with `pg_proc` / `has_function_privilege` in the SQL editor).

Verified in the Supabase dashboard:
- `supabase_migrations.schema_migrations` listed every local migration except `20261029170000_audit_chain_timezone_pin`.
- That one (two `ALTER FUNCTION ... SET timezone TO 'UTC'` statements, no data change) was applied on 30 Oct 2026 with the owner's
  approval and recorded in `schema_migrations`. Staging is now level with `supabase/migrations`.
- API logs showed `offer_drafts`, `list_offers`, `credential_list`, `entitlement_read`, `get_me` answering 200.

Do not use anon-key probes to judge whether a migration is applied; compare `schema_migrations` with `supabase/migrations`.
