begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
create role fw_telemetry_exec nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
-- Offline setup may enable LOGIN with a random password. Never grant it to an API role.
create role oryqen_telemetry_writer nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls connection limit 4;
grant fw_telemetry_exec to postgres;
create schema runtime_ingest authorization fw_schema_owner;
revoke all on schema runtime_ingest from public,anon,authenticated,service_role;
grant usage on schema runtime_ingest to fw_telemetry_exec,oryqen_telemetry_writer;
grant usage on schema private to fw_telemetry_exec;
create table private.runtime_events(
 id uuid primary key, kind text not null check(kind in ('api_failure','login_success','login_failure','mfa_success','logout_success','password_changed','ai_attempt','ai_success','ai_error','ai_rate_limited','ai_unconfigured')),
 subject_id uuid, authorization_id uuid references private.ai_transmission_authorizations(id),
 operation text not null check(operation ~ '^[a-z0-9_.-]{1,64}$'),
 code text check(code in ('AUTH_REQUIRED','ACTION_FORBIDDEN','MFA_REQUIRED','NOT_FOUND','VALIDATION_FAILED','VERSION_CONFLICT','IDEMPOTENCY_CONFLICT','PAYLOAD_TOO_LARGE','UNSUPPORTED_MEDIA_TYPE','INVALID_JSON','RATE_LIMITED','SERVICE_UNAVAILABLE','INTERNAL_ERROR')),
 provider text check(provider in ('gemini','openai')),model text,
 duration_ms integer check(duration_ms between 0 and 120000),input_tokens integer check(input_tokens between 0 and 10000000),output_tokens integer check(output_tokens between 0 and 10000000),
 created_at timestamptz not null default clock_timestamp(),
 check((kind in ('ai_attempt','ai_success','ai_error','ai_rate_limited'))=(authorization_id is not null))
);
create index runtime_events_time on private.runtime_events(created_at desc,id);
create index runtime_events_subject on private.runtime_events(subject_id,created_at desc);
create unique index runtime_ai_terminal on private.runtime_events(authorization_id) where kind in ('ai_success','ai_error','ai_rate_limited');
create unique index runtime_ai_attempt on private.runtime_events(authorization_id) where kind='ai_attempt';
alter table private.runtime_events owner to fw_schema_owner;
alter table private.runtime_events enable row level security;
alter table private.runtime_events force row level security;
revoke all on private.runtime_events from public,anon,authenticated,service_role,oryqen_telemetry_writer;
grant select,insert on private.runtime_events to fw_telemetry_exec;
grant select on private.runtime_events to fw_admin_exec;
grant select(id,actor_id,provider,model) on private.ai_transmission_authorizations to fw_telemetry_exec;
create policy runtime_writer_read on private.runtime_events for select to fw_telemetry_exec using(true);
create policy runtime_writer_insert on private.runtime_events for insert to fw_telemetry_exec with check(true);
create policy runtime_admin_read on private.runtime_events for select to fw_admin_exec using(private.admin_role() is not null);
create policy runtime_consent_read on private.ai_transmission_authorizations for select to fw_telemetry_exec using(true);
create trigger runtime_event_immutable before update or delete on private.runtime_events for each row execute function private.day3_reject_history_mutation();
create function runtime_ingest.record_event(event jsonb) returns void language plpgsql security definer set search_path='' as $$
declare target uuid; actor uuid; consent uuid; provider_name text; model_name text; saved private.runtime_events;
begin
 if event is null or jsonb_typeof(event)<>'object' or not(event ?& array['id','kind','operation'])
 or event-array['id','kind','operation','subjectId','authorizationId','code','durationMs','inputTokens','outputTokens']<>'{}'
 or jsonb_typeof(event->'operation') is distinct from 'string' or event->>'operation' !~ '^[a-z0-9_.-]{1,64}$'
 or event->>'kind' is null or event->>'kind' not in ('api_failure','login_success','login_failure','mfa_success','logout_success','password_changed','ai_attempt','ai_success','ai_error','ai_rate_limited','ai_unconfigured')
 then raise exception 'VALIDATION_FAILED';end if;
 target:=(event->>'id')::uuid;actor:=(event->>'subjectId')::uuid;consent:=(event->>'authorizationId')::uuid;
 if target is null then raise exception 'VALIDATION_FAILED';end if;
 if exists(select 1 from jsonb_each(event) f where f.key in ('durationMs','inputTokens','outputTokens') and (jsonb_typeof(f.value) is distinct from 'number' or f.value::text !~ '^[0-9]{1,8}$')) then raise exception 'VALIDATION_FAILED';end if;
 if event->>'kind' in ('ai_attempt','ai_success','ai_error','ai_rate_limited') then
  select actor_id,provider,model into actor,provider_name,model_name from private.ai_transmission_authorizations where id=consent;
  if not found or event ? 'subjectId' then raise exception 'VALIDATION_FAILED';end if;
 else
  if consent is not null or event ? 'inputTokens' or event ? 'outputTokens' then raise exception 'VALIDATION_FAILED';end if;
 end if;
 if event->>'kind' in ('api_failure','login_failure','ai_unconfigured') and actor is not null then raise exception 'VALIDATION_FAILED';end if;
 if event->>'kind' in ('login_success','mfa_success','logout_success','password_changed') and actor is null then raise exception 'VALIDATION_FAILED';end if;
 if event->>'kind'<>'ai_success' and (event ? 'inputTokens' or event ? 'outputTokens') then raise exception 'VALIDATION_FAILED';end if;
 select * into saved from private.runtime_events where id=target;
 if found then
  if saved.kind<>event->>'kind' or saved.subject_id is distinct from actor or saved.authorization_id is distinct from consent or saved.operation<>event->>'operation' or saved.code is distinct from event->>'code' or saved.duration_ms is distinct from (event->>'durationMs')::integer or saved.input_tokens is distinct from (event->>'inputTokens')::integer or saved.output_tokens is distinct from (event->>'outputTokens')::integer then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return;
 end if;
 insert into private.runtime_events(id,kind,subject_id,authorization_id,operation,code,provider,model,duration_ms,input_tokens,output_tokens)
 values(target,event->>'kind',actor,consent,event->>'operation',event->>'code',provider_name,model_name,(event->>'durationMs')::integer,(event->>'inputTokens')::integer,(event->>'outputTokens')::integer);
