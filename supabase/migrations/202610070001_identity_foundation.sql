-- Day 1 only. Apply using the offline Supabase migration identity, never a web key.
begin;

create role fw_schema_owner nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
create role fw_user_exec nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
create role fw_policy_exec nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
-- postgres is the offline infrastructure owner, outside the runtime RLS boundary.
grant fw_schema_owner, fw_user_exec, fw_policy_exec to postgres;
create schema private authorization fw_schema_owner;
create schema api authorization fw_schema_owner;
revoke all on schema private, api from public, anon, authenticated, service_role;
grant usage on schema api to authenticated;
grant usage on schema private to fw_user_exec, fw_policy_exec;
grant usage, create on schema api to fw_user_exec;
grant create on schema private to fw_user_exec, fw_policy_exec;
grant usage on schema auth to fw_user_exec, fw_policy_exec;
grant execute on function auth.uid(), auth.jwt() to fw_user_exec, fw_policy_exec;

alter default privileges for role postgres in schema private, api revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private, api revoke all on sequences from public, anon, authenticated, service_role;
-- Function EXECUTE defaults are global, not schema-local in PostgreSQL.
alter default privileges for role postgres revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role fw_schema_owner revoke execute on functions from public;
alter default privileges for role fw_user_exec revoke execute on functions from public;
alter default privileges for role fw_policy_exec revoke execute on functions from public;
alter default privileges for role fw_schema_owner in schema private, api revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role fw_schema_owner in schema private, api revoke all on sequences from public, anon, authenticated, service_role;

create table private.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80 and display_name = btrim(display_name)),
  locale text not null default 'en' check (locale = 'en'),
  time_zone text not null default 'UTC' check (char_length(time_zone) between 1 and 64),
  account_state text not null default 'active' check (account_state in ('active','suspended','deletion_pending')),
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  deleted_at timestamptz
);
alter table private.profiles owner to fw_schema_owner;

create table private.capability_assignments (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references private.profiles(id) on delete restrict,
  capability text not null check (capability in ('authority_operator','review_operator','reviewer','privacy_operator')),
  granted_by uuid not null references private.profiles(id) on delete restrict,
  purpose text not null check (char_length(btrim(purpose)) between 1 and 500),
  created_at timestamptz not null default transaction_timestamp(),
  expires_at timestamptz not null check (expires_at > created_at),
  revoked_at timestamptz check (revoked_at >= created_at)
);
alter table private.capability_assignments owner to fw_schema_owner;
create index capability_subject_idx on private.capability_assignments(subject_id, capability, expires_at) where revoked_at is null;
create index capability_granter_idx on private.capability_assignments(granted_by);

create table private.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references private.profiles(id) on delete restrict,
  action text not null check (action in ('create_profile','update_profile')),
  target_id uuid not null,
  request_id uuid not null,
  db_time timestamptz not null default transaction_timestamp(),
  changed_field_names text[] not null,
  reason_code text not null check (reason_code = 'owner_profile_command'),
  retention_class text not null check (retention_class = 'identity')
);
alter table private.audit_logs owner to fw_schema_owner;
create index audit_actor_idx on private.audit_logs(actor_id, db_time, id);

create table private.command_receipts (
  actor_id uuid not null references private.profiles(id) on delete restrict,
  command text not null check (command in ('create_profile','update_profile')),
  idempotency_key uuid not null,
  request_hash text not null check (length(request_hash) = 64),
  result_ids jsonb not null,
  response_code integer not null default 200 check (response_code = 200),
  created_at timestamptz not null default transaction_timestamp(),
  expires_at timestamptz not null default (transaction_timestamp() + interval '24 hours'),
  primary key (actor_id, command, idempotency_key),
  check (expires_at > created_at)
);
alter table private.command_receipts owner to fw_schema_owner;

