begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Private company-research history (module 02). Each entry records what a person searched and the public-registry result summary they were shown, with the
-- source and retrieval time, so they can return to it. It belongs to the person alone: no representative, reviewer, employer or Passport recipient can see it.
-- Entries are deleted by their owner; at most 50 are kept per person and the oldest is dropped when a new one would exceed that.
create table private.research_history (
 id uuid primary key,
 owner_id uuid not null references private.profiles(id),
 query_name text not null check(char_length(btrim(query_name)) between 1 and 200),
 query_country text check(query_country is null or query_country ~ '^[A-Z]{2}$'),
 total_matches integer not null check(total_matches between 0 and 100000),
 top_lei text check(top_lei is null or top_lei ~ '^[A-Z0-9]{20}$'),
 top_name text check(top_name is null or char_length(top_name) between 1 and 300),
 top_match text not null check(top_match in ('exact','close','partial','weak','none')),
 source text not null check(char_length(source) between 1 and 80),
 retrieved_at timestamptz not null,
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 unique(owner_id,idempotency_key)
);
create index research_history_owner_idx on private.research_history(owner_id,created_at desc,id);
alter table private.research_history owner to fw_schema_owner;
alter table private.research_history enable row level security;alter table private.research_history force row level security;
revoke all on private.research_history from public,anon,authenticated,service_role;
grant select,insert,delete on private.research_history to fw_user_exec;
create policy research_history_owner_read on private.research_history for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy research_history_owner_insert on private.research_history for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and created_at=transaction_timestamp());
create policy research_history_owner_delete on private.research_history for delete to fw_user_exec using(private.is_active() and owner_id=private.request_uid());

create function api.research_history_add(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['entryId','queryName','queryCountry','totalMatches','topLei','topName','topMatch','source','retrievedAt','idempotencyKey']; prior private.research_history; id uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or jsonb_typeof(request->'entryId') is distinct from 'string' or jsonb_typeof(request->'queryName') is distinct from 'string' or jsonb_typeof(request->'queryCountry') not in ('string','null')
  or jsonb_typeof(request->'totalMatches') is distinct from 'number' or jsonb_typeof(request->'topLei') not in ('string','null') or jsonb_typeof(request->'topName') not in ('string','null')
  or jsonb_typeof(request->'topMatch') is distinct from 'string' or jsonb_typeof(request->'source') is distinct from 'string' or jsonb_typeof(request->'retrievedAt') is distinct from 'string'
  or jsonb_typeof(request->'idempotencyKey') is distinct from 'string' or (request->>'totalMatches')::numeric<>trunc((request->>'totalMatches')::numeric) then raise exception 'VALIDATION_FAILED';end if;
 id:=(request->>'entryId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2817));
 select * into prior from private.research_history where owner_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.id<>id then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('entryId',prior.id,'replayed',true);
 end if;
 insert into private.research_history(id,owner_id,query_name,query_country,total_matches,top_lei,top_name,top_match,source,retrieved_at,idempotency_key)
  values(id,actor,btrim(request->>'queryName'),request->>'queryCountry',(request->>'totalMatches')::integer,request->>'topLei',request->>'topName',request->>'topMatch',request->>'source',(request->>'retrievedAt')::timestamptz,(request->>'idempotencyKey')::uuid);
 delete from private.research_history h where h.owner_id=actor and h.id in (select x.id from private.research_history x where x.owner_id=actor order by x.created_at desc,x.id desc offset 50);
 return jsonb_build_object('entryId',id,'replayed',false);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_FAILED'; when check_violation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'IDEMPOTENCY_CONFLICT';end $$;

create function api.research_history_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('entryId',h.id,'queryName',h.query_name,'queryCountry',h.query_country,'totalMatches',h.total_matches,'topLei',h.top_lei,'topName',h.top_name,'topMatch',h.top_match,'source',h.source,'retrievedAt',h.retrieved_at,'createdAt',h.created_at) order by h.created_at desc,h.id desc),'[]'::jsonb)
  into items from private.research_history h where h.owner_id=actor;
 return jsonb_build_object('items',items);
end $$;

create function api.research_history_delete(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; gone integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'entryId') or request-array['entryId']<>'{}' or jsonb_typeof(request->'entryId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'entryId')::uuid;
 perform private.consume_identity_quota('identity_write');
 delete from private.research_history h where h.id=target and h.owner_id=actor;get diagnostics gone = row_count;
 if gone=0 then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('entryId',target);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.research_history_add(jsonb) owner to fw_user_exec;alter function api.research_history_list(jsonb) owner to fw_user_exec;alter function api.research_history_delete(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.research_history_add(jsonb),api.research_history_list(jsonb),api.research_history_delete(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.research_history_add(jsonb),api.research_history_list(jsonb),api.research_history_delete(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
