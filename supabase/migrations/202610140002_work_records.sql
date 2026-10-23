-- Day 5 local candidate. No hosted application is authorized.
begin;
alter table private.agreement_versions add constraint agreement_work_basis_unique unique(agreement_id,version,worker_id,company_id,representative_id,authority_decision_id);
create table private.work_records (
 id uuid primary key, agreement_id uuid not null, worker_id uuid not null, company_id uuid not null, representative_id uuid not null,
 current_version integer not null check(current_version>0), published boolean not null default false,
 created_at timestamptz not null default transaction_timestamp(), check(worker_id<>representative_id),
 unique(id,agreement_id,worker_id,company_id,representative_id),
 foreign key(agreement_id,company_id,worker_id,representative_id) references private.agreement_roots(id,company_id,worker_id,representative_id)
);
create table private.work_record_versions (
 work_id uuid not null, version integer not null check(version>0), previous_version integer,
 agreement_id uuid not null, agreement_version integer not null, worker_id uuid not null, company_id uuid not null, representative_id uuid not null, authority_decision_id uuid not null,
 content jsonb not null, content_hash text not null, evidence_hash text not null,
 state text not null check(state in ('draft','submitted','verified','disputed','rejected','superseded')),
 created_at timestamptz not null default transaction_timestamp(), submitted_at timestamptz,
 primary key(work_id,version), check(previous_version is not distinct from case when version=1 then null else version-1 end),
 unique(work_id,version,worker_id,company_id,representative_id,authority_decision_id),
 foreign key(work_id,previous_version) references private.work_record_versions(work_id,version),
 foreign key(work_id,agreement_id,worker_id,company_id,representative_id) references private.work_records(id,agreement_id,worker_id,company_id,representative_id),
 foreign key(agreement_id,agreement_version,worker_id,company_id,representative_id,authority_decision_id) references private.agreement_versions(agreement_id,version,worker_id,company_id,representative_id,authority_decision_id)
);
alter table private.work_records add foreign key(id,current_version) references private.work_record_versions(work_id,version) deferrable initially deferred;
create table private.work_evidence (
 id uuid primary key default gen_random_uuid(), work_id uuid not null, version integer not null,
 owner_id uuid not null references private.profiles(id), text text not null check(length(btrim(text)) between 1 and 2000),
 recorded_at timestamptz not null default transaction_timestamp(),
 foreign key(work_id,version) references private.work_record_versions(work_id,version) deferrable initially deferred
);
create table private.work_decisions (
 id uuid primary key default gen_random_uuid(), work_id uuid not null, version integer not null,
 worker_id uuid not null, company_id uuid not null, representative_id uuid not null, authority_decision_id uuid not null,
 outcome text not null check(outcome in ('verified','disputed','rejected')), reason text not null check(length(btrim(reason)) between 1 and 2000),
 content_hash text not null, evidence_hash text not null, recorded_at timestamptz not null default transaction_timestamp(),
 unique(work_id,version), check(worker_id<>representative_id),
 foreign key(work_id,version,worker_id,company_id,representative_id,authority_decision_id) references private.work_record_versions(work_id,version,worker_id,company_id,representative_id,authority_decision_id)
);
create table private.work_receipts (
 actor_id uuid not null references private.profiles(id), idempotency_key uuid not null, request_hash text not null, result jsonb not null,
 recorded_at timestamptz not null default transaction_timestamp(), primary key(actor_id,idempotency_key)
);
create index work_evidence_version_idx on private.work_evidence(work_id,version);
create index work_worker_list_idx on private.work_records(worker_id,id);
create index work_representative_list_idx on private.work_records(representative_id,id) where published;
alter table private.work_records owner to fw_schema_owner;
alter table private.work_record_versions owner to fw_schema_owner;
alter table private.work_evidence owner to fw_schema_owner;
alter table private.work_decisions owner to fw_schema_owner;
alter table private.work_receipts owner to fw_schema_owner;
revoke all on private.work_records,private.work_record_versions,private.work_evidence,private.work_decisions,private.work_receipts from public,anon,authenticated,service_role;
grant select,insert on private.work_records,private.work_record_versions,private.work_evidence,private.work_decisions,private.work_receipts to fw_user_exec;
grant update(current_version,published) on private.work_records to fw_user_exec;
grant update(state,submitted_at) on private.work_record_versions to fw_user_exec;
alter table private.work_records enable row level security;
alter table private.work_records force row level security;
alter table private.work_record_versions enable row level security;
alter table private.work_record_versions force row level security;
alter table private.work_evidence enable row level security;
alter table private.work_evidence force row level security;
alter table private.work_decisions enable row level security;
alter table private.work_decisions force row level security;
alter table private.work_receipts enable row level security;
alter table private.work_receipts force row level security;
grant create on schema private to fw_policy_exec,fw_user_exec;
create function private.work_authority(company uuid,representative uuid) returns uuid language sql volatile security definer set search_path='' as $$
 select d.id from private.company_membership_decisions d where d.id=private.active_authority(company,representative) and d.effective_at<=clock_timestamp() and d.expires_at>clock_timestamp();
