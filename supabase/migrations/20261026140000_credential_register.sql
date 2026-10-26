begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Register of verifiable credentials the application has issued (module 18, docs/ORYQEN_CREDENTIALS_DESIGN.md).
-- The signature, not this register, is what makes a credential trustworthy; the register exists so the holder
-- can list and revoke credentials, and so anyone can ask whether a credential is still valid. Validity is
-- computed live from the source work record: if the record stops being verified (retraction, withdrawal,
-- correction) every credential built on it stops verifying. Nothing here stores keys.
create table private.credentials (
 id uuid primary key,
 holder_id uuid not null references private.profiles(id),
 source_kind text not null check(source_kind='work_record'),
 source_id uuid not null, source_version integer not null check(source_version>0),
 claim_ref text not null check(claim_ref ~ '^[0-9a-f]{64}$'),
 assurance text not null check(assurance='independently_reviewed'),
 key_id text not null check(char_length(key_id) between 1 and 64),
 token text not null check(char_length(token) between 100 and 4096 and token ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'),
 idempotency_key uuid not null,
 issued_at timestamptz not null default transaction_timestamp(),
 expires_at timestamptz not null check(expires_at>issued_at and expires_at<=issued_at+interval '366 days'),
 unique(holder_id,idempotency_key)
);
create index credentials_holder_idx on private.credentials(holder_id,issued_at desc);
create index credentials_source_idx on private.credentials(source_id,source_version);
create table private.credential_events (
 id uuid primary key default gen_random_uuid(),
 credential_id uuid not null references private.credentials(id),
 holder_id uuid not null references private.profiles(id),
 event text not null check(event in ('issued','revoked')),
 reason text check(reason is null or reason='holder_requested'),
 at timestamptz not null default transaction_timestamp(),
 unique(credential_id,event)
);
alter table private.credentials owner to fw_schema_owner;
alter table private.credential_events owner to fw_schema_owner;
alter table private.credentials enable row level security;alter table private.credentials force row level security;
alter table private.credential_events enable row level security;alter table private.credential_events force row level security;
revoke all on private.credentials,private.credential_events from public,anon,authenticated,service_role;
grant select,insert on private.credentials,private.credential_events to fw_user_exec;
create policy credentials_holder_read on private.credentials for select to fw_user_exec using(private.is_active() and holder_id=private.request_uid());
create policy credentials_holder_insert on private.credentials for insert to fw_user_exec with check(private.is_active() and holder_id=private.request_uid() and issued_at=transaction_timestamp());
create policy credential_events_holder_read on private.credential_events for select to fw_user_exec using(private.is_active() and holder_id=private.request_uid());
create policy credential_events_holder_insert on private.credential_events for insert to fw_user_exec with check(private.is_active() and holder_id=private.request_uid() and at=transaction_timestamp());
create trigger credentials_immutable before update or delete on private.credentials for each row execute function private.day3_reject_history_mutation();
create trigger credential_events_immutable before update or delete on private.credential_events for each row execute function private.day3_reject_history_mutation();

-- The public status check must work for anonymous verifiers, so it runs through helpers owned by the
-- policy role, which can read only these columns: no names, content, evidence or identities.
grant select on private.credentials,private.credential_events to fw_policy_exec;
create policy credentials_status_read on private.credentials for select to fw_policy_exec using(true);
create policy credential_events_status_read on private.credential_events for select to fw_policy_exec using(true);
grant select(work_id,version,state) on private.work_record_versions to fw_policy_exec;
create policy credential_work_versions_status on private.work_record_versions for select to fw_policy_exec using(true);
grant select(work_id,version,operation) on private.work_integrity_events to fw_policy_exec;
create policy credential_work_events_status on private.work_integrity_events for select to fw_policy_exec using(true);

grant create on schema private to fw_policy_exec;
create function private.credential_source_state(work uuid,ver integer) returns text language sql stable security definer set search_path='' as $$
 select case
  when not exists(select 1 from private.work_record_versions v where v.work_id=work and v.version=ver and v.state='verified') then 'changed'
  when exists(select 1 from private.work_integrity_events e where e.work_id=work and (e.operation='withdraw' or (e.version=ver and e.operation in ('retract','correct')))) then 'changed'
  else 'current' end;
$$;
create function private.credential_status(credential uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.credentials;
begin
 select * into c from private.credentials where id=credential;
 if not found then return jsonb_build_object('status','unknown','reason',null);end if;
 if exists(select 1 from private.credential_events e where e.credential_id=c.id and e.event='revoked') then return jsonb_build_object('status','revoked','reason','holder_requested');end if;
 if transaction_timestamp()>=c.expires_at then return jsonb_build_object('status','expired','reason',null);end if;
 if private.credential_source_state(c.source_id,c.source_version)<>'current' then return jsonb_build_object('status','revoked','reason','source_changed');end if;
 return jsonb_build_object('status','valid','reason',null);
end $$;
alter function private.credential_source_state(uuid,integer) owner to fw_policy_exec;
alter function private.credential_status(uuid) owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.credential_source_state(uuid,integer),private.credential_status(uuid) from public,anon,authenticated,service_role;
grant execute on function private.credential_source_state(uuid,integer),private.credential_status(uuid) to fw_user_exec;

create function api.credential_register(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['credentialId','sourceId','sourceVersion','claimRef','assurance','expiresAt','keyId','token','idempotencyKey']; record_json jsonb; version_json jsonb; prior private.credentials; issued_at timestamptz; expiry timestamptz; source uuid; ver integer; total integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or (select count(*) from jsonb_each(request) e where jsonb_typeof(e.value)<>'string' and e.key<>'sourceVersion')>0
  or jsonb_typeof(request->'sourceVersion') is distinct from 'number' or request->>'sourceVersion' !~ '^[1-9][0-9]{0,8}$'
  or request->>'assurance'<>'independently_reviewed' or request->>'claimRef' !~ '^[0-9a-f]{64}$'
  or char_length(request->>'token') not between 100 and 4096 or request->>'token' !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
  or char_length(request->>'keyId') not between 1 and 64 then raise exception 'VALIDATION_FAILED';end if;
 source:=(request->>'sourceId')::uuid;ver:=(request->>'sourceVersion')::integer;expiry:=(request->>'expiresAt')::timestamptz;
 if expiry<=transaction_timestamp() or expiry>transaction_timestamp()+interval '365 days' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2614));
 select * into prior from private.credentials where holder_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.source_id<>source or prior.source_version<>ver or prior.claim_ref<>request->>'claimRef' then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('credentialId',prior.id,'token',prior.token,'expiresAt',prior.expires_at,'replayed',true);
 end if;
 -- Reauthorize against the live work record: the caller must be its worker, the version must be the verified, current one,
 -- and the claim reference must be the one derived from the stored content hash.
 record_json:=api.read_work(jsonb_build_object('workId',source));
 if (record_json->>'workerId')::uuid<>actor or (record_json->>'currentVersion')::integer<>ver then raise exception 'ACTION_FORBIDDEN';end if;
 select v into version_json from jsonb_array_elements(record_json->'versions') v where (v->>'version')::integer=ver;
 if version_json is null or version_json->>'state'<>'verified' or private.credential_source_state(source,ver)<>'current' then raise exception 'VERSION_CONFLICT';end if;
 if encode(sha256(convert_to('oryqen-trust-claim.v1|work_record|'||source::text||'|'||ver::text||'|'||(version_json->>'contentHash'),'utf8')),'hex')<>request->>'claimRef' then raise exception 'VERSION_CONFLICT';end if;
 select count(*) into total from private.credentials c where c.holder_id=actor and c.expires_at>transaction_timestamp() and not exists(select 1 from private.credential_events e where e.credential_id=c.id and e.event='revoked');
 if total>=50 then raise exception 'RATE_LIMITED';end if;
 insert into private.credentials(id,holder_id,source_kind,source_id,source_version,claim_ref,assurance,key_id,token,idempotency_key,expires_at)
  values((request->>'credentialId')::uuid,actor,'work_record',source,ver,request->>'claimRef','independently_reviewed',request->>'keyId',request->>'token',(request->>'idempotencyKey')::uuid,expiry);
 insert into private.credential_events(credential_id,holder_id,event) values((request->>'credentialId')::uuid,actor,'issued');
 return jsonb_build_object('credentialId',(request->>'credentialId')::uuid,'token',request->>'token','expiresAt',expiry,'replayed',false);
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then raise exception 'VALIDATION_FAILED';end $$;

create function api.credential_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or request<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('credentialId',c.id,'sourceId',c.source_id,'sourceVersion',c.source_version,'assurance',c.assurance,'issuedAt',c.issued_at,'expiresAt',c.expires_at,'token',c.token,
   'status',private.credential_status(c.id)->>'status','reason',private.credential_status(c.id)->'reason') order by c.issued_at desc,c.id),'[]') into items
  from (select * from private.credentials where holder_id=actor order by issued_at desc,id limit 50) c;
 return jsonb_build_object('items',items);
