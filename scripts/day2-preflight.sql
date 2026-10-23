-- Read-only prerequisites. Run before approving the pending Day 2 migration.
begin transaction read only;
with checks(name,ok) as (
 select 'effective migration role is postgres',current_user='postgres'
 union all select 'postgres can create the isolated executor role',rolcreaterole or rolsuper from pg_roles where rolname=current_user
 union all select 'postgres has immediate schema owner privileges and SET authority',pg_has_role(current_user,'fw_schema_owner','USAGE') and pg_has_role(current_user,'fw_schema_owner','SET')
 union all select 'postgres can assign policy helper ownership',pg_has_role(current_user,'fw_policy_exec','USAGE') and pg_has_role(current_user,'fw_policy_exec','SET')
 union all select 'postgres owns both Auth wrappers and can grant their EXECUTE',count(*)=2 and bool_and(proowner='postgres'::regrole) from pg_proc where oid in (to_regprocedure('private.request_uid()'),to_regprocedure('private.request_jwt()'))
 union all select 'private and api schema DDL is authorized',has_schema_privilege(current_user,'private','USAGE,CREATE') and has_schema_privilege(current_user,'api','USAGE,CREATE')
 union all select 'both function languages are available',has_language_privilege(current_user,'sql','USAGE') and has_language_privilege(current_user,'plpgsql','USAGE')
 union all select 'all three Day 1 migrations recorded',count(*)=3 from supabase_migrations.schema_migrations where version in ('202610070001','202610080002','202610090001')
 union all select 'Day 2 and retired repair unrecorded',not exists(select 1 from supabase_migrations.schema_migrations where version in ('202610080001','202610090002'))
 union all select 'Day 2 role and objects do not already exist',not exists(select 1 from pg_roles where rolname='fw_authority_exec') and to_regclass('private.companies') is null and to_regclass('private.company_memberships') is null and to_regclass('private.company_membership_decisions') is null and to_regprocedure('api.provision_company(jsonb)') is null and to_regprocedure('api.decide_membership(jsonb)') is null
)
select name as check_name,case when ok is true then 'PASS' else 'FAIL' end as result from checks order by name;
rollback;
