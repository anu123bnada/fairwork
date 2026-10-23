-- Day 6 local candidate. Apply to hosted Supabase only after explicit approval.
begin;
grant create on schema private to fw_user_exec,fw_policy_exec;
grant create on schema api to fw_user_exec;
create table private.work_integrity_events (
 id uuid primary key default gen_random_uuid(), work_id uuid not null, version integer not null,
 operation text not null check(operation in ('withdraw','correct','retract')),
 actor_id uuid not null references private.profiles(id), reason text not null check(length(btrim(reason)) between 1 and 2000),
 next_version integer, decision_id uuid references private.work_decisions(id),
 recorded_at timestamptz not null default transaction_timestamp(),
 foreign key(work_id,version) references private.work_record_versions(work_id,version),
 foreign key(work_id,next_version) references private.work_record_versions(work_id,version),
 check((operation='correct' and next_version=version+1 and decision_id is null) or (operation='withdraw' and next_version is null and decision_id is null) or (operation='retract' and next_version is null and decision_id is not null)),
 unique(work_id,version,operation)
);
create unique index work_withdrawal_once on private.work_integrity_events(work_id) where operation='withdraw';
create unique index work_retraction_once on private.work_integrity_events(decision_id) where operation='retract';
create table private.work_integrity_receipts (
 actor_id uuid not null references private.profiles(id), idempotency_key uuid not null, request_hash text not null, result jsonb not null,
 recorded_at timestamptz not null default transaction_timestamp(), primary key(actor_id,idempotency_key)
);
create table private.work_passports (
 id uuid not null unique default gen_random_uuid(), worker_id uuid primary key references private.profiles(id),
 created_at timestamptz not null default transaction_timestamp()
);
alter table private.work_integrity_events owner to fw_schema_owner;
alter table private.work_integrity_receipts owner to fw_schema_owner;
alter table private.work_passports owner to fw_schema_owner;
revoke all on private.work_integrity_events,private.work_integrity_receipts,private.work_passports from public,anon,authenticated,service_role;
grant select,insert on private.work_integrity_events,private.work_integrity_receipts,private.work_passports to fw_user_exec;
alter table private.work_integrity_events enable row level security;
alter table private.work_integrity_events force row level security;
alter table private.work_integrity_receipts enable row level security;
alter table private.work_integrity_receipts force row level security;
alter table private.work_passports enable row level security;
alter table private.work_passports force row level security;
create policy integrity_read on private.work_integrity_events for select to fw_user_exec using(exists(select 1 from private.work_record_versions v where v.work_id=work_integrity_events.work_id and v.version=work_integrity_events.version));
create policy integrity_insert on private.work_integrity_events for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and recorded_at=transaction_timestamp() and exists(select 1 from private.work_records r where r.id=work_id and ((operation in ('withdraw','correct') and actor_id=r.worker_id) or (operation='retract' and actor_id=r.representative_id and private.work_authority(r.company_id,r.representative_id) is not null))) and (operation<>'retract' or exists(select 1 from private.work_decisions d where d.id=decision_id and d.work_id=work_integrity_events.work_id and d.version=work_integrity_events.version and d.representative_id=actor_id and d.outcome='verified')));
create policy integrity_receipt_read on private.work_integrity_receipts for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy integrity_receipt_insert on private.work_integrity_receipts for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and recorded_at=transaction_timestamp());
create policy passport_read on private.work_passports for select to fw_user_exec using(private.is_active() and worker_id=private.request_uid());
create policy passport_insert on private.work_passports for insert to fw_user_exec with check(private.is_active() and worker_id=private.request_uid() and created_at=transaction_timestamp());
create trigger integrity_immutable before update or delete on private.work_integrity_events for each row execute function private.reject_history_edit();
create trigger integrity_receipt_immutable before update or delete on private.work_integrity_receipts for each row execute function private.reject_history_edit();
create trigger passport_immutable before update or delete on private.work_passports for each row execute function private.reject_history_edit();

