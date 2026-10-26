begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Organization plans (module 22, docs/ORYQEN_ENTITLEMENTS_DESIGN.md). Like worker plans, this is an operator-granted history, not
-- billing: no price, invoice or payment data exists here and none is simulated. The effective plan is the newest assignment; an
-- organization with none is on the basic plan. Essential worker protections never depend on any organization plan.
create table private.org_plan_assignments (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references private.companies(id),
 plan text not null check(plan in ('org_free','org_team')),
 actor_id uuid not null references private.profiles(id),
 reason text not null check(char_length(reason) between 1 and 300),
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 unique(actor_id,idempotency_key)
);
create index org_plan_assignments_company_idx on private.org_plan_assignments(company_id,created_at desc,id desc);
alter table private.org_plan_assignments owner to fw_schema_owner;
alter table private.org_plan_assignments enable row level security;alter table private.org_plan_assignments force row level security;
revoke all on private.org_plan_assignments from public,anon,authenticated,service_role;
grant select on private.org_plan_assignments to fw_user_exec;
grant select,insert on private.org_plan_assignments to fw_authority_exec;
-- Approved representatives of the organization read its plan; operators read and write every plan, but never for an organization in which they hold authority.
create policy org_plan_rep_read on private.org_plan_assignments for select to fw_user_exec using(private.is_active() and private.active_authority(company_id,private.request_uid()) is not null);
create policy org_plan_operator_read on private.org_plan_assignments for select to fw_authority_exec using(private.has_capability('authority_operator'));
create policy org_plan_operator_insert on private.org_plan_assignments for insert to fw_authority_exec with check(private.has_capability('authority_operator') and actor_id=private.request_uid() and created_at=transaction_timestamp() and private.active_authority(company_id,private.request_uid()) is null);
create trigger org_plan_assignments_immutable before update or delete on private.org_plan_assignments for each row execute function private.day3_reject_history_mutation();

-- Counting an organization's live listings needs every author's rows, which a representative's own policy hides. A helper owned by the
-- policy role may read only the columns it needs and returns a number.
grant select(id,company_id,status,expires_at) on private.opportunity_listings to fw_policy_exec;
create policy opportunity_plan_count on private.opportunity_listings for select to fw_policy_exec using(true);
grant create on schema private to fw_policy_exec;
create function private.org_live_listings(company uuid, except_listing uuid) returns integer language sql stable security definer set search_path='' as $$
 select count(*)::integer from private.opportunity_listings l where l.company_id=company and l.status='published' and l.expires_at>clock_timestamp() and l.id is distinct from except_listing;
$$;
alter function private.org_live_listings(uuid,uuid) owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.org_live_listings(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.org_live_listings(uuid,uuid) to fw_user_exec;

create function api.org_entitlement_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; company uuid; except_listing uuid; a private.org_plan_assignments;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'companyId') or request-array['companyId','listingId']<>'{}'
  or jsonb_typeof(request->'companyId') is distinct from 'string' or (request ? 'listingId' and jsonb_typeof(request->'listingId') not in ('string','null')) then raise exception 'VALIDATION_FAILED';end if;
 company:=(request->>'companyId')::uuid;except_listing:=nullif(request->>'listingId','')::uuid;
 if private.active_authority(company,actor) is null then raise exception 'ACTION_FORBIDDEN';end if;
 perform private.consume_identity_quota('identity_read');
 select * into a from private.org_plan_assignments where company_id=company order by created_at desc,id desc limit 1;
 return jsonb_build_object('plan',coalesce(a.plan,'org_free'),'assignedAt',a.created_at,'liveListings',private.org_live_listings(company,except_listing));
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.org_entitlement_assign(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['companyId','plan','reason','idempotencyKey']; prior private.org_plan_assignments; saved private.org_plan_assignments; company uuid;
begin
 actor:=private.require_authority();
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or (select count(*) from jsonb_each(request) e where jsonb_typeof(e.value)<>'string')>0
  or request->>'plan' not in ('org_free','org_team') or char_length(btrim(request->>'reason')) not between 1 and 300 then raise exception 'VALIDATION_FAILED';end if;
 company:=(request->>'companyId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,2617));perform private.consume_authority_quota();
 if private.active_authority(company,actor) is not null then raise exception 'ACTION_FORBIDDEN';end if;
 select * into prior from private.org_plan_assignments where actor_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.company_id<>company or prior.plan<>request->>'plan' or prior.reason<>btrim(request->>'reason') then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('assignmentId',prior.id,'plan',prior.plan,'replayed',true);
 end if;
 insert into private.org_plan_assignments(company_id,plan,actor_id,reason,idempotency_key) values(company,request->>'plan',actor,btrim(request->>'reason'),(request->>'idempotencyKey')::uuid) returning * into saved;
 return jsonb_build_object('assignmentId',saved.id,'plan',saved.plan,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; when foreign_key_violation then raise exception 'NOT_FOUND';end $$;

grant create on schema api to fw_user_exec,fw_authority_exec;
alter function api.org_entitlement_read(jsonb) owner to fw_user_exec;
alter function api.org_entitlement_assign(jsonb) owner to fw_authority_exec;
revoke create on schema api from fw_user_exec,fw_authority_exec;
revoke all on function api.org_entitlement_read(jsonb),api.org_entitlement_assign(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.org_entitlement_read(jsonb),api.org_entitlement_assign(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
