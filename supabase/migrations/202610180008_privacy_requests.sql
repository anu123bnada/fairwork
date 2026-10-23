begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Request tracking only. No Auth deletion, profile lifecycle mutation or data purge.
create role fw_privacy_exec nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant fw_privacy_exec to postgres;
grant usage on schema api,private to fw_privacy_exec;
grant execute on function private.request_uid(),private.request_jwt(),private.require_identity(),private.is_active(),private.has_capability(text),private.consume_identity_quota(text) to fw_privacy_exec;

create table private.privacy_requests (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null references private.profiles(id),
 kind text not null check(kind in ('access','correction','deactivation','deletion')),
 scope text not null check(char_length(btrim(scope)) between 1 and 500),
 idempotency_key uuid not null, created_at timestamptz not null default transaction_timestamp(),
 unique(subject_id,idempotency_key)
);
create table private.privacy_request_events (
 request_id uuid not null references private.privacy_requests(id), revision integer not null check(revision between 1 and 20),
 actor_id uuid not null references private.profiles(id), status text not null check(status in ('in_review','needs_information','fulfilled','declined','withdrawn')),
 note text not null check(char_length(btrim(note)) between 1 and 500),
 evidence_ref text check(evidence_ref is null or char_length(btrim(evidence_ref)) between 10 and 200),
 idempotency_key uuid not null, created_at timestamptz not null default transaction_timestamp(),
 primary key(request_id,revision), unique(actor_id,idempotency_key),
 check((status='fulfilled')=(evidence_ref is not null))
);
create index privacy_owner_page on private.privacy_requests(subject_id,id);
alter table private.privacy_requests enable row level security;
alter table private.privacy_requests force row level security;
alter table private.privacy_request_events enable row level security;
alter table private.privacy_request_events force row level security;
grant select,insert on private.privacy_requests,private.privacy_request_events to fw_user_exec;
grant select on private.privacy_requests to fw_privacy_exec;
grant select,insert on private.privacy_request_events to fw_privacy_exec;
create policy privacy_owner_read on private.privacy_requests for select to fw_user_exec using(private.is_active() and subject_id=private.request_uid());
create policy privacy_owner_create on private.privacy_requests for insert to fw_user_exec with check(private.is_active() and subject_id=private.request_uid() and created_at=transaction_timestamp());
create policy privacy_owner_events on private.privacy_request_events for select to fw_user_exec using(exists(select 1 from private.privacy_requests r where r.id=request_id));
create policy privacy_owner_withdraw on private.privacy_request_events for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and status='withdrawn' and created_at=transaction_timestamp() and exists(select 1 from private.privacy_requests r where r.id=request_id));
create policy privacy_operator_read on private.privacy_requests for select to fw_privacy_exec using(private.has_capability('privacy_operator') and subject_id<>private.request_uid());
create policy privacy_operator_events on private.privacy_request_events for select to fw_privacy_exec using(private.has_capability('privacy_operator') and exists(select 1 from private.privacy_requests r where r.id=request_id));
create policy privacy_operator_write on private.privacy_request_events for insert to fw_privacy_exec with check(private.has_capability('privacy_operator') and actor_id=private.request_uid() and status<>'withdrawn' and created_at=transaction_timestamp() and exists(select 1 from private.privacy_requests r where r.id=request_id));
create trigger privacy_request_immutable before update or delete on private.privacy_requests for each row execute function private.day3_reject_history_mutation();
create trigger privacy_event_immutable before update or delete on private.privacy_request_events for each row execute function private.day3_reject_history_mutation();

-- Lock only the caller's identity/capabilities to serialize review with revocation.
create function private.require_privacy_operator() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=private.request_uid();if actor is null then raise exception 'AUTH_REQUIRED';end if;
 perform p.id from private.profiles p where p.id=actor for share;
 perform c.subject_id from private.capability_assignments c where c.subject_id=actor and c.capability='privacy_operator' for share;
 if not private.case_privileged('privacy_operator') then raise exception 'ACTION_FORBIDDEN';end if;
 return actor;