create function private.work_lock_owner(worker uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if worker is distinct from private.request_uid() or not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 perform 1 from private.profiles where id=worker for share;
 if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
end; $$;
alter function private.work_lock_owner(uuid) owner to fw_policy_exec;
revoke all on function private.work_lock_owner(uuid) from public,anon,authenticated,service_role;
grant execute on function private.work_lock_owner(uuid) to fw_user_exec;

alter table private.work_record_versions drop constraint work_record_versions_state_check;
alter table private.work_record_versions add constraint work_record_versions_state_check check(state in ('draft','submitted','verified','disputed','rejected','superseded','withdrawn','invalidated'));
create or replace function private.work_guard_version() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'ACTION_FORBIDDEN';end if;
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'state'-'submitted_at') is distinct from (to_jsonb(old)-'state'-'submitted_at') then raise exception 'ACTION_FORBIDDEN';end if;
  if not (
   (old.state='draft' and new.state='submitted' and private.request_uid()=new.worker_id) or
   (old.state not in ('superseded','withdrawn') and new.state='superseded' and private.request_uid()=new.worker_id) or
   (old.state='submitted' and new.state in ('verified','disputed','rejected') and private.request_uid()=new.representative_id and exists(select 1 from private.work_decisions d where d.work_id=new.work_id and d.version=new.version and d.outcome=new.state and d.content_hash=new.content_hash and d.evidence_hash=new.evidence_hash)) or
   (old.state not in ('superseded','withdrawn') and new.state='withdrawn' and private.request_uid()=new.worker_id and exists(select 1 from private.work_integrity_events e where e.work_id=new.work_id and e.version=new.version and e.operation='withdraw')) or
   (old.state='verified' and new.state='invalidated' and private.request_uid()=new.representative_id and exists(select 1 from private.work_integrity_events e where e.work_id=new.work_id and e.version=new.version and e.operation='retract'))
  ) then raise exception 'VERSION_CONFLICT';end if;
  if new.submitted_at is distinct from old.submitted_at and not(old.state='draft' and new.state='submitted' and new.submitted_at=transaction_timestamp()) then raise exception 'ACTION_FORBIDDEN';end if;
 end if;
 if new.content_hash<>private.agreement_hash(new.content) or new.evidence_hash<>private.agreement_hash(new.content->'evidence') or (new.content->'agreement'->>'id')::uuid<>new.agreement_id or (new.content->'agreement'->>'version')::integer<>new.agreement_version or (new.content->'agreement'->>'authorityDecisionId')::uuid<>new.authority_decision_id then raise exception 'VALIDATION_FAILED';end if;
 return new;
end; $$;

-- Retain the complete Day 5 validator behind a private, non-client-callable wrapper.
alter function api.work_command(jsonb) rename to work_command_day5;
alter function api.work_command_day5(jsonb) set schema private;
revoke all on function private.work_command_day5(jsonb) from public,anon,authenticated,service_role;
create function api.work_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.work_records;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request->>'operation'<>'create' then
  select * into r from private.work_records where id=(request->>'workId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
  perform private.agreement_lock_participants(r.worker_id,r.representative_id,r.company_id);
  perform pg_advisory_xact_lock(hashtextextended(r.agreement_id::text,4));
  perform pg_advisory_xact_lock(hashtextextended(r.id::text,5));
  if exists(select 1 from private.work_integrity_events where work_id=r.id and operation='withdraw') then raise exception 'ACTION_FORBIDDEN';end if;
 end if;
 return private.work_command_day5(request);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end; $$;

alter table private.audit_logs drop constraint audit_logs_action_check;
alter table private.audit_logs add constraint audit_logs_action_check check(action in ('create_profile','update_profile','provision_company','decide_membership','bootstrap_capability','review_offer','answer_offer_question','confirm_agreement','agreement_create','agreement_amend','agreement_propose','agreement_acknowledge','agreement_decide','work_create','work_revise','work_submit','work_reopen','work_decide','work_withdraw','work_correct','work_retract','passport_initialize'));
alter table private.audit_logs drop constraint audit_logs_reason_code_check;
alter table private.audit_logs add constraint audit_logs_reason_code_check check(reason_code in ('owner_profile_command','synthetic_authority_command','offline_capability_bootstrap','day3_offer_command','day4_agreement_command','day5_work_command','day6_integrity_command'));
create policy integrity_audit_insert on private.audit_logs for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and action in ('work_withdraw','work_correct','work_retract','passport_initialize') and reason_code='day6_integrity_command' and retention_class='authority' and db_time=transaction_timestamp());

