-- Day 7 local candidate. No hosted application is authorized.
begin;
create role fw_review_exec nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant fw_review_exec to postgres;
grant usage on schema private,api to fw_review_exec;
grant create on schema private,api to fw_review_exec,fw_user_exec;
grant create on schema private to fw_policy_exec;
alter default privileges for role fw_review_exec revoke execute on functions from public;
grant execute on function private.request_uid(),private.request_jwt(),private.require_identity(),private.is_active(),private.has_capability(text),private.agreement_hash(jsonb) to fw_review_exec;

create table private.work_cases (
 id uuid primary key, work_id uuid not null, work_version integer not null,
 opened_by uuid not null references private.profiles(id), reason_code text not null check(reason_code in ('work_inaccurate','evidence_integrity','verification_conflict','suspected_fraud')),
 reason text not null check(length(btrim(reason)) between 1 and 2000), content_hash text not null, evidence_hash text not null,
 revision integer not null default 1 check(revision>0), status text not null default 'open' check(status in ('open','resolved')),
 opened_at timestamptz not null default transaction_timestamp(), closed_at timestamptz,
 foreign key(work_id,work_version) references private.work_record_versions(work_id,version), unique(id,work_id,work_version),
 check((status='open' and closed_at is null) or (status='resolved' and closed_at is not null))
);
create unique index work_case_one_open on private.work_cases(work_id) where status='open';
create index work_case_target on private.work_cases(work_id,work_version,id);
create table private.work_case_assignments (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references private.work_cases(id),
 reviewer_id uuid not null references private.profiles(id), assigned_by uuid not null references private.profiles(id),
 reason text not null check(length(btrim(reason)) between 1 and 2000), assigned_at timestamptz not null default transaction_timestamp(),
 expires_at timestamptz not null, accepted_at timestamptz, revoked_at timestamptz,
 check(reviewer_id<>assigned_by), check(expires_at>assigned_at and expires_at<=assigned_at+interval '30 days'),
 unique(case_id,id,reviewer_id)
);
create unique index work_case_one_assignment on private.work_case_assignments(case_id) where revoked_at is null;
create index work_case_reviewer on private.work_case_assignments(reviewer_id,case_id) where revoked_at is null;
create table private.work_case_resolutions (
 case_id uuid primary key, work_id uuid not null, work_version integer not null,
 assignment_id uuid not null, reviewer_id uuid not null,
 outcome text not null check(outcome in ('dismiss','uphold','correction_required')),
 rationale text not null check(length(btrim(rationale)) between 1 and 4000), recorded_at timestamptz not null default transaction_timestamp(),
 foreign key(case_id,work_id,work_version) references private.work_cases(id,work_id,work_version),
 foreign key(case_id,assignment_id,reviewer_id) references private.work_case_assignments(case_id,id,reviewer_id)
);
create index work_case_terminal_target on private.work_case_resolutions(work_id,work_version) where outcome<>'dismiss';
create table private.work_case_events (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references private.work_cases(id), revision integer not null,
 actor_id uuid not null references private.profiles(id), operation text not null check(operation in ('open','assign','accept','refuse','revoke','decide')),
 note text not null, recorded_at timestamptz not null default transaction_timestamp(), unique(case_id,revision)
);
create table private.work_case_receipts (
 actor_id uuid not null references private.profiles(id), idempotency_key uuid not null, request_hash text not null, result jsonb not null,
 recorded_at timestamptz not null default transaction_timestamp(), primary key(actor_id,idempotency_key)
);
do $$ declare t text;begin
 foreach t in array array['work_cases','work_case_assignments','work_case_resolutions','work_case_events','work_case_receipts'] loop
  execute format('alter table private.%I owner to fw_schema_owner',t);
  execute format('alter table private.%I enable row level security',t);
  execute format('alter table private.%I force row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on private.%I to fw_review_exec',t);
 end loop;
