-- Day 2: synthetic authority only. No changes to Supabase-managed Auth objects.
begin;
do $$
begin
  if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolcreaterole or rolsuper)) then
    raise exception 'Run the Day 2 read-only preflight using the authorized postgres migration connection';
  end if;
end;
$$;
create role fw_authority_exec nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant fw_authority_exec to postgres;
grant usage on schema private, api to fw_authority_exec;
-- Required only while assigning function ownership; removed before commit.
grant create on schema private, api to fw_authority_exec;
grant create on schema private to fw_policy_exec;
alter default privileges for role fw_authority_exec revoke execute on functions from public;
grant execute on function private.request_uid(), private.request_jwt(), private.is_active(), private.has_capability(text) to fw_authority_exec;

create table private.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name=btrim(name) and char_length(name) between 1 and 120),
  identity_label text not null default 'demo_provisioned' check (identity_label='demo_provisioned'),
  revision bigint not null default 1 check (revision=1),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  deleted_at timestamptz
);
create table private.company_memberships (
  company_id uuid not null references private.companies(id) on delete restrict,
  subject_id uuid not null references private.profiles(id) on delete restrict,
  current_decision_id uuid,
  revision bigint not null default 0 check (revision>=0),
  primary key(company_id,subject_id)
);
create table private.company_membership_decisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  subject_id uuid not null,
  sequence bigint not null check(sequence>0),
  previous_decision_id uuid,
  decision text not null check(decision in ('approve','revoke')),
  requested_role text not null default 'representative' check(requested_role='representative'),
  approver_id uuid not null references private.profiles(id) on delete restrict,
  method text not null default 'synthetic_demo_review' check(method='synthetic_demo_review'),
  assurance_label text not null default 'demo_provisioned' check(assurance_label='demo_provisioned'),
  reviewed_evidence_refs text[] not null check(cardinality(reviewed_evidence_refs) between 1 and 10),
  reason text not null check(char_length(btrim(reason)) between 1 and 500),
  policy_version text not null check(policy_version='demo-authority.v1'),
  effective_at timestamptz not null default transaction_timestamp(),
  expires_at timestamptz,
  check(approver_id<>subject_id),
  check((decision='approve' and expires_at is not null and expires_at>effective_at and expires_at<=effective_at+interval '30 days') or (decision='revoke' and expires_at is null)),
  unique(company_id,subject_id,id), unique(company_id,subject_id,sequence),
  foreign key(company_id,subject_id) references private.company_memberships(company_id,subject_id) on delete restrict,
  foreign key(company_id,subject_id,previous_decision_id) references private.company_membership_decisions(company_id,subject_id,id) on delete restrict
);
alter table private.company_memberships add foreign key(company_id,subject_id,current_decision_id)
  references private.company_membership_decisions(company_id,subject_id,id) on delete restrict;
alter table private.companies owner to fw_schema_owner;
alter table private.company_memberships owner to fw_schema_owner;
alter table private.company_membership_decisions owner to fw_schema_owner;
revoke all on private.companies, private.company_memberships, private.company_membership_decisions from public,anon,authenticated,service_role;
alter table private.companies enable row level security;
alter table private.companies force row level security;
alter table private.company_memberships enable row level security;
alter table private.company_memberships force row level security;
alter table private.company_membership_decisions enable row level security;
alter table private.company_membership_decisions force row level security;

grant select,insert on private.companies,private.company_memberships,private.company_membership_decisions to fw_authority_exec;
grant update(current_decision_id,revision) on private.company_memberships to fw_authority_exec;
create policy companies_authority_select on private.companies for select to fw_authority_exec using(private.has_capability('authority_operator') and deleted_at is null);
create policy companies_authority_insert on private.companies for insert to fw_authority_exec with check(private.has_capability('authority_operator') and deleted_at is null and revision=1 and created_at=transaction_timestamp() and updated_at=created_at);
create policy memberships_authority_select on private.company_memberships for select to fw_authority_exec using(private.has_capability('authority_operator'));
create policy memberships_authority_insert on private.company_memberships for insert to fw_authority_exec with check(private.has_capability('authority_operator') and subject_id<>private.request_uid());
create policy memberships_authority_update on private.company_memberships for update to fw_authority_exec using(private.has_capability('authority_operator') and subject_id<>private.request_uid()) with check(private.has_capability('authority_operator') and subject_id<>private.request_uid());
create policy decisions_authority_select on private.company_membership_decisions for select to fw_authority_exec using(private.has_capability('authority_operator'));
create policy decisions_authority_insert on private.company_membership_decisions for insert to fw_authority_exec with check(private.has_capability('authority_operator') and approver_id=private.request_uid() and subject_id<>private.request_uid() and effective_at=transaction_timestamp());

