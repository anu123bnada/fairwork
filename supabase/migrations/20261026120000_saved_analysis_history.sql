begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required'; end if; end $$;
-- Private, immutable snapshots of the rules-based offer analysis a user chose to save.
-- Each snapshot is bound to the exact offer revision and term hash it was computed from
-- (checked against the live authorized offer). Snapshots are the user's own record, not
-- verification, and are never shared by this table.
create table private.analysis_history (
 actor_id uuid not null references private.profiles(id), id uuid not null default gen_random_uuid(),
 offer_id uuid not null, offer_version integer not null check(offer_version>0),
 term_hash text not null check(term_hash ~ '^[a-f0-9]{64}$'),
 engine text not null check(engine='offer-indicators.v1'),
 score integer not null check(score between 0 and 100),
 result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=40000),
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 primary key(actor_id,id), unique(actor_id,idempotency_key)
);
create index analysis_history_offer_idx on private.analysis_history(actor_id,offer_id,created_at desc);
alter table private.analysis_history owner to fw_schema_owner;
alter table private.analysis_history enable row level security;
alter table private.analysis_history force row level security;
revoke all on private.analysis_history from public,anon,authenticated,service_role;
grant select,insert on private.analysis_history to fw_user_exec;
create policy analysis_read on private.analysis_history for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy analysis_insert on private.analysis_history for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp());
create trigger analysis_immutable before update or delete on private.analysis_history for each row execute function private.day3_reject_history_mutation();

create function api.analysis_history(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; token uuid; agreement jsonb; prior private.analysis_history; saved_id uuid; total integer; items jsonb; result_json jsonb; score_value integer; version_value integer; hash_value text;
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or jsonb_typeof(request->'offerId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'offerId')::uuid;
 if request->>'operation'='save' then
  if not(request ?& array['operation','offerId','offerVersion','termHash','engine','score','result','idempotencyKey'])
   or request-array['operation','offerId','offerVersion','termHash','engine','score','result','idempotencyKey']<>'{}'
   or jsonb_typeof(request->'idempotencyKey') is distinct from 'string' or jsonb_typeof(request->'termHash') is distinct from 'string' or request->>'termHash' !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(request->'engine') is distinct from 'string' or request->>'engine'<>'offer-indicators.v1'
   or jsonb_typeof(request->'offerVersion') is distinct from 'number' or request->>'offerVersion' !~ '^[1-9][0-9]{0,8}$'
   or jsonb_typeof(request->'score') is distinct from 'number' or request->>'score' !~ '^(0|[1-9][0-9]?|100)$'
   or jsonb_typeof(request->'result') is distinct from 'object' or octet_length((request->'result')::text)>40000
   or (request->'result'->>'version') is distinct from 'offer-indicators.v1'
   or (request->'result'->>'score') is distinct from (request->>'score') then raise exception 'VALIDATION_FAILED';end if;
  token:=(request->>'idempotencyKey')::uuid;version_value:=(request->>'offerVersion')::integer;hash_value:=request->>'termHash';score_value:=(request->>'score')::integer;result_json:=request->'result';
  -- Reauthorize against the live offer; the snapshot must describe its current terms.
  agreement:=api.get_agreement(jsonb_build_object('offerId',target));
  if (agreement->'offer'->>'offerId')::uuid is distinct from target or (agreement->'offer'->>'version')::integer<>version_value or agreement->'offer'->>'termHash'<>hash_value then raise exception 'VERSION_CONFLICT';end if;
  perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2612));
  select * into prior from private.analysis_history where actor_id=actor and idempotency_key=token;
  if found then
   if prior.offer_id<>target or prior.offer_version<>version_value or prior.term_hash<>hash_value or prior.score<>score_value or prior.result<>result_json then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return jsonb_build_object('id',prior.id,'saved',true);
  end if;
  select count(*) into total from private.analysis_history where actor_id=actor and offer_id=target;
  if total>=200 then raise exception 'RATE_LIMITED';end if;
  insert into private.analysis_history(actor_id,offer_id,offer_version,term_hash,engine,score,result,idempotency_key)
   values(actor,target,version_value,hash_value,'offer-indicators.v1',score_value,result_json,token) returning id into saved_id;
  return jsonb_build_object('id',saved_id,'saved',true);
 elsif request->>'operation'='list' then
  if not(request ?& array['operation','offerId']) or request-array['operation','offerId']<>'{}' then raise exception 'VALIDATION_FAILED';end if;
  -- Reauthorize before returning any historical snapshot.
  perform api.get_agreement(jsonb_build_object('offerId',target));
  perform private.consume_identity_quota('identity_read');
  select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'offerVersion',h.offer_version,'termHash',h.term_hash,'engine',h.engine,'score',h.score,'result',h.result,'savedAt',h.created_at) order by h.created_at desc,h.id),'[]') into items
   from (select * from private.analysis_history where actor_id=actor and offer_id=target order by created_at desc,id limit 20) h;
  return jsonb_build_object('offerId',target,'items',items);
 else raise exception 'VALIDATION_FAILED';end if;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_user_exec;
alter function api.analysis_history(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.analysis_history(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.analysis_history(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
