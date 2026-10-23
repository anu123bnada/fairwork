begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;

-- The source events remain in their existing immutable, RLS-scoped tables.
-- Read receipts cannot grant access to an event whose participant access ended.
create table private.notification_reads (
 subject_id uuid not null references private.profiles(id), event_key text not null,
 read_at timestamptz not null default transaction_timestamp(), primary key(subject_id,event_key),
 check(length(event_key) between 1 and 100)
);
alter table private.notification_reads enable row level security;
alter table private.notification_reads force row level security;
grant select,insert on private.notification_reads to fw_user_exec;
create policy notification_owner_read on private.notification_reads for select to fw_user_exec using(private.is_active() and subject_id=private.request_uid());
create policy notification_owner_insert on private.notification_reads for insert to fw_user_exec with check(private.is_active() and subject_id=private.request_uid() and read_at=transaction_timestamp());
create trigger notification_read_immutable before update or delete on private.notification_reads for each row execute function private.day3_reject_history_mutation();

create function private.notification_events() returns table(event_key text,kind text,title text,href text,recorded_at timestamptz)
language sql stable set search_path='' as $$
 select 'offer:'||o.offer_id::text||':'||o.version::text,'offer_revision',
 'Offer revision '||o.version::text||' saved','/app/agreement?offerId='||o.offer_id::text,o.created_at
 from private.day3_offers o
 union all
 select 'organization:'||d.request_id::text,'organization_decision',
 case when d.decision='approve' then 'Organization request approved' else 'Organization request declined' end,
 '/app/employer',d.created_at from private.organization_request_decisions d
 join private.organization_requests r on r.id=d.request_id;
$$;
create function api.notifications(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb; cursor_at timestamptz; cursor_key text; allowed text[];
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or request->>'operation' is null or request->>'operation' not in ('list','read') then raise exception 'VALIDATION_FAILED';end if;
 allowed:=case when request->>'operation'='read' then array['operation','eventKey'] else array['operation','cursorAt','cursorKey'] end;
 if not(request ?& allowed) or request-allowed<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 if request->>'operation'='read' then
  if jsonb_typeof(request->'eventKey') is distinct from 'string' or char_length(request->>'eventKey') not between 1 and 100 then raise exception 'VALIDATION_FAILED';end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));perform private.consume_identity_quota('identity_write');
  if not exists(select 1 from private.notification_events() e where e.event_key=request->>'eventKey') then raise exception 'NOT_FOUND';end if;
  insert into private.notification_reads(subject_id,event_key) values(actor,request->>'eventKey') on conflict do nothing;
  return jsonb_build_object('eventKey',request->>'eventKey','read',true);
 end if;
 if (request->>'cursorAt' is null)<>(request->>'cursorKey' is null) or (request->>'cursorKey' is not null and (jsonb_typeof(request->'cursorKey')<>'string' or char_length(request->>'cursorKey') not between 1 and 100)) then raise exception 'VALIDATION_FAILED';end if;
 cursor_at:=(request->>'cursorAt')::timestamptz;cursor_key:=request->>'cursorKey';
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('eventKey',e.event_key,'kind',e.kind,'title',e.title,'href',e.href,'recordedAt',e.recorded_at,
 'read',exists(select 1 from private.notification_reads r where r.subject_id=actor and r.event_key=e.event_key)) order by e.recorded_at desc,e.event_key desc),'[]') into items
 from (select * from private.notification_events() n where cursor_at is null or (n.recorded_at,n.event_key)<(cursor_at,cursor_key) order by n.recorded_at desc,n.event_key desc limit 20) e;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then jsonb_build_object('cursorAt',items->19->>'recordedAt','cursorKey',items->19->>'eventKey') else null end);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api,private to fw_user_exec;
alter function private.notification_events() owner to fw_user_exec;
alter function api.notifications(jsonb) owner to fw_user_exec;
revoke create on schema api,private from fw_user_exec;
revoke all on function private.notification_events(),api.notifications(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.notifications(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
