-- Local Day 4 candidate. Hosted application requires explicit approval.
-- Additive: no legacy confirmation is upgraded to this contract.
begin;

create table private.agreement_roots (
 id uuid primary key, offer_id uuid not null, worker_id uuid not null references private.profiles(id),
 company_id uuid not null references private.companies(id), representative_id uuid not null references private.profiles(id),
 current_version integer not null check(current_version > 0), effective_version integer,
 published boolean not null default false, created_at timestamptz not null default transaction_timestamp(),
 check(worker_id <> representative_id), unique(id,company_id,worker_id,representative_id)
);
create table private.agreement_versions (
 agreement_id uuid not null references private.agreement_roots(id), version integer not null check(version > 0),
 source_offer_id uuid not null, source_version integer not null, company_id uuid not null, worker_id uuid not null,
 representative_id uuid not null, authority_decision_id uuid not null,
 content jsonb not null, content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
 unresolved_ids jsonb not null check(jsonb_typeof(unresolved_ids)='array'), unresolved_hash text not null,
 state text not null check(state in ('draft','proposed','confirmed','declined','superseded')),
 created_at timestamptz not null default transaction_timestamp(), proposed_at timestamptz,
 primary key(agreement_id,version),
 foreign key(agreement_id,company_id,worker_id,representative_id) references private.agreement_roots(id,company_id,worker_id,representative_id),
 foreign key(source_offer_id,source_version,company_id,worker_id) references private.day3_offers(offer_id,version,company_id,worker_id),
 foreign key(company_id,representative_id,authority_decision_id) references private.company_membership_decisions(company_id,subject_id,id),
 check((content->'source'->>'offerId')::uuid=source_offer_id and (content->'source'->>'version')::integer=source_version and
 (content->>'companyId')::uuid=company_id and (content->>'workerId')::uuid=worker_id and (content->>'representativeId')::uuid=representative_id and (content->>'authorityDecisionId')::uuid=authority_decision_id)
);
alter table private.agreement_roots add foreign key(id,current_version) references private.agreement_versions(agreement_id,version) deferrable initially deferred;
alter table private.agreement_roots add foreign key(id,effective_version) references private.agreement_versions(agreement_id,version) deferrable initially deferred;
create table private.agreement_acknowledgements (
 agreement_id uuid not null, version integer not null, actor_id uuid not null references private.profiles(id),
 content_hash text not null, item_ids jsonb not null, item_set_hash text not null,
 recorded_at timestamptz not null default transaction_timestamp(), primary key(agreement_id,version,actor_id),
 foreign key(agreement_id,version) references private.agreement_versions(agreement_id,version)
);
create table private.agreement_decisions (
 agreement_id uuid not null, version integer not null, actor_id uuid not null references private.profiles(id),
 decision text not null check(decision in ('confirm','decline')), content_hash text not null,
 recorded_at timestamptz not null default transaction_timestamp(), primary key(agreement_id,version,actor_id),
 foreign key(agreement_id,version) references private.agreement_versions(agreement_id,version)
);
create table private.agreement_receipts (
 actor_id uuid not null references private.profiles(id), idempotency_key uuid not null,
 request_hash text not null, result jsonb not null, recorded_at timestamptz not null default transaction_timestamp(),
 primary key(actor_id,idempotency_key)
);