create table private.rate_limit_buckets (
  subject_hash text not null,
  operation text not null check (operation in ('identity_read','identity_write')),
  window_start timestamptz not null,
  count integer not null check (count > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default transaction_timestamp(),
  primary key (subject_hash, operation, window_start),
  check (expires_at > window_start)
);
alter table private.rate_limit_buckets owner to fw_schema_owner;

revoke all on all tables in schema private from public, anon, authenticated, service_role;
revoke all on all sequences in schema private from public, anon, authenticated, service_role;
alter table private.profiles enable row level security;
alter table private.profiles force row level security;
alter table private.capability_assignments enable row level security;
alter table private.capability_assignments force row level security;
alter table private.audit_logs enable row level security;
alter table private.audit_logs force row level security;
alter table private.command_receipts enable row level security;
alter table private.command_receipts force row level security;
alter table private.rate_limit_buckets enable row level security;
alter table private.rate_limit_buckets force row level security;

-- Nonrecursive metadata-only helper policies. Never expose these helpers as RPCs.
grant select (id, account_state, deleted_at) on private.profiles to fw_policy_exec;
grant select (subject_id, capability, expires_at, revoked_at) on private.capability_assignments to fw_policy_exec;
create policy profiles_policy_select on private.profiles for select to fw_policy_exec using (auth.uid() is not null);
create policy capabilities_policy_select on private.capability_assignments for select to fw_policy_exec using (auth.uid() is not null);

create function private.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and coalesce(auth.jwt()->>'role', '') = 'authenticated'
    and coalesce(auth.jwt()->>'is_anonymous','false') = 'false'
    and exists (select 1 from private.profiles p where p.id=auth.uid() and p.account_state='active' and p.deleted_at is null);
$$;
alter function private.is_active() owner to fw_policy_exec;

create function private.has_capability(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active() and coalesce(auth.jwt()->>'aal','') = 'aal2'
    and exists (select 1 from private.capability_assignments c where c.subject_id=auth.uid()
      and c.capability=wanted and c.expires_at > transaction_timestamp() and c.revoked_at is null);
$$;
alter function private.has_capability(text) owner to fw_policy_exec;
revoke all on function private.is_active(), private.has_capability(text) from public, anon, authenticated, service_role;
grant execute on function private.is_active(), private.has_capability(text) to fw_user_exec;

grant select on private.profiles to fw_user_exec;
grant insert (id, display_name, locale, time_zone) on private.profiles to fw_user_exec;
grant update (display_name, locale, time_zone) on private.profiles to fw_user_exec;
create policy profiles_user_select on private.profiles for select to fw_user_exec using (id=auth.uid() and private.is_active());
create policy profiles_user_insert on private.profiles for insert to fw_user_exec with check (
  id=auth.uid() and auth.uid() is not null and auth.jwt()->>'role'='authenticated'
  and coalesce(auth.jwt()->>'is_anonymous','false')='false'
  and account_state='active' and revision=1 and deleted_at is null
);
create policy profiles_user_update on private.profiles for update to fw_user_exec
  using (id=auth.uid() and private.is_active()) with check (id=auth.uid() and account_state='active' and deleted_at is null);

create function private.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception using errcode='P0001', message='ACTION_FORBIDDEN';
  end if;
  if current_user='fw_user_exec' and (new.account_state is distinct from old.account_state or new.deleted_at is distinct from old.deleted_at) then
    raise exception using errcode='P0001', message='ACTION_FORBIDDEN';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := transaction_timestamp();
  return new;
end;
$$;
alter function private.guard_profile() owner to fw_schema_owner;
create trigger profiles_guard before update on private.profiles for each row execute function private.guard_profile();

grant insert on private.audit_logs to fw_user_exec;
create policy audit_user_insert on private.audit_logs for insert to fw_user_exec with check (
  actor_id=auth.uid() and target_id=auth.uid() and private.is_active()
  and action in ('create_profile','update_profile') and db_time=transaction_timestamp()
);
grant select, insert on private.command_receipts to fw_user_exec;
create policy receipts_user_select on private.command_receipts for select to fw_user_exec using (actor_id=auth.uid() and private.is_active());
create policy receipts_user_insert on private.command_receipts for insert to fw_user_exec with check (actor_id=auth.uid() and private.is_active());

grant select, insert, update (count) on private.rate_limit_buckets to fw_user_exec;
create policy limits_user_select on private.rate_limit_buckets for select to fw_user_exec using (subject_hash=encode(sha256(convert_to(auth.uid()::text,'UTF8')),'hex'));
create policy limits_user_insert on private.rate_limit_buckets for insert to fw_user_exec with check (subject_hash=encode(sha256(convert_to(auth.uid()::text,'UTF8')),'hex'));
create policy limits_user_update on private.rate_limit_buckets for update to fw_user_exec
  using (subject_hash=encode(sha256(convert_to(auth.uid()::text,'UTF8')),'hex'))
  with check (subject_hash=encode(sha256(convert_to(auth.uid()::text,'UTF8')),'hex'));

create function private.consume_identity_quota(operation_name text) returns void
language plpgsql set search_path = '' as $$
declare total integer; ceiling integer;
begin
  if operation_name not in ('identity_read','identity_write') then raise exception 'ACTION_FORBIDDEN'; end if;
  ceiling := case when operation_name='identity_read' then 120 else 30 end;
  insert into private.rate_limit_buckets(subject_hash,operation,window_start,count,expires_at)
    values (encode(sha256(convert_to(auth.uid()::text,'UTF8')),'hex'),operation_name,date_trunc('minute',transaction_timestamp()),1,date_trunc('minute',transaction_timestamp())+interval '2 minutes')
    on conflict (subject_hash,operation,window_start) do update set count=private.rate_limit_buckets.count+1
    returning count into total;
  if total > ceiling then raise exception using errcode='P0001', message='RATE_LIMITED'; end if;
end;
$$;
alter function private.consume_identity_quota(text) owner to fw_user_exec;

create function private.require_identity() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'role','') <> 'authenticated'
    or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' then
    raise exception using errcode='P0001', message='AUTH_REQUIRED';
  end if;
  return auth.uid();
end;
$$;
alter function private.require_identity() owner to fw_user_exec;

create function private.profile_dto() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'displayName', p.display_name, 'locale', p.locale,
    'timeZone', p.time_zone, 'revision', p.revision,
    'capabilities', (select coalesce(jsonb_agg(c.name order by c.name),'[]'::jsonb)
      from (values ('authority_operator'),('review_operator'),('reviewer'),('privacy_operator')) c(name)
      where private.has_capability(c.name)))
  from private.profiles p where p.id=auth.uid();
