begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required'; end if; end $$;
-- Read-only team roster for currently authorized representatives of an organization.
-- It exposes membership facts only (role, status, effective/expiry dates, "you" flag).
-- No names, evidence, reasons or reviewer identities cross this boundary, and it grants
-- no new table privilege to any role. Membership changes remain operator-reviewed.
create function private.company_team(company uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when private.active_authority(company,private.request_uid()) is null then null else
  coalesce((select jsonb_agg(jsonb_build_object(
    'self',t.subject_id=private.request_uid(),'role','representative',
    'status',case when t.decision='revoke' then 'revoked' when t.expires_at<=transaction_timestamp() then 'expired'
      when t.effective_at>transaction_timestamp() then 'pending' else 'active' end,
    'effectiveAt',t.effective_at,'expiresAt',t.expires_at) order by t.effective_at desc,t.subject_id)
   from (select m.subject_id,d.decision,d.effective_at,d.expires_at from private.company_memberships m
     join private.company_membership_decisions d on (d.company_id,d.subject_id,d.id)=(m.company_id,m.subject_id,m.current_decision_id)
     where m.company_id=company order by d.effective_at desc,m.subject_id limit 100) t),'[]'::jsonb) end;
$$;
grant create on schema private to fw_policy_exec;
alter function private.company_team(uuid) owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.company_team(uuid) from public,anon,authenticated,service_role;
grant execute on function private.company_team(uuid) to fw_user_exec;

create function api.company_team(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; company uuid; roster jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'companyId') or request-array['companyId']<>'{}'
  or jsonb_typeof(request->'companyId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 company:=(request->>'companyId')::uuid;
 perform private.consume_identity_quota('identity_read');
 roster:=private.company_team(company);
 -- Same answer for unknown organizations and for callers without current authority.
 if roster is null then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('companyId',company,'members',roster,'changeProcess','operator_reviewed');
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_user_exec;
alter function api.company_team(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.company_team(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.company_team(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