alter table private.agreement_roots owner to fw_schema_owner;
alter table private.agreement_versions owner to fw_schema_owner;
alter table private.agreement_acknowledgements owner to fw_schema_owner;
alter table private.agreement_decisions owner to fw_schema_owner;
alter table private.agreement_receipts owner to fw_schema_owner;
revoke all on private.agreement_roots,private.agreement_versions,private.agreement_acknowledgements,private.agreement_decisions,private.agreement_receipts from public,anon,authenticated,service_role;
grant select,insert on private.agreement_roots,private.agreement_versions,private.agreement_acknowledgements,private.agreement_decisions,private.agreement_receipts to fw_user_exec;
grant update(current_version,effective_version,published) on private.agreement_roots to fw_user_exec;
grant update(state,proposed_at) on private.agreement_versions to fw_user_exec;
alter table private.agreement_roots enable row level security;
alter table private.agreement_roots force row level security;
alter table private.agreement_versions enable row level security;
alter table private.agreement_versions force row level security;
alter table private.agreement_acknowledgements enable row level security;
alter table private.agreement_acknowledgements force row level security;
alter table private.agreement_decisions enable row level security;
alter table private.agreement_decisions force row level security;
alter table private.agreement_receipts enable row level security;
alter table private.agreement_receipts force row level security;

create policy agreement_root_read on private.agreement_roots for select to fw_user_exec using(private.is_active() and
 (worker_id=private.request_uid() or (published and representative_id=private.request_uid() and private.active_authority(company_id,representative_id) is not null)));
create policy agreement_root_insert on private.agreement_roots for insert to fw_user_exec with check(private.is_active() and worker_id=private.request_uid() and private.active_authority(company_id,representative_id) is not null);
create policy agreement_root_update on private.agreement_roots for update to fw_user_exec using(private.is_active() and
 (worker_id=private.request_uid() or (published and representative_id=private.request_uid() and private.active_authority(company_id,representative_id) is not null))) with check(private.is_active());
create policy agreement_version_read on private.agreement_versions for select to fw_user_exec using(exists(select 1 from private.agreement_roots r where r.id=agreement_id and (r.worker_id=private.request_uid() or state<>'draft')));
create policy agreement_version_insert on private.agreement_versions for insert to fw_user_exec with check(state='draft' and exists(select 1 from private.agreement_roots r where r.id=agreement_id and r.worker_id=private.request_uid()));
create policy agreement_version_update on private.agreement_versions for update to fw_user_exec using(exists(select 1 from private.agreement_roots r where r.id=agreement_id)) with check(exists(select 1 from private.agreement_roots r where r.id=agreement_id));
create policy agreement_ack_read on private.agreement_acknowledgements for select to fw_user_exec using(exists(select 1 from private.agreement_versions v where v.agreement_id=agreement_acknowledgements.agreement_id and v.version=agreement_acknowledgements.version));
create policy agreement_ack_insert on private.agreement_acknowledgements for insert to fw_user_exec with check(actor_id=private.request_uid() and exists(select 1 from private.agreement_versions v where v.agreement_id=agreement_acknowledgements.agreement_id and v.version=agreement_acknowledgements.version and v.state='proposed' and v.content_hash=agreement_acknowledgements.content_hash and v.unresolved_ids=item_ids and v.unresolved_hash=item_set_hash));
create policy agreement_decision_read on private.agreement_decisions for select to fw_user_exec using(exists(select 1 from private.agreement_versions v where v.agreement_id=agreement_decisions.agreement_id and v.version=agreement_decisions.version));
create policy agreement_decision_insert on private.agreement_decisions for insert to fw_user_exec with check(actor_id=private.request_uid() and exists(select 1 from private.agreement_versions v where v.agreement_id=agreement_decisions.agreement_id and v.version=agreement_decisions.version and v.state='proposed' and v.content_hash=agreement_decisions.content_hash) and (decision='decline' or exists(select 1 from private.agreement_acknowledgements a where a.agreement_id=agreement_decisions.agreement_id and a.version=agreement_decisions.version and a.actor_id=private.request_uid() and a.content_hash=agreement_decisions.content_hash)));
create policy agreement_receipt_read on private.agreement_receipts for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy agreement_receipt_insert on private.agreement_receipts for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and recorded_at=transaction_timestamp());
create trigger agreement_ack_immutable before update or delete on private.agreement_acknowledgements for each row execute function private.reject_history_edit();
create trigger agreement_decision_immutable before update or delete on private.agreement_decisions for each row execute function private.reject_history_edit();
create trigger agreement_receipt_immutable before update or delete on private.agreement_receipts for each row execute function private.reject_history_edit();