end; $$;
grant update(revision,status,closed_at) on private.work_cases to fw_review_exec;
grant update(accepted_at,revoked_at) on private.work_case_assignments to fw_review_exec;
grant select on private.work_records to fw_review_exec;
grant select on private.work_record_versions to fw_review_exec;
-- Policy owner reads metadata only, never case reason, rationale or raw evidence.
grant select(id,agreement_id,worker_id,company_id,representative_id,current_version,published) on private.work_records to fw_policy_exec;
grant select(work_id,version,submitted_at) on private.work_record_versions to fw_policy_exec;
grant select(id,work_id,work_version,opened_by,status,revision) on private.work_cases to fw_policy_exec;
grant select(id,case_id,reviewer_id,assigned_by,expires_at,accepted_at,revoked_at) on private.work_case_assignments to fw_policy_exec;
grant select(case_id,work_id,work_version,outcome) on private.work_case_resolutions to fw_policy_exec;
grant update(subject_id) on private.capability_assignments to fw_policy_exec;
-- SELECT FOR SHARE needs an UPDATE USING policy as well as the column privilege.
-- WITH CHECK false forbids mutations; the immutable capability trigger also remains.
create policy case_capability_lock on private.capability_assignments for update to fw_policy_exec using(private.request_uid() is not null) with check(false);
create policy case_work_metadata on private.work_records for select to fw_policy_exec using(private.request_uid() is not null);
create policy case_version_metadata on private.work_record_versions for select to fw_policy_exec using(private.request_uid() is not null);
create policy case_metadata on private.work_cases for select to fw_policy_exec using(private.request_uid() is not null);
create policy case_assignment_metadata on private.work_case_assignments for select to fw_policy_exec using(private.request_uid() is not null);
create policy case_resolution_metadata on private.work_case_resolutions for select to fw_policy_exec using(private.request_uid() is not null);

create function private.case_capability(subject uuid,wanted text) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from private.profiles p where p.id=subject and p.account_state='active' and p.deleted_at is null) and exists(select 1 from private.capability_assignments c where c.subject_id=subject and c.capability=wanted and c.revoked_at is null and c.expires_at>clock_timestamp());
$$;
create function private.case_privileged(wanted text) returns boolean language sql volatile security definer set search_path='' as $$
 select private.is_active() and coalesce(private.request_jwt()->>'aal','')='aal2' and private.case_capability(private.request_uid(),wanted);
$$;
create function private.case_participant(work uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from private.work_records r where r.id=work and (r.worker_id=private.request_uid() or (r.published and r.representative_id=private.request_uid() and private.agreement_participants_active(r.worker_id,r.representative_id) and private.work_authority(r.company_id,r.representative_id) is not null)));
$$;
create function private.case_independent(work uuid,subject uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.work_records r where r.id=work and subject not in(r.worker_id,r.representative_id) and not exists(select 1 from private.company_memberships m where m.company_id=r.company_id and m.subject_id=subject));
$$;
create function private.case_operator(work uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select private.case_privileged('review_operator') and private.case_independent(work,private.request_uid());
$$;
create function private.case_reviewer(target uuid,accepted boolean) returns boolean language sql volatile security definer set search_path='' as $$
 select private.case_privileged('reviewer') and exists(select 1 from private.work_case_assignments a join private.work_cases c on c.id=a.case_id where c.id=target and a.reviewer_id=private.request_uid() and a.revoked_at is null and a.expires_at>clock_timestamp() and (not accepted or a.accepted_at is not null) and a.assigned_by<>private.request_uid() and private.case_independent(c.work_id,a.reviewer_id));
$$;
create function private.case_visible(target uuid,details boolean) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from private.work_cases c where c.id=target and (private.case_participant(c.work_id) or private.case_reviewer(c.id,details) or (not details and private.case_operator(c.work_id))));
$$;
create function private.case_version_access(work uuid,revision integer) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from private.work_records r join private.work_record_versions v on v.work_id=r.id where r.id=$1 and v.version=$2 and ((private.case_participant($1) and (r.worker_id=private.request_uid() or v.submitted_at is not null)) or exists(select 1 from private.work_cases c where c.work_id=$1 and c.work_version=$2 and private.case_reviewer(c.id,true))));
$$;
create function private.work_case_blocked(work uuid,revision integer) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.work_cases c where c.work_id=work and c.status='open') or exists(select 1 from private.work_case_resolutions d where d.work_id=work and d.work_version=revision and d.outcome<>'dismiss');
$$;
create function private.case_lock(work uuid,candidate uuid) returns void language plpgsql security definer set search_path='' as $$
declare r record; subject uuid;
begin
 select id,agreement_id,worker_id,company_id,representative_id into r from private.work_records where id=work;if not found then raise exception 'NOT_FOUND';end if;
 perform p.id from private.profiles p where p.id in(r.worker_id,r.representative_id,private.request_uid(),candidate) order by p.id for share;
 perform c.subject_id from private.capability_assignments c where c.subject_id in(private.request_uid(),candidate) order by c.subject_id,c.capability for share;
 for subject in select distinct x from unnest(array[r.representative_id,private.request_uid(),candidate]) x where x is not null order by x loop
  perform pg_advisory_xact_lock(hashtextextended(r.company_id::text||subject::text,1));
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(r.agreement_id::text,4));
 perform pg_advisory_xact_lock(hashtextextended(work::text,5));