end $$;
grant create on schema private to fw_policy_exec;
alter function private.require_privacy_operator() owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.require_privacy_operator() from public,anon,authenticated,service_role;
grant execute on function private.require_privacy_operator() to fw_privacy_exec;

-- Invoker DTO respects the calling executor's RLS. Explicit fields, no profile data.
create function private.privacy_request_dto(wanted uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('requestId',r.id,'kind',r.kind,'scope',r.scope,'createdAt',r.created_at,
 'revision',coalesce((select max(e.revision) from private.privacy_request_events e where e.request_id=r.id),0),
 'status',coalesce((select e.status from private.privacy_request_events e where e.request_id=r.id order by e.revision desc limit 1),'received'),
 'history',coalesce((select jsonb_agg(jsonb_build_object('revision',e.revision,'status',e.status,'note',e.note,'evidenceRef',e.evidence_ref,'recordedAt',e.created_at) order by e.revision) from private.privacy_request_events e where e.request_id=r.id),'[]'))
 from private.privacy_requests r where r.id=wanted;
$$;

create function api.privacy_requests(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; op text; allowed text[]; wanted uuid; key uuid; r private.privacy_requests; e private.privacy_request_events; result jsonb; items jsonb; cursor uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 op:=request->>'operation';
 if request is null or jsonb_typeof(request)<>'object' or op is null or op not in ('create','list','read','withdraw') then raise exception 'VALIDATION_FAILED';end if;
 allowed:=case op when 'create' then array['operation','kind','scope','idempotencyKey'] when 'list' then array['operation','cursor'] when 'read' then array['operation','requestId'] else array['operation','requestId','expectedRevision','idempotencyKey'] end;
 if not(request ?& allowed) or request-allowed<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 if op in ('list','read') then
  perform private.consume_identity_quota('identity_read');
  if op='read' then result:=private.privacy_request_dto((request->>'requestId')::uuid);if result is null then raise exception 'NOT_FOUND';end if;return result;end if;
  cursor:=(request->>'cursor')::uuid;
  select coalesce(jsonb_agg(private.privacy_request_dto(p.id) order by p.id),'[]') into items from (select id from private.privacy_requests where cursor is null or id>cursor order by id limit 20) p;
  return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'requestId' else null end);
 end if;
 key:=(request->>'idempotencyKey')::uuid;if key is null then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));perform private.consume_identity_quota('identity_write');
 if op='create' then
  if request->>'kind' is null or request->>'kind' not in ('access','correction','deactivation','deletion') or jsonb_typeof(request->'scope') is distinct from 'string' or char_length(btrim(request->>'scope')) not between 1 and 500 then raise exception 'VALIDATION_FAILED';end if;
  select * into r from private.privacy_requests where subject_id=actor and idempotency_key=key;
  if found then
   if r.kind is distinct from request->>'kind' or r.scope is distinct from request->>'scope' then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  else insert into private.privacy_requests(subject_id,kind,scope,idempotency_key) values(actor,request->>'kind',request->>'scope',key) returning * into r;end if;
  return private.privacy_request_dto(r.id);
 end if;
 wanted:=(request->>'requestId')::uuid;
 if wanted is null or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or (request->>'expectedRevision')!~'^(0|[1-9][0-9]?)$' then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended(wanted::text,8));
 result:=private.privacy_request_dto(wanted);if result is null then raise exception 'NOT_FOUND';end if;
 select * into e from private.privacy_request_events where actor_id=actor and idempotency_key=key;
 if found then
  if e.request_id<>wanted or e.status<>'withdrawn' or e.revision<>(request->>'expectedRevision')::integer+1 then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 else
  if result->>'status' in ('fulfilled','declined','withdrawn') or (result->>'revision')::integer<>(request->>'expectedRevision')::integer or (result->>'revision')::integer>=20 then raise exception 'VERSION_CONFLICT';end if;
  insert into private.privacy_request_events(request_id,revision,actor_id,status,note,idempotency_key) values(wanted,(result->>'revision')::integer+1,actor,'withdrawn','Request withdrawn by its owner.',key);
 end if;
 return private.privacy_request_dto(wanted);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';end $$;