-- Metadata helpers never expose source contents. Private executors only.
grant create on schema private to fw_policy_exec,fw_user_exec;
create function private.agreement_participants_active(worker uuid, representative uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active() and private.request_uid() in (worker,representative) and
 (select count(*) from private.profiles p where p.id in (worker,representative) and p.account_state='active' and p.deleted_at is null)=2;
$$;
alter function private.agreement_participants_active(uuid,uuid) owner to fw_policy_exec;
revoke all on function private.agreement_participants_active(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.agreement_participants_active(uuid,uuid) to fw_user_exec;
alter policy agreement_root_read on private.agreement_roots using(private.is_active() and
 (worker_id=private.request_uid() or (published and representative_id=private.request_uid() and private.agreement_participants_active(worker_id,representative_id) and private.active_authority(company_id,representative_id) is not null)));
grant select(term_hash) on private.day3_offers to fw_policy_exec;
grant select(id,question_id,offer_id,offer_version,answer,answered_by,answered_at) on private.day3_offer_answers to fw_policy_exec;
create policy day4_answer_integrity on private.day3_offer_answers for select to fw_policy_exec using(private.is_active());
grant update(id) on private.profiles to fw_policy_exec;
create function private.agreement_lock_participants(worker uuid, representative uuid, company uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if private.request_uid() not in (worker,representative) or not private.is_active() then raise exception 'ACTION_FORBIDDEN'; end if;
 perform p.id from private.profiles p where p.id in (worker,representative) order by p.id for share;
 if (select count(*) from private.profiles p where p.id in (worker,representative) and p.account_state='active' and p.deleted_at is null)<>2 then raise exception 'ACTION_FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(company::text||representative::text,1));
 if private.active_authority(company,representative) is null then raise exception 'ACTION_FORBIDDEN'; end if;
end; $$;
alter function private.agreement_lock_participants(uuid,uuid,uuid) owner to fw_policy_exec;

create function private.agreement_source_current(content jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active() and private.request_uid() in ((content->>'workerId')::uuid,(content->>'representativeId')::uuid)
 and (select max(o.version) from private.day3_offers o where o.offer_id=(content->'source'->>'offerId')::uuid)=(content->'source'->>'version')::integer
 and exists(select 1 from private.day3_offers o where o.offer_id=(content->'source'->>'offerId')::uuid and o.version=(content->'source'->>'version')::integer and o.term_hash=content->'source'->>'termHash' and o.worker_id=(content->>'workerId')::uuid and o.company_id=(content->>'companyId')::uuid)
 and coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'questionId',a.question_id,'answer',a.answer,'answeredBy',a.answered_by,'answeredAt',to_char(a.answered_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by a.id) from private.day3_offer_answers a where a.offer_id=(content->'source'->>'offerId')::uuid and a.offer_version=(content->'source'->>'version')::integer),'[]'::jsonb)=content->'answers';
$$;
alter function private.agreement_source_current(jsonb) owner to fw_policy_exec;

create function private.agreement_hash(value jsonb) returns text language sql immutable set search_path='' as $$ select encode(sha256(convert_to(value::text,'UTF8')),'hex') $$;
alter function private.agreement_hash(jsonb) owner to fw_user_exec;

create function private.agreement_freeze(source private.day3_offers, representative uuid, basis uuid) returns jsonb
language plpgsql set search_path='' as $$
declare terms jsonb:='{}'; unresolved jsonb:='[]'; questions jsonb; answers jsonb; field record; value jsonb; item uuid; question_id uuid;
begin
 for field in select * from (values
 ('salary.amount','salary','number'),('salary.currency','currency','string'),('salary.period','salaryPeriod','string'),('salary.basis','salaryBasis','string'),
 ('hours.amount','hoursPerWeek','number'),('hours.period','hoursPeriod','string'),('overtime','overtime','string'),('payment_schedule','paymentSchedule','string'),
 ('responsibilities','responsibilities','string'),('employment_type','employmentType','string'),('location','location','string'),('start','startDate','string'),
 ('end','endDate','string'),('duration','duration','string'),('benefits','benefits','string'),('deductions','deductions','string'),('termination','termination','string'),('other_conditions','otherConditions','string')) as fields(id,key,kind)
 loop
  value:=source.snapshot->field.key;
  if field.id='hours.period' and jsonb_typeof(source.snapshot->'hoursPerWeek')='number' and (source.snapshot->>'hoursPerWeek')::numeric>0 then value:='"week"'; end if;
  if value is null or value='null'::jsonb or jsonb_typeof(value)<>field.kind or (field.kind='string' and btrim(value#>>'{}')='') or (field.kind='number' and (value#>>'{}')::numeric<=0) then
   value:='null';
   select q.id into question_id from private.day3_offer_questions q where q.offer_id=source.offer_id and q.offer_version=source.version and q.field=field.key;
   item:=(substr(md5(source.offer_id::text||':'||source.version::text||':'||field.id),1,12)||'8'||substr(md5(source.offer_id::text||':'||source.version::text||':'||field.id),14,3)||'8'||substr(md5(source.offer_id::text||':'||source.version::text||':'||field.id),18,15))::uuid;
   unresolved:=unresolved||jsonb_build_array(jsonb_build_object('itemId',item,'fieldId',field.id,'issueCode','not_stated','sourceQuestionId',question_id,'explanation','No authoritative value is stated for '||field.id||'.'));
  end if;
  terms:=terms||jsonb_build_object(field.id,value);
 end loop;
 select coalesce(jsonb_agg(x order by x->>'itemId'),'[]') into unresolved from jsonb_array_elements(unresolved) x;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'field',q.field,'question',q.question,'required',q.required) order by q.id),'[]') into questions from private.day3_offer_questions q where q.offer_id=source.offer_id and q.offer_version=source.version;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'questionId',a.question_id,'answer',a.answer,'answeredBy',a.answered_by,'answeredAt',to_char(a.answered_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by a.id),'[]') into answers from private.day3_offer_answers a where a.offer_id=source.offer_id and a.offer_version=source.version;
 return jsonb_build_object('schemaVersion','agreement-terms.v1','workerId',source.worker_id,'companyId',source.company_id,'representativeId',representative,'authorityDecisionId',basis,
 'source',jsonb_build_object('offerId',source.offer_id,'version',source.version,'termHash',source.term_hash,'snapshot',source.snapshot),'terms',terms,'unresolved',unresolved,'sharedQuestions',questions,'answers',answers);
