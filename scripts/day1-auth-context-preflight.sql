-- Read-only, PostgreSQL 17. Run in a fresh owner SQL Editor query before approval.
-- Returns one JSON cell; no account data, credentials or migration SQL selected.
-- This proves catalog prerequisites for postgres, not the identity of a previous
-- CLI connection. The migration separately requires current_user = postgres.
with checks(name, ok) as (
  select 'editor effective role is postgres', current_user = 'postgres'
  union all
  select 'postgres can use auth and execute both existing helpers',
    has_schema_privilege('postgres','auth','USAGE')
    and has_function_privilege('postgres','auth.uid()','EXECUTE')
    and has_function_privilege('postgres','auth.jwt()','EXECUTE')
  union all
  select 'postgres can use and create functions in private',
    has_schema_privilege('postgres','private','USAGE')
    and has_schema_privilege('postgres','private','CREATE')
  union all
  select 'postgres can use both required languages',
    has_language_privilege('postgres','sql','USAGE')
    and has_language_privilege('postgres','plpgsql','USAGE')
  union all
  select 'postgres has immediate owner privileges on the five existing helpers',
    count(*)=5 and bool_and(pg_has_role('postgres',p.proowner,'USAGE'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname in
    ('is_active','has_capability','consume_identity_quota','require_identity','profile_dto')
  union all
  select 'postgres has immediate owner privileges on all five FORCE RLS tables',
    count(*)=5 and bool_and(c.relrowsecurity and c.relforcerowsecurity
      and c.relowner='fw_schema_owner'::regrole and pg_has_role('postgres',c.relowner,'USAGE'))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='private' and c.relkind='r'
  union all
  select 'both restricted executors can use private but cannot create there',
    count(*)=2 and bool_and(not r.rolcanlogin and not r.rolsuper and not r.rolbypassrls
      and not r.rolinherit and has_schema_privilege(r.oid,'private','USAGE')
      and not has_schema_privilege(r.oid,'private','CREATE')
      and not pg_has_role(r.oid,'postgres','MEMBER'))
  from pg_roles r where r.rolname in ('fw_user_exec','fw_policy_exec')
  union all
  select 'private scalar helper names are unused', not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname in ('request_uid','request_jwt')
  )
  union all
  select 'five helper bodies match the reviewed foundation', count(*)=5
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  join (values
    ('is_active','b514b77bd87e0b444058f3e8761db251'),
    ('has_capability','2a0edd9130ab6fc7a93756a187bc0339'),
    ('consume_identity_quota','0b09eda121cd2249f554c11398673aca'),
    ('require_identity','ba9799bab071df6668712767c122ffc3'),
    ('profile_dto','85481689558e47fe1ff956668e33f933')
  ) expected(name, source_md5) on p.proname=expected.name
  where n.nspname='private' and md5(replace(p.prosrc,E'\r\n',E'\n'))=expected.source_md5
  union all
  select 'foundation recorded and both repair versions unrecorded',
    exists(select 1 from supabase_migrations.schema_migrations where version='202610070001')
    and not exists(select 1 from supabase_migrations.schema_migrations where version in ('202610080001','202610080002'))
), permissions as (
  select r.rolname,
    has_schema_privilege(r.oid,'auth','USAGE') as auth_usage,
    has_schema_privilege(r.oid,'auth','USAGE WITH GRANT OPTION') as auth_grant_option,
    has_schema_privilege(r.oid,'private','USAGE') as private_usage,
    has_schema_privilege(r.oid,'private','CREATE') as private_create
  from pg_roles r where r.rolname in ('postgres','fw_user_exec','fw_policy_exec')
)
select jsonb_build_object(
  'effective_role',current_user,
  'login_role',session_user,
  'server_version',current_setting('server_version'),
  'checks',(select jsonb_agg(jsonb_build_object('check',name,'result',case when ok is true then 'PASS' else 'FAIL' end) order by name) from checks),
  'permissions',(select jsonb_agg(to_jsonb(p) order by p.rolname) from permissions p)
) as preflight;
