begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Private recommendation history (module 3). When a person saves a listing, a minimal snapshot of why it was shown to them is kept: the listing title, the company name,
-- the preference revision in force, and for each criterion only its id and outcome (matches, differs or unknown). No listing text, pay figure or personal preference value is stored,
-- so the entry cannot expose anything the person did not already see. It belongs to the person alone, is deleted by its owner, and at most 50 are kept (oldest dropped).
create table private.recommendation_history (
 id uuid primary key,
 owner_id uuid not null references private.profiles(id),
 listing_id uuid not null,
 listing_title text not null check(char_length(btrim(listing_title)) between 1 and 120),
 company_name text check(company_name is null or char_length(company_name) between 1 and 300),
 preference_version integer not null check(preference_version>=0),
 reasons jsonb not null check(jsonb_typeof(reasons)='array' and jsonb_array_length(reasons)<=5),
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 unique(owner_id,idempotency_key)
);
create index recommendation_history_owner_idx on private.recommendation_history(owner_id,created_at desc,id);
alter table private.recommendation_history owner to fw_schema_owner;
alter table private.recommendation_history enable row level security;alter table private.recommendation_history force row level security;
revoke all on private.recommendation_history from public,anon,authenticated,service_role;
grant select,insert,delete on private.recommendation_history to fw_user_exec;
create policy recommendation_history_owner_read on private.recommendation_history for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy recommendation_history_owner_insert on private.recommendation_history for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and created_at=transaction_timestamp());
create policy recommendation_history_owner_delete on private.recommendation_history for delete to fw_user_exec using(private.is_active() and owner_id=private.request_uid());

create function api.recommendation_history_add(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['entryId','listingId','listingTitle','companyName','preferenceVersion','reasons','idempotencyKey']; prior private.recommendation_history; id uuid; reason jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or jsonb_typeof(request->'entryId') is distinct from 'string' or jsonb_typeof(request->'listingId') is distinct from 'string' or jsonb_typeof(request->'listingTitle') is distinct from 'string'
  or jsonb_typeof(request->'companyName') not in ('string','null') or jsonb_typeof(request->'preferenceVersion') is distinct from 'number' or jsonb_typeof(request->'reasons') is distinct from 'array'
  or jsonb_typeof(request->'idempotencyKey') is distinct from 'string' or (request->>'preferenceVersion')::numeric<>trunc((request->>'preferenceVersion')::numeric)
  or jsonb_array_length(request->'reasons')>5 then raise exception 'VALIDATION_FAILED';end if;
 for reason in select value from jsonb_array_elements(request->'reasons') loop
  if jsonb_typeof(reason)<>'object' or not(reason ?& array['id','outcome']) or reason-array['id','outcome']<>'{}'
   or reason->>'id' not in ('role','location','workMode','pay','payUnknown') or reason->>'outcome' not in ('matches','differs','unknown') then raise exception 'VALIDATION_FAILED';end if;
 end loop;
 id:=(request->>'entryId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2819));
 select * into prior from private.recommendation_history where owner_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.id<>id then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('entryId',prior.id,'replayed',true);
 end if;
 insert into private.recommendation_history(id,owner_id,listing_id,listing_title,company_name,preference_version,reasons,idempotency_key)
  values(id,actor,(request->>'listingId')::uuid,btrim(request->>'listingTitle'),request->>'companyName',(request->>'preferenceVersion')::integer,request->'reasons',(request->>'idempotencyKey')::uuid);
 delete from private.recommendation_history h where h.owner_id=actor and h.id in (select x.id from private.recommendation_history x where x.owner_id=actor order by x.created_at desc,x.id desc offset 50);
 return jsonb_build_object('entryId',id,'replayed',false);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_FAILED'; when check_violation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'IDEMPOTENCY_CONFLICT';
end $$;

create function api.recommendation_history_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('entryId',h.id,'listingId',h.listing_id,'listingTitle',h.listing_title,'companyName',h.company_name,'preferenceVersion',h.preference_version,'reasons',h.reasons,'createdAt',h.created_at) order by h.created_at desc,h.id desc),'[]'::jsonb)
  into items from private.recommendation_history h where h.owner_id=actor;
 return jsonb_build_object('items',items);
end $$;

create function api.recommendation_history_delete(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; gone integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'entryId') or request-array['entryId']<>'{}' or jsonb_typeof(request->'entryId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'entryId')::uuid;
 perform private.consume_identity_quota('identity_write');
 delete from private.recommendation_history h where h.id=target and h.owner_id=actor;get diagnostics gone = row_count;
 if gone=0 then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('entryId',target);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.recommendation_history_add(jsonb) owner to fw_user_exec;alter function api.recommendation_history_list(jsonb) owner to fw_user_exec;alter function api.recommendation_history_delete(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.recommendation_history_add(jsonb),api.recommendation_history_list(jsonb),api.recommendation_history_delete(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.recommendation_history_add(jsonb),api.recommendation_history_list(jsonb),api.recommendation_history_delete(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
