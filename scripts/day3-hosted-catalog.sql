-- Read-only post-Day-3 catalog verification.
-- Run only after explicit migration approval and successful application.
-- Do not use the Day 2 exact-count catalog script after Day 3 is applied.
begin transaction read only;

with checks(name, ok) as (
  select 'five approved migrations recorded and retired migration absent',
    (select count(*) = 5 from supabase_migrations.schema_migrations
     where version in ('202610070001','202610080002','202610090001','202610090002','202610100001'))
    and not exists (select 1 from supabase_migrations.schema_migrations where version = '202610080001')
  union all
  select 'six Day 3 private tables use FORCE RLS and fw_schema_owner',
    count(*) = 6 and bool_and(c.relrowsecurity and c.relforcerowsecurity and r.rolname = 'fw_schema_owner')
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_roles r on r.oid = c.relowner
  where n.nspname = 'private' and c.relkind = 'r'
    and c.relname in (
      'day3_offers','day3_offer_questions','day3_offer_answers',
      'day3_agreements','day3_command_receipts','day3_effective_agreements'
    )
  union all
  select 'client roles have no private schema or table/column access',
    not exists (
      select 1 from (values ('anon'),('authenticated'),('service_role')) client(name)
      where has_schema_privilege(client.name,'private','USAGE')
    )
    and not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join (values ('anon'),('authenticated'),('service_role')) client(name)
      where n.nspname = 'private' and c.relkind = 'r'
        and (has_table_privilege(client.name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          or has_any_column_privilege(client.name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
    )
  union all
  select 'eight API RPCs are security-definer with empty search paths and expected owners',
    count(*) = 8 and bool_and(
      p.prosecdef
      and p.proconfig = array['search_path=""']::text[]
      and r.rolname = case
        when p.proname in ('provision_company','decide_membership') then 'fw_authority_exec'
        else 'fw_user_exec'
      end
    )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'api'
    and p.proname in (
      'create_profile','get_me','update_profile','provision_company','decide_membership',
      'review_offer','answer_offer_question','confirm_agreement'
    )
  union all
  select 'only authenticated can execute the three Day 3 RPCs',
    count(*) = 3 and bool_and(
      has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists (
        select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      )
    )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'api'
    and p.proname in ('review_offer','answer_offer_question','confirm_agreement')
  union all
  select 'Day 3 authority and agreement hash helpers have restricted owners and grants',
    (select count(*) = 1 and bool_and(r.rolname = 'fw_policy_exec' and p.prosecdef
       and p.proconfig = array['search_path=""']::text[])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     join pg_roles r on r.oid = p.proowner
     where n.nspname = 'private' and p.proname = 'day3_authorized_company_role')
    and (select count(*) = 1 and bool_and(r.rolname = 'fw_user_exec' and p.prosecdef
       and p.proconfig = array['search_path=""']::text[])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     join pg_roles r on r.oid = p.proowner
     where n.nspname = 'private' and p.proname = 'day3_hash_agreement')
    and not has_function_privilege('anon','private.day3_authorized_company_role(uuid,uuid,text)','EXECUTE')
    and not has_function_privilege('authenticated','private.day3_hash_agreement(jsonb,jsonb)','EXECUTE')
    and not has_function_privilege('service_role','private.day3_hash_agreement(jsonb,jsonb)','EXECUTE')
  union all
  select 'six Day 3 executor policies scope reads and writes to participants or actors',
    count(*) = 6
    and bool_and(qual ~ '(worker_id|actor_id|EXISTS)' and with_check ~ '(worker_id|actor_id|EXISTS)')
    and array_agg(policyname::text order by policyname) = array[
      'day3_agreements_executor','day3_answers_executor','day3_effective_executor',
      'day3_offers_executor','day3_questions_executor','day3_receipts_executor'
    ]
  from pg_policies where schemaname = 'private' and policyname like 'day3\_%\_executor' escape '\'
  union all
  select 'offline bootstrap audit action remains allowed',
    exists (select 1 from pg_constraint where conrelid = 'private.audit_logs'::regclass
      and conname = 'audit_logs_action_check' and pg_get_constraintdef(oid) like '%bootstrap_capability%')
  union all
  select 'participant guard is restricted and policy executor cannot read offer contents',
    exists (select 1 from pg_proc p where p.oid = 'private.day3_guard_offer_revision()'::regprocedure
      and pg_get_userbyid(p.proowner) = 'fw_policy_exec' and p.prosecdef
      and p.proconfig = array['search_path=""']::text[])
    and not has_column_privilege('fw_policy_exec','private.day3_offers','snapshot','SELECT')
    and not has_table_privilege('fw_policy_exec','private.day3_offers','INSERT,UPDATE,DELETE')
    and not exists (
      select 1 from pg_proc p cross join (values ('anon'),('authenticated'),('service_role')) client(name)
      where p.oid in ('private.day3_guard_offer_revision()'::regprocedure,'private.day3_guard_effective_agreement()'::regprocedure)
        and has_function_privilege(client.name,p.oid,'EXECUTE'))
  union all
  select 'immutable history, participant revision and effective-pointer guards are enabled',
    count(*) = 7 and bool_and(t.tgenabled = 'O')
    and array_agg(t.tgname::text order by t.tgname) = array[
      'day3_agreements_immutable','day3_answers_immutable','day3_effective_guard',
      'day3_offer_revision_guard','day3_offers_immutable','day3_questions_immutable','day3_receipts_immutable'
    ]
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'private' and not t.tgisinternal and t.tgname like 'day3\_%' escape '\'
  union all
  select 'temporary schema CREATE grants were revoked',
    not has_schema_privilege('fw_user_exec','private','CREATE')
    and not has_schema_privilege('fw_user_exec','api','CREATE')
    and not has_schema_privilege('fw_policy_exec','private','CREATE')
  union all
  select 'runtime executors remain non-login and cannot bypass RLS',
    count(*) = 4 and bool_and(not rolcanlogin and not rolsuper and not rolbypassrls)
  from pg_roles
  where rolname in ('fw_schema_owner','fw_user_exec','fw_policy_exec','fw_authority_exec')
)
select name as check_name,
  case when ok is true then 'PASS' else 'FAIL' end as result
from checks
order by name;

rollback;
