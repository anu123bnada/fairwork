begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Agreement expiry and renewal (modules 05 and 20). The worker who proposed an agreement version may give it an expiry date (at most one year ahead) and may later renew it
-- by setting a later date. Acknowledging or deciding a proposed version after its date is refused with a controlled token; the version itself is never changed, so the
-- immutable, hash-pinned agreement history is untouched. Both participants can read the date; nobody else can.
create table private.agreement_expiries (
 agreement_id uuid not null,
 version integer not null,
 expires_at timestamptz not null,
 set_by uuid not null references private.profiles(id),
 set_at timestamptz not null default transaction_timestamp(),
 renewals integer not null default 0 check(renewals between 0 and 100),
 primary key(agreement_id,version),
 foreign key(agreement_id,version) references private.agreement_versions(agreement_id,version)
);
alter table private.agreement_expiries owner to fw_schema_owner;
alter table private.agreement_expiries enable row level security;alter table private.agreement_expiries force row level security;
revoke all on private.agreement_expiries from public,anon,authenticated,service_role;
grant select,insert,update on private.agreement_expiries to fw_user_exec;
create policy agreement_expiries_participant_read on private.agreement_expiries for select to fw_user_exec using(private.is_active() and exists(select 1 from private.agreement_roots r where r.id=agreement_id and (r.worker_id=private.request_uid() or r.representative_id=private.request_uid())));
create policy agreement_expiries_worker_insert on private.agreement_expiries for insert to fw_user_exec with check(private.is_active() and set_by=private.request_uid() and set_at=transaction_timestamp() and exists(select 1 from private.agreement_roots r where r.id=agreement_id and r.worker_id=private.request_uid()));
create policy agreement_expiries_worker_update on private.agreement_expiries for update to fw_user_exec using(private.is_active() and exists(select 1 from private.agreement_roots r where r.id=agreement_id and r.worker_id=private.request_uid())) with check(private.is_active() and set_by=private.request_uid() and set_at=transaction_timestamp());

create function api.agreement_expiry_set(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; root private.agreement_roots; v private.agreement_versions; target timestamptz; prior private.agreement_expiries;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['agreementId','expectedVersion','expiresAt']) or request-array['agreementId','expectedVersion','expiresAt']<>'{}'
  or jsonb_typeof(request->'agreementId') is distinct from 'string' or jsonb_typeof(request->'expectedVersion') is distinct from 'number' or jsonb_typeof(request->'expiresAt') is distinct from 'string'
  or (request->>'expectedVersion') !~ '^[0-9]{1,6}$' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'expiresAt')::timestamptz;
 if target<=transaction_timestamp()+interval '1 minute' or target>transaction_timestamp()+interval '366 days' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');
 select * into root from private.agreement_roots r where r.id=(request->>'agreementId')::uuid and r.worker_id=actor;
 if not found then raise exception 'NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended(root.id::text,4));
 select * into v from private.agreement_versions av where av.agreement_id=root.id and av.version=root.current_version;
 if not found then raise exception 'NOT_FOUND';end if;
 if v.version<>(request->>'expectedVersion')::integer or v.state not in ('draft','proposed') then raise exception 'VERSION_CONFLICT';end if;
 select * into prior from private.agreement_expiries e where e.agreement_id=root.id and e.version=v.version;
 if found then
  if prior.expires_at=target then return jsonb_build_object('agreementId',root.id,'version',v.version,'expiresAt',prior.expires_at,'renewals',prior.renewals,'replayed',true);end if;
  update private.agreement_expiries set expires_at=target,set_by=actor,set_at=transaction_timestamp(),renewals=least(prior.renewals+1,100) where agreement_id=root.id and version=v.version returning * into prior;
 else
  insert into private.agreement_expiries(agreement_id,version,expires_at,set_by) values(root.id,v.version,target,actor) returning * into prior;
 end if;
 return jsonb_build_object('agreementId',root.id,'version',v.version,'expiresAt',prior.expires_at,'renewals',prior.renewals,'replayed',false);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_FAILED';end $$;