$$;
alter function private.profile_dto() owner to fw_user_exec;

create function private.validate_profile_input(request jsonb, is_update boolean) returns void
language plpgsql set search_path = '' as $$
declare allowed text[] := array['displayName','locale','timeZone','idempotencyKey'];
begin
  if is_update then allowed := allowed || 'expectedRevision'::text; end if;
  if request is null or jsonb_typeof(request) <> 'object' then raise exception 'VALIDATION_FAILED'; end if;
  if not (request ?& allowed) or exists (select 1 from jsonb_object_keys(request) k where not (k=any(allowed))) then raise exception 'VALIDATION_FAILED'; end if;
  if jsonb_typeof(request->'displayName') <> 'string' or char_length(btrim(request->>'displayName')) not between 1 and 80
    or request->>'displayName' <> btrim(request->>'displayName')
    or jsonb_typeof(request->'locale') <> 'string' or request->>'locale' <> 'en' or jsonb_typeof(request->'timeZone') <> 'string'
    or not exists (select 1 from pg_catalog.pg_timezone_names where name=request->>'timeZone')
    or jsonb_typeof(request->'idempotencyKey') <> 'string'
    or request->>'idempotencyKey' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then raise exception 'VALIDATION_FAILED'; end if;
  if is_update and (jsonb_typeof(request->'expectedRevision') <> 'number' or request->>'expectedRevision' !~ '^[1-9][0-9]{0,14}$') then raise exception 'VALIDATION_FAILED'; end if;
end;
$$;
alter function private.validate_profile_input(jsonb,boolean) owner to fw_user_exec;

