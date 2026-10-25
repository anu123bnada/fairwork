begin;
-- Private, self-reported employment history. Entries are never verified by this
-- table: verification is a separate, authority-backed workflow.
create table private.employment_history_revisions (
 actor_id uuid not null references private.profiles(id), id uuid not null,
 revision integer not null check(revision>0), content jsonb not null,
 idempotency_key uuid not null, expected_revision integer not null,
 created_at timestamptz not null default transaction_timestamp(),
 primary key(actor_id,id,revision), unique(actor_id,idempotency_key)
);
alter table private.employment_history_revisions owner to fw_schema_owner;
alter table private.employment_history_revisions enable row level security;
alter table private.employment_history_revisions force row level security;
revoke all on private.employment_history_revisions from public,anon,authenticated,service_role;
grant select,insert on private.employment_history_revisions to fw_user_exec;
create policy employment_read on private.employment_history_revisions for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy employment_insert on private.employment_history_revisions for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp());
create trigger employment_immutable before update or delete on private.employment_history_revisions for each row execute function private.day3_reject_history_mutation();
create function api.employment_history(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; token uuid; expected integer; latest integer; prior private.employment_history_revisions; content jsonb; items jsonb; cursor uuid;
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' then raise exception 'VALIDATION_FAILED';end if;
 if request->>'operation'='save' then
  if not(request ?& array['operation','id','expectedRevision','idempotencyKey','content']) or request-array['operation','id','expectedRevision','idempotencyKey','content']<>'{}'
  or jsonb_typeof(request->'id') is distinct from 'string' or jsonb_typeof(request->'idempotencyKey') is distinct from 'string'
  or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^(0|[1-9][0-9]{0,8})$' then raise exception 'VALIDATION_FAILED';end if;
  content:=request->'content';
  if jsonb_typeof(content) is distinct from 'object' or not(content ?& array['employer','role','startDate','endDate','current','skills','achievements'])
  or content-array['employer','role','startDate','endDate','current','skills','achievements']<>'{}'
  or jsonb_typeof(content->'employer') is distinct from 'string' or char_length(btrim(content->>'employer')) not between 1 and 200
  or jsonb_typeof(content->'role') is distinct from 'string' or char_length(btrim(content->>'role')) not between 1 and 120
  or jsonb_typeof(content->'startDate') is distinct from 'string' or content->>'startDate' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  or jsonb_typeof(content->'current') is distinct from 'boolean'
  or jsonb_typeof(content->'endDate') not in ('null','string')
  or ((content->>'current')::boolean and jsonb_typeof(content->'endDate')<>'null')
  or (not (content->>'current')::boolean and (jsonb_typeof(content->'endDate')<>'string' or content->>'endDate' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or content->>'endDate'<content->>'startDate'))
  or jsonb_typeof(content->'skills') is distinct from 'array' or jsonb_array_length(content->'skills')>20
  or exists(select 1 from jsonb_array_elements(content->'skills') e where jsonb_typeof(e)<>'string' or char_length(btrim(e#>>'{}')) not between 1 and 60)
  or jsonb_typeof(content->'achievements') is distinct from 'string' or char_length(content->>'achievements')>2000 then raise exception 'VALIDATION_FAILED';end if;
  target:=(request->>'id')::uuid;token:=(request->>'idempotencyKey')::uuid;expected:=(request->>'expectedRevision')::integer;
  perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2511));
  select * into prior from private.employment_history_revisions where actor_id=actor and idempotency_key=token;
  if found then
   if prior.id<>target or prior.content<>content or prior.expected_revision<>expected then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return jsonb_build_object('id',target,'revision',prior.revision,'saved',true);
  end if;
  select coalesce(max(revision),0) into latest from private.employment_history_revisions where actor_id=actor and id=target;
  if latest<>expected then raise exception 'VERSION_CONFLICT';end if;
  insert into private.employment_history_revisions values(actor,target,latest+1,content,token,expected,transaction_timestamp());
  return jsonb_build_object('id',target,'revision',latest+1,'saved',true);
 elsif request->>'operation'='list' then
  if not(request ? 'cursor') or request-array['operation','cursor']<>'{}' or jsonb_typeof(request->'cursor') not in ('null','string') then raise exception 'VALIDATION_FAILED';end if;
  cursor:=(request->>'cursor')::uuid;perform private.consume_identity_quota('identity_read');
  select coalesce(jsonb_agg(jsonb_build_object('id',page.id,'revision',page.revision,'content',page.content,'savedAt',page.created_at,'verification','self_reported') order by page.id),'[]') into items from
   (select distinct on(d.id) d.id,d.revision,d.content,d.created_at from private.employment_history_revisions d where d.actor_id=actor and (cursor is null or d.id>cursor) order by d.id,d.revision desc limit 20) page;
  return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'id' else null end);
 else raise exception 'VALIDATION_FAILED';end if;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_user_exec;
alter function api.employment_history(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.employment_history(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.employment_history(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
