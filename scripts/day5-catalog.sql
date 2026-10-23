-- Read-only; local runner evidence is not hosted verification.
with tables as (
 select c.oid,c.relrowsecurity,c.relforcerowsecurity,c.relowner from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='private' and c.relname in ('work_records','work_record_versions','work_evidence','work_decisions','work_receipts')
), functions as (
 select p.oid,p.proowner,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='api' and p.proname in ('work_command','read_work','read_work_evidence','list_work')
), checks as (
 select 'D5 tables owned / forced RLS' name,(select count(*)=5 and bool_and(relrowsecurity and relforcerowsecurity and relowner='fw_schema_owner'::regrole) from tables) ok
 union all select 'D5 no client table access',not exists(select 1 from tables cross join (values('anon'),('authenticated'),('service_role')) r(name) where has_table_privilege(r.name,tables.oid,'SELECT,INSERT,UPDATE,DELETE'))
 union all select 'D5 RPC restricted owner / path',(select count(*)=4 and bool_and(proowner='fw_user_exec'::regrole and prosecdef and proconfig=array['search_path=""']) from functions)
 union all select 'D5 RPC execute allowlist',(select count(*)=4 and bool_and(has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('service_role',oid,'EXECUTE')) from functions)
 union all select 'D5 private helpers not client executable',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'work_%' and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')))
 union all select 'D5 executor roles cannot login/bypass/DDL',not exists(select 1 from pg_roles where rolname in ('fw_user_exec','fw_policy_exec') and (rolcanlogin or rolbypassrls or rolsuper or has_schema_privilege(rolname,'private','CREATE') or has_schema_privilege(rolname,'api','CREATE')))
 union all select 'D5 immutable guards / deferred pointer',(select count(*)=6 from pg_trigger where not tgisinternal and tgname in ('work_evidence_immutable','work_decision_immutable','work_receipt_immutable','work_version_guard','work_root_guard','work_pointer_check')) and exists(select 1 from pg_trigger where tgname='work_pointer_check' and tgdeferrable and tginitdeferred)
 union all select 'D5 typed agreement / root / previous FKs',(select count(*)=3 from pg_constraint where conrelid='private.work_record_versions'::regclass and contype='f') and exists(select 1 from pg_constraint where conrelid='private.work_record_versions'::regclass and confrelid='private.agreement_versions'::regclass and cardinality(conkey)=6)
 union all select 'D5 same-parent current pointer',exists(select 1 from pg_constraint where conrelid='private.work_records'::regclass and confrelid='private.work_record_versions'::regclass and contype='f' and condeferrable and condeferred)
)
select name,case when ok then 'PASS' else 'FAIL' end result from checks order by name;
