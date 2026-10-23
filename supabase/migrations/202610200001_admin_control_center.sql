begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
create role fw_admin_exec nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant fw_admin_exec to postgres;
grant usage on schema private,api to fw_admin_exec;
grant execute on function private.request_uid(),private.request_jwt(),private.is_active(),private.require_identity(),private.agreement_hash(jsonb),private.consume_identity_quota(text) to fw_admin_exec;
create table private.admin_roles(subject_id uuid primary key references private.profiles(id),role text check(role in ('owner','administrator','support','auditor')),revision integer not null check(revision>0),expires_at timestamptz,updated_at timestamptz not null default transaction_timestamp(),check((role is null)=(expires_at is null)));
create table private.admin_audit(id uuid primary key default gen_random_uuid(),actor_id uuid not null references private.profiles(id),action text not null,target_id uuid not null,revision integer not null,reason text not null check(length(btrim(reason)) between 10 and 500),changes jsonb not null,created_at timestamptz not null default transaction_timestamp());
create index admin_audit_target on private.admin_audit(target_id,created_at desc,id);
create index admin_audit_actor on private.admin_audit(actor_id,created_at desc,id);
create table private.admin_receipts(actor_id uuid not null references private.profiles(id),idempotency_key uuid not null,request_hash text not null,result jsonb not null,primary key(actor_id,idempotency_key));
create table private.admin_settings(id uuid primary key,key text not null unique,value jsonb not null,revision integer not null,updated_at timestamptz not null default transaction_timestamp());
create table private.admin_incidents(id uuid primary key,category text not null check(category in ('security','support','moderation')),title text not null check(length(btrim(title)) between 3 and 120),status text not null check(status in ('open','in_review','resolved')),priority text not null check(priority in ('normal','high','urgent')),assigned_to uuid references private.profiles(id),revision integer not null,created_at timestamptz not null default transaction_timestamp(),updated_at timestamptz not null default transaction_timestamp());
create table private.admin_case_notes(id uuid primary key default gen_random_uuid(),case_id uuid not null references private.work_cases(id),actor_id uuid not null references private.profiles(id),note text not null check(length(btrim(note)) between 10 and 500),priority text not null check(priority in ('normal','high','urgent')),created_at timestamptz not null default transaction_timestamp());
do $$ declare t text;begin foreach t in array array['admin_roles','admin_audit','admin_receipts','admin_settings','admin_incidents','admin_case_notes'] loop
 execute format('alter table private.%I owner to fw_schema_owner',t);execute format('alter table private.%I enable row level security',t);execute format('alter table private.%I force row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
end loop;end $$;
grant select on private.admin_roles to fw_policy_exec;
create policy admin_role_policy_read on private.admin_roles for select to fw_policy_exec using(true);
create function private.admin_role() returns text language sql volatile security definer set search_path='' as $$
 select role from private.admin_roles where subject_id=private.request_uid() and expires_at>clock_timestamp() and private.is_active() and private.request_jwt()->>'aal'='aal2';
$$;
grant create on schema private to fw_policy_exec;
alter function private.admin_role() owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.admin_role() from public,anon,authenticated,service_role;
grant execute on function private.admin_role() to fw_admin_exec;
grant execute on function private.case_independent(uuid,uuid) to fw_admin_exec;
create function private.require_admin(sensitive boolean) returns text language plpgsql set search_path='' as $$
declare r text;begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if private.request_jwt()->>'aal' is distinct from 'aal2' then raise exception 'MFA_REQUIRED';end if;
 perform pg_advisory_xact_lock_shared(10202026);
 r:=private.admin_role();if r is null then raise exception 'ACTION_FORBIDDEN';end if;
 if sensitive and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(private.request_jwt()->'amr')='array' then private.request_jwt()->'amr' else '[]'::jsonb end) a where a->>'method' in ('totp','mfa/totp') and a->>'timestamp' ~ '^[0-9]{1,12}$' and (a->>'timestamp')::numeric between extract(epoch from clock_timestamp())-600 and extract(epoch from clock_timestamp())+30) then raise exception 'MFA_REQUIRED';end if;
 return r;
