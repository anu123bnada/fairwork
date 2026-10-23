-- Forward-only repair for the hosted catalog's missing Auth schema USAGE.
-- Apply offline with an identity authorized to grant USAGE on auth.
-- EXECUTE on auth.uid()/auth.jwt() already exists; no table access is added.
begin;

grant usage on schema auth to fw_user_exec, fw_policy_exec;

-- PostgreSQL can warn without granting when the migration identity lacks grant
-- authority. Do not record a successful migration while either grant is absent.
do $$
begin
  if not has_schema_privilege('fw_user_exec', 'auth', 'USAGE')
    or not has_schema_privilege('fw_policy_exec', 'auth', 'USAGE') then
    raise exception 'Auth schema USAGE repair requires an authorized offline grantor';
  end if;
end;
$$;

commit;