create function api.work_integrity(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; op text; allowed text[]; r private.work_records; v private.work_record_versions; receipt private.work_integrity_receipts; key uuid; digest text; result jsonb; decision_id uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>65536 then raise exception 'VALIDATION_FAILED';end if;
 op:=request->>'operation';allowed:=array['operation','workId','idempotencyKey','expectedVersion','expectedHash','expectedState','expectedEvidenceHash','reason'];
 if op='correct' then allowed:=allowed||array['agreementVersion','payload'];elsif op not in ('withdraw','retract') or op is null then raise exception 'VALIDATION_FAILED';end if;
 if not(request ?& allowed) or exists(select 1 from jsonb_object_keys(request) k where not(k=any(allowed))) or exists(select 1 from jsonb_each(request) x where x.value='null'::jsonb) then raise exception 'VALIDATION_FAILED';end if;
 if exists(select 1 from unnest(allowed) k where k not in ('payload','agreementVersion','expectedVersion') and jsonb_typeof(request->k)<>'string') or jsonb_typeof(request->'expectedVersion')<>'number' or (op='correct' and jsonb_typeof(request->'agreementVersion')<>'number') or length(btrim(request->>'reason')) not between 1 and 2000 then raise exception 'VALIDATION_FAILED';end if;
 key:=(request->>'idempotencyKey')::uuid;digest:=private.agreement_hash(request);
 select * into r from private.work_records where id=(request->>'workId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
 if (op='retract' and actor<>r.representative_id) or (op<>'retract' and actor<>r.worker_id) then raise exception 'ACTION_FORBIDDEN';end if;
 if op='withdraw' then perform private.work_lock_owner(r.worker_id);else perform private.agreement_lock_participants(r.worker_id,r.representative_id,r.company_id);end if;
 perform pg_advisory_xact_lock(hashtextextended(r.agreement_id::text,4));
 perform pg_advisory_xact_lock(hashtextextended(r.id::text,5));
 select * into r from private.work_records where id=r.id;if not found then raise exception 'NOT_FOUND';end if;
 select * into v from private.work_record_versions where work_id=r.id and version=r.current_version for update;if not found then raise exception 'NOT_FOUND';end if;
 if op<>'withdraw' and private.work_authority(r.company_id,r.representative_id) is null then raise exception 'ACTION_FORBIDDEN';end if;
 select * into receipt from private.work_integrity_receipts where actor_id=actor and idempotency_key=key;
 if found then if receipt.request_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT';end if;return receipt.result;end if;
 if exists(select 1 from private.work_integrity_events where work_id=r.id and operation='withdraw') then raise exception 'ACTION_FORBIDDEN';end if;
 if v.version is distinct from (request->>'expectedVersion')::integer or v.content_hash is distinct from request->>'expectedHash' or v.state is distinct from request->>'expectedState' or v.evidence_hash is distinct from request->>'expectedEvidenceHash' then raise exception 'VERSION_CONFLICT';end if;
 if op='correct' then
  result:=private.work_command_day5((request-'reason')||jsonb_build_object('operation',case when v.state='draft' then 'revise' else 'reopen' end,'idempotencyKey',gen_random_uuid()));
  insert into private.work_integrity_events(work_id,version,operation,actor_id,reason,next_version) values(r.id,v.version,op,actor,request->>'reason',v.version+1);
  result:=result||jsonb_build_object('operation','correct');
 else
  perform private.consume_day3_quota();
  if op='retract' then
   if v.state<>'verified' then raise exception 'VERSION_CONFLICT';end if;
   select id into decision_id from private.work_decisions where work_id=r.id and version=v.version and representative_id=actor and outcome='verified';if not found then raise exception 'ACTION_FORBIDDEN';end if;
  end if;
  insert into private.work_integrity_events(work_id,version,operation,actor_id,reason,decision_id) values(r.id,v.version,op,actor,request->>'reason',decision_id);
  update private.work_record_versions set state=case when op='withdraw' then 'withdrawn' else 'invalidated' end where work_id=r.id and version=v.version returning * into v;
  result:=jsonb_build_object('workId',r.id,'version',v.version,'contentHash',v.content_hash,'evidenceHash',v.evidence_hash,'state',v.state,'actorId',actor,'operation',op,'decisionId',decision_id,'recordedAt',transaction_timestamp());
 end if;
 insert into private.work_integrity_receipts(actor_id,idempotency_key,request_hash,result) values(actor,key,digest,result);
 insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values(actor,'work_'||op,r.id,key,array['state','integrity_event',op],'day6_integrity_command','authority');
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';when unique_violation then raise exception 'VERSION_CONFLICT';end; $$;

alter function api.read_work(jsonb) rename to read_work_day5;
alter function api.read_work_day5(jsonb) set schema private;
revoke all on function private.read_work_day5(jsonb) from public,anon,authenticated,service_role;
create function api.read_work(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; events jsonb;
begin
 result:=private.read_work_day5(request);
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'version',e.version,'operation',e.operation,'actorId',e.actor_id,'reason',e.reason,'nextVersion',e.next_version,'decisionId',e.decision_id,'recordedAt',e.recorded_at) order by e.recorded_at,e.id),'[]') into events from private.work_integrity_events e where e.work_id=(request->>'workId')::uuid;
 return result||jsonb_build_object('integrityEvents',events);