end $$;
grant select,insert,update on private.admin_roles,private.admin_settings,private.admin_incidents to fw_admin_exec;
grant select,insert on private.admin_audit,private.admin_receipts,private.admin_case_notes to fw_admin_exec;
do $$ declare t text;begin foreach t in array array['admin_roles','admin_audit','admin_receipts','admin_settings','admin_incidents','admin_case_notes'] loop
 execute format('create policy admin_read on private.%I for select to fw_admin_exec using(private.admin_role() is not null)',t);
 execute format('create policy admin_insert on private.%I for insert to fw_admin_exec with check(private.admin_role() in (''owner'',''administrator'',''support''))',t);
end loop;end $$;
create policy admin_role_update on private.admin_roles for update to fw_admin_exec using(private.admin_role()='owner') with check(private.admin_role()='owner');
drop policy admin_insert on private.admin_roles;
create policy admin_insert on private.admin_roles for insert to fw_admin_exec with check(private.admin_role()='owner' and subject_id<>private.request_uid());
drop policy admin_insert on private.admin_settings;
create policy admin_insert on private.admin_settings for insert to fw_admin_exec with check(private.admin_role() in ('owner','administrator'));
create policy admin_settings_update on private.admin_settings for update to fw_admin_exec using(private.admin_role() in ('owner','administrator')) with check(private.admin_role() in ('owner','administrator'));
create policy admin_incidents_update on private.admin_incidents for update to fw_admin_exec using(private.admin_role() in ('owner','administrator','support')) with check(private.admin_role() in ('owner','administrator','support'));
create trigger admin_audit_immutable before update or delete on private.admin_audit for each row execute function private.day3_reject_history_mutation();
create trigger admin_receipts_immutable before update or delete on private.admin_receipts for each row execute function private.day3_reject_history_mutation();
create trigger admin_case_notes_immutable before update or delete on private.admin_case_notes for each row execute function private.day3_reject_history_mutation();

-- Only selected operational metadata columns. No auth schema, private content,
-- evidence text, consent input hashes, provider keys or recipient projections.
grant select(id,display_name,account_state,revision,created_at,deleted_at),update(account_state) on private.profiles to fw_admin_exec;
grant select(id,name,identity_label,created_at,deleted_at) on private.companies to fw_admin_exec;
grant select(company_id,subject_id,current_decision_id,revision) on private.company_memberships to fw_admin_exec;
grant select(id,company_id,subject_id,decision,expires_at) on private.company_membership_decisions to fw_admin_exec;
grant select(id,subject_id,company_id,company_name,created_at) on private.organization_requests to fw_admin_exec;
grant select(request_id,decision,company_id,created_at) on private.organization_request_decisions to fw_admin_exec;
grant select(id,offer_id,version,company_id,worker_id,created_at) on private.day3_offers to fw_admin_exec;
grant select(id,offer_id,company_id,current_version,effective_version,created_at) on private.agreement_roots to fw_admin_exec;
grant select(id,agreement_id,company_id,current_version,created_at) on private.work_records to fw_admin_exec;
grant select(work_id,version,state) on private.work_record_versions to fw_admin_exec;
grant select(id,work_id,work_version,revision,status,opened_at,closed_at) on private.work_cases to fw_admin_exec;
grant select(id,subject_id,kind,created_at) on private.privacy_requests to fw_admin_exec;
grant select(request_id,revision,status,created_at) on private.privacy_request_events to fw_admin_exec;
grant select(id,created_at,activated_at,revoked_at,expires_at) on private.passport_grants to fw_admin_exec;
grant select(id,provider,model,created_at) on private.ai_transmission_authorizations to fw_admin_exec;
grant select(actor_id) on private.account_deactivations to fw_admin_exec;
grant select,insert,update(revoked_at) on private.capability_assignments to fw_admin_exec;
do $$ declare t text;begin foreach t in array array['profiles','companies','company_memberships','company_membership_decisions','organization_requests','organization_request_decisions','day3_offers','agreement_roots','work_records','work_record_versions','work_cases','privacy_requests','privacy_request_events','passport_grants','ai_transmission_authorizations','account_deactivations','capability_assignments'] loop
 execute format('create policy admin_metadata_read on private.%I for select to fw_admin_exec using(private.admin_role() is not null)',t);
