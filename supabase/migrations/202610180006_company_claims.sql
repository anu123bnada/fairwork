begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
create table private.company_claim_versions (
 company_id uuid not null references private.companies(id), version integer not null check(version>0),
 actor_id uuid not null references private.profiles(id), authority_decision_id uuid not null references private.company_membership_decisions(id),
 claims jsonb not null check(jsonb_typeof(claims)='object'), idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(), primary key(company_id,version), unique(actor_id,idempotency_key)
);
alter table private.company_claim_versions enable row level security;
alter table private.company_claim_versions force row level security;
grant select,insert on private.company_claim_versions to fw_user_exec;
create policy company_claim_read on private.company_claim_versions for select to fw_user_exec using(private.is_active() and
 (private.active_authority(company_id,private.request_uid()) is not null or exists(select 1 from private.day3_offers o where o.company_id=company_claim_versions.company_id)));
create policy company_claim_insert on private.company_claim_versions for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and authority_decision_id=private.active_authority(company_id,private.request_uid()) and created_at=transaction_timestamp());
create trigger company_claim_immutable before update or delete on private.company_claim_versions for each row execute function private.day3_reject_history_mutation();
create function api.company_profile(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; company uuid; authority uuid; saved private.company_claim_versions; latest integer; allowed text[]; value jsonb; history jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or request->>'operation' is null or request->>'operation' not in ('read','save') then raise exception 'VALIDATION_FAILED';end if;
 allowed:=case when request->>'operation'='save' then array['operation','companyId','claims','expectedVersion','idempotencyKey'] else array['operation','companyId'] end;
 if not(request ?& allowed) or request-allowed<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 company:=(request->>'companyId')::uuid;
 authority:=private.active_authority(company,actor);
 if company is null then raise exception 'VALIDATION_FAILED';end if;
 if authority is null and not exists(select 1 from private.day3_offers o where o.company_id=company) then raise exception 'NOT_FOUND';end if;
 if request->>'operation'='save' then
  if authority is null then raise exception 'ACTION_FORBIDDEN';end if;
  value:=request->'claims';
  if value is null or jsonb_typeof(value)<>'object' or not(value ?& array['description','website','location','industry']) or value-array['description','website','location','industry']<>'{}'
  or exists(select 1 from jsonb_each(value) f where jsonb_typeof(f.value)<>'string' or char_length(f.value#>>'{}')>500)
  or jsonb_typeof(request->'expectedVersion') is distinct from 'number' or request->>'expectedVersion' !~ '^(0|[1-9][0-9]{0,8})$'
  or request->>'idempotencyKey' is null then raise exception 'VALIDATION_FAILED';end if;
  if value->>'website'<>'' and (value->>'website' !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[^[:space:]]*)?$' or char_length(value->>'website')>400) then raise exception 'VALIDATION_FAILED';end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));perform pg_advisory_xact_lock(hashtextextended(company::text,16));perform private.consume_day3_quota();
  authority:=private.active_authority(company,actor);if authority is null then raise exception 'ACTION_FORBIDDEN';end if;
  select * into saved from private.company_claim_versions where actor_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
  if found then
   if saved.company_id<>company or saved.claims<>value or saved.version<>(request->>'expectedVersion')::integer+1 then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  else
   select coalesce(max(version),0) into latest from private.company_claim_versions where company_id=company;
   if latest<>(request->>'expectedVersion')::integer then raise exception 'VERSION_CONFLICT';end if;
   insert into private.company_claim_versions(company_id,version,actor_id,authority_decision_id,claims,idempotency_key) values(company,latest+1,actor,authority,value,(request->>'idempotencyKey')::uuid) returning * into saved;
  end if;
 else perform private.consume_identity_quota('identity_read');end if;
 select coalesce(jsonb_agg(jsonb_build_object('version',version,'claims',claims,'submittedAt',created_at) order by version desc),'[]') into history from
 (select * from private.company_claim_versions where company_id=company order by version desc limit 10) revisions;
 return jsonb_build_object('companyId',company,'companyName',private.work_company_label(company),'canEdit',authority is not null,'assurance','demo_provisioned','sourceType','representative_claim','verification','unverified','history',history);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.find_companies(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'query') or request-'query'<>'{}' or jsonb_typeof(request->'query') is distinct from 'string' or char_length(request->>'query')>120 then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('companyId',company_id,'name',name) order by name,company_id),'[]') into items from (
 select company_id,private.work_company_label(company_id) name from (
 select company_id from private.day3_offers
 union select d.company_id from private.organization_request_decisions d join private.organization_requests r on r.id=d.request_id where d.decision='approve' and private.active_authority(d.company_id,r.subject_id) is not null
 ) scoped where strpos(lower(private.work_company_label(company_id)),lower(request->>'query'))>0 order by name,company_id limit 20) page;
 return jsonb_build_object('items',items,'scope','your_authorized_organizations','externalSourceConfigured',false);
end $$;
grant create on schema api to fw_user_exec;
alter function api.company_profile(jsonb) owner to fw_user_exec;
alter function api.find_companies(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.company_profile(jsonb),api.find_companies(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.company_profile(jsonb),api.find_companies(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
