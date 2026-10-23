begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Correspondence is additive. An appeal opens a linked new case; it never edits
-- a previous resolution or removes any independent Passport exclusion.
create table private.case_followups(id uuid primary key default gen_random_uuid(),case_id uuid not null references private.work_cases(id),actor_id uuid not null references private.profiles(id),kind text not null check(kind in ('response','appeal')),message text not null check(length(btrim(message)) between 10 and 2000),linked_case_id uuid references private.work_cases(id),created_at timestamptz not null default transaction_timestamp(),check((kind='appeal')=(linked_case_id is not null)));
create unique index one_case_appeal on private.case_followups(case_id) where kind='appeal';
create unique index unique_appeal_child on private.case_followups(linked_case_id) where linked_case_id is not null;
create index case_followup_page on private.case_followups(case_id,id);
create table private.case_followup_receipts(actor_id uuid not null references private.profiles(id),key uuid not null,hash text not null,result jsonb not null,primary key(actor_id,key));
create table private.case_access_events(id uuid primary key default gen_random_uuid(),case_id uuid not null references private.work_cases(id),actor_id uuid not null references private.profiles(id),basis text not null check(basis in ('participant','accepted_independent_assignment')),recorded_at timestamptz not null default transaction_timestamp());
create index case_access_target on private.case_access_events(case_id,recorded_at desc);
do $$ declare t text;begin foreach t in array array['case_followups','case_followup_receipts','case_access_events'] loop
 execute format('alter table private.%I owner to fw_schema_owner',t);execute format('alter table private.%I enable row level security',t);execute format('alter table private.%I force row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger immutable before update or delete on private.%I for each row execute function private.day3_reject_history_mutation()',t);
end loop;end $$;
grant select,insert on private.case_followups,private.case_followup_receipts,private.case_access_events to fw_review_exec;
grant select on private.case_followups to fw_policy_exec;
grant select(reviewer_id) on private.work_case_resolutions to fw_policy_exec;
create policy followup_policy on private.case_followups for select to fw_policy_exec using(true);
create policy followup_read on private.case_followups for select to fw_review_exec using(private.case_visible(case_id,true));
create policy followup_insert on private.case_followups for insert to fw_review_exec with check(actor_id=private.request_uid() and private.case_visible(case_id,true));
create policy followup_receipt_read on private.case_followup_receipts for select to fw_review_exec using(private.is_active() and actor_id=private.request_uid());
create policy followup_receipt_insert on private.case_followup_receipts for insert to fw_review_exec with check(private.is_active() and actor_id=private.request_uid());
create policy case_access_insert on private.case_access_events for insert to fw_review_exec with check(actor_id=private.request_uid() and private.case_visible(case_id,true));
create policy case_access_read on private.case_access_events for select to fw_review_exec using(private.case_visible(case_id,true));
grant select on private.case_access_events to fw_admin_exec;
create policy admin_case_access_read on private.case_access_events for select to fw_admin_exec using(private.admin_role() is not null);
alter function private.admin_metadata(text) rename to admin_metadata_before_case_access;
create function private.admin_metadata(resource text) returns table(id uuid,label text,status text,revision integer,recorded_at timestamptz,detail jsonb) language plpgsql set search_path='' as $$
begin
 if resource='evidence_access' then return query select e.id,'Authorized case evidence read',e.basis,1,e.recorded_at,jsonb_build_object('caseId',e.case_id,'actorId',e.actor_id,'reasonSource','Participant ownership or immutable accepted reviewer assignment') from private.case_access_events e;
 else return query select * from private.admin_metadata_before_case_access(resource);end if;
end $$;
grant create on schema private to fw_admin_exec;
alter function private.admin_metadata(text) owner to fw_admin_exec;
revoke create on schema private from fw_admin_exec;
revoke all on function private.admin_metadata(text),private.admin_metadata_before_case_access(text) from public,anon,authenticated,service_role;