end; $$;
alter function private.agreement_freeze(private.day3_offers,uuid,uuid) owner to fw_user_exec;

create function private.agreement_guard_version() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'ACTION_FORBIDDEN'; end if;
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'state'-'proposed_at') is distinct from (to_jsonb(old)-'state'-'proposed_at') then raise exception 'ACTION_FORBIDDEN'; end if;
  if not ((old.state='draft' and new.state in ('proposed','superseded')) or (old.state='proposed' and new.state in ('confirmed','declined','superseded')) or (old.state='confirmed' and new.state='superseded')) then raise exception 'VERSION_CONFLICT'; end if;
  if new.proposed_at is distinct from old.proposed_at and not(old.state='draft' and new.state='proposed' and new.proposed_at=transaction_timestamp()) then raise exception 'ACTION_FORBIDDEN'; end if;
 end if;
 if new.content_hash<>private.agreement_hash(new.content) or new.unresolved_hash<>private.agreement_hash(new.unresolved_ids) or new.unresolved_ids<>(select coalesce(jsonb_agg(x->>'itemId' order by x->>'itemId'),'[]') from jsonb_array_elements(new.content->'unresolved') x) then raise exception 'VALIDATION_FAILED'; end if;
 return new;
end; $$;
alter function private.agreement_guard_version() owner to fw_user_exec;
create trigger agreement_version_guard before insert or update or delete on private.agreement_versions for each row execute function private.agreement_guard_version();

