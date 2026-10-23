begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
create role fw_projection_exec nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant fw_projection_exec to postgres;
grant usage on schema private,api to fw_projection_exec;
grant execute on function private.request_uid(),private.require_identity(),private.request_jwt(),private.is_active(),private.agreement_hash(jsonb),private.work_historical_authority(uuid,uuid,uuid,timestamptz),private.work_case_blocked(uuid,integer) to fw_projection_exec;

create table private.passport_field_registry (version text not null,field_code text not null,primary key(version,field_code));
insert into private.passport_field_registry values ('passport.v1','task_summary'),('passport.v1','observation_date'),('passport.v1','evidence_kind'),('passport.v1','confirmation_method'),('passport.v1','authority_assurance'),('passport.v1','verification_status');
create table private.work_passport_items (
 id uuid primary key,passport_id uuid not null references private.work_passports(id),worker_id uuid not null references private.profiles(id),
 work_id uuid not null,work_version integer not null,disclosure_summary text not null check(char_length(btrim(disclosure_summary)) between 1 and 240),
 added_at timestamptz not null default transaction_timestamp(),removed_at timestamptz,
 foreign key(work_id,work_version) references private.work_record_versions(work_id,version),unique(id,passport_id,worker_id)
);
create table private.passport_item_fields (
 item_id uuid not null references private.work_passport_items(id),version text not null default 'passport.v1' check(version='passport.v1'),field_code text not null,removed_at timestamptz,
 primary key(item_id,field_code),foreign key(version,field_code) references private.passport_field_registry(version,field_code)
);
-- One immutable item per grant; multiple records use separate explicit grants.
create table private.passport_grants (
 id uuid primary key,item_id uuid not null,passport_id uuid not null,worker_id uuid not null,recipient_id uuid not null references private.profiles(id),
 projection_version text not null default 'passport.v1' check(projection_version='passport.v1'),
 created_at timestamptz not null default transaction_timestamp(),expires_at timestamptz not null,activated_at timestamptz,revoked_at timestamptz,
 check(worker_id<>recipient_id),check(expires_at>created_at and expires_at<=created_at+interval '30 days'),
 foreign key(item_id,passport_id,worker_id) references private.work_passport_items(id,passport_id,worker_id),unique(id,item_id)
);
create table private.passport_grant_fields (
 grant_id uuid not null,item_id uuid not null,field_code text not null,primary key(grant_id,field_code),
 foreign key(grant_id,item_id) references private.passport_grants(id,item_id),foreign key(item_id,field_code) references private.passport_item_fields(item_id,field_code)
);
create table private.passport_share_events (
 id uuid primary key default gen_random_uuid(),worker_id uuid not null references private.profiles(id),item_id uuid not null references private.work_passport_items(id),
 grant_id uuid references private.passport_grants(id),operation text not null check(operation in ('select','prepare','activate','revoke','remove','remove_field')),
 field_code text,recorded_at timestamptz not null default transaction_timestamp()
);
create index passport_item_owner on private.work_passport_items(worker_id,id);
create index passport_grant_recipient on private.passport_grants(recipient_id,expires_at,id);
create index passport_item_work on private.work_passport_items(work_id,work_version);
create index passport_grant_item on private.passport_grants(item_id);

