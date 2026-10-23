-- Read-only before/after evidence for exactly the three Day 1 signatures.
-- Before repair: inspect direct/effective grants and migration_role_is_owner.
-- After repair: require all three rows PASS and both role-path arrays empty.
with rpc as (
  select p.* from pg_proc p where p.oid in (
    'api.create_profile(jsonb)'::regprocedure,
    'api.get_me(jsonb)'::regprocedure,
    'api.update_profile(jsonb)'::regprocedure
  )
), evidence as (
  select p.oid::regprocedure::text as signature,
    pg_get_userbyid(p.proowner) as owner,
    current_user as inspection_role,
    pg_has_role(current_user,p.proowner,'USAGE') as migration_role_is_owner,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
    has_function_privilege('fw_user_exec',p.oid,'EXECUTE') as internal_execute,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute,
    exists (select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute,
    array(select r.rolname::text from pg_roles r
      where pg_has_role('anon',r.oid,'SET') and has_function_privilege(r.oid,p.oid,'EXECUTE')
      order by r.rolname) as anon_set_role_paths,
    array(select r.rolname::text from pg_roles r
      where pg_has_role('service_role',r.oid,'SET') and has_function_privilege(r.oid,p.oid,'EXECUTE')
      order by r.rolname) as service_role_set_role_paths,
    (select jsonb_agg(jsonb_build_object(
        'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        'grantor',pg_get_userbyid(a.grantor),'grant_option',a.is_grantable) order by a.grantee)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.privilege_type='EXECUTE') as execute_acl
  from rpc p
)
select *, case when authenticated_execute and internal_execute
  and not anon_execute and not service_role_execute and not public_execute
  and cardinality(anon_set_role_paths)=0 and cardinality(service_role_set_role_paths)=0
  then 'PASS' else 'FAIL' end as result
from evidence order by signature;