create function api.agreement_expiry_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; root private.agreement_roots; e private.agreement_expiries;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'agreementId') or request-array['agreementId']<>'{}' or jsonb_typeof(request->'agreementId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select * into root from private.agreement_roots r where r.id=(request->>'agreementId')::uuid and (r.worker_id=actor or r.representative_id=actor);
 if not found then raise exception 'NOT_FOUND';end if;
 select * into e from private.agreement_expiries x where x.agreement_id=root.id and x.version=root.current_version;
 return jsonb_build_object('agreementId',root.id,'version',root.current_version,'expiresAt',case when e.agreement_id is null then null else e.expires_at end,'expired',e.agreement_id is not null and e.expires_at<=transaction_timestamp(),'renewals',coalesce(e.renewals,0),'canSet',root.worker_id=actor);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.agreement_expiries(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('agreementId',x.agreement_id,'version',x.version,'expiresAt',x.expires_at,'expired',x.expires_at<=transaction_timestamp(),'role',x.role) order by x.expires_at,x.agreement_id),'[]'::jsonb) into items
 from (select e.agreement_id,e.version,e.expires_at,case when r.worker_id=actor then 'worker' else 'representative' end role
  from private.agreement_expiries e join private.agreement_roots r on r.id=e.agreement_id and r.current_version=e.version
  join private.agreement_versions v on v.agreement_id=e.agreement_id and v.version=e.version and v.state='proposed'
  where r.worker_id=actor or r.representative_id=actor order by e.expires_at,e.agreement_id limit 50) x;
 return jsonb_build_object('items',items);
end $$;

