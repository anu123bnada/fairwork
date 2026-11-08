begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Own security activity (module 12). A person can read the server-observed sign-in, second-factor, sign-out and password-change events recorded for their own account,
-- newest first, so they can notice activity they do not recognise. Only four event kinds and only the kind and time are readable; the telemetry table keeps no address,
-- device or request content. Failed sign-ins are recorded without a subject (the server cannot attribute them), so they are not shown here. Nobody else can read these rows
-- through this path: the policy is bound to the caller's own identity and the table stays append-only and force-RLS.
grant select(kind,subject_id,created_at) on private.runtime_events to fw_user_exec;
create policy runtime_owner_security_read on private.runtime_events for select to fw_user_exec
 using(private.is_active() and subject_id=private.request_uid() and kind in ('login_success','mfa_success','logout_success','password_changed'));

create function api.security_events_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('kind',e.kind,'occurredAt',e.created_at) order by e.created_at desc),'[]'::jsonb) into items
  from (select x.kind,x.created_at from private.runtime_events x
         where x.subject_id=actor and x.kind in ('login_success','mfa_success','logout_success','password_changed')
         order by x.created_at desc limit 30) e;
 return jsonb_build_object('items',items,'limit',30);
end $$;

grant create on schema api to fw_user_exec;
alter function api.security_events_list(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.security_events_list(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.security_events_list(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
