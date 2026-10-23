begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Authorizations, not claims that an external call succeeded. No offer text stored.
create table private.ai_transmission_authorizations (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references private.profiles(id),
 provider text not null check(provider in ('openai','gemini')),
 model text not null check(model in ('gpt-4o-mini','gemini-2.5-flash')),
 notice_version text not null check(notice_version='offer-analysis.v1'),
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default transaction_timestamp()
);
alter table private.ai_transmission_authorizations enable row level security;
alter table private.ai_transmission_authorizations force row level security;
grant select,insert on private.ai_transmission_authorizations to fw_user_exec;
grant select on private.ai_transmission_authorizations to fw_policy_exec;
create policy ai_owner_read on private.ai_transmission_authorizations for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy ai_owner_insert on private.ai_transmission_authorizations for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp());
create policy ai_budget_read on private.ai_transmission_authorizations for select to fw_policy_exec using(private.is_active());
create index ai_admission_created on private.ai_transmission_authorizations(created_at);
create index ai_admission_actor_created on private.ai_transmission_authorizations(actor_id,created_at);
create trigger ai_authorization_immutable before update or delete on private.ai_transmission_authorizations for each row execute function private.day3_reject_history_mutation();
create function private.check_ai_budget() returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if (select count(*) from private.ai_transmission_authorizations where created_at>=transaction_timestamp()-interval '1 day')>=100
 or (select count(*) from private.ai_transmission_authorizations where actor_id=private.request_uid() and created_at>=transaction_timestamp()-interval '1 day')>=10
 or (select count(*) from private.ai_transmission_authorizations where actor_id=private.request_uid() and created_at>=transaction_timestamp()-interval '1 minute')>=3 then raise exception 'RATE_LIMITED';end if;
end $$;
grant create on schema private to fw_policy_exec;
alter function private.check_ai_budget() owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.check_ai_budget() from public,anon,authenticated,service_role;
grant execute on function private.check_ai_budget() to fw_user_exec;
create function api.authorize_ai_transmission(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['provider','model','noticeVersion','inputHash','consent']) or request-array['provider','model','noticeVersion','inputHash','consent']<>'{}'
 or request->'consent' is distinct from 'true'::jsonb or request->>'noticeVersion' is distinct from 'offer-analysis.v1'
 or request->>'provider' is null or request->>'provider' not in ('openai','gemini')
 or request->>'model' is distinct from (case when request->>'provider'='openai' then 'gpt-4o-mini' else 'gemini-2.5-flash' end)
 or jsonb_typeof(request->'inputHash') is distinct from 'string' or request->>'inputHash' !~ '^[0-9a-f]{64}$'
 then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended('oryqen-ai-global-budget',14));
 perform private.check_ai_budget();
 insert into private.ai_transmission_authorizations(actor_id,provider,model,notice_version,input_hash) values(actor,request->>'provider',request->>'model',request->>'noticeVersion',request->>'inputHash') returning id into receipt;
 return jsonb_build_object('authorizationId',receipt);
end $$;
grant create on schema api to fw_user_exec;
alter function api.authorize_ai_transmission(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.authorize_ai_transmission(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.authorize_ai_transmission(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