$$;
alter function private.work_authority(uuid,uuid) owner to fw_policy_exec;
revoke all on function private.work_authority(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.work_authority(uuid,uuid) to fw_user_exec;
create policy work_root_read on private.work_records for select to fw_user_exec using(private.is_active() and (worker_id=private.request_uid() or (published and representative_id=private.request_uid() and private.agreement_participants_active(worker_id,representative_id) and private.work_authority(company_id,representative_id) is not null)));
create policy work_root_insert on private.work_records for insert to fw_user_exec with check(private.is_active() and worker_id=private.request_uid() and exists(select 1 from private.agreement_roots a where a.id=agreement_id and a.worker_id=worker_id));
create policy work_root_update on private.work_records for update to fw_user_exec using(private.is_active() and worker_id=private.request_uid()) with check(worker_id=private.request_uid());
create policy work_version_read on private.work_record_versions for select to fw_user_exec using(exists(select 1 from private.work_records r where r.id=work_id and (r.worker_id=private.request_uid() or submitted_at is not null)));
create policy work_version_insert on private.work_record_versions for insert to fw_user_exec with check(state='draft' and worker_id=private.request_uid() and exists(select 1 from private.work_records r where r.id=work_id and r.worker_id=private.request_uid()));
create policy work_version_update on private.work_record_versions for update to fw_user_exec using(exists(select 1 from private.work_records r where r.id=work_id)) with check(exists(select 1 from private.work_records r where r.id=work_id));
create policy work_evidence_read on private.work_evidence for select to fw_user_exec using((owner_id=private.request_uid() and private.is_active()) or exists(select 1 from private.work_record_versions v where v.work_id=work_evidence.work_id and v.version=work_evidence.version));
create policy work_evidence_insert on private.work_evidence for insert to fw_user_exec with check(owner_id=private.request_uid() and recorded_at=transaction_timestamp() and exists(select 1 from private.work_records r where r.id=work_id and r.worker_id=owner_id));
create policy work_decision_read on private.work_decisions for select to fw_user_exec using(exists(select 1 from private.work_record_versions v where v.work_id=work_decisions.work_id and v.version=work_decisions.version));
create policy work_decision_insert on private.work_decisions for insert to fw_user_exec with check(representative_id=private.request_uid() and authority_decision_id=private.work_authority(company_id,representative_id) and recorded_at=transaction_timestamp() and exists(select 1 from private.work_record_versions v where v.work_id=work_decisions.work_id and v.version=work_decisions.version and v.state='submitted' and v.content_hash=work_decisions.content_hash and v.evidence_hash=work_decisions.evidence_hash));
create policy work_receipt_read on private.work_receipts for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy work_receipt_insert on private.work_receipts for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and recorded_at=transaction_timestamp());
create trigger work_evidence_immutable before update or delete on private.work_evidence for each row execute function private.reject_history_edit();
create trigger work_decision_immutable before update or delete on private.work_decisions for each row execute function private.reject_history_edit();
create trigger work_receipt_immutable before update or delete on private.work_receipts for each row execute function private.reject_history_edit();

