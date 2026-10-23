-- Correct only the three Day 1 RPC ACLs. Preserve their owners, bodies and
-- authenticated/internal grants. Do not change managed Auth or private data.
begin;

revoke execute on function
  api.create_profile(jsonb), api.get_me(jsonb), api.update_profile(jsonb)
from public, anon, service_role restrict;

-- REVOKE of a direct ACL cannot remove inherited privileges. Fail atomically
-- if a prohibited caller still has access, including a SET ROLE membership
-- path. Investigate such drift separately; never rewrite memberships here.
do $$
begin
  if exists (
    select 1 from pg_proc p
    where p.oid in ('api.create_profile(jsonb)'::regprocedure,
                    'api.get_me(jsonb)'::regprocedure,
                    'api.update_profile(jsonb)'::regprocedure)
      and (
        not has_function_privilege('authenticated',p.oid,'EXECUTE')
        or not has_function_privilege('fw_user_exec',p.oid,'EXECUTE')
        or exists (
          select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          where a.grantee=0 and a.privilege_type='EXECUTE'
        )
        or exists (
          select 1 from pg_roles denied
          where denied.rolname in ('anon','service_role') and (
            has_function_privilege(denied.oid,p.oid,'EXECUTE')
            or exists (
              select 1 from pg_roles reachable
              where pg_has_role(denied.oid,reachable.oid,'SET')
                and has_function_privilege(reachable.oid,p.oid,'EXECUTE')
            )
          )
        )
      )
  ) then
    raise exception 'RPC EXECUTE repair failed: required access missing or prohibited client access remains';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