create function private.agreement_guard_root() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'ACTION_FORBIDDEN'; end if;
 if (to_jsonb(new)-'current_version'-'effective_version'-'published') is distinct from (to_jsonb(old)-'current_version'-'effective_version'-'published') or (old.published and not new.published) or new.current_version not in (old.current_version,old.current_version+1) then raise exception 'ACTION_FORBIDDEN'; end if;
 if new.effective_version is distinct from old.effective_version then
  if new.effective_version is null or new.effective_version<>new.current_version or coalesce(old.effective_version,0)>=new.effective_version then raise exception 'VERSION_CONFLICT'; end if;
  if (select count(*) from private.agreement_decisions d join private.agreement_acknowledgements a using(agreement_id,version,actor_id) join private.agreement_versions v using(agreement_id,version) where d.agreement_id=new.id and d.version=new.effective_version and d.actor_id in (new.worker_id,new.representative_id) and d.decision='confirm' and d.content_hash=v.content_hash and a.content_hash=v.content_hash and a.item_ids=v.unresolved_ids and v.state='confirmed')<>2 then raise exception 'ACTION_FORBIDDEN'; end if;
 end if;
 return new;
end; $$;
alter function private.agreement_guard_root() owner to fw_user_exec;
create trigger agreement_root_guard before update or delete on private.agreement_roots for each row execute function private.agreement_guard_root();

create function private.agreement_check_pointers() returns trigger language plpgsql set search_path='' as $$
declare r private.agreement_roots;
begin
 select * into r from private.agreement_roots where id=new.id;
 if r.current_version is distinct from (select max(v.version) from private.agreement_versions v where v.agreement_id=r.id) then raise exception 'VERSION_CONFLICT'; end if;
 if exists(select 1 from private.agreement_versions v where v.agreement_id=r.id and ((v.content->>'workerId')::uuid<>r.worker_id or (v.content->>'companyId')::uuid<>r.company_id or (v.content->>'representativeId')::uuid<>r.representative_id or (v.content->'source'->>'offerId')::uuid<>r.offer_id)) then raise exception 'ACTION_FORBIDDEN'; end if;
 if r.effective_version is distinct from (select v.version from private.agreement_versions v where v.agreement_id=r.id and v.state='confirmed') then raise exception 'ACTION_FORBIDDEN'; end if;
 return null;
end; $$;
alter function private.agreement_check_pointers() owner to fw_user_exec;
revoke all on function private.agreement_check_pointers() from public,anon,authenticated,service_role;
create constraint trigger agreement_pointer_check after insert or update on private.agreement_roots deferrable initially deferred for each row execute function private.agreement_check_pointers();

alter table private.audit_logs drop constraint audit_logs_action_check;
alter table private.audit_logs add constraint audit_logs_action_check check(action in ('create_profile','update_profile','provision_company','decide_membership','bootstrap_capability','review_offer','answer_offer_question','confirm_agreement','agreement_create','agreement_amend','agreement_propose','agreement_acknowledge','agreement_decide'));
alter table private.audit_logs drop constraint audit_logs_reason_code_check;
alter table private.audit_logs add constraint audit_logs_reason_code_check check(reason_code in ('owner_profile_command','synthetic_authority_command','offline_capability_bootstrap','day3_offer_command','day4_agreement_command'));
create policy agreement_audit_insert on private.audit_logs for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and action in ('agreement_create','agreement_amend','agreement_propose','agreement_acknowledge','agreement_decide') and reason_code='day4_agreement_command' and retention_class='authority' and db_time=transaction_timestamp());