create function private.work_guard_version() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'ACTION_FORBIDDEN'; end if;
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'state'-'submitted_at') is distinct from (to_jsonb(old)-'state'-'submitted_at') then raise exception 'ACTION_FORBIDDEN'; end if;
  if not ((old.state='draft' and new.state='submitted' and private.request_uid()=new.worker_id) or (old.state<>'superseded' and new.state='superseded' and private.request_uid()=new.worker_id) or (old.state='submitted' and new.state in ('verified','disputed','rejected') and private.request_uid()=new.representative_id and exists(select 1 from private.work_decisions d where d.work_id=new.work_id and d.version=new.version and d.outcome=new.state and d.content_hash=new.content_hash and d.evidence_hash=new.evidence_hash))) then raise exception 'VERSION_CONFLICT'; end if;
  if new.submitted_at is distinct from old.submitted_at and not(old.state='draft' and new.state='submitted' and new.submitted_at=transaction_timestamp()) then raise exception 'ACTION_FORBIDDEN'; end if;
 end if;
 if new.content_hash<>private.agreement_hash(new.content) or new.evidence_hash<>private.agreement_hash(new.content->'evidence') or (new.content->'agreement'->>'id')::uuid<>new.agreement_id or (new.content->'agreement'->>'version')::integer<>new.agreement_version or (new.content->'agreement'->>'authorityDecisionId')::uuid<>new.authority_decision_id then raise exception 'VALIDATION_FAILED'; end if;
 return new;
end; $$;
alter function private.work_guard_version() owner to fw_user_exec;
create trigger work_version_guard before insert or update or delete on private.work_record_versions for each row execute function private.work_guard_version();
create function private.work_guard_root() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'ACTION_FORBIDDEN'; end if;
 if (to_jsonb(new)-'current_version'-'published') is distinct from (to_jsonb(old)-'current_version'-'published') or new.current_version not in (old.current_version,old.current_version+1) or (old.published and not new.published) then raise exception 'ACTION_FORBIDDEN'; end if;
 return new;
end; $$;
alter function private.work_guard_root() owner to fw_user_exec;
create trigger work_root_guard before update or delete on private.work_records for each row execute function private.work_guard_root();
create function private.work_check_pointer() returns trigger language plpgsql set search_path='' as $$
begin
 if (select current_version from private.work_records where id=new.id) is distinct from (select max(version) from private.work_record_versions where work_id=new.id) then raise exception 'VERSION_CONFLICT'; end if;
 return null;
end; $$;
alter function private.work_check_pointer() owner to fw_user_exec;
create constraint trigger work_pointer_check after insert or update on private.work_records deferrable initially deferred for each row execute function private.work_check_pointer();
alter table private.audit_logs drop constraint audit_logs_action_check;
alter table private.audit_logs add constraint audit_logs_action_check check(action in ('create_profile','update_profile','provision_company','decide_membership','bootstrap_capability','review_offer','answer_offer_question','confirm_agreement','agreement_create','agreement_amend','agreement_propose','agreement_acknowledge','agreement_decide','work_create','work_revise','work_submit','work_reopen','work_decide'));
alter table private.audit_logs drop constraint audit_logs_reason_code_check;
alter table private.audit_logs add constraint audit_logs_reason_code_check check(reason_code in ('owner_profile_command','synthetic_authority_command','offline_capability_bootstrap','day3_offer_command','day4_agreement_command','day5_work_command'));
create policy work_audit_insert on private.audit_logs for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and action in ('work_create','work_revise','work_submit','work_reopen','work_decide') and reason_code='day5_work_command' and retention_class='authority' and db_time=transaction_timestamp());