create function api.get_me(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_identity();
  if request is distinct from '{}'::jsonb then raise exception 'VALIDATION_FAILED'; end if;
  if not private.is_active() then raise exception 'NOT_FOUND'; end if;
  perform private.consume_identity_quota('identity_read');
  result := private.profile_dto();
  if result is null then raise exception 'NOT_FOUND'; end if;
  return result;
end;
$$;
alter function api.get_me(jsonb) owner to fw_user_exec;

create function api.create_profile(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare caller uuid; key uuid; digest text; receipt private.command_receipts%rowtype;
begin
  caller := private.require_identity();
  perform private.validate_profile_input(request,false);
  key := (request->>'idempotencyKey')::uuid;
  digest := encode(sha256(convert_to(request::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  perform private.consume_identity_quota('identity_write');
  if private.is_active() then
    select * into receipt from private.command_receipts where actor_id=caller and command='create_profile' and idempotency_key=key;
    if found then
      if receipt.request_hash<>digest or receipt.expires_at<=transaction_timestamp() then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
      return private.profile_dto();
    end if;
    raise exception 'VERSION_CONFLICT';
  end if;
  begin
    insert into private.profiles(id,display_name,locale,time_zone) values(caller,request->>'displayName',request->>'locale',request->>'timeZone');
  exception when unique_violation then
    -- Suspended/deleted accounts cannot bootstrap themselves back to active.
    raise exception 'ACTION_FORBIDDEN';
  end;
  insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class)
    values(caller,'create_profile',caller,key,array['display_name','locale','time_zone'],'owner_profile_command','identity');
  insert into private.command_receipts(actor_id,command,idempotency_key,request_hash,result_ids)
    values(caller,'create_profile',key,digest,jsonb_build_object('profileId',caller));
  return private.profile_dto();
end;
$$;
alter function api.create_profile(jsonb) owner to fw_user_exec;

create function api.update_profile(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare caller uuid; key uuid; digest text; current_revision bigint; receipt private.command_receipts%rowtype;
begin
  caller := private.require_identity();
  perform private.validate_profile_input(request,true);
  key := (request->>'idempotencyKey')::uuid;
  digest := encode(sha256(convert_to(request::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
  select revision into current_revision from private.profiles where id=caller for update;
  if not found or not private.is_active() then raise exception 'NOT_FOUND'; end if;
  perform private.consume_identity_quota('identity_write');
  select * into receipt from private.command_receipts where actor_id=caller and command='update_profile' and idempotency_key=key;
  if found then
    if receipt.request_hash<>digest or receipt.expires_at<=transaction_timestamp() then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return private.profile_dto();
  end if;
  if current_revision<>(request->>'expectedRevision')::bigint then raise exception 'VERSION_CONFLICT'; end if;
  update private.profiles set display_name=request->>'displayName',locale=request->>'locale',time_zone=request->>'timeZone' where id=caller;
  insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class)
    values(caller,'update_profile',caller,key,array['display_name','locale','time_zone'],'owner_profile_command','identity');
  insert into private.command_receipts(actor_id,command,idempotency_key,request_hash,result_ids)
    values(caller,'update_profile',key,digest,jsonb_build_object('profileId',caller));
  return private.profile_dto();
end;
$$;
alter function api.update_profile(jsonb) owner to fw_user_exec;

create function private.reject_history_edit() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode='P0001', message='ACTION_FORBIDDEN';
end;
$$;
alter function private.reject_history_edit() owner to fw_schema_owner;
create trigger audit_immutable before update or delete on private.audit_logs for each row execute function private.reject_history_edit();
create trigger receipts_immutable before update or delete on private.command_receipts for each row execute function private.reject_history_edit();
-- A future scoped retention migration may add the documented privacy exception;
-- there is no generic purge/update function in the Day 1 runtime.

create function private.guard_capability() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at')
    or old.revoked_at is not null or new.revoked_at is null then
    raise exception using errcode='P0001', message='ACTION_FORBIDDEN';
  end if;
  return new;
end;
$$;
alter function private.guard_capability() owner to fw_schema_owner;
create trigger capability_immutable before update on private.capability_assignments for each row execute function private.guard_capability();

-- Explicit exact-signature allowlist, applied atomically with creation.
revoke all on all functions in schema private, api from public, anon, authenticated, service_role;
grant execute on function private.is_active(), private.has_capability(text) to fw_user_exec;
grant execute on function api.create_profile(jsonb), api.get_me(jsonb), api.update_profile(jsonb) to authenticated;
revoke create on schema private from fw_user_exec, fw_policy_exec;
revoke create on schema api from fw_user_exec;
notify pgrst, 'reload schema';
commit;
