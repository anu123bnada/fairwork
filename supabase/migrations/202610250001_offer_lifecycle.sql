begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required'; end if; end $$;
-- Personal organization/intent only: never changes agreement acceptance or visibility.
create table private.offer_lifecycle_events (
 actor_id uuid not null references private.profiles(id), offer_id uuid not null,
 revision integer not null check(revision>0), archived boolean not null,
 decision text not null check(decision in ('considering','interested','accepted','declined')),
 idempotency_key uuid not null, expected_revision integer not null,
 created_at timestamptz not null default transaction_timestamp(),
 primary key(actor_id,offer_id,revision), unique(actor_id,idempotency_key)
);
alter table private.offer_lifecycle_events owner to fw_schema_owner;
alter table private.offer_lifecycle_events enable row level security;
alter table private.offer_lifecycle_events force row level security;
revoke all on private.offer_lifecycle_events from public,anon,authenticated,service_role;
grant select,insert on private.offer_lifecycle_events to fw_user_exec;
create policy lifecycle_read on private.offer_lifecycle_events for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy lifecycle_insert on private.offer_lifecycle_events for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp());
create trigger lifecycle_immutable before update or delete on private.offer_lifecycle_events for each row execute function private.day3_reject_history_mutation();
create function api.offer_lifecycle(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; token uuid; expected integer; current_revision integer; existing private.offer_lifecycle_events;
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if request is null or jsonb_typeof(request)<>'object'
 or not(request ?& array['offerId','archived','decision','expectedRevision','idempotencyKey'])
 or request-array['offerId','archived','decision','expectedRevision','idempotencyKey']<>'{}'
 or jsonb_typeof(request->'offerId') is distinct from 'string'
 or jsonb_typeof(request->'idempotencyKey') is distinct from 'string'
 or jsonb_typeof(request->'archived') is distinct from 'boolean'
 or jsonb_typeof(request->'decision') is distinct from 'string'
 or request->>'decision' not in ('considering','interested','accepted','declined')
 or jsonb_typeof(request->'expectedRevision') is distinct from 'number'
 or request->>'expectedRevision' !~ '^(0|[1-9][0-9]{0,8})$' then raise exception 'VALIDATION_FAILED'; end if;
 target:=(request->>'offerId')::uuid; token:=(request->>'idempotencyKey')::uuid; expected:=(request->>'expectedRevision')::integer;
 -- Reauthorize before even returning a retry receipt.
 perform api.get_agreement(jsonb_build_object('offerId',target));
 perform private.consume_identity_quota('identity_write');
 perform pg_advisory_xact_lock(hashtextextended(actor::text,2501));
 select * into existing from private.offer_lifecycle_events where actor_id=actor and idempotency_key=token;
 if found then
  if existing.offer_id<>target or existing.archived<>(request->>'archived')::boolean or existing.decision<>request->>'decision' or existing.expected_revision<>expected then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('saved',true,'revision',existing.revision);
 end if;
 select coalesce(max(revision),0) into current_revision from private.offer_lifecycle_events where actor_id=actor and offer_id=target;
 if expected<>current_revision then raise exception 'VERSION_CONFLICT'; end if;
 insert into private.offer_lifecycle_events values(actor,target,current_revision+1,(request->>'archived')::boolean,request->>'decision',token,expected,transaction_timestamp());
 return jsonb_build_object('saved',true,'revision',current_revision+1);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED'; end $$;
create or replace function api.list_offers(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb; cursor uuid; actor uuid; view_name text;
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['cursor','context']) or request-array['cursor','context','view']<>'{}'
 or request->>'context' is null or request->>'context' not in ('WORKER','EMPLOYER')
 or jsonb_typeof(request->'cursor') not in ('null','string')
 or (request ? 'view' and (jsonb_typeof(request->'view') is distinct from 'string' or request->>'view' not in ('active','archived','all'))) then raise exception 'VALIDATION_FAILED'; end if;
 cursor:=(request->>'cursor')::uuid; view_name:=coalesce(request->>'view','active');
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('offerId',offer_id,'companyId',company_id,'version',version,
 'role',snapshot->>'role','createdAt',created_at,'questions',jsonb_array_length(unresolved),
 'archived',archived,'decision',decision,'lifecycleRevision',lifecycle_revision) order by offer_id),'[]') into items
 from (select o.*,coalesce(e.archived,false) archived,coalesce(e.decision,'considering') decision,coalesce(e.revision,0) lifecycle_revision
 from (select distinct on (offer_id) offer_id,company_id,version,snapshot,created_at,unresolved
 from private.day3_offers where (cursor is null or offer_id>cursor) and
 ((request->>'context'='WORKER' and worker_id=actor) or (request->>'context'='EMPLOYER' and representative_id=actor)) order by offer_id,version desc) o
 left join lateral (select archived,decision,revision from private.offer_lifecycle_events where actor_id=actor and offer_id=o.offer_id order by revision desc limit 1) e on true
 where view_name='all' or coalesce(e.archived,false)=(view_name='archived') order by o.offer_id limit 20) page;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'offerId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; end $$;
grant create on schema api to fw_user_exec;
alter function api.offer_lifecycle(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.offer_lifecycle(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.offer_lifecycle(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