create or replace function api.agreement_workflow(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; operation text; allowed text[]; root private.agreement_roots; v private.agreement_versions; source private.day3_offers; representative uuid; basis uuid; key uuid; digest text; receipt private.agreement_receipts; frozen jsonb; ids jsonb; next_version integer; result jsonb;
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>65536 then raise exception 'VALIDATION_FAILED'; end if;
 operation:=request->>'operation';
 allowed:=array['operation','agreementId','idempotencyKey'];
 if operation='create' then allowed:=allowed||array['offerId','offerVersion','expectedSourceHash','representativeId'];
 elsif operation='amend' then allowed:=allowed||array['offerId','offerVersion','expectedSourceHash','expectedVersion','expectedHash','expectedState'];
 elsif operation='propose' then allowed:=allowed||array['expectedVersion','expectedHash','expectedState','sharedQuestionIds'];
 elsif operation='acknowledge' then allowed:=allowed||array['expectedVersion','expectedHash','expectedState','acknowledgedItemIds','expectedItemSetHash'];
 elsif operation='decide' then allowed:=allowed||array['expectedVersion','expectedHash','expectedState','acknowledgedItemIds','expectedItemSetHash','decision'];
 else raise exception 'VALIDATION_FAILED'; end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& allowed) or exists(select 1 from jsonb_object_keys(request) k where not(k=any(allowed))) then raise exception 'VALIDATION_FAILED'; end if;
 if request->>'agreementId' is null or request->>'idempotencyKey' is null then raise exception 'VALIDATION_FAILED'; end if;
 key:=(request->>'idempotencyKey')::uuid; digest:=private.agreement_hash(request);
 if operation='create' then
  select * into source from private.day3_offers o where o.offer_id=(request->>'offerId')::uuid and o.version=(request->>'offerVersion')::integer and o.worker_id=actor;
  if not found then raise exception 'NOT_FOUND'; end if;
  representative:=(request->>'representativeId')::uuid;
  if representative is null or representative=actor then raise exception 'ACTION_FORBIDDEN'; end if;
  root.id:=(request->>'agreementId')::uuid; root.worker_id:=actor; root.company_id:=source.company_id; root.representative_id:=representative; root.offer_id:=source.offer_id;
 else
  select * into root from private.agreement_roots r where r.id=(request->>'agreementId')::uuid;
  if not found then raise exception 'NOT_FOUND'; end if;
 end if;
 -- Lock order: participant rows, membership, source, agreement. Legacy writers
 -- use the same membership/source advisory keys; no caller-selected lock SQL.
 perform private.agreement_lock_participants(root.worker_id,root.representative_id,root.company_id);
 perform pg_advisory_xact_lock(hashtextextended(root.offer_id::text,3));
 perform pg_advisory_xact_lock(hashtextextended(root.id::text,4));
 basis:=private.active_authority(root.company_id,root.representative_id);
 if basis is null then raise exception 'ACTION_FORBIDDEN'; end if;
 if operation in ('create','amend','propose') and actor<>root.worker_id then raise exception 'ACTION_FORBIDDEN'; end if;
 if operation<>'create' then
  select * into root from private.agreement_roots r where r.id=root.id for update;
  select * into v from private.agreement_versions av where av.agreement_id=root.id and av.version=root.current_version for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if operation<>'amend' and v.content->>'authorityDecisionId'<>basis::text then raise exception 'VERSION_CONFLICT'; end if;
 end if;
 select * into receipt from private.agreement_receipts r where r.actor_id=actor and r.idempotency_key=key;
 if found then
  if receipt.request_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return receipt.result;
 end if;
 perform private.consume_day3_quota();
 if operation<>'create' and (v.version is distinct from (request->>'expectedVersion')::integer or v.content_hash is distinct from request->>'expectedHash' or v.state is distinct from request->>'expectedState') then raise exception 'VERSION_CONFLICT'; end if;
 if operation in ('create','amend') then
  if operation='amend' then
   if (request->>'offerId')::uuid<>root.offer_id then raise exception 'VALIDATION_FAILED'; end if;
   select * into source from private.day3_offers o where o.offer_id=root.offer_id and o.version=(request->>'offerVersion')::integer and o.worker_id=actor and o.company_id=root.company_id;
   if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  if source.term_hash is distinct from request->>'expectedSourceHash' or source.version<>(select max(o.version) from private.day3_offers o where o.offer_id=root.offer_id) then raise exception 'VERSION_CONFLICT'; end if;
  frozen:=private.agreement_freeze(source,root.representative_id,basis);
  select coalesce(jsonb_agg(x->>'itemId' order by x->>'itemId'),'[]') into ids from jsonb_array_elements(frozen->'unresolved') x;
  next_version:=case when operation='create' then 1 else root.current_version+1 end;
  if operation='create' then
   insert into private.agreement_roots(id,offer_id,worker_id,company_id,representative_id,current_version) values(root.id,root.offer_id,actor,root.company_id,root.representative_id,1);
  else
   if v.state in ('draft','proposed') then update private.agreement_versions set state='superseded' where agreement_id=root.id and version=v.version; end if;
   update private.agreement_roots set current_version=next_version where id=root.id;
  end if;
  insert into private.agreement_versions(agreement_id,version,source_offer_id,source_version,company_id,worker_id,representative_id,authority_decision_id,content,content_hash,unresolved_ids,unresolved_hash,state) values(root.id,next_version,source.offer_id,source.version,root.company_id,root.worker_id,root.representative_id,basis,frozen,private.agreement_hash(frozen),ids,private.agreement_hash(ids),'draft') returning * into v;
 else
  if not private.agreement_source_current(v.content) then raise exception 'VERSION_CONFLICT'; end if;
  if exists(select 1 from jsonb_array_elements(v.content->'sharedQuestions') q where (q->>'required')::boolean and not exists(select 1 from jsonb_array_elements(v.content->'answers') a where a->>'questionId'=q->>'id')) then raise exception 'VALIDATION_FAILED'; end if;
  if operation='propose' then
   if v.state<>'draft' then raise exception 'VERSION_CONFLICT'; end if;
   if jsonb_typeof(request->'sharedQuestionIds')<>'array' then raise exception 'VALIDATION_FAILED'; end if;
   select coalesce(jsonb_agg(x order by x),'[]') into ids from jsonb_array_elements(request->'sharedQuestionIds') x;
   if ids<>(select coalesce(jsonb_agg(q->>'id' order by q->>'id'),'[]') from jsonb_array_elements(v.content->'sharedQuestions') q) then raise exception 'VALIDATION_FAILED'; end if;
   update private.agreement_versions set state='proposed',proposed_at=transaction_timestamp() where agreement_id=root.id and version=v.version returning * into v;
   update private.agreement_roots set published=true where id=root.id;
  else
   if v.state<>'proposed' then raise exception 'VERSION_CONFLICT'; end if;
   -- A proposal whose expiry date has passed can no longer be acknowledged or decided; its proposer can renew it by setting a later date.
   if exists(select 1 from private.agreement_expiries e where e.agreement_id=root.id and e.version=v.version and e.expires_at<=transaction_timestamp()) then raise exception 'AGREEMENT_EXPIRED'; end if;
   if jsonb_typeof(request->'acknowledgedItemIds')<>'array' then raise exception 'VALIDATION_FAILED'; end if;
   select coalesce(jsonb_agg(x order by x),'[]') into ids from jsonb_array_elements(request->'acknowledgedItemIds') x;
   if ids<>v.unresolved_ids or request->>'expectedItemSetHash' is distinct from v.unresolved_hash then raise exception 'VALIDATION_FAILED'; end if;
   if operation='acknowledge' then
    insert into private.agreement_acknowledgements(agreement_id,version,actor_id,content_hash,item_ids,item_set_hash) values(root.id,v.version,actor,v.content_hash,ids,v.unresolved_hash);
   else
    if request->>'decision' not in ('confirm','decline') or request->>'decision' is null then raise exception 'VALIDATION_FAILED'; end if;
    if request->>'decision'='confirm' and not exists(select 1 from private.agreement_acknowledgements a where a.agreement_id=root.id and a.version=v.version and a.actor_id=actor and a.content_hash=v.content_hash and a.item_ids=ids) then raise exception 'ACTION_FORBIDDEN'; end if;
    insert into private.agreement_decisions(agreement_id,version,actor_id,decision,content_hash) values(root.id,v.version,actor,request->>'decision',v.content_hash);
    if request->>'decision'='decline' then
     update private.agreement_versions set state='declined' where agreement_id=root.id and version=v.version returning * into v;
    elsif (select count(*) from private.agreement_decisions d where d.agreement_id=root.id and d.version=v.version and d.decision='confirm' and d.actor_id in(root.worker_id,root.representative_id))=2 then
     if root.effective_version is not null then update private.agreement_versions set state='superseded' where agreement_id=root.id and version=root.effective_version; end if;
     update private.agreement_versions set state='confirmed' where agreement_id=root.id and version=v.version returning * into v;
     update private.agreement_roots set effective_version=v.version where id=root.id;
    end if;
   end if;
  end if;
 end if;
 result:=jsonb_build_object('agreementId',root.id,'version',v.version,'contentHash',v.content_hash,'state',v.state,'actorId',actor,'operation',operation,'recordedAt',transaction_timestamp());
 insert into private.agreement_receipts(actor_id,idempotency_key,request_hash,result) values(actor,key,digest,result);
 insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values(actor,'agreement_'||operation,root.id,key,array['version','content_hash',operation],'day4_agreement_command','authority');
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';
 when unique_violation then raise exception 'VERSION_CONFLICT';
end; $$;

grant create on schema api to fw_user_exec;
alter function api.agreement_expiry_set(jsonb) owner to fw_user_exec;alter function api.agreement_expiry_read(jsonb) owner to fw_user_exec;alter function api.agreement_expiries(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.agreement_expiry_set(jsonb),api.agreement_expiry_read(jsonb),api.agreement_expiries(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.agreement_expiry_set(jsonb),api.agreement_expiry_read(jsonb),api.agreement_expiries(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