create function api.agreement_workflow(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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

create function api.read_agreement_workflow(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; root private.agreement_roots; versions jsonb;
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'agreementId') or request-'agreementId'<>'{}'::jsonb then raise exception 'VALIDATION_FAILED'; end if;
 select * into root from private.agreement_roots r where r.id=(request->>'agreementId')::uuid;
 if not found then raise exception 'NOT_FOUND'; end if;
 perform private.consume_identity_quota('identity_read');
 perform pg_advisory_xact_lock(hashtextextended(root.offer_id::text,3));
 perform pg_advisory_xact_lock(hashtextextended(root.id::text,4));
 select * into root from private.agreement_roots r where r.id=root.id;
 select coalesce(jsonb_agg(jsonb_build_object('version',v.version,'state',v.state,'content',v.content,'contentHash',v.content_hash,'unresolvedIds',v.unresolved_ids,'itemSetHash',v.unresolved_hash,'createdAt',v.created_at,'proposedAt',v.proposed_at,
 'status',case when v.state='superseded' then 'superseded' when v.state='declined' then 'declined'
 when not private.agreement_participants_active(root.worker_id,root.representative_id) or v.content->>'authorityDecisionId' is distinct from private.active_authority(root.company_id,root.representative_id)::text or not private.agreement_source_current(v.content) then 'revision_conflict'
 when v.state='confirmed' then 'effective'
 when exists(select 1 from jsonb_array_elements(v.content->'sharedQuestions') q where (q->>'required')::boolean and not exists(select 1 from jsonb_array_elements(v.content->'answers') a where a->>'questionId'=q->>'id')) then 'awaiting_answers'
 when v.state='draft' then 'ready_for_review'
 when (select count(*) from private.agreement_acknowledgements a where a.agreement_id=root.id and a.version=v.version)<2 then 'awaiting_acknowledgements' else 'awaiting_confirmations' end,
 'acknowledgements',coalesce((select jsonb_agg(jsonb_build_object('actorId',a.actor_id,'contentHash',a.content_hash,'itemIds',a.item_ids,'itemSetHash',a.item_set_hash,'recordedAt',a.recorded_at) order by a.actor_id) from private.agreement_acknowledgements a where a.agreement_id=root.id and a.version=v.version),'[]'),
 'decisions',coalesce((select jsonb_agg(jsonb_build_object('actorId',d.actor_id,'decision',d.decision,'contentHash',d.content_hash,'recordedAt',d.recorded_at) order by d.actor_id) from private.agreement_decisions d where d.agreement_id=root.id and d.version=v.version),'[]')) order by v.version),'[]') into versions from private.agreement_versions v where v.agreement_id=root.id;
 return jsonb_build_object('agreementId',root.id,'workerId',root.worker_id,'companyId',root.company_id,'representativeId',root.representative_id,'currentVersion',root.current_version,'effectiveVersion',root.effective_version,'versions',versions);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';
end; $$;

grant create on schema api to fw_user_exec;
alter function api.agreement_workflow(jsonb) owner to fw_user_exec;
alter function api.read_agreement_workflow(jsonb) owner to fw_user_exec;
revoke all on function api.agreement_workflow(jsonb),api.read_agreement_workflow(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.agreement_workflow(jsonb),api.read_agreement_workflow(jsonb) to authenticated;
revoke all on function private.agreement_lock_participants(uuid,uuid,uuid),private.agreement_source_current(jsonb),private.agreement_hash(jsonb),private.agreement_freeze(private.day3_offers,uuid,uuid),private.agreement_guard_version(),private.agreement_guard_root() from public,anon,authenticated,service_role;
grant execute on function private.agreement_lock_participants(uuid,uuid,uuid),private.agreement_source_current(jsonb) to fw_user_exec;
revoke create on schema private from fw_user_exec,fw_policy_exec;
revoke create on schema api from fw_user_exec;
notify pgrst,'reload schema';
commit;