end loop;end $$;
create policy admin_profile_restrict on private.profiles for update to fw_admin_exec using(private.admin_role() in ('owner','administrator') and id<>private.request_uid()) with check(private.admin_role() in ('owner','administrator') and id<>private.request_uid());
create policy admin_capability_insert on private.capability_assignments for insert to fw_admin_exec with check(private.admin_role()='owner' and subject_id<>private.request_uid() and granted_by=private.request_uid());
create policy admin_capability_revoke on private.capability_assignments for update to fw_admin_exec using(private.admin_role()='owner' and subject_id<>private.request_uid()) with check(private.admin_role()='owner' and subject_id<>private.request_uid());
grant select,insert,update(count) on private.rate_limit_buckets to fw_admin_exec;
create policy admin_quota on private.rate_limit_buckets for all to fw_admin_exec using(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex')) with check(subject_hash=encode(sha256(convert_to(private.request_uid()::text,'UTF8')),'hex'));

create function private.admin_metadata(resource text) returns table(id uuid,label text,status text,revision integer,recorded_at timestamptz,detail jsonb) language plpgsql set search_path='' as $$
begin
 case resource
 when 'search' then return query select distinct on(m.id) m.id,m.label,m.status,m.revision,m.recorded_at,m.detail||jsonb_build_object('workspace',r.name) from unnest(array['users','organizations','requests','offers','agreements','work','cases','privacy','shares','ai','incidents'])r(name) cross join lateral private.admin_metadata(r.name)m order by m.id,r.name;
 when 'users' then return query select p.id,p.display_name,p.account_state,p.revision::integer,p.created_at,jsonb_build_object('adminRole',r.role,'roleExpiresAt',r.expires_at,'profileVerification','authenticated_profile_not_external_identity','memberships',(select coalesce(jsonb_agg(jsonb_build_object('companyId',m.company_id,'revision',m.revision,'decision',d.decision,'expiresAt',d.expires_at)),'[]') from private.company_memberships m left join private.company_membership_decisions d on d.id=m.current_decision_id where m.subject_id=p.id),'privacyRequests',(select count(*) from private.privacy_requests q where q.subject_id=p.id)) from private.profiles p left join private.admin_roles r on r.subject_id=p.id;
 when 'organizations' then return query select c.id,c.name,c.identity_label,1,c.created_at,jsonb_build_object('externallyVerified',false,'memberships',(select count(*) from private.company_memberships m where m.company_id=c.id)) from private.companies c;
 when 'requests' then return query select r.id,coalesce(r.company_name,'Existing organization request'),coalesce(d.decision,'pending'),case when d.request_id is null then 0 else 1 end,r.created_at,jsonb_build_object('applicantId',r.subject_id,'companyId',coalesce(d.company_id,r.company_id),'evidenceAccess','separate_authority_capability_required') from private.organization_requests r left join private.organization_request_decisions d on d.request_id=r.id;
 when 'offers' then return query select o.offer_id,'Offer', 'saved',o.version::integer,o.created_at,jsonb_build_object('companyId',o.company_id) from private.day3_offers o where not exists(select 1 from private.day3_offers n where n.offer_id=o.offer_id and n.version>o.version);
 when 'agreements' then return query select r.id,'Agreement',case when r.effective_version is null then 'not_effective' else 'effective' end,r.current_version,r.created_at,jsonb_build_object('companyId',r.company_id,'offerId',r.offer_id) from private.agreement_roots r;
 when 'work' then return query select r.id,'Work Record',v.state,r.current_version,r.created_at,jsonb_build_object('companyId',r.company_id,'agreementId',r.agreement_id) from private.work_records r join private.work_record_versions v on v.work_id=r.id and v.version=r.current_version;
 when 'cases' then return query select c.id,'Work Record concern',c.status,c.revision,c.opened_at,jsonb_build_object('workId',c.work_id,'workVersion',c.work_version,'priority',coalesce((select n.priority from private.admin_case_notes n where n.case_id=c.id order by n.created_at desc,n.id desc limit 1),'normal'),'evidenceAccess','independent_accepted_assignment_required') from private.work_cases c;
 when 'privacy' then return query select r.id,r.kind,coalesce(e.status,'received'),coalesce(e.revision,0),r.created_at,jsonb_build_object('subjectId',r.subject_id,'fulfillment','separate_privacy_capability_and_retention_rules') from private.privacy_requests r left join lateral(select v.status,v.revision from private.privacy_request_events v where v.request_id=r.id order by v.revision desc limit 1)e on true;
 when 'shares' then return query select g.id,'Named-recipient grant',case when g.revoked_at is not null then 'revoked' when g.expires_at<=clock_timestamp() then 'expired' when g.activated_at is null then 'draft' else 'active' end,1,g.created_at,jsonb_build_object('expiresAt',g.expires_at,'activatedAt',g.activated_at,'revokedAt',g.revoked_at) from private.passport_grants g;
 when 'ai' then return query select a.id,a.provider||' / '||a.model,'consent_authorization',1,a.created_at,jsonb_build_object('completedCall',null,'providerCost',null) from private.ai_transmission_authorizations a;
 when 'roles' then return query select a.subject_id,p.display_name,coalesce(a.role,'revoked'),a.revision,a.updated_at,jsonb_build_object('expiresAt',a.expires_at,'currentlyEffective',a.expires_at>clock_timestamp(),'capabilities',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'capability',c.capability,'expiresAt',c.expires_at,'revokedAt',c.revoked_at)),'[]') from private.capability_assignments c where c.subject_id=a.subject_id)) from private.admin_roles a join private.profiles p on p.id=a.subject_id;
 when 'settings' then return query select s.id,s.key,'configured',s.revision,s.updated_at,jsonb_build_object('value',s.value) from private.admin_settings s;
 when 'incidents' then return query select i.id,i.title,i.status,i.revision,i.created_at,jsonb_build_object('category',i.category,'priority',i.priority,'assignedTo',i.assigned_to) from private.admin_incidents i;
 when 'audit' then return query select a.id,a.action,'recorded',a.revision,a.created_at,jsonb_build_object('actorId',a.actor_id,'targetId',a.target_id,'reason',a.reason,'changes',a.changes) from private.admin_audit a;
 else raise exception 'VALIDATION_FAILED';end case;