end $$;

create function api.credential_revoke(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; owned boolean;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'credentialId') or request-array['credentialId']<>'{}' or jsonb_typeof(request->'credentialId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'credentialId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2614));
 select exists(select 1 from private.credentials c where c.id=target and c.holder_id=actor) into owned;
 if not owned then raise exception 'NOT_FOUND';end if;
 insert into private.credential_events(credential_id,holder_id,event,reason) values(target,actor,'revoked','holder_requested') on conflict(credential_id,event) do nothing;
 return jsonb_build_object('credentialId',target,'status','revoked');
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.credential_status(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'credentialId') or request-array['credentialId']<>'{}' or jsonb_typeof(request->'credentialId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 return private.credential_status((request->>'credentialId')::uuid)||jsonb_build_object('checkedAt',transaction_timestamp());
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.credential_register(jsonb) owner to fw_user_exec;
alter function api.credential_list(jsonb) owner to fw_user_exec;
alter function api.credential_revoke(jsonb) owner to fw_user_exec;
alter function api.credential_status(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.credential_register(jsonb),api.credential_list(jsonb),api.credential_revoke(jsonb),api.credential_status(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.credential_register(jsonb),api.credential_list(jsonb),api.credential_revoke(jsonb) to authenticated;
-- Public by design: it returns only valid, revoked, expired or unknown for an unguessable credential id.
-- Anonymous verifiers need schema USAGE to call it; every other api function is individually revoked from anon.
grant usage on schema api to anon;
grant execute on function api.credential_status(jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
