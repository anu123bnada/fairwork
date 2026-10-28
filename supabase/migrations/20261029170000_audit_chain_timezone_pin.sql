begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- QA correction to the audit hash chain (module 10). The chain hashes to_jsonb(row)::text, and to_jsonb renders timestamptz in the TimeZone of the session that runs it.
-- A row chained from a session with one TimeZone therefore failed verification from a session with another, reporting every timestamped row as altered. Pinning the
-- time zone on the three functions that hash a row makes the text, and so every hash, independent of the caller. Existing links were produced by UTC sessions (the hosted
-- default), so they remain valid; no data is rewritten and no permission is changed.
alter function private.audit_chain_append() set timezone to 'UTC';
alter function private.audit_chain_verify() set timezone to 'UTC';
commit;