do $$ declare t text;begin
 foreach t in array array['passport_field_registry','work_passport_items','passport_item_fields','passport_grants','passport_grant_fields','passport_share_events'] loop
  execute format('alter table private.%I enable row level security',t);execute format('alter table private.%I force row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
grant select on private.passport_field_registry to fw_user_exec,fw_projection_exec;
create policy registry_read on private.passport_field_registry for select to fw_user_exec,fw_projection_exec using(true);
grant select,insert on private.work_passport_items,private.passport_item_fields,private.passport_grants,private.passport_grant_fields,private.passport_share_events to fw_user_exec;
grant update(removed_at) on private.work_passport_items,private.passport_item_fields to fw_user_exec;
grant update(activated_at,revoked_at) on private.passport_grants to fw_user_exec;
create policy share_item_owner on private.work_passport_items for all to fw_user_exec using(private.is_active() and worker_id=private.request_uid()) with check(private.is_active() and worker_id=private.request_uid() and exists(select 1 from private.work_passports p where p.id=passport_id and p.worker_id=private.request_uid()) and exists(select 1 from private.work_records r where r.id=work_id and r.worker_id=private.request_uid()));
create policy share_fields_owner on private.passport_item_fields for all to fw_user_exec using(exists(select 1 from private.work_passport_items i where i.id=item_id)) with check(exists(select 1 from private.work_passport_items i where i.id=item_id and i.removed_at is null));
create policy share_grant_owner on private.passport_grants for all to fw_user_exec using(private.is_active() and worker_id=private.request_uid()) with check(private.is_active() and worker_id=private.request_uid());
create policy share_grant_fields_owner on private.passport_grant_fields for all to fw_user_exec using(exists(select 1 from private.passport_grants g where g.id=grant_id)) with check(exists(select 1 from private.passport_grants g where g.id=grant_id and g.activated_at is null and g.revoked_at is null));
create policy share_event_owner on private.passport_share_events for all to fw_user_exec using(private.is_active() and worker_id=private.request_uid()) with check(private.is_active() and worker_id=private.request_uid() and recorded_at=transaction_timestamp());

-- Metadata helper never receives raw content, summaries, reasons or evidence.
grant select(id,worker_id,passport_id,work_id,work_version,removed_at) on private.work_passport_items to fw_policy_exec;
grant select(id,item_id,worker_id,recipient_id,expires_at,activated_at,revoked_at) on private.passport_grants to fw_policy_exec;
grant select(agreement_id,agreement_version) on private.work_record_versions to fw_policy_exec;
create policy share_item_metadata on private.work_passport_items for select to fw_policy_exec using(private.request_uid() is not null);
create policy share_grant_metadata on private.passport_grants for select to fw_policy_exec using(private.request_uid() is not null);
grant create on schema private to fw_policy_exec;
create function private.share_subject_active(subject uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from private.profiles where id=subject and account_state='active' and deleted_at is null); $$;
create function private.can_project_item(wanted uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from private.work_passport_items i where i.id=wanted and i.removed_at is null and private.share_subject_active(i.worker_id)
 and (i.worker_id=private.request_uid() or exists(select 1 from private.passport_grants g where g.item_id=i.id and g.recipient_id=private.request_uid() and g.activated_at is not null and g.revoked_at is null and g.expires_at>clock_timestamp())));
$$;
create function private.can_project_work(wanted uuid,revision integer default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.work_passport_items i where i.work_id=wanted and (revision is null or i.work_version=revision) and private.can_project_item(i.id));
$$;
create function private.can_project_agreement(wanted uuid,revision integer) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.work_record_versions v where v.agreement_id=wanted and v.agreement_version=revision and private.can_project_work(v.work_id,v.version));
$$;
create function private.can_project_grant(wanted uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from private.passport_grants g where g.id=wanted and private.share_subject_active(g.worker_id) and (g.worker_id=private.request_uid() or (g.recipient_id=private.request_uid() and g.activated_at is not null and g.revoked_at is null and g.expires_at>clock_timestamp())));
$$;
do $$ declare p record;begin
 for p in select oid::regprocedure signature from pg_proc where pronamespace='private'::regnamespace and proname in ('share_subject_active','can_project_item','can_project_work','can_project_agreement','can_project_grant') loop
 execute format('alter function %s owner to fw_policy_exec',p.signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',p.signature);execute format('grant execute on function %s to fw_projection_exec,fw_user_exec',p.signature);
 end loop;
end $$;
revoke create on schema private from fw_policy_exec;

grant select on private.work_passport_items,private.passport_item_fields,private.passport_grants,private.passport_grant_fields to fw_projection_exec;
create policy projection_item on private.work_passport_items for select to fw_projection_exec using(private.can_project_item(id));
create policy projection_item_field on private.passport_item_fields for select to fw_projection_exec using(private.can_project_item(item_id));
create policy projection_grant on private.passport_grants for select to fw_projection_exec using(private.can_project_grant(id));
create policy projection_grant_field on private.passport_grant_fields for select to fw_projection_exec using(private.can_project_grant(grant_id));
-- Read only the exact source columns needed for integrity; no DTO uses whole rows.
grant select(id,worker_id,representative_id,company_id,current_version) on private.work_records to fw_projection_exec;
grant select(work_id,version,agreement_id,agreement_version,state,content,content_hash,evidence_hash,authority_decision_id) on private.work_record_versions to fw_projection_exec;
grant select(id,work_id,version,worker_id,representative_id,company_id,authority_decision_id,outcome,content_hash,evidence_hash,recorded_at) on private.work_decisions to fw_projection_exec;
grant select(work_id,operation,decision_id) on private.work_integrity_events to fw_projection_exec;
grant select(id,work_id,version,owner_id,text,recorded_at) on private.work_evidence to fw_projection_exec;
grant select(agreement_id,version,content_hash,authority_decision_id,unresolved_ids,unresolved_hash) on private.agreement_versions to fw_projection_exec;
grant select(agreement_id,version,actor_id,decision,content_hash) on private.agreement_decisions to fw_projection_exec;
grant select(agreement_id,version,actor_id,content_hash,item_ids,item_set_hash) on private.agreement_acknowledgements to fw_projection_exec;
create policy projection_work on private.work_records for select to fw_projection_exec using(private.can_project_work(id));
create policy projection_version on private.work_record_versions for select to fw_projection_exec using(private.can_project_work(work_id,version));
create policy projection_decision on private.work_decisions for select to fw_projection_exec using(private.can_project_work(work_id,version));
create policy projection_integrity on private.work_integrity_events for select to fw_projection_exec using(private.can_project_work(work_id));
create policy projection_evidence on private.work_evidence for select to fw_projection_exec using(private.can_project_work(work_id,version));
create policy projection_agreement on private.agreement_versions for select to fw_projection_exec using(private.can_project_agreement(agreement_id,version));
create policy projection_agreement_decision on private.agreement_decisions for select to fw_projection_exec using(private.can_project_agreement(agreement_id,version));
create policy projection_ack on private.agreement_acknowledgements for select to fw_projection_exec using(private.can_project_agreement(agreement_id,version));

-- Reuse the complete existing Day 6 integrity predicate, changing only its actor
-- binding to an explicit owner under the projection executor's restricted RLS.
-- Fail migration if the exact reviewed binding cannot be identified. No JWT swap.
do $$ declare body text;begin
 select prosrc into body from pg_proc where oid='private.passport_eligible_day6(uuid,integer)'::regprocedure;
 if length(body)-length(replace(body,'r.worker_id=private.request_uid()',''))<>length('r.worker_id=private.request_uid()') then raise exception 'Unreviewed Passport eligibility source';end if;
 body:=replace(body,'r.worker_id=private.request_uid()','r.worker_id=owner_id');
 execute 'create function private.shared_passport_integrity(work uuid,revision integer,owner_id uuid) returns boolean language sql stable set search_path='''''||' as '||quote_literal(body);
end $$;
grant create on schema private,api to fw_projection_exec,fw_user_exec;
alter function private.shared_passport_integrity(uuid,integer,uuid) owner to fw_projection_exec;
revoke all on function private.shared_passport_integrity(uuid,integer,uuid) from public,anon,authenticated,service_role;

create function private.guard_share_lifecycle() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'ACTION_FORBIDDEN';end if;
 if tg_table_name='passport_grants' then
  if (to_jsonb(new)-'activated_at'-'revoked_at') is distinct from (to_jsonb(old)-'activated_at'-'revoked_at') or (old.activated_at is not null and new.activated_at is distinct from old.activated_at) or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) or (new.activated_at is distinct from old.activated_at and (old.revoked_at is not null or new.activated_at<>transaction_timestamp())) or (new.revoked_at is distinct from old.revoked_at and new.revoked_at<>transaction_timestamp()) then raise exception 'ACTION_FORBIDDEN';end if;
 else
  if (to_jsonb(new)-'removed_at') is distinct from (to_jsonb(old)-'removed_at') or (old.removed_at is not null and new.removed_at is distinct from old.removed_at) or (new.removed_at is distinct from old.removed_at and new.removed_at<>transaction_timestamp()) then raise exception 'ACTION_FORBIDDEN';end if;
 end if;return new;
end $$;
create trigger share_item_guard before update or delete on private.work_passport_items for each row execute function private.guard_share_lifecycle();
create trigger share_field_guard before update or delete on private.passport_item_fields for each row execute function private.guard_share_lifecycle();
create trigger share_grant_guard before update or delete on private.passport_grants for each row execute function private.guard_share_lifecycle();
create trigger share_frozen_fields before update or delete on private.passport_grant_fields for each row execute function private.day3_reject_history_mutation();
create trigger share_events_immutable before update or delete on private.passport_share_events for each row execute function private.day3_reject_history_mutation();
create trigger share_registry_immutable before update or delete on private.passport_field_registry for each row execute function private.day3_reject_history_mutation();

create function private.consume_projection_quota() returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 perform private.consume_identity_quota('identity_read');
end $$;
alter function private.consume_projection_quota() owner to fw_user_exec;
revoke all on function private.consume_projection_quota() from public,anon,authenticated,service_role;
grant execute on function private.consume_projection_quota() to fw_projection_exec;
create function api.passport_projection(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g private.passport_grants;i private.work_passport_items;fields jsonb;values_json jsonb;eligible boolean;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 perform private.consume_projection_quota();
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['grantId','mode']) or request-array['grantId','mode']<>'{}' or request->>'mode' is null or request->>'mode' not in ('preview','recipient') then raise exception 'VALIDATION_FAILED';end if;
 select * into g from private.passport_grants where id=(request->>'grantId')::uuid;
 if not found or (request->>'mode'='preview' and g.worker_id<>private.request_uid()) or (request->>'mode'='recipient' and g.recipient_id<>private.request_uid()) or g.revoked_at is not null or g.expires_at<=clock_timestamp() then raise exception 'NOT_FOUND';end if;
 select * into i from private.work_passport_items where id=g.item_id;
 eligible:=i.id is not null and private.shared_passport_integrity(i.work_id,i.work_version,i.worker_id) and not private.work_case_blocked(i.work_id,i.work_version);
 select coalesce(jsonb_agg(f.field_code order by f.field_code),'[]') into fields from private.passport_grant_fields f join private.passport_item_fields s on s.item_id=f.item_id and s.field_code=f.field_code join private.passport_field_registry registry on registry.version=g.projection_version and registry.field_code=f.field_code where f.grant_id=g.id and s.removed_at is null;
 values_json:='{}';
 if eligible then
  select coalesce(jsonb_object_agg(code,case code when 'task_summary' then to_jsonb(i.disclosure_summary) when 'observation_date' then v.content->'periodEnd' when 'evidence_kind' then to_jsonb('confirmed_work'::text) when 'confirmation_method' then to_jsonb('independent_account_confirmation'::text) when 'authority_assurance' then to_jsonb('synthetic_demo_authority_not_legal_verification'::text) when 'verification_status' then to_jsonb('currently_eligible'::text) end),'{}') into values_json from jsonb_array_elements_text(fields) code cross join private.work_record_versions v where v.work_id=i.work_id and v.version=i.work_version;
 end if;
 return jsonb_build_object('projectionVersion','passport.v1','grantId',g.id,'expiresAt',g.expires_at,'active',g.activated_at is not null,'entries',case when eligible and values_json<>'{}' then jsonb_build_array(values_json) else '[]'::jsonb end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.passport_share_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;op text;allowed text[];i private.work_passport_items;g private.passport_grants;wanted uuid;work uuid;revision integer;fields text[];expires timestamptz;projection jsonb;
begin
 actor:=private.require_identity();perform private.work_lock_owner(actor);op:=request->>'operation';
 if request is null or jsonb_typeof(request)<>'object' or op is null or op not in ('select','prepare','activate','revoke','remove','remove_field') then raise exception 'VALIDATION_FAILED';end if;
 allowed:=case op when 'select' then array['operation','itemId','workId','workVersion','summary','fields'] when 'prepare' then array['operation','grantId','itemId','recipientId','expiresAt','fields'] when 'remove_field' then array['operation','itemId','field'] when 'remove' then array['operation','itemId'] else array['operation','grantId'] end;
 if not(request ?& allowed) or request-allowed<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,7));perform private.consume_identity_quota('identity_write');
 if op in ('select','prepare') then
  if jsonb_typeof(request->'fields') is distinct from 'array' or jsonb_array_length(request->'fields') not between 1 and 6 or exists(select 1 from jsonb_array_elements(request->'fields') f where jsonb_typeof(f)<>'string') then raise exception 'VALIDATION_FAILED';end if;
  select array_agg(f order by f) into fields from jsonb_array_elements_text(request->'fields') f;
  if cardinality(fields)<>(select count(distinct f) from unnest(fields) f) or exists(select 1 from unnest(fields) f where not exists(select 1 from private.passport_field_registry r where r.version='passport.v1' and r.field_code=f)) then raise exception 'VALIDATION_FAILED';end if;
 end if;
 if op='select' then
  wanted:=(request->>'itemId')::uuid;work:=(request->>'workId')::uuid;revision:=(request->>'workVersion')::integer;
  if wanted is null or work is null or revision is null or jsonb_typeof(request->'summary') is distinct from 'string' or char_length(btrim(request->>'summary')) not between 1 and 240 then raise exception 'VALIDATION_FAILED';end if;
  if not private.passport_eligible(work,revision) then raise exception 'ACTION_FORBIDDEN';end if;
  select * into i from private.work_passport_items where id=wanted;
  if found then
   if i.work_id<>work or i.work_version<>revision or i.disclosure_summary is distinct from request->>'summary' or fields is distinct from (select array_agg(field_code order by field_code) from private.passport_item_fields where item_id=i.id) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  else
   insert into private.work_passport_items(id,passport_id,worker_id,work_id,work_version,disclosure_summary) select wanted,p.id,actor,work,revision,request->>'summary' from private.work_passports p where p.worker_id=actor returning * into i;
   if not found then raise exception 'NOT_FOUND';end if;
   insert into private.passport_item_fields(item_id,field_code) select i.id,f from unnest(fields) f;
   insert into private.passport_share_events(worker_id,item_id,operation) values(actor,i.id,op);
  end if;
 elsif op in ('prepare','remove','remove_field') then
  select * into i from private.work_passport_items where id=(request->>'itemId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
  if op='prepare' then
   if i.removed_at is not null or not private.passport_eligible(i.work_id,i.work_version) then raise exception 'ACTION_FORBIDDEN';end if;
   expires:=(request->>'expiresAt')::timestamptz;wanted:=(request->>'grantId')::uuid;
   if wanted is null or expires is null or (request->>'recipientId')::uuid is not distinct from actor or not private.share_subject_active((request->>'recipientId')::uuid) or expires<=clock_timestamp() or expires>clock_timestamp()+interval '30 days' or exists(select 1 from unnest(fields) f where not exists(select 1 from private.passport_item_fields s where s.item_id=i.id and s.field_code=f and s.removed_at is null)) then raise exception 'VALIDATION_FAILED';end if;
   select * into g from private.passport_grants where id=wanted;
   if found then
    if g.item_id<>i.id or g.recipient_id<>(request->>'recipientId')::uuid or g.expires_at<>expires or fields is distinct from (select array_agg(field_code order by field_code) from private.passport_grant_fields where grant_id=g.id) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   else
    insert into private.passport_grants(id,item_id,passport_id,worker_id,recipient_id,expires_at) values(wanted,i.id,i.passport_id,actor,(request->>'recipientId')::uuid,expires) returning * into g;
    insert into private.passport_grant_fields(grant_id,item_id,field_code) select g.id,i.id,f from unnest(fields) f;
    insert into private.passport_share_events(worker_id,item_id,grant_id,operation) values(actor,i.id,g.id,op);
   end if;
  elsif op='remove' then
   if i.removed_at is null then update private.work_passport_items set removed_at=transaction_timestamp() where id=i.id;insert into private.passport_share_events(worker_id,item_id,operation) values(actor,i.id,op);end if;
  else
   if not exists(select 1 from private.passport_item_fields where item_id=i.id and field_code=request->>'field') then raise exception 'NOT_FOUND';end if;
   update private.passport_item_fields set removed_at=transaction_timestamp() where item_id=i.id and field_code=request->>'field' and removed_at is null;
   if found then insert into private.passport_share_events(worker_id,item_id,operation,field_code) values(actor,i.id,op,request->>'field');end if;
  end if;
 else
  select * into g from private.passport_grants where id=(request->>'grantId')::uuid;if not found then raise exception 'NOT_FOUND';end if;
  if op='activate' then
   if g.revoked_at is not null or g.expires_at<=clock_timestamp() then raise exception 'ACTION_FORBIDDEN';end if;
   projection:=api.passport_projection(jsonb_build_object('grantId',g.id,'mode','preview'));
   if jsonb_array_length(projection->'entries')=0 then raise exception 'ACTION_FORBIDDEN';end if;
   if g.activated_at is null then update private.passport_grants set activated_at=transaction_timestamp() where id=g.id;insert into private.passport_share_events(worker_id,item_id,grant_id,operation) values(actor,g.item_id,g.id,op);end if;
  else
   if g.revoked_at is null then update private.passport_grants set revoked_at=transaction_timestamp() where id=g.id;insert into private.passport_share_events(worker_id,item_id,grant_id,operation) values(actor,g.item_id,g.id,op);end if;
  end if;
 end if;
 return jsonb_build_object('itemId',coalesce(i.id,g.item_id),'grantId',g.id,'operation',op);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_FAILED';when unique_violation or foreign_key_violation then raise exception 'VERSION_CONFLICT';end $$;

create function api.passport_share_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;cursor uuid;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 perform private.consume_projection_quota();
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'cursor') or request-'cursor'<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 cursor:=(request->>'cursor')::uuid;
 select coalesce(jsonb_agg(jsonb_build_object('grantId',p.id,'itemId',case when p.worker_id=private.request_uid() then p.item_id end,'recipientId',case when p.worker_id=private.request_uid() then p.recipient_id end,'owner',p.worker_id=private.request_uid(),'active',p.activated_at is not null,'revoked',p.revoked_at is not null,'expiresAt',p.expires_at) order by p.id),'[]') into items from(select * from private.passport_grants where cursor is null or id>cursor order by id limit 20) p;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'grantId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
alter function api.passport_projection(jsonb) owner to fw_projection_exec;
alter function api.passport_share_list(jsonb) owner to fw_projection_exec;
alter function api.passport_share_command(jsonb) owner to fw_user_exec;
alter function private.guard_share_lifecycle() owner to fw_schema_owner;
revoke all on function private.guard_share_lifecycle(),api.passport_projection(jsonb),api.passport_share_list(jsonb),api.passport_share_command(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.passport_projection(jsonb) to fw_user_exec;
grant execute on function api.passport_projection(jsonb),api.passport_share_list(jsonb),api.passport_share_command(jsonb) to authenticated;
revoke create on schema private,api from fw_projection_exec,fw_user_exec;
notify pgrst,'reload schema';
commit;
