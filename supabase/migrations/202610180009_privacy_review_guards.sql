begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- The shared quota helper is SECURITY INVOKER: give this narrow executor only
-- its current caller's existing identity buckets, never another subject's quota.
grant select,insert,update(count) on private.rate_limit_buckets to fw_privacy_exec;
create policy limits_privacy_select on private.rate_limit_buckets for select to fw_privacy_exec using(private.has_capability('privacy_operator') and subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation in ('identity_read','identity_write'));
create policy limits_privacy_insert on private.rate_limit_buckets for insert to fw_privacy_exec with check(private.has_capability('privacy_operator') and subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation in ('identity_read','identity_write'));
create policy limits_privacy_update on private.rate_limit_buckets for update to fw_privacy_exec using(private.has_capability('privacy_operator') and subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation in ('identity_read','identity_write')) with check(private.has_capability('privacy_operator') and subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation in ('identity_read','identity_write'));
-- Preserve the applied request migration. Reserve its final bounded history slot
-- for closure, so repeated reviews cannot strand an owner's open request.
create function private.guard_privacy_terminal_capacity() returns trigger language plpgsql set search_path='' as $$
begin
 if new.revision=20 and new.status not in ('fulfilled','declined','withdrawn') then raise exception 'VERSION_CONFLICT';end if;
 return new;
end $$;
alter function private.guard_privacy_terminal_capacity() owner to fw_schema_owner;
revoke all on function private.guard_privacy_terminal_capacity() from public,anon,authenticated,service_role;
create trigger privacy_terminal_capacity before insert on private.privacy_request_events for each row execute function private.guard_privacy_terminal_capacity();
notify pgrst,'reload schema';
commit;