grant select(id,deleted_at) on private.companies to fw_policy_exec;
grant select on private.company_memberships to fw_policy_exec;
grant select(id,company_id,subject_id,sequence,decision,effective_at,expires_at) on private.company_membership_decisions to fw_policy_exec;
create policy companies_policy_select on private.companies for select to fw_policy_exec using(private.request_uid() is not null);
create policy memberships_policy_select on private.company_memberships for select to fw_policy_exec using(private.request_uid() is not null);
create policy decisions_policy_select on private.company_membership_decisions for select to fw_policy_exec using(private.request_uid() is not null);

create function private.authority_subject_active(subject uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.has_capability('authority_operator') and exists(select 1 from private.profiles p where p.id=subject and p.account_state='active' and p.deleted_at is null);
$$;
alter function private.authority_subject_active(uuid) owner to fw_policy_exec;
grant execute on function private.authority_subject_active(uuid) to fw_authority_exec;

-- Metadata-only helper; no evidence, reason or company/profile text crosses it.
create function private.active_authority(company uuid, subject uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select d.id from private.company_memberships m
  join private.company_membership_decisions d on (d.company_id,d.subject_id,d.id)=(m.company_id,m.subject_id,m.current_decision_id)
  join private.companies c on c.id=m.company_id
  join private.profiles p on p.id=m.subject_id
  where private.is_active() and m.company_id=company and m.subject_id=subject
    and c.deleted_at is null and p.account_state='active' and p.deleted_at is null
    and d.decision='approve' and d.effective_at<=transaction_timestamp() and d.expires_at>transaction_timestamp();
$$;
alter function private.active_authority(uuid,uuid) owner to fw_policy_exec;
grant execute on function private.active_authority(uuid,uuid) to fw_user_exec,fw_authority_exec;

create function private.guard_authority_decision() returns trigger
language plpgsql set search_path='' as $$
declare m private.company_memberships;
begin
  select * into m from private.company_memberships where company_id=new.company_id and subject_id=new.subject_id for update;
  if not found or new.sequence<>m.revision+1 or new.previous_decision_id is distinct from m.current_decision_id
    or new.effective_at<>transaction_timestamp() or new.approver_id<>private.request_uid()
    or exists(select 1 from unnest(new.reviewed_evidence_refs) r where r is null or r !~ '^demo:[A-Za-z0-9._/-]{1,120}$') then
    raise exception 'ACTION_FORBIDDEN';
  end if;
  return new;
end;
$$;
alter function private.guard_authority_decision() owner to fw_schema_owner;
create trigger authority_decision_insert before insert on private.company_membership_decisions for each row execute function private.guard_authority_decision();
create trigger authority_decision_immutable before update or delete on private.company_membership_decisions for each row execute function private.reject_history_edit();

-- Deferred validation sees the final pointer, including the initial root INSERT.
create function private.check_authority_pointer() returns trigger
language plpgsql security definer set search_path='' as $$
declare pointer uuid; rev bigint; latest uuid; seq bigint;
begin
  select current_decision_id,revision into pointer,rev from private.company_memberships where company_id=new.company_id and subject_id=new.subject_id;
  select id,sequence into latest,seq from private.company_membership_decisions where company_id=new.company_id and subject_id=new.subject_id order by sequence desc limit 1;
  if pointer is null or pointer is distinct from latest or rev is distinct from seq then raise exception 'ACTION_FORBIDDEN'; end if;
  return null;
end;
$$;
alter function private.check_authority_pointer() owner to fw_policy_exec;
create constraint trigger authority_pointer_commit after insert or update on private.company_memberships deferrable initially deferred for each row execute function private.check_authority_pointer();
create constraint trigger authority_decision_commit after insert on private.company_membership_decisions deferrable initially deferred for each row execute function private.check_authority_pointer();

alter table private.audit_logs drop constraint audit_logs_action_check;
alter table private.audit_logs add check(action in ('create_profile','update_profile','provision_company','decide_membership','bootstrap_capability'));
alter table private.audit_logs drop constraint audit_logs_reason_code_check;
alter table private.audit_logs add check(reason_code in ('owner_profile_command','synthetic_authority_command','offline_capability_bootstrap'));
alter table private.audit_logs drop constraint audit_logs_retention_class_check;
alter table private.audit_logs add check(retention_class in ('identity','authority'));
alter table private.command_receipts drop constraint command_receipts_command_check;
alter table private.command_receipts add check(command in ('create_profile','update_profile','provision_company','decide_membership'));
alter table private.rate_limit_buckets drop constraint rate_limit_buckets_operation_check;
alter table private.rate_limit_buckets add check(operation in ('identity_read','identity_write','authority_write'));
-- Keep the Day 1 executor inside its command family as the shared tables grow.
alter policy audit_user_insert on private.audit_logs with check(actor_id=private.request_uid() and target_id=private.request_uid() and private.is_active() and action in ('create_profile','update_profile') and db_time=transaction_timestamp() and reason_code='owner_profile_command' and retention_class='identity');
alter policy receipts_user_select on private.command_receipts using(actor_id=private.request_uid() and private.is_active() and command in ('create_profile','update_profile'));
alter policy receipts_user_insert on private.command_receipts with check(actor_id=private.request_uid() and private.is_active() and command in ('create_profile','update_profile'));
alter policy limits_user_select on private.rate_limit_buckets using(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation in ('identity_read','identity_write'));
alter policy limits_user_insert on private.rate_limit_buckets with check(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation in ('identity_read','identity_write'));
alter policy limits_user_update on private.rate_limit_buckets using(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation in ('identity_read','identity_write')) with check(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation in ('identity_read','identity_write'));
grant insert on private.audit_logs to fw_authority_exec;
grant select,insert on private.command_receipts to fw_authority_exec;
grant select,insert,update(count) on private.rate_limit_buckets to fw_authority_exec;
create policy audit_authority_insert on private.audit_logs for insert to fw_authority_exec with check(actor_id=private.request_uid() and private.has_capability('authority_operator') and action in ('provision_company','decide_membership') and reason_code='synthetic_authority_command' and retention_class='authority' and db_time=transaction_timestamp());
create policy receipts_authority_select on private.command_receipts for select to fw_authority_exec using(actor_id=private.request_uid() and private.has_capability('authority_operator') and command in ('provision_company','decide_membership'));
create policy receipts_authority_insert on private.command_receipts for insert to fw_authority_exec with check(actor_id=private.request_uid() and private.has_capability('authority_operator') and command in ('provision_company','decide_membership'));
create policy limits_authority_select on private.rate_limit_buckets for select to fw_authority_exec using(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation='authority_write');
create policy limits_authority_insert on private.rate_limit_buckets for insert to fw_authority_exec with check(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation='authority_write');
create policy limits_authority_update on private.rate_limit_buckets for update to fw_authority_exec using(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation='authority_write') with check(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex') and operation='authority_write');

create function private.require_authority() returns uuid language plpgsql stable set search_path='' as $$
begin
  if not private.is_active() then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(private.request_jwt()->>'aal','')<>'aal2' then raise exception 'MFA_REQUIRED'; end if;
  if not private.has_capability('authority_operator') then raise exception 'ACTION_FORBIDDEN'; end if;
  return private.request_uid();
end;
$$;
alter function private.require_authority() owner to fw_authority_exec;
create function private.consume_authority_quota() returns void language plpgsql set search_path='' as $$
declare total integer;
begin
  insert into private.rate_limit_buckets(subject_hash,operation,window_start,count,expires_at)
  values(encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex'),'authority_write',date_trunc('minute',transaction_timestamp()),1,date_trunc('minute',transaction_timestamp())+interval '2 minutes')
  on conflict(subject_hash,operation,window_start) do update set count=private.rate_limit_buckets.count+1 returning count into total;
  if total>30 then raise exception 'RATE_LIMITED'; end if;
end;
$$;
alter function private.consume_authority_quota() owner to fw_authority_exec;

-- Strict SQL validation also applies to direct PostgREST calls.
create function private.validate_authority_input(request jsonb, membership boolean) returns void language plpgsql set search_path='' as $$
declare allowed text[]; field text;
begin
  allowed:=case when membership then array['companyId','subjectId','decision','expectedRevision','expiresAt','reviewedEvidenceRefs','reason','policyVersion','idempotencyKey'] else array['name','idempotencyKey'] end;
  if jsonb_typeof(request) is distinct from 'object' then raise exception 'VALIDATION_FAILED'; end if;
  if exists(select 1 from jsonb_object_keys(request) k where not k=any(allowed)) or not request ?& allowed then raise exception 'VALIDATION_FAILED'; end if;
  foreach field in array case when membership then array['idempotencyKey','companyId','subjectId'] else array['idempotencyKey'] end loop
    if jsonb_typeof(request->field) is distinct from 'string' or (request->>field) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'VALIDATION_FAILED'; end if;
  end loop;
  if not membership then
    if jsonb_typeof(request->'name') is distinct from 'string' or char_length(btrim(request->>'name')) not between 1 and 120 or request->>'name'<>btrim(request->>'name') then raise exception 'VALIDATION_FAILED'; end if;
  else
    if request->>'decision' not in ('approve','revoke') or jsonb_typeof(request->'decision') is distinct from 'string'
      or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^(0|[1-9][0-9]{0,8})$'
      or jsonb_typeof(request->'reason') is distinct from 'string' or char_length(btrim(request->>'reason')) not between 1 and 500
      or request->>'policyVersion' is distinct from 'demo-authority.v1'
      or jsonb_typeof(request->'reviewedEvidenceRefs') is distinct from 'array' then raise exception 'VALIDATION_FAILED'; end if;
    if jsonb_array_length(request->'reviewedEvidenceRefs') not between 1 and 10 or exists(select 1 from jsonb_array_elements(request->'reviewedEvidenceRefs') r where jsonb_typeof(r)<>'string' or (r#>>'{}') !~ '^demo:[A-Za-z0-9._/-]{1,120}$') then raise exception 'VALIDATION_FAILED'; end if;
    if request->>'decision'='revoke' then
      if request->'expiresAt'<>'null'::jsonb then raise exception 'VALIDATION_FAILED'; end if;
    else
      if jsonb_typeof(request->'expiresAt') is distinct from 'string' or request->>'expiresAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' then raise exception 'VALIDATION_FAILED'; end if;
      begin
        if (request->>'expiresAt')::timestamptz<=transaction_timestamp() or (request->>'expiresAt')::timestamptz>transaction_timestamp()+interval '30 days' then raise exception 'VALIDATION_FAILED'; end if;
      exception when invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_FAILED'; end;
    end if;
  end if;
end;
$$;
alter function private.validate_authority_input(jsonb,boolean) owner to fw_authority_exec;

create function api.provision_company(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; key uuid; digest text; receipt private.command_receipts; company private.companies;
begin
  actor:=private.require_authority(); perform private.validate_authority_input(request,false);
  key:=(request->>'idempotencyKey')::uuid; digest:=encode(sha256(convert_to(request::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0)); perform private.consume_authority_quota();
  perform private.require_authority();
  select * into receipt from private.command_receipts where actor_id=actor and command='provision_company' and idempotency_key=key;
  if found then
    if receipt.request_hash<>digest or receipt.expires_at<=transaction_timestamp() then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    select * into company from private.companies where id=(receipt.result_ids->>'companyId')::uuid;
    if not found then raise exception 'NOT_FOUND'; end if;
  else
    insert into private.companies(name) values(request->>'name') returning * into company;
    insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class)
    values(actor,'provision_company',company.id,key,array['name','identity_label'],'synthetic_authority_command','authority');
    insert into private.command_receipts(actor_id,command,idempotency_key,request_hash,result_ids) values(actor,'provision_company',key,digest,jsonb_build_object('companyId',company.id));
  end if;
  return jsonb_build_object('id',company.id,'name',company.name,'identityLabel',company.identity_label,'revision',company.revision);
end;
$$;
alter function api.provision_company(jsonb) owner to fw_authority_exec;

create function api.decide_membership(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; company uuid; subject uuid; key uuid; digest text; receipt private.command_receipts; m private.company_memberships; d private.company_membership_decisions; applied uuid;
begin
  actor:=private.require_authority(); perform private.validate_authority_input(request,true);
  company:=(request->>'companyId')::uuid; subject:=(request->>'subjectId')::uuid; key:=(request->>'idempotencyKey')::uuid;
  if subject=actor then raise exception 'ACTION_FORBIDDEN'; end if;
  if request->>'decision'='approve' and not private.authority_subject_active(subject) then raise exception 'NOT_FOUND'; end if;
  perform 1 from private.companies where id=company and deleted_at is null;
  if not found then raise exception 'NOT_FOUND'; end if;
  digest:=encode(sha256(convert_to(request::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  perform pg_advisory_xact_lock(hashtextextended(company::text||subject::text,1));
  perform private.consume_authority_quota();
  perform private.require_authority();
  select * into receipt from private.command_receipts where actor_id=actor and command='decide_membership' and idempotency_key=key;
  if found then
    if receipt.request_hash<>digest or receipt.expires_at<=transaction_timestamp() then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    applied:=(receipt.result_ids->>'decisionId')::uuid;
  else
    select * into m from private.company_memberships where company_id=company and subject_id=subject for update;
    if not found then
      if (request->>'expectedRevision')::bigint<>0 then raise exception 'VERSION_CONFLICT'; end if;
      if request->>'decision'='revoke' then raise exception 'NOT_FOUND'; end if;
      insert into private.company_memberships(company_id,subject_id) values(company,subject) returning * into m;
    end if;
    if m.revision<>(request->>'expectedRevision')::bigint then raise exception 'VERSION_CONFLICT'; end if;
    insert into private.company_membership_decisions(company_id,subject_id,sequence,previous_decision_id,decision,approver_id,reviewed_evidence_refs,reason,policy_version,expires_at)
    values(company,subject,m.revision+1,m.current_decision_id,request->>'decision',actor,array(select jsonb_array_elements_text(request->'reviewedEvidenceRefs')),btrim(request->>'reason'),'demo-authority.v1',(request->>'expiresAt')::timestamptz) returning * into d;
    update private.company_memberships set current_decision_id=d.id,revision=d.sequence where company_id=company and subject_id=subject;
    applied:=d.id;
    insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class)
    values(actor,'decide_membership',d.id,key,array['current_decision_id','revision'],'synthetic_authority_command','authority');
    insert into private.command_receipts(actor_id,command,idempotency_key,request_hash,result_ids) values(actor,'decide_membership',key,digest,jsonb_build_object('decisionId',d.id));
  end if;
  -- A replay reports the current state, never resurrects an old approval.
  select d0.* into d from private.company_memberships m0 join private.company_membership_decisions d0 on d0.id=m0.current_decision_id where m0.company_id=company and m0.subject_id=subject;
  return jsonb_build_object('companyId',company,'subjectId',subject,'appliedDecisionId',applied,'currentDecisionId',d.id,'decision',d.decision,'revision',d.sequence,'assuranceLabel',d.assurance_label,'active',private.active_authority(company,subject) is not null);
exception when foreign_key_violation then raise exception 'NOT_FOUND';
end;
$$;
alter function api.decide_membership(jsonb) owner to fw_authority_exec;

revoke all on function private.authority_subject_active(uuid),private.active_authority(uuid,uuid),private.guard_authority_decision(),private.check_authority_pointer(),private.require_authority(),private.consume_authority_quota(),private.validate_authority_input(jsonb,boolean) from public,anon,authenticated,service_role;
revoke all on function api.provision_company(jsonb),api.decide_membership(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.provision_company(jsonb),api.decide_membership(jsonb) to authenticated;
revoke create on schema private,api from fw_authority_exec;
revoke create on schema private from fw_policy_exec;
do $$
begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname in ('provision_company','decide_membership')
    and (not has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')))
    or has_schema_privilege('fw_authority_exec','auth','USAGE')
    or has_schema_privilege('fw_authority_exec','private','CREATE') then
    raise exception 'Day 2 effective privilege postcondition failed';
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
