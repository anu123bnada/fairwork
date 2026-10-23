begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
create table private.organization_requests (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null references private.profiles(id),
 company_id uuid, company_name text, statement text not null check(char_length(statement) between 1 and 500),
 idempotency_key uuid not null, created_at timestamptz not null default transaction_timestamp(),
 check((company_id is null)<>(company_name is null)),
 check(company_name is null or char_length(company_name) between 1 and 120),
 unique(subject_id,idempotency_key)
);
-- company_id is a submitted claim; no FK/existence oracle is exposed to applicants.
create table private.organization_request_decisions (
 request_id uuid primary key references private.organization_requests(id),
 actor_id uuid not null references private.profiles(id), decision text not null check(decision in ('approve','reject')),
 reason text not null check(char_length(reason) between 1 and 500), input jsonb not null,
 company_id uuid references private.companies(id), membership_decision_id uuid references private.company_membership_decisions(id),
 created_at timestamptz not null default transaction_timestamp(),
 check((decision='approve' and company_id is not null and membership_decision_id is not null) or
 (decision='reject' and company_id is null and membership_decision_id is null))
);
alter table private.organization_requests enable row level security;
alter table private.organization_requests force row level security;
alter table private.organization_request_decisions enable row level security;
alter table private.organization_request_decisions force row level security;
grant select,insert on private.organization_requests to fw_user_exec;
grant select on private.organization_request_decisions to fw_user_exec;
grant select on private.organization_requests to fw_authority_exec;
grant select,insert on private.organization_request_decisions to fw_authority_exec;
create policy organization_request_owner_read on private.organization_requests for select to fw_user_exec using(private.is_active() and subject_id=private.request_uid());
create policy organization_request_owner_insert on private.organization_requests for insert to fw_user_exec with check(private.is_active() and subject_id=private.request_uid() and created_at=transaction_timestamp());
create policy organization_decision_owner_read on private.organization_request_decisions for select to fw_user_exec using(exists(select 1 from private.organization_requests r where r.id=request_id));
create policy organization_request_operator_read on private.organization_requests for select to fw_authority_exec using(private.has_capability('authority_operator'));
create policy organization_decision_operator_read on private.organization_request_decisions for select to fw_authority_exec using(private.has_capability('authority_operator'));
create policy organization_decision_operator_insert on private.organization_request_decisions for insert to fw_authority_exec with check(private.has_capability('authority_operator') and actor_id=private.request_uid() and created_at=transaction_timestamp() and exists(select 1 from private.organization_requests r where r.id=request_id and r.subject_id<>private.request_uid()));
create trigger organization_request_immutable before update or delete on private.organization_requests for each row execute function private.day3_reject_history_mutation();
create trigger organization_decision_immutable before update or delete on private.organization_request_decisions for each row execute function private.day3_reject_history_mutation();
create index organization_request_owner_page on private.organization_requests(subject_id,id);