create function api.case_followup_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;after_id uuid;items jsonb;c private.work_cases;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['caseId','cursor']) or request-array['caseId','cursor']<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'caseId')::uuid;after_id:=(request->>'cursor')::uuid;
 if target is null then raise exception 'VALIDATION_FAILED';end if;
 select * into c from private.work_cases where id=target;if not found or not private.case_visible(target,true) then raise exception 'NOT_FOUND';end if;
 perform private.case_quota(true);
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'actorId',f.actor_id,'kind',f.kind,'message',f.message,'linkedCaseId',f.linked_case_id,'createdAt',f.created_at) order by f.id),'[]') into items from(select * from private.case_followups where case_id=target and (after_id is null or id>after_id) order by id limit 20)f;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'id' else null end,'canRespond',c.status='open','canAppeal',c.status='resolved' and private.case_participant(c.work_id) and not exists(select 1 from private.case_followups where case_id=target and kind='appeal'));
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.case_followup_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;target uuid;token uuid;digest text;saved private.case_followup_receipts;c private.work_cases;v private.work_record_versions;r private.work_records;child uuid;receipt jsonb;result jsonb;event_id uuid;allowed text[]:=array['caseId','operation','expectedRevision','message','idempotencyKey'];
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& allowed) or request-allowed<>'{}' or request->>'operation' is null or request->>'operation' not in ('response','appeal') or jsonb_typeof(request->'message') is distinct from 'string' or length(btrim(request->>'message')) not between 10 and 2000 or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^[1-9][0-9]{0,8}$' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'caseId')::uuid;token:=(request->>'idempotencyKey')::uuid;if target is null or token is null then raise exception 'VALIDATION_FAILED';end if;
 select * into c from private.work_cases where id=target;if not found or not private.case_visible(target,true) then raise exception 'NOT_FOUND';end if;
 perform private.case_lock(c.work_id,actor);perform pg_advisory_xact_lock(hashtextextended(target::text,6));
 select * into c from private.work_cases where id=target;if not found or not private.case_visible(target,true) then raise exception 'NOT_FOUND';end if;
 if request->>'operation'='appeal' and not private.case_participant(c.work_id) then raise exception 'ACTION_FORBIDDEN';end if;
 digest:=private.agreement_hash(request-'idempotencyKey');select * into saved from private.case_followup_receipts where actor_id=actor and key=token;
 if found then if saved.hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT';end if;return saved.result;end if;
 if c.revision<>(request->>'expectedRevision')::integer then raise exception 'VERSION_CONFLICT';end if;
 perform private.case_quota(false);
 if request->>'operation'='response' then
  if c.status<>'open' then raise exception 'ACTION_FORBIDDEN';end if;
 else
  if c.status<>'resolved' or exists(select 1 from private.case_followups where case_id=target and kind='appeal') then raise exception 'ACTION_FORBIDDEN';end if;
  select * into r from private.work_records where id=c.work_id;
  select * into v from private.work_record_versions where work_id=r.id and version=r.current_version;
  if not found then raise exception 'NOT_FOUND';end if;
  child:=gen_random_uuid();
  receipt:=api.work_case_command(jsonb_build_object('operation','open','caseId',child,'workId',r.id,'expectedVersion',v.version,'expectedHash',v.content_hash,'expectedState',v.state,'expectedEvidenceHash',v.evidence_hash,'reasonCode','evidence_integrity','reason',request->>'message','idempotencyKey',gen_random_uuid()));
 end if;
 insert into private.case_followups(case_id,actor_id,kind,message,linked_case_id) values(target,actor,request->>'operation',btrim(request->>'message'),child) returning id into event_id;
 result:=jsonb_build_object('eventId',event_id,'caseId',target,'linkedCaseId',child);
 insert into private.case_followup_receipts values(actor,token,digest,result);return result;
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';when unique_violation then raise exception 'VERSION_CONFLICT';end $$;

-- An appeal must be assigned to a different independent reviewer. Protect this
-- at the command boundary and the helper, so direct RPC calls cannot bypass it.
create function private.appeal_reviewer_allowed(target uuid,candidate uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.case_followups f join private.work_case_resolutions d on d.case_id=f.case_id where f.linked_case_id=target and d.reviewer_id=candidate);
$$;
grant create on schema private,api to fw_review_exec,fw_policy_exec;
alter function private.appeal_reviewer_allowed(uuid,uuid) owner to fw_policy_exec;
revoke all on function private.appeal_reviewer_allowed(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.appeal_reviewer_allowed(uuid,uuid) to fw_review_exec;
alter function api.work_case_command(jsonb) rename to work_case_command_before_followups;
revoke all on function api.work_case_command_before_followups(jsonb) from public,anon,authenticated,service_role;
create function api.work_case_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if request->>'operation'='assign' and not private.appeal_reviewer_allowed((request->>'caseId')::uuid,(request->>'reviewerId')::uuid) then raise exception 'ACTION_FORBIDDEN';end if;
 return api.work_case_command_before_followups(request);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
alter function api.read_work_case(jsonb) rename to read_work_case_before_access_audit;
revoke all on function api.read_work_case_before_access_audit(jsonb) from public,anon,authenticated,service_role;
create function api.read_work_case(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;target uuid;
begin
 result:=api.read_work_case_before_access_audit(request);target:=(result->>'caseId')::uuid;
 if result->'basis' is distinct from 'null'::jsonb then
  insert into private.case_access_events(case_id,actor_id,basis) values(target,private.request_uid(),case when private.case_participant((result->>'workId')::uuid) then 'participant' else 'accepted_independent_assignment' end);
 end if;return result;
end $$;
alter function api.case_followup_read(jsonb) owner to fw_review_exec;
alter function api.case_followup_command(jsonb) owner to fw_review_exec;
alter function api.work_case_command(jsonb) owner to fw_review_exec;
alter function api.read_work_case(jsonb) owner to fw_review_exec;
revoke create on schema private,api from fw_review_exec,fw_policy_exec;
revoke all on function api.case_followup_read(jsonb),api.case_followup_command(jsonb),api.work_case_command(jsonb),api.read_work_case(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.case_followup_read(jsonb),api.case_followup_command(jsonb),api.work_case_command(jsonb),api.read_work_case(jsonb) to authenticated;

grant execute on function private.case_visible(uuid,boolean) to fw_user_exec;
grant select on private.case_followups to fw_user_exec;
create policy followup_notification_read on private.case_followups for select to fw_user_exec using(private.case_visible(case_id,true));
alter function private.notification_events() rename to notification_events_before_cases;
create function private.notification_events() returns table(event_key text,kind text,title text,href text,recorded_at timestamptz) language sql stable set search_path='' as $$
 select * from private.notification_events_before_cases()
 union all select 'case-followup:'||f.id::text,'case_followup',case when f.kind='appeal' then 'Case appeal opened for independent review' else 'New case response' end,'/app/cases?caseId='||coalesce(f.linked_case_id,f.case_id)::text,f.created_at from private.case_followups f;
$$;
grant create on schema private to fw_user_exec;
alter function private.notification_events() owner to fw_user_exec;
revoke create on schema private from fw_user_exec;
revoke all on function private.notification_events(),private.notification_events_before_cases() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
