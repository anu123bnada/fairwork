begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;

-- Invoker context deliberately inherits the existing participant RLS. No new
-- evidence, reviewer, identity or table privileges are granted by this feed.
create or replace function private.notification_events() returns table(event_key text,kind text,title text,href text,recorded_at timestamptz)
language sql stable set search_path='' as $$
 select 'offer:'||o.offer_id::text||':'||o.version::text,'offer_revision',
 'Offer revision '||o.version::text||' saved','/app/agreement?offerId='||o.offer_id::text,o.created_at
 from private.day3_offers o
 union all
 select 'organization:'||d.request_id::text,'organization_decision',
 case when d.decision='approve' then 'Organization request approved' else 'Organization request declined' end,
 '/app/employer',d.created_at from private.organization_request_decisions d
 join private.organization_requests r on r.id=d.request_id
 union all
 select 'agreement:'||d.agreement_id::text||':'||d.version::text||':'||d.actor_id::text,'agreement_decision',
 case when d.decision='confirm' then 'Agreement participant confirmed revision ' else 'Agreement participant declined revision ' end||d.version::text,
 '/app/agreement-workflow?workflowId='||d.agreement_id::text,d.recorded_at from private.agreement_decisions d
 union all
 select 'work:'||d.id::text,'work_decision','Work revision '||d.version::text||' '||d.outcome,
 '/app/work-record?workId='||d.work_id::text,d.recorded_at from private.work_decisions d
 union all
 select 'integrity:'||e.id::text,'work_integrity',
 case e.operation when 'withdraw' then 'Work record withdrawn' when 'correct' then 'Work record correction recorded' else 'Work verification retracted' end,
 '/app/work-record?workId='||e.work_id::text,e.recorded_at from private.work_integrity_events e;
$$;
revoke all on function private.notification_events() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
