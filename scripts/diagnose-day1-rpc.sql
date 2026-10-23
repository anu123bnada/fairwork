-- Read-only hosted diagnosis: ONE SELECT, ONE result row named diagnostics.
-- Run the entire file in Supabase SQL Editor. Copy the COMPLETE JSON cell or
-- export the result; a screenshot may truncate nested details.
-- No user records, claims, passwords, tokens or secret settings are selected.
with schema_usage as (
select 'schema_usage' as kind, r.name as role_name, s.name as object_name,
  has_schema_privilege(r.name,s.name,'USAGE') as allowed
from (values ('authenticated'),('fw_user_exec'),('fw_policy_exec')) r(name)
cross join (values ('api'),('private'),('auth')) s(name)
order by role_name, object_name
), function_privileges as (

select 'function_privileges' as kind, n.nspname as schema_name, p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
  (select setting from unnest(p.proconfig) setting where setting like 'search_path=%' limit 1) as search_path,
  md5(replace(p.prosrc, E'\r\n', E'\n')) as source_md5,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('fw_user_exec',p.oid,'EXECUTE') as user_executor_execute,
  has_function_privilege('fw_policy_exec',p.oid,'EXECUTE') as policy_executor_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('api','private') or (n.nspname='auth' and p.proname in ('uid','jwt'))
order by schema_name, function_name, arguments
), metadata_columns as (

select 'metadata_columns' as kind, c.relname as table_name, a.attname as column_name,
  has_column_privilege('fw_policy_exec',c.oid,a.attnum,'SELECT') as policy_executor_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
where n.nspname='private' and c.relname in ('profiles','capability_assignments')
order by table_name, column_name
), rls_policies as (

select 'rls_policy' as kind, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='private' order by tablename, policyname
), language_usage as (

select 'language_usage' as kind, r.name as role_name,
  has_language_privilege(r.name,'sql','USAGE') as sql_usage,
  has_language_privilege(r.name,'plpgsql','USAGE') as plpgsql_usage
from (values ('fw_user_exec'),('fw_policy_exec')) r(name)
), postgrest_settings as (

-- Allowlisted PostgREST settings only; never dump role configuration wholesale.
select 'postgrest_setting' as kind, coalesce(r.rolname,'all roles') as role_name,
  split_part(setting,'=',1) as setting_name,
  substring(setting from position('=' in setting)+1) as setting_value
from pg_db_role_setting s left join pg_roles r on r.oid=s.setrole
cross join lateral unnest(s.setconfig) setting
where split_part(setting,'=',1) in ('pgrst.db_schemas','pgrst.db_extra_search_path','pgrst.db_pre_request')
order by role_name, setting_name
), table_privileges as (
select c.relname as table_name, pg_get_userbyid(c.relowner) as owner,
  c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls,
  has_table_privilege('fw_user_exec',c.oid,'SELECT') as user_executor_select,
  has_table_privilege('fw_user_exec',c.oid,'INSERT') as user_executor_insert,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_any_table_access,
  has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') as authenticated_any_column_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='private' and c.relkind='r' order by c.relname
), role_properties as (
select rolname, rolcanlogin, rolsuper, rolbypassrls, rolinherit
from pg_roles where rolname in ('authenticated','fw_schema_owner','fw_user_exec','fw_policy_exec') order by rolname
)
select jsonb_build_object(
  'schema_usage', coalesce((
  
  
  
  
  
  
  select jsonb_agg(to_jsonb(x)) from schema_usage x),'[]'::jsonb),
  'function_privileges', coalesce((select jsonb_agg(to_jsonb(x)) from function_privileges x),'[]'::jsonb),
  'metadata_columns', coalesce((select jsonb_agg(to_jsonb(x)) from metadata_columns x),'[]'::jsonb),
  'rls_policies', coalesce((select jsonb_agg(to_jsonb(x)) from rls_policies x),'[]'::jsonb),
  'language_usage', coalesce((select jsonb_agg(to_jsonb(x)) from language_usage x),'[]'::jsonb),
  'postgrest_settings', coalesce((select jsonb_agg(to_jsonb(x)) from postgrest_settings x),'[]'::jsonb),
  'table_privileges', coalesce((select jsonb_agg(to_jsonb(x)) from table_privileges x),'[]'::jsonb),
  'role_properties', coalesce((select jsonb_agg(to_jsonb(x)) from role_properties x),'[]'::jsonb)
) as diagnostics;