create function api.work_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; op text; allowed text[]; r private.work_records; a private.agreement_roots; av private.agreement_versions; v private.work_record_versions; receipt private.work_receipts; key uuid; digest text; basis uuid; basis_version integer; effective_at timestamptz; p jsonb; e jsonb; frozen jsonb; evidence jsonb; next_version integer; result jsonb; decision_id uuid; start_day date; end_day date; hours numeric;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>65536 then raise exception 'VALIDATION_FAILED';end if;
 op:=request->>'operation';allowed:=array['operation','workId','idempotencyKey'];
 if op='create' then allowed:=allowed||array['agreementId','agreementVersion','payload'];
 elsif op in ('revise','reopen','submit','decide') then
  allowed:=allowed||array['expectedVersion','expectedHash','expectedState','expectedEvidenceHash'];
  if op in ('revise','reopen') then allowed:=allowed||array['agreementVersion','payload'];end if;
  if op='decide' then allowed:=allowed||array['outcome','reason'];end if;
 else raise exception 'VALIDATION_FAILED';end if;
 if not(request ?& allowed) or exists(select 1 from jsonb_object_keys(request) k where not(k=any(allowed))) or exists(select 1 from jsonb_each(request) x where x.value='null'::jsonb) then raise exception 'VALIDATION_FAILED';end if;
 if exists(select 1 from unnest(allowed) k where k not in ('payload','agreementVersion','expectedVersion') and jsonb_typeof(request->k)<>'string') or (request ? 'agreementVersion' and jsonb_typeof(request->'agreementVersion')<>'number') or (request ? 'expectedVersion' and jsonb_typeof(request->'expectedVersion')<>'number') then raise exception 'VALIDATION_FAILED';end if;
 key:=(request->>'idempotencyKey')::uuid;digest:=private.agreement_hash(request);
 if op='create' then
  select * into a from private.agreement_roots where id=(request->>'agreementId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
  if a.worker_id<>actor then raise exception 'ACTION_FORBIDDEN';end if;
  r.id:=(request->>'workId')::uuid;r.agreement_id:=a.id;r.worker_id:=a.worker_id;r.company_id:=a.company_id;r.representative_id:=a.representative_id;
 else
  select * into r from private.work_records where id=(request->>'workId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
 end if;
 perform private.agreement_lock_participants(r.worker_id,r.representative_id,r.company_id);
 perform pg_advisory_xact_lock(hashtextextended(r.agreement_id::text,4));
 perform pg_advisory_xact_lock(hashtextextended(r.id::text,5));
 basis:=private.work_authority(r.company_id,r.representative_id);if basis is null then raise exception 'ACTION_FORBIDDEN';end if;
 select * into a from private.agreement_roots where id=r.agreement_id;
 if op<>'create' then
  select * into r from private.work_records where id=r.id;
  select * into v from private.work_record_versions where work_id=r.id and version=r.current_version for update;
  if not found then raise exception 'NOT_FOUND';end if;
 end if;
 if (op='decide' and actor<>r.representative_id) or (op<>'decide' and actor<>r.worker_id) then raise exception 'ACTION_FORBIDDEN';end if;
 select * into receipt from private.work_receipts where actor_id=actor and idempotency_key=key;
 if found then if receipt.request_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT';end if;return receipt.result;end if;
 perform private.consume_day3_quota();
 if op<>'create' and (v.version is distinct from (request->>'expectedVersion')::integer or v.content_hash is distinct from request->>'expectedHash' or v.state is distinct from request->>'expectedState' or v.evidence_hash is distinct from request->>'expectedEvidenceHash') then raise exception 'VERSION_CONFLICT';end if;
 if a.effective_version is null then raise exception 'ACTION_FORBIDDEN';end if;
 basis_version:=case when op in ('create','revise','reopen') then (request->>'agreementVersion')::integer else v.agreement_version end;
 if basis_version is distinct from a.effective_version then raise exception 'VERSION_CONFLICT';end if;
 select * into av from private.agreement_versions where agreement_id=a.id and version=basis_version;
 if av.state<>'confirmed' or av.authority_decision_id<>basis then raise exception 'VERSION_CONFLICT';end if;
 select max(d.recorded_at) into effective_at from private.agreement_decisions d join private.agreement_acknowledgements ack using(agreement_id,version,actor_id)
 where d.agreement_id=a.id and d.version=basis_version and d.actor_id in (r.worker_id,r.representative_id) and d.decision='confirm' and d.content_hash=av.content_hash and ack.content_hash=av.content_hash and ack.item_ids=av.unresolved_ids and ack.item_set_hash=av.unresolved_hash having count(*)=2;
 if effective_at is null then raise exception 'ACTION_FORBIDDEN';end if;
 if op in ('create','revise','reopen') then
  if op='revise' and v.state<>'draft' then raise exception 'VERSION_CONFLICT';end if;
  if op='reopen' and v.state in ('draft','superseded') then raise exception 'VERSION_CONFLICT';end if;
  p:=request->'payload';allowed:=array['role','periodStart','periodEnd','hours','tasks','evidence'];
  if jsonb_typeof(p)<>'object' or not(p ?& allowed) or exists(select 1 from jsonb_object_keys(p) k where not(k=any(allowed))) then raise exception 'VALIDATION_FAILED';end if;
  if exists(select 1 from unnest(array['role','periodStart','periodEnd','hours','tasks']) k where jsonb_typeof(p->k) is distinct from 'string') or length(btrim(p->>'role')) not between 1 and 120 or length(btrim(p->>'tasks')) not between 1 and 4000 or p->>'hours'!~'^(0|[1-9][0-9]{0,4})(\.[0-9]{1,2})?$' or p->>'periodStart'!~'^\d{4}-\d{2}-\d{2}$' or p->>'periodEnd'!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'VALIDATION_FAILED';end if;
  start_day:=(p->>'periodStart')::date;end_day:=(p->>'periodEnd')::date;hours:=(p->>'hours')::numeric;
  if end_day<start_day or end_day-start_day>366 or hours>24*(end_day-start_day+1) then raise exception 'VALIDATION_FAILED';end if;
  if nullif(btrim(av.content->'terms'->>'responsibilities'),'') is null then raise exception 'ACTION_FORBIDDEN';end if;
  if (av.content->'terms'->>'start') ~ '^\d{4}-\d{2}-\d{2}$' and start_day<(av.content->'terms'->>'start')::date then raise exception 'VALIDATION_FAILED';end if;
  if (av.content->'terms'->>'end') ~ '^\d{4}-\d{2}-\d{2}$' and end_day>(av.content->'terms'->>'end')::date then raise exception 'VALIDATION_FAILED';end if;
  if jsonb_typeof(p->'evidence') is distinct from 'array' or jsonb_array_length(p->'evidence')>10 then raise exception 'VALIDATION_FAILED';end if;
  if exists(select 1 from jsonb_array_elements(p->'evidence') x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 1 and 2000) then raise exception 'VALIDATION_FAILED';end if;
  next_version:=case when op='create' then 1 else v.version+1 end;
  if op='create' then insert into private.work_records(id,agreement_id,worker_id,company_id,representative_id,current_version) values(r.id,a.id,r.worker_id,r.company_id,r.representative_id,1);
  else update private.work_record_versions set state='superseded' where work_id=r.id and version=v.version;update private.work_records set current_version=next_version where id=r.id;end if;
  evidence:='[]';
  for e in select value from jsonb_array_elements(p->'evidence') loop
   insert into private.work_evidence(work_id,version,owner_id,text) values(r.id,next_version,actor,e#>>'{}') returning jsonb_build_object('id',id,'ownerId',owner_id,'text',text,'recordedAt',to_char(recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) into frozen;
   evidence:=evidence||jsonb_build_array(frozen);
  end loop;
  select coalesce(jsonb_agg(value order by value->>'id'),'[]') into evidence from jsonb_array_elements(evidence);
  frozen:=(p-'evidence')||jsonb_build_object('schemaVersion','work-record.v1','evidence',evidence,'agreement',jsonb_build_object('id',a.id,'version',basis_version,'contentHash',av.content_hash,'authorityDecisionId',basis,'effectiveAt',to_char(effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'scope',av.content->'terms'->>'responsibilities'));
  insert into private.work_record_versions(work_id,version,previous_version,agreement_id,agreement_version,worker_id,company_id,representative_id,authority_decision_id,content,content_hash,evidence_hash,state)
  values(r.id,next_version,case when next_version=1 then null else next_version-1 end,a.id,basis_version,r.worker_id,r.company_id,r.representative_id,basis,frozen,private.agreement_hash(frozen),private.agreement_hash(evidence),'draft') returning * into v;
 elsif op='submit' then
  if v.state<>'draft' then raise exception 'VERSION_CONFLICT';end if;
  if (v.content->>'periodEnd')::date>(clock_timestamp() at time zone 'UTC')::date or jsonb_array_length(v.content->'evidence')=0 then raise exception 'VALIDATION_FAILED';end if;
  update private.work_records set published=true where id=r.id;
  update private.work_record_versions set state='submitted',submitted_at=transaction_timestamp() where work_id=r.id and version=v.version returning * into v;
 else
  if v.state<>'submitted' then raise exception 'VERSION_CONFLICT';end if;
  if request->>'outcome' not in ('verified','disputed','rejected') or jsonb_typeof(request->'reason')<>'string' or length(btrim(request->>'reason')) not between 1 and 2000 then raise exception 'VALIDATION_FAILED';end if;
  insert into private.work_decisions(work_id,version,worker_id,company_id,representative_id,authority_decision_id,outcome,reason,content_hash,evidence_hash)
  values(r.id,v.version,r.worker_id,r.company_id,r.representative_id,basis,request->>'outcome',request->>'reason',v.content_hash,v.evidence_hash) returning id into decision_id;
  update private.work_record_versions set state=request->>'outcome' where work_id=r.id and version=v.version returning * into v;
 end if;
 result:=jsonb_build_object('workId',r.id,'version',v.version,'contentHash',v.content_hash,'evidenceHash',v.evidence_hash,'state',v.state,'actorId',actor,'operation',op,'decisionId',decision_id,'recordedAt',transaction_timestamp());
 insert into private.work_receipts(actor_id,idempotency_key,request_hash,result) values(actor,key,digest,result);
 insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values(actor,'work_'||op,r.id,key,array['version','content_hash','evidence_hash',op],'day5_work_command','authority');
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format then raise exception 'VALIDATION_FAILED';when unique_violation then raise exception 'VERSION_CONFLICT';
end; $$;

create function api.read_work(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.work_records; versions jsonb;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'workId') or request-'workId'<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 select * into r from private.work_records where id=(request->>'workId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
 perform private.consume_identity_quota('identity_read');
 perform pg_advisory_xact_lock(hashtextextended(r.id::text,5));
 select * into r from private.work_records where id=r.id;if not found then raise exception 'NOT_FOUND';end if;
 select coalesce(jsonb_agg(jsonb_build_object('version',v.version,'state',v.state,'content',v.content,'contentHash',v.content_hash,'evidenceHash',v.evidence_hash,'createdAt',v.created_at,'submittedAt',v.submitted_at,
 'decision',(select jsonb_build_object('id',d.id,'outcome',d.outcome,'reason',d.reason,'actorId',d.representative_id,'authorityDecisionId',d.authority_decision_id,'contentHash',d.content_hash,'evidenceHash',d.evidence_hash,'recordedAt',d.recorded_at) from private.work_decisions d where d.work_id=r.id and d.version=v.version)) order by v.version),'[]') into versions from private.work_record_versions v where v.work_id=r.id;
 return jsonb_build_object('workId',r.id,'agreementId',r.agreement_id,'workerId',r.worker_id,'companyId',r.company_id,'representativeId',r.representative_id,'currentVersion',r.current_version,'versions',versions);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end; $$;
create function api.read_work_evidence(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.work_evidence;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'evidenceId') or request-'evidenceId'<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');select * into e from private.work_evidence where id=(request->>'evidenceId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('id',e.id,'workId',e.work_id,'version',e.version,'ownerId',e.owner_id,'text',e.text,'recordedAt',e.recorded_at);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end; $$;
create function api.list_work(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb; cursor uuid;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'cursor') or request-'cursor'<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 cursor:=(request->>'cursor')::uuid;perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('workId',id,'version',version,'state',state,'hours',content->>'hours','periodStart',content->>'periodStart','periodEnd',content->>'periodEnd') order by id),'[]') into items from (
 select r.id,v.version,v.state,v.content from private.work_records r cross join lateral(select * from private.work_record_versions v where v.work_id=r.id order by version desc limit 1) v where cursor is null or r.id>cursor order by r.id limit 20) page;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'workId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end; $$;
grant create on schema api to fw_user_exec;
alter function api.work_command(jsonb) owner to fw_user_exec;
alter function api.read_work(jsonb) owner to fw_user_exec;
alter function api.read_work_evidence(jsonb) owner to fw_user_exec;
alter function api.list_work(jsonb) owner to fw_user_exec;
revoke all on function api.work_command(jsonb),api.read_work(jsonb),api.read_work_evidence(jsonb),api.list_work(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.work_command(jsonb),api.read_work(jsonb),api.read_work_evidence(jsonb),api.list_work(jsonb) to authenticated;
revoke all on function private.work_guard_version(),private.work_guard_root(),private.work_check_pointer() from public,anon,authenticated,service_role;
revoke create on schema private from fw_user_exec,fw_policy_exec;
revoke create on schema api from fw_user_exec;
notify pgrst,'reload schema';
commit;
