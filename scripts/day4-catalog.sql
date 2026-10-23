-- Read-only catalog checks. This file does not authorize hosted execution.
with tables as (
 select c.oid,c.relrowsecurity,c.relforcerowsecurity,c.relowner
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='private' and c.relname in ('agreement_roots','agreement_versions','agreement_acknowledgements','agreement_decisions','agreement_receipts')
), functions as (
 select p.oid,p.proowner,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='api' and p.proname in ('agreement_workflow','read_agreement_workflow')
), checks as (
 select 'D4 tables owned / forced RLS' name,(select count(*)=5 and bool_and(relrowsecurity and relforcerowsecurity and relowner='fw_schema_owner'::regrole) from tables) ok
 union all select 'D4 no client table access',not exists(select 1 from tables cross join (values('anon'),('authenticated'),('service_role')) r(name) where has_table_privilege(r.name,tables.oid,'SELECT,INSERT,UPDATE,DELETE'))
 union all select 'D4 RPC restricted owner / path',(select count(*)=2 and bool_and(proowner='fw_user_exec'::regrole and prosecdef and proconfig=array['search_path=""']) from functions)
 union all select 'D4 RPC execute allowlist',(select count(*)=2 and bool_and(has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('service_role',oid,'EXECUTE')) from functions)
 union all select 'D4 private helpers not client executable',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'agreement_%' and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')))
 union all select 'D4 executor roles cannot login/bypass/DDL',not exists(select 1 from pg_roles where rolname in ('fw_user_exec','fw_policy_exec') and (rolcanlogin or rolbypassrls or rolsuper or has_schema_privilege(rolname,'private','CREATE') or has_schema_privilege(rolname,'api','CREATE')))
 union all select 'D4 immutable guards / deferred pointer',(select count(*)=6 from pg_trigger where not tgisinternal and tgname in ('agreement_ack_immutable','agreement_decision_immutable','agreement_receipt_immutable','agreement_version_guard','agreement_root_guard','agreement_pointer_check')) and exists(select 1 from pg_trigger where tgname='agreement_pointer_check' and tgdeferrable and tginitdeferred)
 union all select 'D4 typed source / participant / authority FKs',(select count(*)=4 from pg_constraint where conrelid='private.agreement_versions'::regclass and contype='f')
 union all select 'D4 same-parent current / effective pointers',(select count(*)=2 from pg_constraint where conrelid='private.agreement_roots'::regclass and confrelid='private.agreement_versions'::regclass and contype='f' and condeferrable and condeferred)
)
select name,case when ok then 'PASS' else 'FAIL' end result from checks order by name;
