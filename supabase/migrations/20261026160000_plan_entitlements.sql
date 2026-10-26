begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Plan assignments (module 22, docs/ORYQEN_ENTITLEMENTS_DESIGN.md). This is an administrative grant history,
-- not billing: no payment, price, invoice or provider data exists here and none is simulated. The effective
-- plan is the newest assignment; a person with no assignment is on the free worker plan. Essential worker
-- protections are not gated by this table (the application catalog enforces and tests that).
create table private.plan_assignments (
 id uuid primary key default gen_random_uuid(),
 subject_id uuid not null references private.profiles(id),
 plan text not null check(plan in ('worker_free','worker_plus')),
 actor_id uuid not null references private.profiles(id),
 reason text not null check(char_length(reason) between 1 and 300),
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 check(actor_id<>subject_id),
 unique(actor_id,idempotency_key)
);
create index plan_assignments_subject_idx on private.plan_assignments(subject_id,created_at desc,id desc);
alter table private.plan_assignments owner to fw_schema_owner;
alter table private.plan_assignments enable row level security;alter table private.plan_assignments force row level security;
revoke all on private.plan_assignments from public,anon,authenticated,service_role;
grant select on private.plan_assignments to fw_user_exec;
grant select,insert on private.plan_assignments to fw_authority_exec;
create policy plan_assignment_subject_read on private.plan_assignments for select to fw_user_exec using(private.is_active() and subject_id=private.request_uid());
create policy plan_assignment_operator_read on private.plan_assignments for select to fw_authority_exec using(private.has_capability('authority_operator'));
create policy plan_assignment_operator_insert on private.plan_assignments for insert to fw_authority_exec with check(private.has_capability('authority_operator') and actor_id=private.request_uid() and subject_id<>private.request_uid() and created_at=transaction_timestamp());
create trigger plan_assignments_immutable before update or delete on private.plan_assignments for each row execute function private.day3_reject_history_mutation();

create function api.entitlement_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; a private.plan_assignments;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or request<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select * into a from private.plan_assignments where subject_id=actor order by created_at desc,id desc limit 1;
 if not found then return jsonb_build_object('plan','worker_free','assignedAt',null);end if;
 return jsonb_build_object('plan',a.plan,'assignedAt',a.created_at);
end $$;

create function api.entitlement_assign(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['subjectId','plan','reason','idempotencyKey']; prior private.plan_assignments; saved private.plan_assignments; subject uuid;
begin
 actor:=private.require_authority();
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or (select count(*) from jsonb_each(request) e where jsonb_typeof(e.value)<>'string')>0
  or request->>'plan' not in ('worker_free','worker_plus') or char_length(btrim(request->>'reason')) not between 1 and 300 then raise exception 'VALIDATION_FAILED';end if;
 subject:=(request->>'subjectId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,2616));perform private.consume_authority_quota();
 if subject=actor then raise exception 'ACTION_FORBIDDEN';end if;
 select * into prior from private.plan_assignments where actor_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.subject_id<>subject or prior.plan<>request->>'plan' or prior.reason<>btrim(request->>'reason') then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('assignmentId',prior.id,'plan',prior.plan,'replayed',true);
 end if;
 insert into private.plan_assignments(subject_id,plan,actor_id,reason,idempotency_key) values(subject,request->>'plan',actor,btrim(request->>'reason'),(request->>'idempotencyKey')::uuid) returning * into saved;
 return jsonb_build_object('assignmentId',saved.id,'plan',saved.plan,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; when foreign_key_violation then raise exception 'NOT_FOUND';end $$;

grant create on schema api to fw_user_exec,fw_authority_exec;
alter function api.entitlement_read(jsonb) owner to fw_user_exec;
alter function api.entitlement_assign(jsonb) owner to fw_authority_exec;
revoke create on schema api from fw_user_exec,fw_authority_exec;
revoke all on function api.entitlement_read(jsonb),api.entitlement_assign(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.entitlement_read(jsonb),api.entitlement_assign(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
