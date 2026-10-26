begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Developer access (module 21, docs/ORYQEN_DEVELOPER_API.md). A signed-in person can create a key that lets their own
-- software call the credential verification API. The key's secret is shown once and only its SHA-256 is stored.
-- A key has a scope list (today only credentials:verify), is revocable, and is limited to 60 calls per minute.
-- Keys never read or write anyone's account data; they identify an integrator, not a user session.
create table private.developer_keys (
 id uuid primary key,
 owner_id uuid not null references private.profiles(id),
 label text not null check(char_length(label) between 1 and 60),
 secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'),
 scopes text[] not null check(scopes<@array['credentials:verify']::text[] and cardinality(scopes)>=1),
 created_at timestamptz not null default transaction_timestamp()
);
create index developer_keys_owner_idx on private.developer_keys(owner_id,created_at desc);
create table private.developer_key_events (
 id uuid primary key default gen_random_uuid(),
 key_id uuid not null references private.developer_keys(id),
 owner_id uuid not null references private.profiles(id),
 event text not null check(event in ('created','revoked')),
 at timestamptz not null default transaction_timestamp(),
 unique(key_id,event)
);
create table private.developer_key_usage (
 key_id uuid not null references private.developer_keys(id),
 window_start timestamptz not null,
 calls integer not null check(calls>0),
 primary key(key_id,window_start)
);
alter table private.developer_keys owner to fw_schema_owner;
alter table private.developer_key_events owner to fw_schema_owner;
alter table private.developer_key_usage owner to fw_schema_owner;
alter table private.developer_keys enable row level security;alter table private.developer_keys force row level security;
alter table private.developer_key_events enable row level security;alter table private.developer_key_events force row level security;
alter table private.developer_key_usage enable row level security;alter table private.developer_key_usage force row level security;
revoke all on private.developer_keys,private.developer_key_events,private.developer_key_usage from public,anon,authenticated,service_role;
grant select,insert on private.developer_keys,private.developer_key_events to fw_user_exec;
grant select on private.developer_key_usage to fw_user_exec;
create policy developer_keys_owner_read on private.developer_keys for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy developer_keys_owner_insert on private.developer_keys for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and created_at=transaction_timestamp());
create policy developer_key_events_owner_read on private.developer_key_events for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy developer_key_events_owner_insert on private.developer_key_events for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and at=transaction_timestamp());
create policy developer_key_usage_owner_read on private.developer_key_usage for select to fw_user_exec using(exists(select 1 from private.developer_keys k where k.id=key_id and k.owner_id=private.request_uid()));
create trigger developer_keys_immutable before update or delete on private.developer_keys for each row execute function private.day3_reject_history_mutation();
create trigger developer_key_events_immutable before update or delete on private.developer_key_events for each row execute function private.day3_reject_history_mutation();

