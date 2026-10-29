begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- PROPOSED (batch 7, C). NOT APPLIED. REQUIRES THE HOSTED SUPABASE REALTIME SERVICE (schema `realtime`: realtime.send, realtime.topic(), realtime.messages). It could only be
-- tested here against a stub of that schema, so it must be verified on the hosted project (two accounts) before it is relied on.
-- Design: a *signal*, never data. When something changes for a person, the database broadcasts the single word of the affected area ("notifications", "offers",
-- "agreements", "work", "cases", "passport") on that person's private topic `user:<uid>`. The payload carries no id, title, name or content, so even a misrouted message
-- discloses nothing. The browser treats a signal as a hint to refetch through the existing authorized API (see src/features/realtime/feed-sync.ts); the API remains the only
-- source of data, with all of its checks. Clients can subscribe only to their own topic (policy below) and can never publish (no insert policy).
create function private.realtime_signal(target uuid,area text) returns void language plpgsql security definer set search_path='' as $$
begin
 if target is null or area not in ('notifications','offers','agreements','work','cases','passport') then return;end if;
 perform realtime.send(jsonb_build_object('area',area),'changed','user:'||target::text,true);
exception when others then null; -- a failed signal must never fail or roll back the business write; clients also refetch on focus and reconnect
end $$;
-- The function owner must be allowed to call the Realtime sender. (Verify on the hosted project that realtime.send is callable by a granted role; if it is not, the owner of
-- private.realtime_signal must be changed to the role that may call it. A silent failure here would only mean no live hints, never a failed write.)
grant usage on schema realtime to fw_schema_owner;
grant execute on function realtime.send(jsonb,text,text,boolean) to fw_schema_owner;
grant create on schema private to fw_schema_owner;
alter function private.realtime_signal(uuid,text) owner to fw_schema_owner;
revoke create on schema private from fw_schema_owner;
revoke all on function private.realtime_signal(uuid,text) from public,anon,authenticated,service_role;

-- Receive only your own topic, only as a broadcast, only on private channels.
alter table realtime.messages enable row level security;
create policy oryqen_own_topic_receive on realtime.messages for select to authenticated
 using (realtime.messages.extension='broadcast' and realtime.topic()='user:'||(select auth.uid())::text);

-- Fan-out. Each trigger resolves the people who may already see the record through the existing rules and signals only them. They never read or copy record content.
create function private.signal_offer_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.realtime_signal(new.worker_id,'offers');perform private.realtime_signal(new.worker_id,'notifications');
 perform private.realtime_signal(new.representative_id,'offers');perform private.realtime_signal(new.representative_id,'notifications');
 return null;
end $$;
-- Owned by fw_policy_exec, the role that already holds the narrow metadata-only read rights on cases, records and assignments (forced row level security would hide them from
-- any other owner). It reads only who the parties are, never the case text.
create function private.signal_case_event() returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
 for r in select w.worker_id,w.representative_id,a.reviewer_id from private.work_cases c join private.work_records w on w.id=c.work_id
   left join private.work_case_assignments a on a.case_id=c.id and a.revoked_at is null where c.id=new.case_id loop
  perform private.realtime_signal(r.worker_id,'cases');perform private.realtime_signal(r.worker_id,'notifications');
  perform private.realtime_signal(r.representative_id,'cases');perform private.realtime_signal(r.representative_id,'notifications');
  perform private.realtime_signal(r.reviewer_id,'cases');
 end loop;
 return null;
end $$;
create function private.signal_passport_grant() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.activated_at is not null and (tg_op='INSERT' or old.activated_at is null) then perform private.realtime_signal(new.recipient_id,'passport');perform private.realtime_signal(new.recipient_id,'notifications');end if;
 if new.revoked_at is not null and (tg_op='INSERT' or old.revoked_at is null) then perform private.realtime_signal(new.recipient_id,'passport');end if;
 return null;
end $$;
grant create on schema private to fw_schema_owner,fw_policy_exec;
alter function private.signal_offer_change() owner to fw_schema_owner;
alter function private.signal_case_event() owner to fw_policy_exec;
alter function private.signal_passport_grant() owner to fw_schema_owner;
revoke create on schema private from fw_schema_owner,fw_policy_exec;
grant execute on function private.realtime_signal(uuid,text) to fw_policy_exec;
revoke all on function private.signal_offer_change(),private.signal_case_event(),private.signal_passport_grant() from public,anon,authenticated,service_role;
create trigger signal_offer_change after insert on private.day3_offers for each row execute function private.signal_offer_change();
create trigger signal_case_event after insert on private.work_case_events for each row execute function private.signal_case_event();
create trigger signal_passport_grant after insert or update of activated_at,revoked_at on private.passport_grants for each row execute function private.signal_passport_grant();
commit;
