-- Self-service access deactivation, not data erasure or Auth-user deletion.
-- Separate immutable receipt; no changes to existing audit vocabularies.
begin;
create role fw_deactivation_exec nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant fw_deactivation_exec to postgres;
grant usage on schema private,api to fw_deactivation_exec;
grant create on schema api to fw_deactivation_exec;
grant create on schema private to fw_user_exec;
grant execute on function private.request_uid(),private.request_jwt(),private.require_identity() to fw_deactivation_exec;
grant select(id,account_state,deleted_at,revision),update(account_state) on private.profiles to fw_deactivation_exec;
create policy profiles_deactivation_read on private.profiles for select to fw_deactivation_exec using(id=private.request_uid());
create policy profiles_deactivation_update on private.profiles for update to fw_deactivation_exec
 using(id=private.request_uid() and account_state='active' and deleted_at is null and private.request_jwt()->>'aal'='aal2')
 with check(id=private.request_uid() and account_state='suspended' and deleted_at is null);

create table private.account_deactivations(
 actor_id uuid primary key references private.profiles(id) on delete restrict,
 request_id uuid not null unique,
 previous_revision bigint not null check(previous_revision>=1),
 recorded_at timestamptz not null default transaction_timestamp(),
 reason text not null default 'owner_deactivation' check(reason='owner_deactivation')
);
alter table private.account_deactivations owner to fw_schema_owner;
alter table private.account_deactivations enable row level security;
alter table private.account_deactivations force row level security;
revoke all on private.account_deactivations from public,anon,authenticated,service_role;
grant select,insert on private.account_deactivations to fw_deactivation_exec;
create policy deactivation_owner_read on private.account_deactivations for select to fw_deactivation_exec using(actor_id=private.request_uid());
create policy deactivation_owner_insert on private.account_deactivations for insert to fw_deactivation_exec
 with check(actor_id=private.request_uid() and private.request_jwt()->>'aal'='aal2' and recorded_at=transaction_timestamp());
create trigger account_deactivation_immutable before update or delete on private.account_deactivations for each row execute function private.reject_history_edit();

create function private.consume_deactivation_quota(op text) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_identity();perform private.consume_identity_quota(op);end $$;
alter function private.consume_deactivation_quota(text) owner to fw_user_exec;
revoke all on function private.consume_deactivation_quota(text) from public,anon,authenticated,service_role;
grant execute on function private.consume_deactivation_quota(text) to fw_deactivation_exec;

-- Distinguish an uninitialized profile from a disabled account only AFTER Auth
-- verifies the credentials. No email/subject argument or cross-account lookup.
create function api.account_access(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare state text;removed timestamptz;
begin
 perform private.require_identity();
 if request is distinct from '{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_deactivation_quota('identity_read');
 select account_state,deleted_at into state,removed from private.profiles where id=private.request_uid();
 return jsonb_build_object('access',case when not found then 'needs_profile' when state='active' and removed is null then 'active' else 'disabled' end);
end $$;
alter function api.account_access(jsonb) owner to fw_deactivation_exec;

create function api.deactivate_account(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;key uuid;expected bigint;state text;current_revision bigint;removed timestamptz;receipt private.account_deactivations%rowtype;
begin
 caller:=private.require_identity();
 if coalesce(private.request_jwt()->>'aal','')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['expectedRevision','confirmation','idempotencyKey']) or request-array['expectedRevision','confirmation','idempotencyKey']<>'{}' or request->>'confirmation' is distinct from 'DEACTIVATE' or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^[1-9][0-9]{0,14}$' or jsonb_typeof(request->'idempotencyKey') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 key:=(request->>'idempotencyKey')::uuid;expected:=(request->>'expectedRevision')::bigint;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
 perform private.consume_deactivation_quota('identity_write');
 select account_state,revision,deleted_at into state,current_revision,removed from private.profiles where id=caller for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into receipt from private.account_deactivations where actor_id=caller;
 if found then
  if receipt.request_id<>key or receipt.previous_revision<>expected then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  if state<>'suspended' then raise exception 'ACTION_FORBIDDEN';end if;
  return jsonb_build_object('deactivated',true,'recordedAt',receipt.recorded_at,'revision',receipt.previous_revision+1);
 end if;
 if state<>'active' or removed is not null then raise exception 'ACTION_FORBIDDEN';end if;
 if current_revision<>expected then raise exception 'VERSION_CONFLICT';end if;
 update private.profiles set account_state='suspended' where id=caller;
 insert into private.account_deactivations(actor_id,request_id,previous_revision) values(caller,key,expected) returning * into receipt;
 return jsonb_build_object('deactivated',true,'recordedAt',receipt.recorded_at,'revision',expected+1);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';end $$;
alter function api.deactivate_account(jsonb) owner to fw_deactivation_exec;
revoke all on function api.account_access(jsonb),api.deactivate_account(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.account_access(jsonb),api.deactivate_account(jsonb) to authenticated;
revoke create on schema private from fw_user_exec;
revoke create on schema api from fw_deactivation_exec;
notify pgrst,'reload schema';
commit;