end; $$;
do $$ declare p record;begin
 for p in select oid::regprocedure signature from pg_proc where pronamespace='private'::regnamespace and proname in ('case_capability','case_privileged','case_participant','case_independent','case_operator','case_reviewer','case_visible','case_version_access','work_case_blocked','case_lock') loop
  execute format('alter function %s owner to fw_policy_exec',p.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',p.signature);
  execute format('grant execute on function %s to fw_review_exec',p.signature);
 end loop;
end; $$;
grant execute on function private.work_case_blocked(uuid,integer) to fw_user_exec;

create policy review_case_read on private.work_cases for select to fw_review_exec using(private.case_participant(work_id) or private.case_operator(work_id) or private.case_reviewer(id,false));
create policy review_case_insert on private.work_cases for insert to fw_review_exec with check(opened_by=private.request_uid() and private.case_participant(work_id) and status='open' and revision=1 and opened_at=transaction_timestamp());
create policy review_case_update on private.work_cases for update to fw_review_exec using(private.case_visible(id,false)) with check(private.case_visible(id,false));
create policy review_assignment_read on private.work_case_assignments for select to fw_review_exec using(private.case_visible(case_id,false));
create policy review_assignment_insert on private.work_case_assignments for insert to fw_review_exec with check(assigned_by=private.request_uid() and assigned_at=transaction_timestamp() and exists(select 1 from private.work_cases c where c.id=case_id and private.case_operator(c.work_id)));
create policy review_assignment_update on private.work_case_assignments for update to fw_review_exec using(private.case_visible(case_id,false)) with check(reviewer_id=private.request_uid() or private.case_visible(case_id,false));
create policy review_resolution_read on private.work_case_resolutions for select to fw_review_exec using(private.case_visible(case_id,true));
create policy review_resolution_insert on private.work_case_resolutions for insert to fw_review_exec with check(reviewer_id=private.request_uid() and private.case_reviewer(case_id,true) and recorded_at=transaction_timestamp());
create policy review_event_read on private.work_case_events for select to fw_review_exec using(private.case_visible(case_id,true));
create policy review_event_insert on private.work_case_events for insert to fw_review_exec with check(actor_id=private.request_uid() and private.case_visible(case_id,false) and recorded_at=transaction_timestamp());
create policy review_receipt_read on private.work_case_receipts for select to fw_review_exec using(private.is_active() and actor_id=private.request_uid());
create policy review_receipt_insert on private.work_case_receipts for insert to fw_review_exec with check(private.is_active() and actor_id=private.request_uid() and recorded_at=transaction_timestamp());
create policy review_work_read on private.work_records for select to fw_review_exec using(private.case_participant(id) or private.case_operator(id) or exists(select 1 from private.work_cases c where c.work_id=work_records.id and private.case_reviewer(c.id,false)));
create policy review_version_read on private.work_record_versions for select to fw_review_exec using(private.case_version_access(work_id,version));
create trigger case_resolution_immutable before update or delete on private.work_case_resolutions for each row execute function private.reject_history_edit();
create trigger case_event_immutable before update or delete on private.work_case_events for each row execute function private.reject_history_edit();
create trigger case_receipt_immutable before update or delete on private.work_case_receipts for each row execute function private.reject_history_edit();
create function private.case_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'ACTION_FORBIDDEN';end if;
 if tg_table_name='work_cases' then
  if (to_jsonb(new)-'revision'-'status'-'closed_at') is distinct from (to_jsonb(old)-'revision'-'status'-'closed_at') or old.status<>'open' or new.revision<>old.revision+1 then raise exception 'ACTION_FORBIDDEN';end if;
  if new.status='resolved' and (new.closed_at is distinct from transaction_timestamp() or not exists(select 1 from private.work_case_resolutions d where d.case_id=new.id)) then raise exception 'ACTION_FORBIDDEN';end if;
 else
  if (to_jsonb(new)-'accepted_at'-'revoked_at') is distinct from (to_jsonb(old)-'accepted_at'-'revoked_at') or old.revoked_at is not null then raise exception 'ACTION_FORBIDDEN';end if;
  if new.accepted_at is distinct from old.accepted_at and (old.accepted_at is not null or new.accepted_at is distinct from transaction_timestamp() or new.reviewer_id<>private.request_uid()) then raise exception 'ACTION_FORBIDDEN';end if;
  if new.revoked_at is distinct from old.revoked_at and new.revoked_at is distinct from transaction_timestamp() then raise exception 'ACTION_FORBIDDEN';end if;
 end if;return new;
end; $$;
alter function private.case_guard() owner to fw_review_exec;
revoke all on function private.case_guard() from public,anon,authenticated,service_role;
create trigger case_guard before update or delete on private.work_cases for each row execute function private.case_guard();
create trigger case_assignment_guard before update or delete on private.work_case_assignments for each row execute function private.case_guard();
create function private.case_quota(read_only boolean) returns void language plpgsql security definer set search_path='' as $$
begin if read_only then perform private.consume_identity_quota('identity_read');else perform private.consume_day3_quota();end if;end; $$;
alter function private.case_quota(boolean) owner to fw_user_exec;
revoke all on function private.case_quota(boolean) from public,anon,authenticated,service_role;
grant execute on function private.case_quota(boolean) to fw_review_exec;
alter table private.audit_logs drop constraint audit_logs_action_check;
alter table private.audit_logs add constraint audit_logs_action_check check(action in ('create_profile','update_profile','provision_company','decide_membership','bootstrap_capability','review_offer','answer_offer_question','confirm_agreement','agreement_create','agreement_amend','agreement_propose','agreement_acknowledge','agreement_decide','work_create','work_revise','work_submit','work_reopen','work_decide','work_withdraw','work_correct','work_retract','passport_initialize','case_open','case_assign','case_accept','case_refuse','case_revoke','case_decide'));
alter table private.audit_logs drop constraint audit_logs_reason_code_check;
alter table private.audit_logs add constraint audit_logs_reason_code_check check(reason_code in ('owner_profile_command','synthetic_authority_command','offline_capability_bootstrap','day3_offer_command','day4_agreement_command','day5_work_command','day6_integrity_command','day7_case_command'));
grant insert on private.audit_logs to fw_review_exec;
create policy case_audit_insert on private.audit_logs for insert to fw_review_exec with check(private.is_active() and actor_id=private.request_uid() and action in ('case_open','case_assign','case_accept','case_refuse','case_revoke','case_decide') and reason_code='day7_case_command' and retention_class='authority' and db_time=transaction_timestamp());

create function api.work_case_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; op text; allowed text[]; target uuid; key uuid; digest text; c private.work_cases; r private.work_records; v private.work_record_versions; a private.work_case_assignments; receipt private.work_case_receipts; result jsonb; candidate uuid; note text; next_revision integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>65536 then raise exception 'VALIDATION_FAILED';end if;
 op:=request->>'operation';allowed:=array['operation','caseId','idempotencyKey'];
 if op='open' then allowed:=allowed||array['workId','expectedVersion','expectedHash','expectedEvidenceHash','expectedState','reasonCode','reason'];
 elsif op='assign' then allowed:=allowed||array['expectedRevision','reviewerId','expiresAt','reason'];
 elsif op='accept' then allowed:=allowed||array['expectedRevision','noConflict'];
 elsif op='revoke' then allowed:=allowed||array['expectedRevision','reason'];
 elsif op='decide' then allowed:=allowed||array['expectedRevision','outcome','rationale'];else raise exception 'VALIDATION_FAILED';end if;
 if not(request ?& allowed) or exists(select 1 from jsonb_object_keys(request) k where not(k=any(allowed))) or exists(select 1 from jsonb_each(request) x where x.value='null'::jsonb) then raise exception 'VALIDATION_FAILED';end if;
 if exists(select 1 from unnest(allowed) k where k not in ('expectedVersion','expectedRevision','noConflict') and jsonb_typeof(request->k)<>'string') or (request ? 'expectedVersion' and jsonb_typeof(request->'expectedVersion')<>'number') or (request ? 'expectedRevision' and jsonb_typeof(request->'expectedRevision')<>'number') or (op='accept' and jsonb_typeof(request->'noConflict')<>'boolean') then raise exception 'VALIDATION_FAILED';end if;
 if (request ? 'reason' and length(btrim(request->>'reason')) not between 1 and 2000) or (op='decide' and (request->>'outcome' not in ('dismiss','uphold','correction_required') or length(btrim(request->>'rationale')) not between 1 and 4000)) or (op='open' and request->>'reasonCode' not in ('work_inaccurate','evidence_integrity','verification_conflict','suspected_fraud')) then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'caseId')::uuid;key:=(request->>'idempotencyKey')::uuid;digest:=private.agreement_hash(request);
 if op<>'open' and coalesce(private.request_jwt()->>'aal','')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
 if op='open' then
  select * into r from private.work_records where id=(request->>'workId')::uuid;if not found or not private.case_participant(r.id) then raise exception 'NOT_FOUND';end if;
 else
  select * into c from private.work_cases where id=target;if not found then raise exception 'NOT_FOUND';end if;
  select * into r from private.work_records where id=c.work_id;
  if op in ('assign','revoke') and not private.case_operator(r.id) then raise exception 'ACTION_FORBIDDEN';end if;
  if op in ('accept','decide') and not private.case_reviewer(c.id,op='decide') then raise exception 'ACTION_FORBIDDEN';end if;
 end if;
 candidate:=case when op='assign' then (request->>'reviewerId')::uuid else actor end;
 perform private.case_lock(r.id,candidate);perform pg_advisory_xact_lock(hashtextextended(target::text,6));
 -- Re-read and reauthorize after all waits, before any replay or mutation.
 if op='open' then if not private.case_participant(r.id) then raise exception 'NOT_FOUND';end if;
 else
  select * into c from private.work_cases where id=target for update;if not found then raise exception 'NOT_FOUND';end if;
  if op in ('assign','revoke') and not private.case_operator(r.id) then raise exception 'ACTION_FORBIDDEN';end if;
  if op in ('accept','decide') and not private.case_reviewer(c.id,op='decide') then raise exception 'ACTION_FORBIDDEN';end if;
 end if;
 select * into receipt from private.work_case_receipts where actor_id=actor and idempotency_key=key;
 if found then if receipt.request_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT';end if;return receipt.result;end if;
 perform private.case_quota(false);
 if op='open' then
  select * into r from private.work_records where id=r.id;
  select * into v from private.work_record_versions where work_id=r.id and version=r.current_version;
  if not found then raise exception 'NOT_FOUND';end if;
  if v.version is distinct from (request->>'expectedVersion')::integer or v.state is distinct from request->>'expectedState' or v.content_hash is distinct from request->>'expectedHash' or v.evidence_hash is distinct from request->>'expectedEvidenceHash' then raise exception 'VERSION_CONFLICT';end if;
  if v.submitted_at is null or v.state in ('draft','withdrawn','superseded') then raise exception 'ACTION_FORBIDDEN';end if;
  insert into private.work_cases(id,work_id,work_version,opened_by,reason_code,reason,content_hash,evidence_hash) values(target,r.id,v.version,actor,request->>'reasonCode',request->>'reason',v.content_hash,v.evidence_hash) returning * into c;
  next_revision:=1;note:=request->>'reason';
 else
  if c.revision is distinct from (request->>'expectedRevision')::integer or c.status<>'open' then raise exception 'VERSION_CONFLICT';end if;
  next_revision:=c.revision+1;
  select * into a from private.work_case_assignments where case_id=c.id and revoked_at is null for update;
  if op='assign' then
   if a.id is not null then raise exception 'VERSION_CONFLICT';end if;
   if candidate=actor or not private.case_independent(r.id,candidate) or not private.case_capability(candidate,'reviewer') then raise exception 'ACTION_FORBIDDEN';end if;
   if (request->>'expiresAt')::timestamptz<=clock_timestamp() or (request->>'expiresAt')::timestamptz>transaction_timestamp()+interval '30 days' then raise exception 'VALIDATION_FAILED';end if;
   insert into private.work_case_assignments(case_id,reviewer_id,assigned_by,reason,expires_at) values(c.id,candidate,actor,request->>'reason',(request->>'expiresAt')::timestamptz);note:=request->>'reason';
  elsif op='accept' then
   if a.id is null or a.reviewer_id<>actor or a.accepted_at is not null then raise exception 'VERSION_CONFLICT';end if;
   if (request->>'noConflict')::boolean then update private.work_case_assignments set accepted_at=transaction_timestamp() where id=a.id;note:='Reviewer explicitly declared no conflict';
   else op:='refuse';note:='Reviewer declined because independence was not declared';end if;
  elsif op='revoke' then
   if a.id is null then raise exception 'VERSION_CONFLICT';end if;
   update private.work_case_assignments set revoked_at=transaction_timestamp() where id=a.id;note:=request->>'reason';
  elsif op='decide' then
   if a.id is null or a.reviewer_id<>actor or a.accepted_at is null or a.expires_at<=clock_timestamp() then raise exception 'ACTION_FORBIDDEN';end if;
   insert into private.work_case_resolutions(case_id,work_id,work_version,assignment_id,reviewer_id,outcome,rationale) values(c.id,c.work_id,c.work_version,a.id,actor,request->>'outcome',request->>'rationale');note:=request->>'rationale';
  end if;
  update private.work_cases set revision=next_revision,status=case when op='decide' then 'resolved' else 'open' end,closed_at=case when op='decide' then transaction_timestamp() else null end where id=c.id returning * into c;
 end if;
 insert into private.work_case_events(case_id,revision,actor_id,operation,note) values(c.id,next_revision,actor,op,note);
 result:=jsonb_build_object('caseId',c.id,'revision',next_revision,'status',c.status,'operation',op,'actorId',actor,'recordedAt',transaction_timestamp());
 insert into private.work_case_receipts(actor_id,idempotency_key,request_hash,result) values(actor,key,digest,result);
 insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values(actor,'case_'||op,c.id,key,array['case_revision',op],'day7_case_command','authority');
 if op='refuse' then update private.work_case_assignments set revoked_at=transaction_timestamp() where id=a.id;end if;
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format then raise exception 'VALIDATION_FAILED';when unique_violation then raise exception 'VERSION_CONFLICT';end; $$;

