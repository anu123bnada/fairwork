-- Read-only addition to the existing 12-check Day 3 catalog. Run BOTH scripts.
begin transaction read only;
with checks(name,ok) as (
  select 'participant-read forward migration is recorded', exists (
    select 1 from supabase_migrations.schema_migrations where version='202610120001')
  union all
  select 'read RPC has restricted owner and empty search path',
    count(*)=1 and bool_and(p.prosecdef and r.rolname='fw_user_exec'
      and p.proconfig=array['search_path=""']::text[])
    from pg_proc p join pg_roles r on r.oid=p.proowner
    where p.oid=to_regprocedure('api.get_agreement(jsonb)')
  union all
  select 'read RPC effective privileges exclude anonymous and service roles',
    count(*)=1 and bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee=0 and a.privilege_type='EXECUTE'))
    from pg_proc p where p.oid=to_regprocedure('api.get_agreement(jsonb)')
  union all
  select 'read executor retains narrow existing prerequisites and no schema CREATE',
    has_schema_privilege('fw_user_exec','private','USAGE')
    and not has_schema_privilege('fw_user_exec','private','CREATE')
    and not has_schema_privilege('fw_user_exec','api','CREATE')
    and has_function_privilege('fw_user_exec','private.consume_identity_quota(text)','EXECUTE')
    and not has_schema_privilege('fw_user_exec','auth','USAGE')
  union all
  select 'only nine approved domain RPC signatures exist',
    count(*)=9 and bool_and(p.proname in ('create_profile','get_me','update_profile',
      'provision_company','decide_membership','review_offer','answer_offer_question','confirm_agreement','get_agreement')
      and pg_get_function_identity_arguments(p.oid) in ('request jsonb','payload jsonb'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api'
)
select name as check_name,case when ok is true then 'PASS' else 'FAIL' end as result from checks order by name;
rollback;