create function api.request_organization(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; key uuid; saved private.organization_requests; company uuid; name text;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['companyId','companyName','statement','idempotencyKey']) or request-array['companyId','companyName','statement','idempotencyKey']<>'{}'
 or jsonb_typeof(request->'idempotencyKey') is distinct from 'string'
 or jsonb_typeof(request->'statement') is distinct from 'string' or char_length(btrim(request->>'statement')) not between 1 and 500
 then raise exception 'VALIDATION_FAILED';end if;
 key:=(request->>'idempotencyKey')::uuid; company:=(request->>'companyId')::uuid; name:=request->>'companyName';
 if (company is null)=(name is null) or (name is not null and (jsonb_typeof(request->'companyName')<>'string' or char_length(btrim(name)) not between 1 and 120)) then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));perform private.consume_identity_quota('identity_write');
 select * into saved from private.organization_requests where subject_id=actor and idempotency_key=key;
 if found then
  if saved.company_id is distinct from company or saved.company_name is distinct from name or saved.statement is distinct from request->>'statement' then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 else
  insert into private.organization_requests(subject_id,company_id,company_name,statement,idempotency_key) values(actor,company,name,request->>'statement',key) returning * into saved;
 end if;
 return jsonb_build_object('requestId',saved.id);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.decide_organization_request(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; wanted uuid; r private.organization_requests; d private.organization_request_decisions; company uuid; membership jsonb;
begin
 actor:=private.require_authority();
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['requestId','decision','reason','expiresAt','reviewedEvidenceRefs','expectedRevision']) or request-array['requestId','decision','reason','expiresAt','reviewedEvidenceRefs','expectedRevision']<>'{}'
 or request->>'decision' is null or request->>'decision' not in ('approve','reject') or jsonb_typeof(request->'reason') is distinct from 'string' or char_length(btrim(request->>'reason')) not between 1 and 500
 or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^(0|[1-9][0-9]{0,8})$'
 then raise exception 'VALIDATION_FAILED';end if;
 wanted:=(request->>'requestId')::uuid;
 if wanted is null then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 perform pg_advisory_xact_lock(hashtextextended(wanted::text,12));perform private.require_authority();perform private.consume_authority_quota();
 select * into r from private.organization_requests where id=wanted;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.subject_id=actor then raise exception 'ACTION_FORBIDDEN';end if;
 select * into d from private.organization_request_decisions where request_id=wanted;
 if found then
  if d.input<>request or d.actor_id<>actor then raise exception 'VERSION_CONFLICT';end if;
 else
  if request->>'decision'='approve' then
   company:=r.company_id;
   if company is null then company:=(api.provision_company(jsonb_build_object('name',r.company_name,'idempotencyKey',r.id))->>'id')::uuid;end if;
   membership:=api.decide_membership(jsonb_build_object('companyId',company,'subjectId',r.subject_id,'decision','approve','expectedRevision',request->'expectedRevision','expiresAt',request->'expiresAt','reviewedEvidenceRefs',request->'reviewedEvidenceRefs','reason',request->'reason','policyVersion','demo-authority.v1','idempotencyKey',r.id));
  elsif request->'expiresAt'<>'null' or request->'reviewedEvidenceRefs'<>'[]' then raise exception 'VALIDATION_FAILED';end if;
  insert into private.organization_request_decisions(request_id,actor_id,decision,reason,input,company_id,membership_decision_id)
  values(wanted,actor,request->>'decision',request->>'reason',request,company,(membership->>'appliedDecisionId')::uuid) returning * into d;
 end if;
 return jsonb_build_object('requestId',d.request_id,'decision',d.decision,'companyId',d.company_id);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.list_organization_requests(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb; cursor uuid;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'cursor') or request-'cursor'<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 cursor:=(request->>'cursor')::uuid;perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('requestId',r.id,'companyId',coalesce(d.company_id,r.company_id),'companyName',r.company_name,'statement',r.statement,'decision',d.decision,'reason',d.reason,'createdAt',r.created_at,
 'active',d.company_id is not null and private.active_authority(d.company_id,r.subject_id) is not null) order by r.id),'[]') into items
 from (select * from private.organization_requests where cursor is null or id>cursor order by id limit 20) r left join private.organization_request_decisions d on d.request_id=r.id;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'requestId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.list_organization_queue(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb; cursor uuid;
begin
 perform private.require_authority();
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'cursor') or request-'cursor'<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 cursor:=(request->>'cursor')::uuid;perform private.consume_authority_quota();
 select coalesce(jsonb_agg(jsonb_build_object('requestId',r.id,'companyId',r.company_id,'companyName',r.company_name,'statement',r.statement,'subjectId',r.subject_id,'createdAt',r.created_at) order by r.id),'[]') into items
 from (select r.* from private.organization_requests r where (cursor is null or r.id>cursor) and not exists(select 1 from private.organization_request_decisions d where d.request_id=r.id) order by r.id limit 20) r;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'requestId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_user_exec,fw_authority_exec;
alter function api.request_organization(jsonb) owner to fw_user_exec;
alter function api.list_organization_requests(jsonb) owner to fw_user_exec;
alter function api.decide_organization_request(jsonb) owner to fw_authority_exec;
alter function api.list_organization_queue(jsonb) owner to fw_authority_exec;
revoke create on schema api from fw_user_exec,fw_authority_exec;
revoke all on function api.request_organization(jsonb),api.list_organization_requests(jsonb),api.decide_organization_request(jsonb),api.list_organization_queue(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.request_organization(jsonb),api.list_organization_requests(jsonb),api.decide_organization_request(jsonb),api.list_organization_queue(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
