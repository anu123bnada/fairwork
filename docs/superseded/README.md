# Retired, unrecorded migration proposal

`202610080001_identity_auth_schema_usage.sql` is preserved byte-for-byte as historical evidence. The owner confirmed it failed its postcondition and is **not** recorded in hosted migration history. It is deliberately outside `supabase/migrations`, so normal CLI push does not execute it.

Do not copy it back to the active queue or mark it applied. The replacement proposal is `supabase/migrations/202610080002_identity_auth_context.sql`, which changes no managed Auth schema permissions. See `docs/DAY1_AUTH_CONTEXT_REPAIR.md` for the current review and approval gate. The archived file remains exercised by a local regression documenting its grant-authority requirement.
