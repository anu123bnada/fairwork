-- Day 1 forward repair. No changes to Supabase-managed schemas or their ACLs.
-- The failed/unrecorded 202610080001 grant proposal is archived outside migrations.
-- Only these two scalar helpers use postgres authority; no table query or write
-- runs inside them. Existing domain functions retain their restricted owners.
begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Auth context migration requires the offline postgres identity';
  end if;
  if not has_schema_privilege('postgres', 'auth', 'USAGE')
    or not has_function_privilege('postgres', 'auth.uid()', 'EXECUTE')
    or not has_function_privilege('postgres', 'auth.jwt()', 'EXECUTE') then
    raise exception 'Offline postgres cannot call the existing Auth helpers';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if exists (select 1 from supabase_migrations.schema_migrations where version='202610080001') then
      raise exception 'The retired grant migration is recorded; review before proceeding';
    end if;
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      join (values
        ('is_active','b514b77bd87e0b444058f3e8761db251'),
        ('has_capability','2a0edd9130ab6fc7a93756a187bc0339'),
        ('consume_identity_quota','0b09eda121cd2249f554c11398673aca'),
        ('require_identity','ba9799bab071df6668712767c122ffc3'),
        ('profile_dto','85481689558e47fe1ff956668e33f933')
      ) expected(name, source_md5) on p.proname=expected.name
      where n.nspname='private' and md5(replace(p.prosrc, E'\r\n', E'\n'))=expected.source_md5) <> 5 then
    raise exception 'Identity helper source differs from reviewed foundation';
  end if;
end;
$$;

-- No arguments, dynamic SQL, table access, claim-setting, or caller-controlled
-- identifiers. STABLE (not IMMUTABLE): identity follows the current request.
create function private.request_uid() returns uuid
language sql stable security definer set search_path = '' as $$
  select auth.uid();
$$;
alter function private.request_uid() owner to postgres;
create function private.request_jwt() returns jsonb
language sql stable security definer set search_path = '' as $$
  select auth.jwt();
$$;
alter function private.request_jwt() owner to postgres;
revoke all on function private.request_uid(), private.request_jwt()
  from public, anon, authenticated, service_role, fw_schema_owner;
grant execute on function private.request_uid(), private.request_jwt()
  to fw_user_exec, fw_policy_exec;

-- CREATE OR REPLACE retains existing function ownership and EXECUTE ACLs.
-- Only Auth helper call sites change; every authorization predicate is retained.
create or replace function private.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.request_uid() is not null
    and coalesce(private.request_jwt()->>'role', '') = 'authenticated'
    and coalesce(private.request_jwt()->>'is_anonymous','false') = 'false'
    and exists (select 1 from private.profiles p where p.id=private.request_uid() and p.account_state='active' and p.deleted_at is null);
$$;

create or replace function private.has_capability(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active() and coalesce(private.request_jwt()->>'aal','') = 'aal2'
    and exists (select 1 from private.capability_assignments c where c.subject_id=private.request_uid()
      and c.capability=wanted and c.expires_at > transaction_timestamp() and c.revoked_at is null);
$$;

create or replace function private.consume_identity_quota(operation_name text) returns void
language plpgsql set search_path = '' as $$
declare total integer; ceiling integer;
begin
  if operation_name not in ('identity_read','identity_write') then raise exception 'ACTION_FORBIDDEN'; end if;
  ceiling := case when operation_name='identity_read' then 120 else 30 end;
  insert into private.rate_limit_buckets(subject_hash,operation,window_start,count,expires_at)
    values (encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex'),operation_name,date_trunc('minute',transaction_timestamp()),1,date_trunc('minute',transaction_timestamp())+interval '2 minutes')
    on conflict (subject_hash,operation,window_start) do update set count=private.rate_limit_buckets.count+1
    returning count into total;
  if total > ceiling then raise exception using errcode='P0001', message='RATE_LIMITED'; end if;
end;
$$;

create or replace function private.require_identity() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if private.request_uid() is null or coalesce(private.request_jwt()->>'role','') <> 'authenticated'
    or coalesce(private.request_jwt()->>'is_anonymous','false') <> 'false' then
    raise exception using errcode='P0001', message='AUTH_REQUIRED';
  end if;
  return private.request_uid();
end;
$$;

create or replace function private.profile_dto() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'displayName', p.display_name, 'locale', p.locale,
    'timeZone', p.time_zone, 'revision', p.revision,
    'capabilities', (select coalesce(jsonb_agg(c.name order by c.name),'[]'::jsonb)
      from (values ('authority_operator'),('review_operator'),('reviewer'),('privacy_operator')) c(name)
      where private.has_capability(c.name)))
  from private.profiles p where p.id=private.request_uid();
$$;

-- Preserve every policy's command/role/predicate, changing only Auth accessors.
alter policy profiles_policy_select on private.profiles to fw_policy_exec using (private.request_uid() is not null);
alter policy capabilities_policy_select on private.capability_assignments to fw_policy_exec using (private.request_uid() is not null);
alter policy profiles_user_select on private.profiles to fw_user_exec using (id=private.request_uid() and private.is_active());
alter policy profiles_user_insert on private.profiles to fw_user_exec with check (
  id=private.request_uid() and private.request_uid() is not null and private.request_jwt()->>'role'='authenticated'
  and coalesce(private.request_jwt()->>'is_anonymous','false')='false'
  and account_state='active' and revision=1 and deleted_at is null
);
alter policy profiles_user_update on private.profiles to fw_user_exec
  using (id=private.request_uid() and private.is_active()) with check (id=private.request_uid() and account_state='active' and deleted_at is null);
alter policy audit_user_insert on private.audit_logs to fw_user_exec with check (
  actor_id=private.request_uid() and target_id=private.request_uid() and private.is_active()
  and action in ('create_profile','update_profile') and db_time=transaction_timestamp()
);
alter policy receipts_user_select on private.command_receipts to fw_user_exec using (actor_id=private.request_uid() and private.is_active());
alter policy receipts_user_insert on private.command_receipts to fw_user_exec with check (actor_id=private.request_uid() and private.is_active());
alter policy limits_user_select on private.rate_limit_buckets to fw_user_exec using (subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex'));
alter policy limits_user_insert on private.rate_limit_buckets to fw_user_exec with check (subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex'));
alter policy limits_user_update on private.rate_limit_buckets to fw_user_exec
  using (subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex'))
  with check (subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex'));

-- Catch accidental omissions: only the two scalar wrappers may name Auth calls.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where n.nspname='private' and p.proname in ('request_uid','request_jwt')
      and (a.grantee not in ('postgres'::regrole,'fw_user_exec'::regrole,'fw_policy_exec'::regrole)
        or (a.grantee <> 'postgres'::regrole and a.is_grantable))
  ) then
    raise exception 'Unexpected Auth context helper EXECUTE grants';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('private','api') and p.proname not in ('request_uid','request_jwt')
      and (p.prosrc like '%auth.uid(%' or p.prosrc like '%auth.jwt(%')
  ) or exists (
    select 1 from pg_policies where schemaname='private'
      and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'auth[.](uid|jwt)[(]'
  ) then
    raise exception 'Unconverted direct Auth helper reference';
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
