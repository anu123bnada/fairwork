-- Read-only before/after evidence for the narrowly scoped RPC EXECUTE repair.
-- Run the same complete SELECT before and after applying 202610090001.
-- Compare security_boundary JSON structurally: it must remain identical.
-- The only excluded ACLs are the three RPCs intentionally repaired; verify those
-- separately with day1-rpc-execute-check.sql. No application rows, function
-- source text, configuration values, credentials, timestamps or history writes
-- are selected. Body/configuration hashes still detect changes to those values.
-- Ephemeral CLI login roles are excluded from the membership inventory.
with selected_roles as (
  select oid, rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
    rolcanlogin, rolreplication, rolbypassrls, rolconnlimit,
    md5(coalesce(rolconfig::text, 'null')) as configuration_md5
  from pg_roles
  where rolname in ('postgres', 'authenticator', 'anon', 'authenticated',
    'service_role', 'fw_schema_owner', 'fw_user_exec', 'fw_policy_exec')
), schemas as (
  select n.* from pg_namespace n where n.nspname in ('auth', 'private', 'api')
), functions as (
  select p.*, n.nspname,
    p.oid in ('api.create_profile(jsonb)'::regprocedure,
      'api.get_me(jsonb)'::regprocedure,
      'api.update_profile(jsonb)'::regprocedure) as rpc_acl_excluded
  from pg_proc p join schemas n on n.oid=p.pronamespace
), private_tables as (
  select c.* from pg_class c join schemas n on n.oid=c.relnamespace
  where n.nspname='private' and c.relkind in ('r', 'p')
)
select jsonb_build_object(
  'schemas', (
    select jsonb_agg(jsonb_build_object(
      'name', n.nspname,
      'owner', pg_get_userbyid(n.nspowner),
      'acl', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'grantee', case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
          'grantor', pg_get_userbyid(a.grantor),
          'privilege', a.privilege_type, 'grantable', a.is_grantable
        ) order by a.grantee, a.grantor, a.privilege_type), '[]'::jsonb)
        from aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
      )
    ) order by n.nspname) from schemas n
  ),
  'private_tables', (
    select jsonb_agg(jsonb_build_object(
      'name', c.relname, 'kind', c.relkind,
      'owner', pg_get_userbyid(c.relowner),
      'rls_enabled', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
      'acl', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'grantee', case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
          'grantor', pg_get_userbyid(a.grantor),
          'privilege', a.privilege_type, 'grantable', a.is_grantable
        ) order by a.grantee, a.grantor, a.privilege_type), '[]'::jsonb)
        from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      ),
      'columns', (
        select jsonb_agg(jsonb_build_object(
          'name', col.attname,
          'acl', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'grantee', case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
              'grantor', pg_get_userbyid(a.grantor),
              'privilege', a.privilege_type, 'grantable', a.is_grantable
            ) order by a.grantee, a.grantor, a.privilege_type), '[]'::jsonb)
            from aclexplode(col.attacl) a
          )
        ) order by col.attnum)
        from pg_attribute col
        where col.attrelid=c.oid and col.attnum>0 and not col.attisdropped
      )
    ) order by c.relname) from private_tables c
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'schema', p.nspname, 'name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'result', pg_get_function_result(p.oid),
      'owner', pg_get_userbyid(p.proowner),
      'language', l.lanname,
      'kind', p.prokind, 'security_definer', p.prosecdef,
      'leakproof', p.proleakproof, 'strict', p.proisstrict,
      'volatility', p.provolatile, 'parallel', p.proparallel,
      'returns_set', p.proretset,
      'configuration_md5', md5(coalesce(p.proconfig::text, 'null')),
      'source_md5', md5(replace(p.prosrc, E'\r\n', E'\n')),
      'binary_md5', md5(coalesce(p.probin, 'null')),
      'sql_body_md5', md5(coalesce(p.prosqlbody::text, 'null')),
      'argument_defaults_md5', md5(coalesce(p.proargdefaults::text, 'null')),
      'rpc_acl_excluded', p.rpc_acl_excluded,
      'acl', case when p.rpc_acl_excluded then null else (
        select coalesce(jsonb_agg(jsonb_build_object(
          'grantee', case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
          'grantor', pg_get_userbyid(a.grantor),
          'privilege', a.privilege_type, 'grantable', a.is_grantable
        ) order by a.grantee, a.grantor, a.privilege_type), '[]'::jsonb)
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      ) end
    ) order by p.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from functions p join pg_language l on l.oid=p.prolang
  ),
  'policies', (
    select jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname)
    from pg_policies p where p.schemaname='private'
  ),
  'triggers', (
    select jsonb_agg(jsonb_build_object(
      'table', c.relname, 'name', t.tgname, 'enabled', t.tgenabled,
      'internal', t.tgisinternal,
      'function', t.tgfoid::regprocedure::text,
      'definition_md5', md5(pg_get_triggerdef(t.oid, true))
    ) order by c.relname, t.tgname)
    from pg_trigger t join private_tables c on c.oid=t.tgrelid
  ),
  'roles', (
    select jsonb_agg(to_jsonb(r)-'oid' order by r.rolname) from selected_roles r
  ),
  'memberships', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'member', member.rolname, 'role', pg_get_userbyid(m.roleid),
      'grantor', pg_get_userbyid(m.grantor),
      'admin_option', m.admin_option, 'inherit_option', m.inherit_option,
      'set_option', m.set_option
    ) order by member.rolname, pg_get_userbyid(m.roleid), pg_get_userbyid(m.grantor)), '[]'::jsonb)
    from pg_auth_members m join selected_roles member on member.oid=m.member
  )
) as security_boundary;
