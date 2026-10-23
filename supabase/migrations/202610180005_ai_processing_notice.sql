begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Preserve older admission receipts; new dispatches require a complete notice.
create table private.ai_processing_notices (
 authorization_id uuid primary key references private.ai_transmission_authorizations(id),
 actor_id uuid not null references private.profiles(id),
 processing_region text not null check(char_length(processing_region) between 1 and 120),
 data_use text not null check(char_length(data_use) between 1 and 1000),
 policy_hash text not null check(policy_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default transaction_timestamp()
);
alter table private.ai_processing_notices enable row level security;
alter table private.ai_processing_notices force row level security;
grant select,insert on private.ai_processing_notices to fw_user_exec;
create policy ai_notice_owner_read on private.ai_processing_notices for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy ai_notice_owner_insert on private.ai_processing_notices for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp() and exists(select 1 from private.ai_transmission_authorizations a where a.id=authorization_id and a.actor_id=private.request_uid()));
create trigger ai_notice_immutable before update or delete on private.ai_processing_notices for each row execute function private.day3_reject_history_mutation();
alter function api.authorize_ai_transmission(jsonb) rename to authorize_ai_transmission_v1;
revoke all on function api.authorize_ai_transmission_v1(jsonb) from public,anon,authenticated,service_role;
create function api.authorize_ai_transmission(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; actor uuid;
begin
 actor:=private.require_identity();
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['processingRegion','dataUse','policyHash'])
 or jsonb_typeof(request->'processingRegion') is distinct from 'string' or char_length(btrim(request->>'processingRegion')) not between 1 and 120
 or jsonb_typeof(request->'dataUse') is distinct from 'string' or char_length(btrim(request->>'dataUse')) not between 1 and 1000
 or jsonb_typeof(request->'policyHash') is distinct from 'string' or request->>'policyHash' !~ '^[0-9a-f]{64}$'
 then raise exception 'VALIDATION_FAILED';end if;
 result:=api.authorize_ai_transmission_v1(request-array['processingRegion','dataUse','policyHash']);
 insert into private.ai_processing_notices(authorization_id,actor_id,processing_region,data_use,policy_hash)
 values((result->>'authorizationId')::uuid,actor,request->>'processingRegion',request->>'dataUse',request->>'policyHash');
 return result;
end $$;
grant create on schema api to fw_user_exec;
alter function api.authorize_ai_transmission(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.authorize_ai_transmission(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.authorize_ai_transmission(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
