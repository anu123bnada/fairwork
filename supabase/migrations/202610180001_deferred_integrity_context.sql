-- Deferred triggers execute after a SECURITY DEFINER RPC has returned to the
-- authenticated caller. Retain the existing restricted owner for those checks;
-- never grant clients private schema usage or bypass FORCE RLS.
begin;
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname in ('agreement_check_pointers','work_check_pointer')
      and p.pronargs=0 and pg_get_userbyid(p.proowner)='fw_user_exec'
      and p.proconfig @> array['search_path=""']) <> 2 then
    raise exception 'Unexpected deferred integrity function owner or search_path';
  end if;
  if exists(select 1 from pg_roles where rolname='fw_user_exec' and (rolsuper or rolbypassrls or rolcanlogin)) then
    raise exception 'Restricted integrity owner required';
  end if;
end $$;
alter function private.agreement_check_pointers() security definer;
alter function private.work_check_pointer() security definer;
revoke all on function private.agreement_check_pointers(), private.work_check_pointer()
  from public, anon, authenticated, service_role;
commit;
