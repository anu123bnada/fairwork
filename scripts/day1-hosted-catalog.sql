-- Owner-only read-only verification in the hosted Supabase SQL Editor.
-- No user/profile rows, secrets, JWTs or connection strings are selected.
-- This verifies selected catalog invariants, not a full schema equivalence proof.
begin transaction read only;

with checks(name, ok) as (
  select 'identity migration recorded', exists (
    select 1 from supabase_migrations.schema_migrations where version='202610070001'
  )
  union all
  select 'private Auth context migration recorded', exists (
    select 1 from supabase_migrations.schema_migrations where version='202610080002'
  )
  union all
  select 'retired grant proposal remains unrecorded', not exists (
    select 1 from supabase_migrations.schema_migrations where version='202610080001'
  )
  union all
  select 'two restricted scalar Auth context helpers', count(*)=2 and bool_and(
    p.proowner='postgres'::regrole and p.prosecdef and p.provolatile='s'
    and p.pronargs=0 and p.prolang=(select oid from pg_language where lanname='sql')
    and p.proconfig=array['search_path=""']::text[]
    and p.prorettype=case p.proname when 'request_uid' then 'uuid'::regtype else 'jsonb'::regtype end
    and btrim(p.prosrc,E' \n\r\t')=case p.proname when 'request_uid' then 'select auth.uid();' else 'select auth.jwt();' end
    and has_function_privilege('fw_user_exec',p.oid,'EXECUTE')
    and has_function_privilege('fw_policy_exec',p.oid,'EXECUTE')
    and has_schema_privilege('fw_user_exec','private','USAGE')
    and has_schema_privilege('fw_policy_exec','private','USAGE')
    and not has_schema_privilege('fw_user_exec','private','CREATE')
    and not has_schema_privilege('fw_policy_exec','private','CREATE')
    and not pg_has_role('fw_user_exec','postgres','MEMBER')
    and not pg_has_role('fw_policy_exec','postgres','MEMBER')
    and not exists (
      select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee not in ('postgres'::regrole,'fw_user_exec'::regrole,'fw_policy_exec'::regrole)
        or (a.grantee <> 'postgres'::regrole and a.is_grantable)
    )
  ) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname in ('request_uid','request_jwt')
  union all
  select 'scalar helper owner can call existing Auth functions',
    has_schema_privilege('postgres','auth','USAGE')
    and has_function_privilege('postgres','auth.uid()','EXECUTE')
    and has_function_privilege('postgres','auth.jwt()','EXECUTE')
  union all
  select 'domain functions and RLS have no direct Auth helper calls', not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('private','api') and p.proname not in ('request_uid','request_jwt')
      and (p.prosrc like '%auth.uid(%' or p.prosrc like '%auth.jwt(%')
  ) and not exists (
    select 1 from pg_policies where schemaname='private'
      and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'auth[.](uid|jwt)[(]'
  )
  union all
  select 'exactly five private tables with FORCE RLS and separate owner',
    count(*)=5 and bool_and(c.relrowsecurity and c.relforcerowsecurity and r.rolname='fw_schema_owner')
    and array_agg(c.relname::text order by c.relname)=array['audit_logs','capability_assignments','command_receipts','profiles','rate_limit_buckets']
  from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner
  where n.nspname='private' and c.relkind='r'
  union all
  select 'runtime roles cannot login or bypass RLS', count(*)=3 and bool_and(not rolcanlogin and not rolbypassrls and not rolsuper)
  from pg_roles where rolname in ('fw_schema_owner','fw_user_exec','fw_policy_exec')
  union all
  select 'client roles have no executor membership', not exists (
    select 1 from (values ('anon'),('authenticated'),('service_role')) client(name)
    cross join (values ('fw_schema_owner'),('fw_user_exec'),('fw_policy_exec')) executor(name)
    where pg_has_role(client.name,executor.name,'MEMBER')
  )
  union all
  select 'client roles have no private schema or table/column privileges', not exists (
    select 1 from (values ('anon'),('authenticated'),('service_role')) client(name)
    where has_schema_privilege(client.name,'private','USAGE')
  ) and not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join (values ('anon'),('authenticated'),('service_role')) client(name)
    where n.nspname='private' and c.relkind='r'
      and (has_table_privilege(client.name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(client.name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
  )
  union all
  select 'only three approved api function signatures', count(*)=3 and
    bool_and(p.prosecdef and r.rolname='fw_user_exec' and 'search_path=""'=any(p.proconfig)
      and pg_get_function_identity_arguments(p.oid)='request jsonb') and
    array_agg(p.proname::text order by p.proname)=array['create_profile','get_me','update_profile']
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='api'
  union all
  select 'RPC grants are authenticated-only among public client roles', count(*)=3 and bool_and(
    has_function_privilege('authenticated',p.oid,'EXECUTE') and
    not has_function_privilege('anon',p.oid,'EXECUTE') and
    not has_function_privilege('service_role',p.oid,'EXECUTE') and
    not exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
  ) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api'
  union all
  select 'private helpers have no public client execution', not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join (values ('anon'),('authenticated'),('service_role')) client(name)
    where n.nspname='private' and has_function_privilege(client.name,p.oid,'EXECUTE')
  )
  union all
  select 'api schema contains no tables or views', not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='api' and c.relkind in ('r','p','v','m','f')
  )
  union all
  select 'eleven expected RLS policies present', count(*)=11 and
    array_agg(policyname::text order by policyname)=array[
      'audit_user_insert','capabilities_policy_select','limits_user_insert','limits_user_select','limits_user_update',
      'profiles_policy_select','profiles_user_insert','profiles_user_select','profiles_user_update','receipts_user_insert','receipts_user_select']
  from pg_policies where schemaname='private'
  union all
  select 'four invariant triggers enabled', count(*)=4 and bool_and(t.tgenabled='O') and
    array_agg(t.tgname::text order by t.tgname)=array['audit_immutable','capability_immutable','profiles_guard','receipts_immutable']
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='private' and not t.tgisinternal
)
select name as check_name, case when ok is true then 'PASS' else 'FAIL' end as result from checks order by name;

rollback;
