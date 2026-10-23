begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
create table private.organization_appeals(
 parent_request_id uuid primary key references private.organization_requests(id),
 child_request_id uuid not null unique references private.organization_requests(id),
 actor_id uuid not null references private.profiles(id),
 created_at timestamptz not null default transaction_timestamp(),
 check(parent_request_id<>child_request_id)
);
alter table private.organization_appeals owner to fw_schema_owner;
alter table private.organization_appeals enable row level security;
alter table private.organization_appeals force row level security;
revoke all on private.organization_appeals from public,anon,authenticated,service_role;
grant select,insert on private.organization_appeals to fw_user_exec;
grant select on private.organization_appeals to fw_authority_exec,fw_admin_exec;
create policy organization_appeal_owner_read on private.organization_appeals for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy organization_appeal_owner_insert on private.organization_appeals for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp()
 and exists(select 1 from private.organization_request_decisions d where d.request_id=parent_request_id and d.decision='reject')
 and exists(select 1 from private.organization_requests r where r.id=child_request_id and r.subject_id=private.request_uid()));
create policy organization_appeal_operator_read on private.organization_appeals for select to fw_authority_exec using(private.has_capability('authority_operator'));
create policy organization_appeal_admin_read on private.organization_appeals for select to fw_admin_exec using(private.admin_role() is not null);
create trigger organization_appeal_immutable before update or delete on private.organization_appeals for each row execute function private.day3_reject_history_mutation();

create function api.appeal_organization_request(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; token uuid; original private.organization_requests; child private.organization_requests; link private.organization_appeals; result jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['requestId','grounds','idempotencyKey'])
 or request-array['requestId','grounds','idempotencyKey']<>'{}'
 or jsonb_typeof(request->'grounds') is distinct from 'string' or length(btrim(request->>'grounds')) not between 10 and 500
 then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'requestId')::uuid;token:=(request->>'idempotencyKey')::uuid;
 if target is null or token is null then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 perform pg_advisory_xact_lock(hashtextextended(target::text,12));
 if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 select * into original from private.organization_requests where id=target and subject_id=actor;
 if not found then raise exception 'NOT_FOUND';end if;
 if not exists(select 1 from private.organization_request_decisions where request_id=target and decision='reject') then raise exception 'ACTION_FORBIDDEN';end if;
 -- One appeal of the original decision. Further correction needs a new request.
 if exists(select 1 from private.organization_appeals where child_request_id=target) then raise exception 'ACTION_FORBIDDEN';end if;
 select * into link from private.organization_appeals where parent_request_id=target;
 if found then
  select * into child from private.organization_requests where id=link.child_request_id;
  if child.idempotency_key<>token or child.statement<>btrim(request->>'grounds') then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('requestId',child.id,'parentRequestId',target);
 end if;
 if exists(select 1 from private.organization_requests where subject_id=actor and idempotency_key=token) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 result:=api.request_organization(jsonb_build_object('companyId',original.company_id,'companyName',original.company_name,'statement',btrim(request->>'grounds'),'idempotencyKey',token));
 insert into private.organization_appeals(parent_request_id,child_request_id,actor_id) values(target,(result->>'requestId')::uuid,actor);
 return result||jsonb_build_object('parentRequestId',target);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

alter function api.decide_organization_request(jsonb) rename to decide_organization_request_before_appeals;
revoke all on function api.decide_organization_request_before_appeals(jsonb) from public,anon,authenticated,service_role;
create function api.decide_organization_request(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=private.require_authority();
 if exists(select 1 from private.organization_appeals a join private.organization_request_decisions d on d.request_id=a.parent_request_id
 where a.child_request_id=(request->>'requestId')::uuid and d.actor_id=actor) then raise exception 'ACTION_FORBIDDEN';end if;
 return api.decide_organization_request_before_appeals(request);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

-- Enrich only the already-authorized page. Preserve its original RLS and cursor.
alter function api.list_organization_requests(jsonb) rename to list_organization_requests_before_appeals;
revoke all on function api.list_organization_requests_before_appeals(jsonb) from public,anon,authenticated,service_role;
create function api.list_organization_requests(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; items jsonb;
begin
 result:=api.list_organization_requests_before_appeals(request);
 select coalesce(jsonb_agg(item||jsonb_build_object(
 'appealRequestId',(select child_request_id from private.organization_appeals where parent_request_id=(item->>'requestId')::uuid),
 'parentRequestId',(select parent_request_id from private.organization_appeals where child_request_id=(item->>'requestId')::uuid)) order by ordinal),'[]')
 into items from jsonb_array_elements(result->'items') with ordinality a(item,ordinal);
 return jsonb_set(result,'{items}',items);
end $$;
alter function api.list_organization_queue(jsonb) rename to list_organization_queue_before_appeals;
revoke all on function api.list_organization_queue_before_appeals(jsonb) from public,anon,authenticated,service_role;
create function api.list_organization_queue(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; items jsonb;
begin
 result:=api.list_organization_queue_before_appeals(request);
 select coalesce(jsonb_agg(item||jsonb_build_object(
 'parentRequestId',(select parent_request_id from private.organization_appeals where child_request_id=(item->>'requestId')::uuid),
 'previousDecisionReason',(select d.reason from private.organization_appeals f join private.organization_request_decisions d on d.request_id=f.parent_request_id where f.child_request_id=(item->>'requestId')::uuid)) order by ordinal),'[]')
 into items from jsonb_array_elements(result->'items') with ordinality a(item,ordinal);
 return jsonb_set(result,'{items}',items);
end $$;
grant create on schema api to fw_user_exec,fw_authority_exec;
alter function api.appeal_organization_request(jsonb) owner to fw_user_exec;
alter function api.list_organization_requests(jsonb) owner to fw_user_exec;
alter function api.decide_organization_request(jsonb) owner to fw_authority_exec;
alter function api.list_organization_queue(jsonb) owner to fw_authority_exec;
revoke create on schema api from fw_user_exec,fw_authority_exec;
revoke all on function api.appeal_organization_request(jsonb),api.list_organization_requests(jsonb),api.decide_organization_request(jsonb),api.list_organization_queue(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.appeal_organization_request(jsonb),api.list_organization_requests(jsonb),api.decide_organization_request(jsonb),api.list_organization_queue(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
