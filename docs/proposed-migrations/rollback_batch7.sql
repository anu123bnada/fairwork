begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- PROPOSED ROLLBACK for batch 7 (A, B, C). Not applied anywhere. Reverse order. Preferring to keep private.passport_access_log (audit history) is allowed:
-- delete the last statement of section A if the history should be retained; the functions around it are restored either way.
-- C
drop trigger if exists signal_offer_change on private.day3_offers;
drop trigger if exists signal_case_event on private.work_case_events;
drop trigger if exists signal_passport_grant on private.passport_grants;
drop policy if exists oryqen_own_topic_receive on realtime.messages;
drop function if exists private.signal_offer_change(),private.signal_case_event(),private.signal_passport_grant(),private.realtime_signal(uuid,text);
revoke execute on function realtime.send(jsonb,text,text,boolean) from fw_schema_owner;
revoke usage on schema realtime from fw_schema_owner;
-- B
drop function if exists api.qualifications(jsonb);
drop table if exists private.qualification_revisions;
-- A
drop function if exists private.notification_events();
alter function private.notification_events_before_passport() rename to notification_events;
drop function if exists private.passport_notification_events();
drop function if exists api.passport_access_summary(jsonb);
drop function if exists api.passport_projection(jsonb);
alter function api.passport_projection_core(jsonb) rename to passport_projection;
grant execute on function api.passport_projection(jsonb) to authenticated,fw_user_exec;
drop table if exists private.passport_access_log;
notify pgrst,'reload schema';
commit;