end; $$;

-- This helper checks the immutable authority at the recorded verification time.
create function private.work_historical_authority(basis uuid,company uuid,representative uuid,verified_at timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.company_membership_decisions d where d.id=basis and d.company_id=company and d.subject_id=representative and d.decision='approve' and d.effective_at<=verified_at and d.expires_at>verified_at);
$$;
alter function private.work_historical_authority(uuid,uuid,uuid,timestamptz) owner to fw_policy_exec;
revoke all on function private.work_historical_authority(uuid,uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function private.work_historical_authority(uuid,uuid,uuid,timestamptz) to fw_user_exec;
grant select(name) on private.companies to fw_policy_exec;
create function private.work_company_label(company uuid) returns text language sql stable security definer set search_path='' as $$ select name from private.companies where id=company; $$;
alter function private.work_company_label(uuid) owner to fw_policy_exec;
revoke all on function private.work_company_label(uuid) from public,anon,authenticated,service_role;
grant execute on function private.work_company_label(uuid) to fw_user_exec;

create function private.passport_eligible(work uuid,revision integer) returns boolean language sql stable set search_path='' as $$
 select exists(
 select 1 from private.work_records r join private.work_record_versions v on v.work_id=r.id and v.version=r.current_version
 join private.work_decisions d on d.work_id=v.work_id and d.version=v.version
 join private.agreement_versions a on a.agreement_id=v.agreement_id and a.version=v.agreement_version
 where r.id=work and r.worker_id=private.request_uid() and v.version=revision and v.state='verified'
 and d.outcome='verified' and d.worker_id=r.worker_id and d.representative_id=r.representative_id and d.company_id=r.company_id and d.authority_decision_id=v.authority_decision_id
 and d.content_hash=v.content_hash and d.evidence_hash=v.evidence_hash
 and not exists(select 1 from private.work_integrity_events e where e.work_id=r.id and (e.operation='withdraw' or (e.operation='retract' and e.decision_id=d.id)))
 and v.content_hash=private.agreement_hash(v.content) and v.evidence_hash=private.agreement_hash(v.content->'evidence')
 and v.content->'evidence'=(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'ownerId',e.owner_id,'text',e.text,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by e.id),'[]') from private.work_evidence e where e.work_id=v.work_id and e.version=v.version and e.owner_id=r.worker_id)
 and a.content_hash=v.content->'agreement'->>'contentHash' and a.authority_decision_id=v.authority_decision_id
 and (select count(*) from private.agreement_decisions ad join private.agreement_acknowledgements ack using(agreement_id,version,actor_id) where ad.agreement_id=a.agreement_id and ad.version=a.version and ad.actor_id in(r.worker_id,r.representative_id) and ad.decision='confirm' and ad.content_hash=a.content_hash and ack.content_hash=a.content_hash and ack.item_ids=a.unresolved_ids and ack.item_set_hash=a.unresolved_hash)=2
 and private.work_historical_authority(v.authority_decision_id,r.company_id,r.representative_id,d.recorded_at));