create function api.read_work_case(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.work_cases; a private.work_case_assignments; details boolean; basis jsonb; events jsonb; resolution jsonb;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'caseId') or request-'caseId'<>'{}' or jsonb_typeof(request->'caseId')<>'string' then raise exception 'VALIDATION_FAILED';end if;
 select * into c from private.work_cases where id=(request->>'caseId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
 perform private.case_quota(true);perform pg_advisory_xact_lock(hashtextextended(c.id::text,6));
 select * into c from private.work_cases where id=c.id;if not found then raise exception 'NOT_FOUND';end if;
 details:=private.case_visible(c.id,true);
 select * into a from private.work_case_assignments where case_id=c.id order by assigned_at desc,id desc limit 1;
 if details then
  select jsonb_build_object('role',v.content->>'role','tasks',v.content->>'tasks','hours',v.content->>'hours','periodStart',v.content->>'periodStart','periodEnd',v.content->>'periodEnd','contentHash',v.content_hash,'evidenceHash',v.evidence_hash,'evidence',v.content->'evidence') into basis from private.work_record_versions v where v.work_id=c.work_id and v.version=c.work_version;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'actorId',e.actor_id,'operation',e.operation,'note',e.note,'recordedAt',e.recorded_at) order by e.revision),'[]') into events from private.work_case_events e where e.case_id=c.id;
  select jsonb_build_object('outcome',d.outcome,'rationale',d.rationale,'reviewerId',d.reviewer_id,'assignmentId',d.assignment_id,'recordedAt',d.recorded_at) into resolution from private.work_case_resolutions d where d.case_id=c.id;
 end if;
 return jsonb_build_object('caseId',c.id,'workId',c.work_id,'workVersion',c.work_version,'revision',c.revision,'status',c.status,'reasonCode',case when details then c.reason_code end,'reason',case when details then c.reason end,'openedAt',c.opened_at,'closedAt',c.closed_at,'basis',basis,'events',coalesce(events,'[]'),'resolution',resolution,'outcome',resolution->>'outcome',
 'assignment',case when a.id is not null then jsonb_build_object('id',a.id,'reviewerId',a.reviewer_id,'expiresAt',a.expires_at,'acceptedAt',a.accepted_at,'revokedAt',a.revoked_at) end,
 'permissions',jsonb_build_object('canAssign',c.status='open' and private.case_operator(c.work_id) and (a.id is null or a.revoked_at is not null),'canRevoke',c.status='open' and private.case_operator(c.work_id) and a.id is not null and a.revoked_at is null,'canAccept',c.status='open' and private.case_reviewer(c.id,false) and a.accepted_at is null,'canDecide',c.status='open' and private.case_reviewer(c.id,true)));
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end; $$;
create function api.list_work_cases(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cursor uuid; work uuid; items jsonb;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['cursor','workId']) or request-'cursor'-'workId'<>'{}' or jsonb_typeof(request->'cursor') not in ('string','null') or jsonb_typeof(request->'workId') not in ('string','null') then raise exception 'VALIDATION_FAILED';end if;
 cursor:=(request->>'cursor')::uuid;work:=(request->>'workId')::uuid;perform private.case_quota(true);
 select coalesce(jsonb_agg(jsonb_build_object('caseId',id,'workId',work_id,'workVersion',work_version,'revision',revision,'status',status,'openedAt',opened_at) order by id),'[]') into items from(select * from private.work_cases where (cursor is null or id>cursor) and (work is null or work_id=work) order by id limit 20) page;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'caseId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end; $$;