exception when invalid_text_representation or check_violation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema runtime_ingest to fw_telemetry_exec;
alter function runtime_ingest.record_event(jsonb) owner to fw_telemetry_exec;
revoke create on schema runtime_ingest from fw_telemetry_exec;
revoke all on function runtime_ingest.record_event(jsonb) from public,anon,authenticated,service_role;
grant execute on function runtime_ingest.record_event(jsonb) to oryqen_telemetry_writer;

alter function private.admin_metadata(text) rename to admin_metadata_before_telemetry;
create function private.admin_metadata(resource text) returns table(id uuid,label text,status text,revision integer,recorded_at timestamptz,detail jsonb) language plpgsql set search_path='' as $$
begin
 if resource='telemetry' then return query select e.id,e.operation,e.kind,1,e.created_at,jsonb_build_object('subjectId',e.subject_id,'targetId',e.subject_id,'authorizationId',e.authorization_id,'code',e.code,'provider',e.provider,'model',e.model,'durationMs',e.duration_ms,'inputTokens',e.input_tokens,'outputTokens',e.output_tokens,'providerCost',null) from private.runtime_events e;
 else return query select * from private.admin_metadata_before_telemetry(resource);end if;
end $$;
alter function api.admin_read(jsonb) rename to admin_read_before_telemetry;
revoke all on function api.admin_read_before_telemetry(jsonb) from public,anon,authenticated,service_role;
create function api.admin_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; summary jsonb;
begin
 result:=api.admin_read_before_telemetry(request);
 if request->>'resource' in ('dashboard','ai','telemetry') then
  select jsonb_build_object('coverageStartedAt',min(created_at),'lastEventAt',max(created_at),
  'aiAttempts',count(*) filter(where kind='ai_attempt'),'aiSucceeded',count(*) filter(where kind='ai_success'),
  'aiFailed',count(*) filter(where kind in ('ai_error','ai_rate_limited')),'loginFailures',count(*) filter(where kind='login_failure'),
  'authorizationDenials',count(*) filter(where kind='api_failure' and code in ('AUTH_REQUIRED','ACTION_FORBIDDEN','MFA_REQUIRED')),
  'providerCost',null,'availability','observed_requests_only','scope','selected_utc_window') into summary
  from private.runtime_events where created_at>=(request->>'from')::date and created_at<(request->>'to')::date+1;
  result:=result||jsonb_build_object('telemetry',summary);
 end if;return result;
end $$;
grant create on schema private,api to fw_admin_exec;
alter function private.admin_metadata(text) owner to fw_admin_exec;
alter function api.admin_read(jsonb) owner to fw_admin_exec;
revoke create on schema private,api from fw_admin_exec;
revoke all on function private.admin_metadata(text),private.admin_metadata_before_telemetry(text),api.admin_read(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.admin_read(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