$$;
alter function private.passport_eligible(uuid,integer) owner to fw_user_exec;
revoke all on function private.passport_eligible(uuid,integer) from public,anon,authenticated,service_role;

create function api.initialize_passport(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; key uuid; digest text; receipt private.work_integrity_receipts; p private.work_passports; result jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'idempotencyKey') or request-'idempotencyKey'<>'{}' or jsonb_typeof(request->'idempotencyKey')<>'string' then raise exception 'VALIDATION_FAILED';end if;
 key:=(request->>'idempotencyKey')::uuid;digest:=private.agreement_hash(request||jsonb_build_object('operation','initialize_passport'));
 perform private.work_lock_owner(actor);perform pg_advisory_xact_lock(hashtextextended(actor::text,7));
 select * into receipt from private.work_integrity_receipts where actor_id=actor and idempotency_key=key;
 if found then if receipt.request_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT';end if;return receipt.result;end if;
 perform private.consume_day3_quota();
 select * into p from private.work_passports where worker_id=actor;
 if not found then
  insert into private.work_passports(worker_id) values(actor) returning * into p;
  insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values(actor,'passport_initialize',p.id,key,array['passport'],'day6_integrity_command','authority');
 end if;
 result:=jsonb_build_object('passportId',p.id,'ownerId',actor,'createdAt',p.created_at);
 insert into private.work_integrity_receipts(actor_id,idempotency_key,request_hash,result) values(actor,key,digest,result);
 return result;
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';when unique_violation then raise exception 'VERSION_CONFLICT';end; $$;

create function api.read_passport(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; cursor uuid; p private.work_passports; entries jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'cursor') or request-'cursor'<>'{}' or jsonb_typeof(request->'cursor') not in ('string','null') then raise exception 'VALIDATION_FAILED';end if;
 cursor:=(request->>'cursor')::uuid;perform private.consume_identity_quota('identity_read');
 select * into p from private.work_passports where worker_id=actor;
 select coalesce(jsonb_agg(jsonb_build_object('workId',r.id,'version',v.version,'role',v.content->>'role','periodStart',v.content->>'periodStart','periodEnd',v.content->>'periodEnd','hours',v.content->>'hours','summary',left(v.content->>'tasks',240),'companyId',r.company_id,'companyName',private.work_company_label(r.company_id),'agreementId',v.agreement_id,'agreementVersion',v.agreement_version,'agreementHash',v.content->'agreement'->>'contentHash','agreementEffectiveAt',v.content->'agreement'->>'effectiveAt','verificationId',d.id,'verifiedAt',d.recorded_at,'verifierId',d.representative_id,'authorityDecisionId',d.authority_decision_id,'evidenceCount',jsonb_array_length(v.content->'evidence'),'evidenceHash',v.evidence_hash) order by r.id),'[]') into entries
 from (select * from private.work_records root where p.id is not null and root.worker_id=actor and (cursor is null or root.id>cursor) and private.passport_eligible(root.id,root.current_version) order by root.id limit 20) r
 join private.work_record_versions v on v.work_id=r.id and v.version=r.current_version join private.work_decisions d on d.work_id=v.work_id and d.version=v.version;
 return jsonb_build_object('policyVersion','private-work-passport.v1','passportId',p.id,'ownerId',actor,'createdAt',p.created_at,'entries',entries,'nextCursor',case when jsonb_array_length(entries)=20 then entries->19->>'workId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end; $$;

alter function api.work_command(jsonb) owner to fw_user_exec;
alter function api.work_integrity(jsonb) owner to fw_user_exec;
alter function api.read_work(jsonb) owner to fw_user_exec;
alter function api.initialize_passport(jsonb) owner to fw_user_exec;
alter function api.read_passport(jsonb) owner to fw_user_exec;
revoke all on function api.work_command(jsonb),api.work_integrity(jsonb),api.read_work(jsonb),api.initialize_passport(jsonb),api.read_passport(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.work_command(jsonb),api.work_integrity(jsonb),api.read_work(jsonb),api.initialize_passport(jsonb),api.read_passport(jsonb) to authenticated;
revoke create on schema private from fw_user_exec,fw_policy_exec;
revoke create on schema api from fw_user_exec;
notify pgrst,'reload schema';
commit;
