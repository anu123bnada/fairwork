begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;

-- Suspension is an access control state, not deletion or an external fraud finding.
create table private.organization_controls(
 company_id uuid primary key references private.companies(id),
 suspended boolean not null, revision integer not null check(revision>0),
 updated_at timestamptz not null default transaction_timestamp()
);
alter table private.organization_controls owner to fw_schema_owner;
alter table private.organization_controls enable row level security;
alter table private.organization_controls force row level security;
revoke all on private.organization_controls from public,anon,authenticated,service_role;
grant select,insert,update on private.organization_controls to fw_admin_exec;
grant select on private.organization_controls to fw_policy_exec;
create policy organization_control_policy on private.organization_controls for select to fw_policy_exec using(true);
create policy organization_control_read on private.organization_controls for select to fw_admin_exec using(private.admin_role() is not null);
create policy organization_control_insert on private.organization_controls for insert to fw_admin_exec with check(private.admin_role() in ('owner','administrator'));
create policy organization_control_update on private.organization_controls for update to fw_admin_exec using(private.admin_role() in ('owner','administrator')) with check(private.admin_role() in ('owner','administrator'));

-- Preserve this function's OID: existing policies must not keep a renamed bypass.
-- The transaction-scoped shared lock makes suspension wait for admitted commands.
create or replace function private.active_authority(company uuid, subject uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock_shared(hashtextextended(company::text,20261020));
 if exists(select 1 from private.organization_controls where company_id=company and suspended) then return null;end if;
 select d.id into result from private.company_memberships m
 join private.company_membership_decisions d on (d.company_id,d.subject_id,d.id)=(m.company_id,m.subject_id,m.current_decision_id)
 join private.companies c on c.id=m.company_id join private.profiles p on p.id=m.subject_id
 where private.is_active() and m.company_id=company and m.subject_id=subject
 and c.deleted_at is null and p.account_state='active' and p.deleted_at is null
 and d.decision='approve' and d.effective_at<=clock_timestamp() and d.expires_at>clock_timestamp();
 return result;
end $$;

-- New command shares the existing serialization, immutable receipts and audit.
alter function api.admin_command(jsonb) rename to admin_command_before_organization_controls;
revoke all on function api.admin_command_before_organization_controls(jsonb) from public,anon,authenticated,service_role;
create function api.admin_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; expected integer; token uuid; digest text; saved private.admin_receipts; actual integer; receipt jsonb; event_id uuid;
begin
 if request->>'operation' is distinct from 'organization_status' then return api.admin_command_before_organization_controls(request);end if;
 perform pg_advisory_xact_lock(10202026);
 if private.require_admin(true) not in ('owner','administrator') then raise exception 'ACTION_FORBIDDEN';end if;
 actor:=private.request_uid();
 if jsonb_typeof(request) is distinct from 'object'
 or not(request ?& array['operation','targetId','expectedRevision','reason','idempotencyKey','suspended'])
 or request-array['operation','targetId','expectedRevision','reason','idempotencyKey','suspended']<>'{}'
 or jsonb_typeof(request->'suspended') is distinct from 'boolean'
 or jsonb_typeof(request->'reason') is distinct from 'string' or length(btrim(request->>'reason')) not between 10 and 500
 or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^[0-9]{1,9}$'
 then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'targetId')::uuid;token:=(request->>'idempotencyKey')::uuid;expected:=(request->>'expectedRevision')::integer;
 if target is null or token is null then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,20261020));
 perform private.require_admin(true);
 if not exists(select 1 from private.companies where id=target and deleted_at is null) then raise exception 'NOT_FOUND';end if;
 -- Historical membership is a conflict even when currently expired or suspended.
 if exists(select 1 from private.company_memberships where company_id=target and subject_id=actor) then raise exception 'ACTION_FORBIDDEN';end if;
 digest:=private.agreement_hash(request-'idempotencyKey');
 select * into saved from private.admin_receipts where actor_id=actor and idempotency_key=token;
 if found then if saved.request_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT';end if;return saved.result;end if;
 select revision into actual from private.organization_controls where company_id=target;
 if coalesce(actual,0)<>expected then raise exception 'VERSION_CONFLICT';end if;
 perform private.consume_identity_quota('identity_write');
 insert into private.organization_controls values(target,(request->>'suspended')::boolean,expected+1,transaction_timestamp())
 on conflict(company_id) do update set suspended=excluded.suspended,revision=excluded.revision,updated_at=excluded.updated_at;
 insert into private.admin_audit(actor_id,action,target_id,revision,reason,changes)
 values(actor,'organization_status',target,expected+1,btrim(request->>'reason'),jsonb_build_object('suspended',request->'suspended','scope','current_representative_access_only')) returning id into event_id;
 receipt:=jsonb_build_object('targetId',target,'revision',expected+1,'auditId',event_id,'operation','organization_status');
 insert into private.admin_receipts values(actor,token,digest,receipt);return receipt;
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

