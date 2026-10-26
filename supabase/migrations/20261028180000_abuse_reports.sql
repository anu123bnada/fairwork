begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- User reports of suspicious recruiters, listings and organizations (modules 13 and 17). A report is a private message to ORYQEN's reviewers, not a
-- public accusation: it is never shown to the person or organization it names, is never published, and its handling is an append-only event history.
-- Reviewers (capability review_operator, second factor) triage it without seeing who reported it. The reporter sees their own reports and the notes
-- reviewers choose to write back, and can withdraw a report that is still open.
create table private.abuse_reports (
 id uuid primary key,
 reporter_id uuid not null references private.profiles(id),
 subject_kind text not null check(subject_kind in ('recruiter_check','listing','organization','other')),
 subject_ref uuid,
 subject_label text not null check(char_length(btrim(subject_label)) between 1 and 120),
 category text not null check(category in ('fee_request','impersonation','fake_listing','harassment','data_misuse','other')),
 details text not null check(char_length(btrim(details)) between 10 and 1000),
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 unique(reporter_id,idempotency_key)
);
create index abuse_reports_reporter_idx on private.abuse_reports(reporter_id,created_at desc,id);
create table private.abuse_report_events (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references private.abuse_reports(id),
 actor_id uuid not null references private.profiles(id),
 event text not null check(event in ('received','reviewing','needs_information','closed_actioned','closed_no_action','withdrawn')),
 note text check(note is null or char_length(note) between 1 and 500),
 revision integer not null check(revision>=0),
 at timestamptz not null default transaction_timestamp(),
 unique(report_id,revision)
);
create index abuse_report_events_latest_idx on private.abuse_report_events(report_id,revision desc);
alter table private.abuse_reports owner to fw_schema_owner;alter table private.abuse_report_events owner to fw_schema_owner;
alter table private.abuse_reports enable row level security;alter table private.abuse_reports force row level security;
alter table private.abuse_report_events enable row level security;alter table private.abuse_report_events force row level security;
revoke all on private.abuse_reports,private.abuse_report_events from public,anon,authenticated,service_role;
grant select,insert on private.abuse_reports,private.abuse_report_events to fw_user_exec;
create policy abuse_reports_read on private.abuse_reports for select to fw_user_exec using(private.is_active() and (reporter_id=private.request_uid() or private.has_capability('review_operator')));
create policy abuse_reports_insert on private.abuse_reports for insert to fw_user_exec with check(private.is_active() and reporter_id=private.request_uid() and created_at=transaction_timestamp());
create policy abuse_report_events_read on private.abuse_report_events for select to fw_user_exec using(private.is_active() and (private.has_capability('review_operator') or exists(select 1 from private.abuse_reports r where r.id=report_id and r.reporter_id=private.request_uid())));
-- The reporter may only withdraw or open their own report; reviewers may only act on reports that are not their own.
create policy abuse_report_events_insert on private.abuse_report_events for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and at=transaction_timestamp() and (
 (event in ('received','withdrawn') and exists(select 1 from private.abuse_reports r where r.id=report_id and r.reporter_id=private.request_uid()))
 or (event in ('reviewing','needs_information','closed_actioned','closed_no_action') and private.has_capability('review_operator') and exists(select 1 from private.abuse_reports r where r.id=report_id and r.reporter_id<>private.request_uid()))));
create trigger abuse_reports_immutable before update or delete on private.abuse_reports for each row execute function private.day3_reject_history_mutation();
create trigger abuse_report_events_immutable before update or delete on private.abuse_report_events for each row execute function private.day3_reject_history_mutation();

create function api.report_create(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['reportId','subjectKind','subjectRef','subjectLabel','category','details','idempotencyKey']; prior private.abuse_reports; id uuid; kind text; ref uuid; recent integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or (select count(*) from jsonb_each(request) e where jsonb_typeof(e.value) not in ('string','null'))>0
  or jsonb_typeof(request->'reportId') is distinct from 'string' or jsonb_typeof(request->'idempotencyKey') is distinct from 'string'
  or jsonb_typeof(request->'subjectLabel') is distinct from 'string' or jsonb_typeof(request->'details') is distinct from 'string'
  or request->>'subjectKind' not in ('recruiter_check','listing','organization','other')
  or request->>'category' not in ('fee_request','impersonation','fake_listing','harassment','data_misuse','other')
  or char_length(btrim(request->>'subjectLabel')) not between 1 and 120 or char_length(btrim(request->>'details')) not between 10 and 1000 then raise exception 'VALIDATION_FAILED';end if;
 id:=(request->>'reportId')::uuid;kind:=request->>'subjectKind';ref:=nullif(request->>'subjectRef','')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2813));
 select * into prior from private.abuse_reports where reporter_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.id<>id or prior.details<>btrim(request->>'details') or prior.category<>request->>'category' then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('reportId',prior.id,'replayed',true);
 end if;
 -- The reference must be something the reporter can already see, so a report cannot be used to probe for records.
 if kind='recruiter_check' and (ref is null or not exists(select 1 from private.recruiter_verifications v where v.id=ref and v.requester_id=actor)) then raise exception 'NOT_FOUND';end if;
 if kind='listing' and (ref is null or not exists(select 1 from private.opportunity_listings l where l.id=ref)) then raise exception 'NOT_FOUND';end if;
 select count(*) into recent from private.abuse_reports where reporter_id=actor and created_at>transaction_timestamp()-interval '24 hours';
 if recent>=10 then raise exception 'RATE_LIMITED';end if;
 insert into private.abuse_reports(id,reporter_id,subject_kind,subject_ref,subject_label,category,details,idempotency_key) values(id,actor,kind,ref,btrim(request->>'subjectLabel'),request->>'category',btrim(request->>'details'),(request->>'idempotencyKey')::uuid);
 insert into private.abuse_report_events(report_id,actor_id,event,revision) values(id,actor,'received',0);
 return jsonb_build_object('reportId',id,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'IDEMPOTENCY_CONFLICT';end $$;

create function api.report_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or request<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('reportId',r.id,'subjectKind',r.subject_kind,'subjectLabel',r.subject_label,'category',r.category,'details',r.details,'createdAt',r.created_at,
   'status',(select e.event from private.abuse_report_events e where e.report_id=r.id order by e.revision desc limit 1),
   'revision',(select e.revision from private.abuse_report_events e where e.report_id=r.id order by e.revision desc limit 1),
   'events',(select coalesce(jsonb_agg(jsonb_build_object('event',e.event,'note',e.note,'at',e.at) order by e.revision),'[]'::jsonb) from private.abuse_report_events e where e.report_id=r.id)) order by r.created_at desc,r.id),'[]'::jsonb) into items
  from (select * from private.abuse_reports where reporter_id=actor order by created_at desc,id limit 20) r;
 return jsonb_build_object('items',items);
