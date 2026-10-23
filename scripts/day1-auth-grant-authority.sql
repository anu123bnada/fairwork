-- Read-only: one SELECT returning one JSON cell. Run in a fresh SQL Editor
-- query as its normal administrative role. No user rows or secrets selected.
-- This identifies THIS connection, not a previous db push connection.
with auth_schema as (
  select oid, nspowner, nspacl from pg_namespace where nspname = 'auth'
), relevant_roles as (
  select r.oid, r.rolname, r.rolsuper, r.rolcanlogin, r.rolinherit, r.rolbypassrls
  from pg_roles r
  where r.rolname in (
    'postgres', 'cli_login_postgres', 'supabase_admin', 'supabase_auth_admin',
    'fw_user_exec', 'fw_policy_exec', 'fw_schema_owner', 'authenticated', 'anon', 'service_role'
  ) or r.rolname in (current_user, session_user)
), effective_privileges as (
  select r.*,
    r.oid = n.nspowner as owns_auth_schema,
    has_schema_privilege(r.oid, n.oid, 'USAGE') as auth_usage,
    has_schema_privilege(r.oid, n.oid, 'USAGE WITH GRANT OPTION') as auth_usage_grant_option,
    has_schema_privilege(r.oid, n.oid, 'CREATE') as auth_create,
    has_function_privilege(r.oid, to_regprocedure('auth.uid()'), 'EXECUTE') as uid_execute,
    has_function_privilege(r.oid, to_regprocedure('auth.jwt()'), 'EXECUTE') as jwt_execute
  from relevant_roles r cross join auth_schema n
), schema_acl as (
  select pg_get_userbyid(a.grantor) as grantor,
    case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
    a.privilege_type, a.is_grantable
  from auth_schema n
  cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
), role_memberships as (
  select parent.rolname as granted_role, child.rolname as member,
    pg_get_userbyid(m.grantor) as grantor,
    m.admin_option, m.inherit_option, m.set_option
  from pg_auth_members m
  join pg_roles parent on parent.oid = m.roleid
  join pg_roles child on child.oid = m.member
  where child.oid in (select oid from relevant_roles)
), current_connection as (
  select current_user as effective_role, session_user as login_role,
    current_database() as database_name,
    current_setting('server_version') as server_version,
    current_setting('role', true) as role_setting,
    (select rolsuper from pg_roles where rolname = current_user) as effective_role_superuser,
    (select pg_get_userbyid(nspowner) from auth_schema) as auth_schema_owner,
    (select has_schema_privilege(current_user, oid, 'USAGE WITH GRANT OPTION') from auth_schema) as can_grant_auth_usage,
    to_regclass('supabase_migrations.schema_migrations')::text as migration_history_relation
)
select jsonb_build_object(
  'connection', (select to_jsonb(c) from current_connection c),
  'role_privileges', coalesce((select jsonb_agg(to_jsonb(p) order by p.rolname) from effective_privileges p), '[]'::jsonb),
  'auth_schema_acl', coalesce((select jsonb_agg(to_jsonb(a) order by a.grantee, a.privilege_type) from schema_acl a), '[]'::jsonb),
  'memberships', coalesce((select jsonb_agg(to_jsonb(m) order by m.member, m.granted_role) from role_memberships m), '[]'::jsonb)
) as authority_diagnostics;