create function api.privacy_review(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; op text; allowed text[]; wanted uuid; key uuid; e private.privacy_request_events; result jsonb; items jsonb; cursor uuid;
begin
 actor:=private.require_privacy_operator();op:=request->>'operation';
 if request is null or jsonb_typeof(request)<>'object' or op is null or op not in ('list','read','review') then raise exception 'VALIDATION_FAILED';end if;
 allowed:=case op when 'list' then array['operation','cursor'] when 'read' then array['operation','requestId'] else array['operation','requestId','expectedRevision','status','note','evidenceRef','idempotencyKey'] end;
 if not(request ?& allowed) or request-allowed<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 perform private.consume_identity_quota(case when op='review' then 'identity_write' else 'identity_read' end);
 if op='list' then
  cursor:=(request->>'cursor')::uuid;
  select coalesce(jsonb_agg(private.privacy_request_dto(p.id) order by p.id),'[]') into items from (select id from private.privacy_requests where cursor is null or id>cursor order by id limit 20) p;
  return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'requestId' else null end);
 end if;
 wanted:=(request->>'requestId')::uuid;if wanted is null then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended(wanted::text,8));
 result:=private.privacy_request_dto(wanted);if result is null then raise exception 'NOT_FOUND';end if;
 if op='read' then return result;end if;
 key:=(request->>'idempotencyKey')::uuid;
 if key is null or request->>'status' is null or request->>'status' not in ('in_review','needs_information','fulfilled','declined') or jsonb_typeof(request->'note') is distinct from 'string' or char_length(btrim(request->>'note')) not between 1 and 500
 or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or (request->>'expectedRevision')!~'^(0|[1-9][0-9]?)$'
 or ((request->>'status'='fulfilled')<>(request->>'evidenceRef' is not null)) or (request->>'evidenceRef' is not null and (jsonb_typeof(request->'evidenceRef')<>'string' or char_length(btrim(request->>'evidenceRef')) not between 10 and 200)) then raise exception 'VALIDATION_FAILED';end if;
 select * into e from private.privacy_request_events where actor_id=actor and idempotency_key=key;
 if found then
  if e.request_id<>wanted or e.revision<>(request->>'expectedRevision')::integer+1 or e.status is distinct from request->>'status' or e.note is distinct from request->>'note' or e.evidence_ref is distinct from request->>'evidenceRef' then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 else
  if result->>'status' in ('fulfilled','declined','withdrawn') or (result->>'revision')::integer<>(request->>'expectedRevision')::integer or (result->>'revision')::integer>=20 then raise exception 'VERSION_CONFLICT';end if;
  if request->>'status'='fulfilled' and result->>'status'='received' then raise exception 'VERSION_CONFLICT';end if;
  insert into private.privacy_request_events(request_id,revision,actor_id,status,note,evidence_ref,idempotency_key) values(wanted,(result->>'revision')::integer+1,actor,request->>'status',request->>'note',request->>'evidenceRef',key);
 end if;
 return private.privacy_request_dto(wanted);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api,private to fw_user_exec,fw_privacy_exec;
alter function private.privacy_request_dto(uuid) owner to fw_user_exec;
alter function api.privacy_requests(jsonb) owner to fw_user_exec;
alter function api.privacy_review(jsonb) owner to fw_privacy_exec;
revoke create on schema api,private from fw_user_exec,fw_privacy_exec;
revoke all on function private.privacy_request_dto(uuid),api.privacy_requests(jsonb),api.privacy_review(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.privacy_request_dto(uuid) to fw_privacy_exec;
grant execute on function api.privacy_requests(jsonb),api.privacy_review(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