end $$;

create function api.admin_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare role_name text; resource text; page jsonb; after_id uuid; since date; until date; metrics jsonb; trend jsonb;
begin
 role_name:=private.require_admin(false);perform private.consume_identity_quota('identity_read');
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['resource','cursor','search','status','from','to']) or request-array['resource','cursor','search','status','from','to']<>'{}' or jsonb_typeof(request->'search') is distinct from 'string' or length(request->>'search')>80 or jsonb_typeof(request->'status') is distinct from 'string' or length(request->>'status')>40 then raise exception 'VALIDATION_FAILED';end if;
 resource:=request->>'resource';after_id:=(request->>'cursor')::uuid;since:=(request->>'from')::date;until:=(request->>'to')::date;
 if since is null or until is null or until<since or until-since>92 then raise exception 'VALIDATION_FAILED';end if;
 if resource='dashboard' then
  select jsonb_build_object('users',(select count(*) from private.profiles),'activeProfiles',(select count(*) from private.profiles where account_state='active' and deleted_at is null),'workersWithOffers',(select count(distinct worker_id) from private.day3_offers),'activeEmployerMemberships',(select count(*) from private.company_memberships m join private.company_membership_decisions d on d.id=m.current_decision_id where d.decision='approve' and d.expires_at>clock_timestamp()),'organizations',(select count(*) from private.companies),'externallyVerifiedOrganizations',null,'pendingOrganizations',(select count(*) from private.organization_requests r where not exists(select 1 from private.organization_request_decisions d where d.request_id=r.id)),'offers',(select count(distinct offer_id) from private.day3_offers),'agreements',(select count(*) from private.agreement_roots),'workRecords',(select count(*) from private.work_records),'passportShares',(select count(*) from private.passport_grants),'openDisputes',(select count(*) from private.work_cases where status='open'),'openIncidents',(select count(*) from private.admin_incidents where status<>'resolved'),'aiConsentAuthorizations',(select count(*) from private.ai_transmission_authorizations),'completedAnalyses',null,'estimatedProviderCost',null,'loginFailures',null) into metrics;
  select coalesce(jsonb_agg(jsonb_build_object('date',d.day::date,'offers',(select count(distinct offer_id) from private.day3_offers where created_at>=d.day and created_at<d.day+interval '1 day'),'registrations',(select count(*) from private.profiles where created_at>=d.day and created_at<d.day+interval '1 day')) order by d.day),'[]') into trend from generate_series(since::timestamptz,until::timestamptz,interval '1 day')d(day);
  resource:='audit';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'label',m.label,'status',m.status,'revision',m.revision,'recordedAt',m.recorded_at,'detail',m.detail) order by m.id),'[]') into page from(select * from private.admin_metadata(resource) m where (after_id is null or m.id>after_id) and (request->>'search'='' or strpos(lower(m.label),lower(request->>'search'))>0 or m.id::text=request->>'search' or m.detail->>'targetId'=request->>'search') and (request->>'status'='' or m.status=request->>'status') and (resource in ('search','users','organizations','roles','settings') or (m.recorded_at>=since and m.recorded_at<until+1)) order by m.id limit 20)m;
 return jsonb_build_object('role',role_name,'items',page,'nextCursor',case when jsonb_array_length(page)=20 then page->19->>'id' else null end,'metrics',metrics,'trend',trend,'dataMode','synthetic');
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_FAILED';end $$;

