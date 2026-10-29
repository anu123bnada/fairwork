begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- PROPOSED (batch 7, A). NOT APPLIED. Lives outside supabase/migrations on purpose: it is not part of the migration inventory until the owner approves it.
-- Work Passport sharing: an append-only record of every successful recipient view, an owner-only summary of it, and two notification events (the recipient is told a
-- record was shared with them; the owner is told it was first opened). The existing projection function keeps all of its checks (named recipient, expiry, revocation,
-- eligibility, quota): it is renamed to passport_projection_core, closed to clients, and a thin wrapper under the old name calls it and then records the view. Because
-- the wrapper keeps the old name and signature, callers (including a client calling the API directly) cannot reach the projection without being logged.
create table private.passport_access_log (
 id uuid primary key default gen_random_uuid(),
 grant_id uuid not null references private.passport_grants(id),
 worker_id uuid not null,
 recipient_id uuid not null,
 entries_shown smallint not null check(entries_shown between 0 and 1),
 viewed_at timestamptz not null default clock_timestamp()
);
create index passport_access_grant_idx on private.passport_access_log(grant_id,viewed_at);
create index passport_access_worker_idx on private.passport_access_log(worker_id,viewed_at);
alter table private.passport_access_log owner to fw_schema_owner;
alter table private.passport_access_log enable row level security;alter table private.passport_access_log force row level security;
revoke all on private.passport_access_log from public,anon,authenticated,service_role;
grant select,insert on private.passport_access_log to fw_projection_exec;
-- Only the projection role writes, and only a row about the caller's own view; only the record's owner reads it. The recipient cannot read or erase the log.
create policy passport_access_insert on private.passport_access_log for insert to fw_projection_exec with check(private.is_active() and recipient_id=private.request_uid());
create policy passport_access_owner_read on private.passport_access_log for select to fw_projection_exec using(private.is_active() and worker_id=private.request_uid());
create trigger passport_access_immutable before update or delete on private.passport_access_log for each row execute function private.day3_reject_history_mutation();

alter function api.passport_projection(jsonb) rename to passport_projection_core;
revoke all on function api.passport_projection_core(jsonb) from public,anon,authenticated,service_role;
create function api.passport_projection(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;g private.passport_grants;
begin
 result:=api.passport_projection_core(request); -- every existing check runs first and may raise; a refused view is never logged as a view
 if request->>'mode'='recipient' then
  select * into g from private.passport_grants where id=(request->>'grantId')::uuid;
  if found and g.recipient_id=private.request_uid() then
   insert into private.passport_access_log(grant_id,worker_id,recipient_id,entries_shown) values(g.id,g.worker_id,g.recipient_id,least(1,jsonb_array_length(result->'entries')));
  end if;
 end if;
 return result;
end $$;
grant create on schema api to fw_projection_exec;
alter function api.passport_projection(jsonb) owner to fw_projection_exec;
revoke create on schema api from fw_projection_exec;
revoke all on function api.passport_projection(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.passport_projection(jsonb) to authenticated;
-- passport_share_command (owned by fw_user_exec) renders the owner's preview through this name, so the wrapper inherits the grant the original held. Previews are not logged.
grant execute on function api.passport_projection(jsonb) to fw_user_exec;

-- Owner-only summary: per grant, how many times it was opened and when. Never shows anything about the recipient beyond the grant the owner already made.
create function api.passport_access_summary(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 select coalesce(jsonb_agg(jsonb_build_object('grantId',s.grant_id,'views',s.views,'firstViewedAt',s.first_at,'lastViewedAt',s.last_at) order by s.last_at desc),'[]') into items
 from (select l.grant_id,count(*) views,min(l.viewed_at) first_at,max(l.viewed_at) last_at from private.passport_access_log l where l.worker_id=private.request_uid() group by l.grant_id order by max(l.viewed_at) desc limit 50) s;
 return jsonb_build_object('items',items);
end $$;
grant create on schema api to fw_projection_exec;
alter function api.passport_access_summary(jsonb) owner to fw_projection_exec;
revoke create on schema api from fw_projection_exec;
revoke all on function api.passport_access_summary(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.passport_access_summary(jsonb) to authenticated;

-- Notification events. COMPANION CHANGE REQUIRED BEFORE APPLYING: the feed's response schema (src/features/identity/notifications-schema.ts) is a strict enum of kinds and a
-- strict pattern of links. It must first accept kinds 'passport_share' and 'passport_view' and the link '/app/passport', or the whole feed would fail to parse for any
-- account that has such an event.
create function private.passport_notification_events() returns table(event_key text,kind text,title text,href text,recorded_at timestamptz)
language sql stable security definer set search_path='' as $$
 select 'passport-share:'||g.id::text,'passport_share','A Work Passport record was shared with you','/app/passport',g.activated_at
 from private.passport_grants g where g.recipient_id=private.request_uid() and g.activated_at is not null and g.revoked_at is null and g.expires_at>clock_timestamp()
 union all
 select 'passport-view:'||l.grant_id::text,'passport_view','A Work Passport record you shared was opened','/app/passport',min(l.viewed_at)
 from private.passport_access_log l where l.worker_id=private.request_uid() group by l.grant_id;
$$;
grant create on schema private to fw_projection_exec;
alter function private.passport_notification_events() owner to fw_projection_exec;
revoke create on schema private from fw_projection_exec;
revoke all on function private.passport_notification_events() from public,anon,authenticated,service_role;
grant execute on function private.passport_notification_events() to fw_user_exec;
alter function private.notification_events() rename to notification_events_before_passport;
revoke all on function private.notification_events_before_passport() from public,anon,authenticated,service_role;
create function private.notification_events() returns table(event_key text,kind text,title text,href text,recorded_at timestamptz) language sql stable set search_path='' as $$
 select * from private.notification_events_before_passport() union all select * from private.passport_notification_events();
$$;
grant create on schema private to fw_user_exec;
alter function private.notification_events() owner to fw_user_exec;
alter function private.notification_events_before_passport() owner to fw_user_exec;
revoke create on schema private from fw_user_exec;
revoke all on function private.notification_events() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