alter function private.admin_metadata(text) rename to admin_metadata_before_operations;
create function private.admin_metadata(resource text) returns table(id uuid,label text,status text,revision integer,recorded_at timestamptz,detail jsonb) language plpgsql set search_path='' as $$
begin
 if resource='organizations' then
  return query select c.id,c.name,case when s.suspended then 'suspended' else c.identity_label end,coalesce(s.revision,0),c.created_at,
   jsonb_build_object('externallyVerified',false,'suspended',coalesce(s.suspended,false),'suspensionScope','current_representative_access_only','memberships',(select count(*) from private.company_memberships m where m.company_id=c.id))
   from private.companies c left join private.organization_controls s on s.company_id=c.id;
 else return query select * from private.admin_metadata_before_operations(resource);end if;
end $$;

-- Aggregate and metadata-only operations. Counts name the actual stored fact;
-- consent/admission receipts are never counted as completed provider calls.
create function private.admin_overview(since date,until date) returns jsonb language plpgsql set search_path='' as $$
declare activity jsonb; trends jsonb; alerts jsonb; pending bigint; privacy_pending bigint; open_cases bigint; incidents bigint;
begin
 select coalesce(jsonb_agg(to_jsonb(e) order by e."recordedAt" desc,e.kind,e.id),'[]') into activity from(
  select m.id,m.label,m.status,m.recorded_at as "recordedAt",r.kind
  from unnest(array['audit','requests','agreements','work','cases','privacy','incidents'])r(kind)
  cross join lateral private.admin_metadata(r.kind)m
  where m.recorded_at>=since and m.recorded_at<until+1
  order by m.recorded_at desc,r.kind,m.id limit 20
 ) e;
 select coalesce(jsonb_agg(jsonb_build_object('date',day::date,
 'agreements',(select count(*) from private.agreement_roots where created_at>=day and created_at<day+interval '1 day'),
 'workRecords',(select count(*) from private.work_records where created_at>=day and created_at<day+interval '1 day'),
 'casesOpened',(select count(*) from private.work_cases where opened_at>=day and opened_at<day+interval '1 day'),
 'casesResolved',(select count(*) from private.work_cases where closed_at>=day and closed_at<day+interval '1 day')
 ) order by day),'[]') into trends from generate_series(since::timestamptz,until::timestamptz,interval '1 day')d(day);
 select count(*) into pending from private.organization_requests r where not exists(select 1 from private.organization_request_decisions d where d.request_id=r.id);
 select count(*) into privacy_pending from private.admin_metadata('privacy') where status not in ('fulfilled','declined','withdrawn');
 select count(*) into open_cases from private.work_cases where status='open';
 select count(*) into incidents from private.admin_incidents where status<>'resolved';
 alerts:=jsonb_build_array(
 jsonb_build_object('kind','organization_review','count',pending,'href','/admin/requests','explanation','Requests without an independent decision; not a fraud finding.'),
 jsonb_build_object('kind','privacy_review','count',privacy_pending,'href','/admin/privacy','explanation','Privacy requests requiring review; no export or deletion is inferred.'),
 jsonb_build_object('kind','open_cases','count',open_cases,'href','/admin/cases','explanation','Open Work Record cases; evidence requires separate scoped authority.'),
 jsonb_build_object('kind','open_incidents','count',incidents,'href','/admin/incidents','explanation','Recorded incidents not yet resolved; priority is set by an authorized operator.'));
 return jsonb_build_object('activity',activity,'trends',trends,'alerts',alerts,
 'suspendedOrganizations',(select count(*) from private.organization_controls where suspended),
 'window',jsonb_build_object('from',since,'to',until,'timezone','UTC'));
end $$;
alter function api.admin_read(jsonb) rename to admin_read_before_operations;
revoke all on function api.admin_read_before_operations(jsonb) from public,anon,authenticated,service_role;
create function api.admin_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=api.admin_read_before_operations(request);
 if request->>'resource'='dashboard' then
  result:=result||jsonb_build_object('overview',private.admin_overview((request->>'from')::date,(request->>'to')::date));
 end if;return result;
end $$;
grant create on schema private,api to fw_admin_exec;
alter function private.admin_metadata(text) owner to fw_admin_exec;
alter function private.admin_overview(date,date) owner to fw_admin_exec;
alter function api.admin_read(jsonb) owner to fw_admin_exec;
alter function api.admin_command(jsonb) owner to fw_admin_exec;
revoke create on schema private,api from fw_admin_exec;
revoke all on function private.admin_metadata(text),private.admin_metadata_before_operations(text),private.admin_overview(date,date),api.admin_read(jsonb),api.admin_command(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.admin_read(jsonb),api.admin_command(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
