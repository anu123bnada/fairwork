-- Read-only Day 3 migration prerequisites for the approved Mumbai project.
-- Run only after confirming the linked project reference in the Supabase dashboard.
-- This script never changes privileges, data, migration history, or database settings.
begin transaction read only;

with checks(name, ok) as (
  select 'migration session is postgres', current_user = 'postgres'
  union all
  select 'all four approved foundation migrations are recorded and Day 3 is pending',
    (select count(*) = 4 from supabase_migrations.schema_migrations
     where version in ('202610070001','202610080002','202610090001','202610090002'))
    and not exists (select 1 from supabase_migrations.schema_migrations where version = '202610100001')
    and not exists (select 1 from supabase_migrations.schema_migrations where version = '202610080001')
  union all
  select 'all four existing executor roles are restricted',
    count(*) = 4 and bool_and(not rolcanlogin and not rolsuper and not rolbypassrls)
  from pg_roles
  where rolname in ('fw_schema_owner','fw_user_exec','fw_policy_exec','fw_authority_exec')
  union all
  select 'migration session can assume all required owners',
    pg_has_role(current_user,'fw_schema_owner','USAGE')
    and pg_has_role(current_user,'fw_schema_owner','SET')
    and pg_has_role(current_user,'fw_user_exec','USAGE')
    and pg_has_role(current_user,'fw_user_exec','SET')
    and pg_has_role(current_user,'fw_policy_exec','USAGE')
    and pg_has_role(current_user,'fw_policy_exec','SET')
  union all
  select 'migration session owns or can assume both DDL schemas',
    count(*) = 2 and bool_and(
      pg_get_userbyid(nspowner) = current_user
      or pg_has_role(current_user, nspowner, 'USAGE')
        and pg_has_role(current_user, nspowner, 'SET')
    )
  from pg_namespace
  where nspname in ('private','api')
  union all
  select 'shared audit and quota tables remain under the schema owner',
    count(*) = 2 and bool_and(
      c.relowner = 'fw_schema_owner'::regrole
      and pg_has_role(current_user,'fw_schema_owner','USAGE')
      and pg_has_role(current_user,'fw_schema_owner','SET')
    )
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'private' and c.relname in ('audit_logs','rate_limit_buckets') and c.relkind = 'r'
  union all
  select 'Day 2 authority helper and RPC boundary are intact',
    to_regprocedure('private.active_authority(uuid,uuid)') is not null
    and to_regprocedure('api.provision_company(jsonb)') is not null
    and to_regprocedure('api.decide_membership(jsonb)') is not null
    and has_function_privilege('fw_user_exec','private.active_authority(uuid,uuid)','EXECUTE')
    and has_function_privilege('fw_policy_exec','private.active_authority(uuid,uuid)','EXECUTE')
  union all
  select 'Day 3 tables and RPCs do not already exist',
    not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'private' and c.relname in (
        'day3_offers','day3_offer_questions','day3_offer_answers',
        'day3_agreements','day3_command_receipts','day3_effective_agreements'
      )
    )
    and to_regprocedure('api.review_offer(jsonb)') is null
    and to_regprocedure('api.answer_offer_question(jsonb)') is null
    and to_regprocedure('api.confirm_agreement(jsonb)') is null
  union all
  select 'client roles have no private-schema access',
    not exists (
      select 1 from (values ('anon'),('authenticated'),('service_role')) client(name)
      where has_schema_privilege(client.name,'private','USAGE')
    )
  union all
  select 'API schema has no exposed relations',
    not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'api' and c.relkind in ('r','p','v','m','f')
    )
)
select name as check_name,
  case when ok is true then 'PASS' else 'FAIL' end as result
from checks
order by name;

rollback;