end $$;

create function api.report_withdraw(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; rid uuid; latest private.abuse_report_events;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'reportId') or request-array['reportId']<>'{}' or jsonb_typeof(request->'reportId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 rid:=(request->>'reportId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(rid::text,2814));
 if not exists(select 1 from private.abuse_reports r where r.id=rid and r.reporter_id=actor) then raise exception 'NOT_FOUND';end if;
 select * into latest from private.abuse_report_events where report_id=rid order by revision desc limit 1;
 if latest.event in ('closed_actioned','closed_no_action','withdrawn') then raise exception 'VERSION_CONFLICT';end if;
 insert into private.abuse_report_events(report_id,actor_id,event,revision) values(rid,actor,'withdrawn',latest.revision+1);
 return jsonb_build_object('reportId',rid,'status','withdrawn','revision',latest.revision+1);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.report_queue(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; wanted text; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if coalesce(private.request_jwt()->>'aal','')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
 if not private.has_capability('review_operator') then raise exception 'ACTION_FORBIDDEN';end if;
 if request is null or jsonb_typeof(request)<>'object' or request-array['status']<>'{}' or (request ? 'status' and request->>'status' not in ('open','closed')) then raise exception 'VALIDATION_FAILED';end if;
 wanted:=coalesce(request->>'status','open');
 perform private.consume_identity_quota('identity_read');
 -- The queue never contains the reporter's identity.
 select coalesce(jsonb_agg(jsonb_build_object('reportId',x.id,'subjectKind',x.subject_kind,'subjectLabel',x.subject_label,'category',x.category,'details',x.details,'createdAt',x.created_at,'status',x.status,'revision',x.revision,'own',x.reporter_id=actor) order by x.created_at,x.id),'[]'::jsonb) into items
  from (select r.*,l.event as status,l.revision from private.abuse_reports r join lateral (select e.event,e.revision from private.abuse_report_events e where e.report_id=r.id order by e.revision desc limit 1) l on true
        where (wanted='open' and l.event in ('received','reviewing','needs_information')) or (wanted='closed' and l.event in ('closed_actioned','closed_no_action','withdrawn'))
        order by r.created_at,r.id limit 20) x;
 return jsonb_build_object('items',items);
end $$;

create function api.report_review(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; rid uuid; ev text; note text; latest private.abuse_report_events; rep private.abuse_reports;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if coalesce(private.request_jwt()->>'aal','')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
 if not private.has_capability('review_operator') then raise exception 'ACTION_FORBIDDEN';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['reportId','expectedRevision','event']) or request-array['reportId','expectedRevision','event','note']<>'{}'
  or jsonb_typeof(request->'reportId') is distinct from 'string' or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or jsonb_typeof(request->'event') is distinct from 'string'
  or (request ? 'note' and jsonb_typeof(request->'note') not in ('string','null'))
  or request->>'event' not in ('reviewing','needs_information','closed_actioned','closed_no_action') then raise exception 'VALIDATION_FAILED';end if;
 rid:=(request->>'reportId')::uuid;ev:=request->>'event';note:=nullif(btrim(coalesce(request->>'note','')),'');
 if ev<>'reviewing' and (note is null or char_length(note)>500) then raise exception 'VALIDATION_FAILED';end if;
 if note is not null and char_length(note)>500 then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(rid::text,2814));
 select * into rep from private.abuse_reports where id=rid;
 if not found then raise exception 'NOT_FOUND';end if;
 if rep.reporter_id=actor then raise exception 'ACTION_FORBIDDEN';end if;
 select * into latest from private.abuse_report_events where report_id=rid order by revision desc limit 1;
 if latest.revision<>(request->>'expectedRevision')::integer or latest.event in ('closed_actioned','closed_no_action','withdrawn') then raise exception 'VERSION_CONFLICT';end if;
 insert into private.abuse_report_events(report_id,actor_id,event,note,revision) values(rid,actor,ev,note,latest.revision+1);
 return jsonb_build_object('reportId',rid,'status',ev,'revision',latest.revision+1);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.report_create(jsonb) owner to fw_user_exec;alter function api.report_list(jsonb) owner to fw_user_exec;alter function api.report_withdraw(jsonb) owner to fw_user_exec;
alter function api.report_queue(jsonb) owner to fw_user_exec;alter function api.report_review(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.report_create(jsonb),api.report_list(jsonb),api.report_withdraw(jsonb),api.report_queue(jsonb),api.report_review(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.report_create(jsonb),api.report_list(jsonb),api.report_withdraw(jsonb),api.report_queue(jsonb),api.report_review(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