-- The check runs for callers with no session (an integrator's server), so the helper is owned by the policy role, which can read
-- key rows and write usage counters only. It returns the scopes for a matching, unrevoked key and nothing about the owner.
grant select on private.developer_keys,private.developer_key_events to fw_policy_exec;
grant select,insert,update,delete on private.developer_key_usage to fw_policy_exec;
create policy developer_keys_check_read on private.developer_keys for select to fw_policy_exec using(true);
create policy developer_key_events_check_read on private.developer_key_events for select to fw_policy_exec using(true);
create policy developer_key_usage_check_all on private.developer_key_usage for all to fw_policy_exec using(true) with check(true);
grant create on schema private to fw_policy_exec;
create function private.developer_key_check(key uuid,hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare k private.developer_keys; total integer; bucket timestamptz:=date_trunc('minute',transaction_timestamp());
begin
 select * into k from private.developer_keys where id=key;
 if not found or k.secret_hash<>hash or exists(select 1 from private.developer_key_events e where e.key_id=k.id and e.event='revoked') then return jsonb_build_object('valid',false,'scopes','[]'::jsonb);end if;
 delete from private.developer_key_usage where key_id=k.id and window_start<transaction_timestamp()-interval '2 days';
 insert into private.developer_key_usage(key_id,window_start,calls) values(k.id,bucket,1) on conflict(key_id,window_start) do update set calls=private.developer_key_usage.calls+1 returning calls into total;
 if total>60 then raise exception using errcode='P0001',message='RATE_LIMITED';end if;
 return jsonb_build_object('valid',true,'scopes',to_jsonb(k.scopes));
end $$;
alter function private.developer_key_check(uuid,text) owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.developer_key_check(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.developer_key_check(uuid,text) to fw_user_exec;

create function api.developer_key_create(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['keyId','label','secretHash']; total integer; key uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or (select count(*) from jsonb_each(request) e where jsonb_typeof(e.value)<>'string')>0
  or char_length(btrim(request->>'label')) not between 1 and 60 or request->>'secretHash' !~ '^[0-9a-f]{64}$' then raise exception 'VALIDATION_FAILED';end if;
 key:=(request->>'keyId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2714));
 select count(*) into total from private.developer_keys k where k.owner_id=actor and not exists(select 1 from private.developer_key_events e where e.key_id=k.id and e.event='revoked');
 if total>=5 then raise exception 'RATE_LIMITED';end if;
 insert into private.developer_keys(id,owner_id,label,secret_hash,scopes) values(key,actor,btrim(request->>'label'),request->>'secretHash',array['credentials:verify']);
 insert into private.developer_key_events(key_id,owner_id,event) values(key,actor,'created');
 return jsonb_build_object('keyId',key,'scopes',jsonb_build_array('credentials:verify'));
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'IDEMPOTENCY_CONFLICT';end $$;

create function api.developer_key_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or request<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('keyId',k.id,'label',k.label,'scopes',to_jsonb(k.scopes),'createdAt',k.created_at,
   'revokedAt',(select e.at from private.developer_key_events e where e.key_id=k.id and e.event='revoked'),
   'callsLast24h',coalesce((select sum(u.calls) from private.developer_key_usage u where u.key_id=k.id and u.window_start>transaction_timestamp()-interval '24 hours'),0)) order by k.created_at desc,k.id),'[]') into items
  from (select * from private.developer_keys where owner_id=actor order by created_at desc,id limit 20) k;
 return jsonb_build_object('items',items);
end $$;

create function api.developer_key_revoke(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'keyId') or request-array['keyId']<>'{}' or jsonb_typeof(request->'keyId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'keyId')::uuid;
 perform private.consume_identity_quota('identity_write');
 if not exists(select 1 from private.developer_keys k where k.id=target and k.owner_id=actor) then raise exception 'NOT_FOUND';end if;
 insert into private.developer_key_events(key_id,owner_id,event) values(target,actor,'revoked') on conflict(key_id,event) do nothing;
 return jsonb_build_object('keyId',target,'status','revoked');
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

-- Public by design, like credential_status: an integrator's server has no session. It answers only whether this key id and
-- secret hash pair is currently valid, with its scopes, and counts the call against the 60-per-minute ceiling.
create function api.developer_key_check(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['keyId','secretHash']) or request-array['keyId','secretHash']<>'{}'
  or jsonb_typeof(request->'keyId') is distinct from 'string' or request->>'secretHash' !~ '^[0-9a-f]{64}$' then raise exception 'VALIDATION_FAILED';end if;
 return private.developer_key_check((request->>'keyId')::uuid,request->>'secretHash');
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.developer_key_create(jsonb) owner to fw_user_exec;
alter function api.developer_key_list(jsonb) owner to fw_user_exec;
alter function api.developer_key_revoke(jsonb) owner to fw_user_exec;
alter function api.developer_key_check(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.developer_key_create(jsonb),api.developer_key_list(jsonb),api.developer_key_revoke(jsonb),api.developer_key_check(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.developer_key_create(jsonb),api.developer_key_list(jsonb),api.developer_key_revoke(jsonb) to authenticated;
grant execute on function api.developer_key_check(jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