-- Preserve every Day 6 eligibility condition; add root-wide open-case suppression.
alter function private.passport_eligible(uuid,integer) rename to passport_eligible_day6;
create function private.passport_eligible(work uuid,revision integer) returns boolean language sql stable set search_path='' as $$ select private.passport_eligible_day6(work,revision) and not private.work_case_blocked(work,revision); $$;
alter function private.passport_eligible(uuid,integer) owner to fw_user_exec;
revoke all on function private.passport_eligible(uuid,integer),private.passport_eligible_day6(uuid,integer) from public,anon,authenticated,service_role;
alter function api.work_command(jsonb) rename to work_command_day6;
alter function api.work_command_day6(jsonb) set schema private;
revoke all on function private.work_command_day6(jsonb) from public,anon,authenticated,service_role;
create function api.work_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.work_records;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request->>'operation'='decide' then
  select * into r from private.work_records where id=(request->>'workId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
  perform private.agreement_lock_participants(r.worker_id,r.representative_id,r.company_id);perform pg_advisory_xact_lock(hashtextextended(r.agreement_id::text,4));perform pg_advisory_xact_lock(hashtextextended(r.id::text,5));
  select * into r from private.work_records where id=r.id;if private.work_case_blocked(r.id,r.current_version) then raise exception 'ACTION_FORBIDDEN';end if;
 end if;return private.work_command_day6(request);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end; $$;
alter function api.work_command(jsonb) owner to fw_user_exec;
alter function api.work_case_command(jsonb) owner to fw_review_exec;
alter function api.read_work_case(jsonb) owner to fw_review_exec;
alter function api.list_work_cases(jsonb) owner to fw_review_exec;
revoke all on function api.work_command(jsonb),api.work_case_command(jsonb),api.read_work_case(jsonb),api.list_work_cases(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.work_command(jsonb),api.work_case_command(jsonb),api.read_work_case(jsonb),api.list_work_cases(jsonb) to authenticated;
revoke create on schema private,api from fw_review_exec,fw_user_exec;
revoke create on schema private from fw_policy_exec;
notify pgrst,'reload schema';
commit;