create function api.admin_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare role_name text; actor uuid; op text; target uuid; expected integer; command_key uuid; digest text; saved private.admin_receipts; allowed text[]; current_revision integer; current_role text; expires timestamptz; result jsonb; changed jsonb:='{}'; event_id uuid; setting_key text; setting_value jsonb; was_restricted boolean;
begin
 perform pg_advisory_xact_lock(10202026);role_name:=private.require_admin(true);actor:=private.request_uid();
 if role_name='auditor' then raise exception 'ACTION_FORBIDDEN';end if;
 if request is null or jsonb_typeof(request)<>'object' then raise exception 'VALIDATION_FAILED';end if;
 op:=request->>'operation';allowed:=array['operation','targetId','expectedRevision','reason','idempotencyKey'];
 case op when 'role' then allowed:=allowed||array['role','expiresAt'];when 'restrict' then allowed:=allowed||array['restricted'];when 'setting' then allowed:=allowed||array['key','value'];when 'incident' then allowed:=allowed||array['title','category','status','priority','assignedTo'];when 'case_note' then allowed:=allowed||array['priority'];when 'capability' then allowed:=allowed||array['capability','expiresAt','revoke'];else raise exception 'VALIDATION_FAILED';end case;
 if not(request ?& allowed) or request-allowed<>'{}' or jsonb_typeof(request->'reason') is distinct from 'string' or length(btrim(request->>'reason')) not between 10 and 500 or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^[0-9]{1,9}$' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'targetId')::uuid;command_key:=(request->>'idempotencyKey')::uuid;expected:=(request->>'expectedRevision')::integer;
 if target is null or command_key is null then raise exception 'VALIDATION_FAILED';end if;
 if op in ('role','capability') and role_name<>'owner' or op in ('restrict','setting') and role_name not in ('owner','administrator') then raise exception 'ACTION_FORBIDDEN';end if;
 digest:=private.agreement_hash(request-'idempotencyKey');select * into saved from private.admin_receipts where actor_id=actor and idempotency_key=command_key;
 if found then if saved.request_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT';end if;return saved.result;end if;
 perform private.consume_identity_quota('identity_write');
 case op
 when 'role' then
  if target=actor then raise exception 'ACTION_FORBIDDEN';end if;
  if request->>'role' is not null and request->>'role' not in ('owner','administrator','support','auditor') then raise exception 'VALIDATION_FAILED';end if;
  expires:=(request->>'expiresAt')::timestamptz;if (request->>'role' is null)<>(expires is null) or expires<=clock_timestamp() or expires>clock_timestamp()+interval '90 days' then raise exception 'VALIDATION_FAILED';end if;
  if not exists(select 1 from private.profiles where id=target and account_state='active' and deleted_at is null) then raise exception 'NOT_FOUND';end if;
  select revision,role into current_revision,current_role from private.admin_roles where subject_id=target for update;
  if coalesce(current_revision,0)<>expected then raise exception 'VERSION_CONFLICT';end if;
  if current_role='owner' and request->>'role' is distinct from 'owner' and (select count(*) from private.admin_roles where role='owner' and expires_at>clock_timestamp())<=1 then raise exception 'ACTION_FORBIDDEN';end if;
  insert into private.admin_roles(subject_id,role,expires_at,revision) values(target,request->>'role',expires,expected+1) on conflict(subject_id) do update set role=excluded.role,expires_at=excluded.expires_at,revision=excluded.revision,updated_at=transaction_timestamp();
  changed:=jsonb_build_object('previousRole',current_role,'role',request->>'role','expiresAt',expires);
 when 'restrict' then
  if target=actor or exists(select 1 from private.admin_roles where subject_id=target and role is not null and expires_at>clock_timestamp()) or exists(select 1 from private.capability_assignments where subject_id=target and revoked_at is null and expires_at>clock_timestamp()) then raise exception 'ACTION_FORBIDDEN';end if;
  if jsonb_typeof(request->'restricted') is distinct from 'boolean' then raise exception 'VALIDATION_FAILED';end if;
  select revision into current_revision from private.profiles where id=target and deleted_at is null for update;if not found then raise exception 'NOT_FOUND';end if;if current_revision<>expected then raise exception 'VERSION_CONFLICT';end if;
  select coalesce((changes->>'restricted')::boolean,false) into was_restricted from private.admin_audit where target_id=target and action='restrict' order by created_at desc,id desc limit 1;
  if request->'restricted'='false'::jsonb and (not coalesce(was_restricted,false) or exists(select 1 from private.account_deactivations where actor_id=target)) then raise exception 'ACTION_FORBIDDEN';end if;
  update private.profiles set account_state=case when request->'restricted'='true'::jsonb then 'suspended' else 'active' end where id=target;
  changed:=jsonb_build_object('restricted',request->'restricted');
 when 'setting' then
  setting_key:=request->>'key';setting_value:=request->'value';
  if setting_key in ('analysis_paused','ai_daily_platform','ai_daily_account','ai_minute_account') then perform pg_advisory_xact_lock(hashtextextended('oryqen-ai-global-budget',14));end if;
  if setting_key in ('announcement','maintenance_notice','notification_template','support_categories') then
   if jsonb_typeof(setting_value) is distinct from 'string' or length(setting_value#>>'{}')>500 then raise exception 'VALIDATION_FAILED';end if;
  elsif setting_key='analysis_paused' then if jsonb_typeof(setting_value) is distinct from 'boolean' then raise exception 'VALIDATION_FAILED';end if;
  elsif setting_key in ('ai_daily_platform','ai_daily_account','ai_minute_account') then
   if jsonb_typeof(setting_value) is distinct from 'number' or setting_value::text !~ '^[1-9][0-9]{0,2}$' then raise exception 'VALIDATION_FAILED';end if;
   if (setting_value::text)::integer>(case setting_key when 'ai_daily_platform' then 100 when 'ai_daily_account' then 10 else 3 end) then raise exception 'VALIDATION_FAILED';end if;
  else raise exception 'VALIDATION_FAILED';end if;
  select revision,id into current_revision,event_id from private.admin_settings where key=setting_key for update;
  if coalesce(current_revision,0)<>expected or (event_id is not null and event_id<>target) then raise exception 'VERSION_CONFLICT';end if;
  insert into private.admin_settings(id,key,value,revision) values(target,setting_key,setting_value,expected+1) on conflict(key) do update set value=excluded.value,revision=excluded.revision,updated_at=transaction_timestamp();changed:=jsonb_build_object('key',setting_key,'value',setting_value);
 when 'incident' then
  if jsonb_typeof(request->'title') is distinct from 'string' or length(btrim(request->>'title')) not between 3 and 120 or request->>'category' is null or request->>'category' not in ('security','support','moderation') or request->>'status' is null or request->>'status' not in ('open','in_review','resolved') or request->>'priority' is null or request->>'priority' not in ('normal','high','urgent') then raise exception 'VALIDATION_FAILED';end if;
  if request->>'assignedTo' is not null and not exists(select 1 from private.admin_roles where subject_id=(request->>'assignedTo')::uuid and role in ('owner','administrator','support') and expires_at>clock_timestamp()) then raise exception 'ACTION_FORBIDDEN';end if;
  select revision into current_revision from private.admin_incidents where id=target for update;if coalesce(current_revision,0)<>expected then raise exception 'VERSION_CONFLICT';end if;
  insert into private.admin_incidents(id,title,category,status,priority,assigned_to,revision) values(target,btrim(request->>'title'),request->>'category',request->>'status',request->>'priority',(request->>'assignedTo')::uuid,expected+1) on conflict(id) do update set title=excluded.title,category=excluded.category,status=excluded.status,priority=excluded.priority,assigned_to=excluded.assigned_to,revision=excluded.revision,updated_at=transaction_timestamp();changed:=request-array['idempotencyKey','reason'];
 when 'case_note' then
  select revision into current_revision from private.work_cases where id=target;if not found then raise exception 'NOT_FOUND';end if;if current_revision<>expected then raise exception 'VERSION_CONFLICT';end if;
  if not private.case_independent((select work_id from private.work_cases where id=target),actor) then raise exception 'ACTION_FORBIDDEN';end if;
  if request->>'priority' is null or request->>'priority' not in ('normal','high','urgent') then raise exception 'VALIDATION_FAILED';end if;
  insert into private.admin_case_notes(case_id,actor_id,note,priority) values(target,actor,request->>'reason',request->>'priority');changed:=jsonb_build_object('priority',request->>'priority');
 when 'capability' then
  if target=actor then raise exception 'ACTION_FORBIDDEN';end if;
  if request->>'capability' is null or request->>'capability' not in ('authority_operator','review_operator','reviewer','privacy_operator') or jsonb_typeof(request->'revoke') is distinct from 'boolean' then raise exception 'VALIDATION_FAILED';end if;
  select coalesce(max(revision),0) into current_revision from private.admin_audit where action='capability' and target_id=target and changes->>'capability'=request->>'capability';
  if current_revision<>expected then raise exception 'VERSION_CONFLICT';end if;
  expires:=(request->>'expiresAt')::timestamptz;
  if request->'revoke'='false'::jsonb then
   if expires is null or expires<=clock_timestamp() or expires>clock_timestamp()+interval '7 days' then raise exception 'VALIDATION_FAILED';end if;
   if not exists(select 1 from private.profiles where id=target and account_state='active' and deleted_at is null) then raise exception 'NOT_FOUND';end if;
   insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values(target,request->>'capability',actor,request->>'reason',expires);
  else update private.capability_assignments set revoked_at=clock_timestamp() where subject_id=target and capability=request->>'capability' and revoked_at is null;end if;
  changed:=jsonb_build_object('capability',request->>'capability','revoked',request->'revoke','expiresAt',expires);
 end case;
 insert into private.admin_audit(actor_id,action,target_id,revision,reason,changes) values(actor,op,target,expected+1,btrim(request->>'reason'),changed) returning id into event_id;
 result:=jsonb_build_object('targetId',target,'revision',expected+1,'auditId',event_id,'operation',op);
 insert into private.admin_receipts values(actor,command_key,digest,result);return result;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema private,api to fw_admin_exec;
alter function private.require_admin(boolean) owner to fw_admin_exec;
alter function private.admin_metadata(text) owner to fw_admin_exec;
alter function api.admin_read(jsonb) owner to fw_admin_exec;
alter function api.admin_command(jsonb) owner to fw_admin_exec;
revoke create on schema private,api from fw_admin_exec;
revoke all on function private.require_admin(boolean),private.admin_metadata(text),api.admin_read(jsonb),api.admin_command(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.admin_read(jsonb),api.admin_command(jsonb) to authenticated;
-- The pause can only reduce AI availability; all existing consent, provider and
-- quota checks remain in the existing admission function.
grant select(key,value) on private.admin_settings to fw_policy_exec;
create policy admin_public_settings on private.admin_settings for select to fw_policy_exec using(key in ('announcement','maintenance_notice','analysis_paused','ai_daily_platform','ai_daily_account','ai_minute_account') and private.is_active());
alter function private.check_ai_budget() rename to check_ai_budget_before_admin;
create function private.check_ai_budget() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if exists(select 1 from private.admin_settings where key='analysis_paused' and value='true'::jsonb) then raise exception 'SERVICE_UNAVAILABLE';end if;
 if (select count(*) from private.ai_transmission_authorizations where created_at>=transaction_timestamp()-interval '1 day')>=coalesce((select (value::text)::integer from private.admin_settings where key='ai_daily_platform'),100)
 or (select count(*) from private.ai_transmission_authorizations where actor_id=private.request_uid() and created_at>=transaction_timestamp()-interval '1 day')>=coalesce((select (value::text)::integer from private.admin_settings where key='ai_daily_account'),10)
 or (select count(*) from private.ai_transmission_authorizations where actor_id=private.request_uid() and created_at>=transaction_timestamp()-interval '1 minute')>=coalesce((select (value::text)::integer from private.admin_settings where key='ai_minute_account'),3) then raise exception 'RATE_LIMITED';end if;
 perform private.check_ai_budget_before_admin();
end $$;
create function api.platform_notices(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is distinct from '{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 return (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from private.admin_settings where key in ('announcement','maintenance_notice'));
end $$;
grant create on schema private,api to fw_policy_exec;
alter function private.check_ai_budget() owner to fw_policy_exec;
alter function api.platform_notices(jsonb) owner to fw_policy_exec;
revoke create on schema private,api from fw_policy_exec;
revoke all on function private.check_ai_budget(),private.check_ai_budget_before_admin(),api.platform_notices(jsonb) from public,anon,authenticated,service_role,fw_user_exec;
grant execute on function private.check_ai_budget() to fw_user_exec;
grant execute on function api.platform_notices(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
