begin;
create table private.offer_draft_revisions (
 actor_id uuid not null references private.profiles(id), id uuid not null,
 revision integer not null check(revision>0), content jsonb not null,
 idempotency_key uuid not null, expected_revision integer not null,
 created_at timestamptz not null default transaction_timestamp(),
 primary key(actor_id,id,revision), unique(actor_id,idempotency_key)
);
alter table private.offer_draft_revisions owner to fw_schema_owner;
alter table private.offer_draft_revisions enable row level security;
alter table private.offer_draft_revisions force row level security;
revoke all on private.offer_draft_revisions from public,anon,authenticated,service_role;
grant select,insert on private.offer_draft_revisions to fw_user_exec;
create policy draft_read on private.offer_draft_revisions for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy draft_insert on private.offer_draft_revisions for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp());
create trigger draft_immutable before update or delete on private.offer_draft_revisions for each row execute function private.day3_reject_history_mutation();
create function api.offer_drafts(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; token uuid; expected integer; latest integer; prior private.offer_draft_revisions; content jsonb; items jsonb; cursor uuid;
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' then raise exception 'VALIDATION_FAILED';end if;
 if request->>'operation'='save' then
  if not(request ?& array['operation','id','expectedRevision','idempotencyKey','content']) or request-array['operation','id','expectedRevision','idempotencyKey','content']<>'{}'
  or jsonb_typeof(request->'id') is distinct from 'string' or jsonb_typeof(request->'idempotencyKey') is distinct from 'string'
  or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^(0|[1-9][0-9]{0,8})$' then raise exception 'VALIDATION_FAILED';end if;
  content:=request->'content';
  if jsonb_typeof(content) is distinct from 'object' or not(content ?& array['role','employer','text']) or content-array['role','employer','text']<>'{}'
  or jsonb_typeof(content->'role') is distinct from 'string' or char_length(btrim(content->>'role')) not between 1 and 120
  or jsonb_typeof(content->'employer') is distinct from 'string' or char_length(content->>'employer')>200
  or jsonb_typeof(content->'text') is distinct from 'string' or char_length(content->>'text')>10000 then raise exception 'VALIDATION_FAILED';end if;
  target:=(request->>'id')::uuid;token:=(request->>'idempotencyKey')::uuid;expected:=(request->>'expectedRevision')::integer;
  perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2510));
  select * into prior from private.offer_draft_revisions where actor_id=actor and idempotency_key=token;
  if found then
   if prior.id<>target or prior.content<>content or prior.expected_revision<>expected then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return jsonb_build_object('id',target,'revision',prior.revision,'saved',true);
  end if;
  select coalesce(max(revision),0) into latest from private.offer_draft_revisions where actor_id=actor and id=target;
  if latest<>expected then raise exception 'VERSION_CONFLICT';end if;
  insert into private.offer_draft_revisions values(actor,target,latest+1,content,token,expected,transaction_timestamp());
  return jsonb_build_object('id',target,'revision',latest+1,'saved',true);
 elsif request->>'operation'='list' then
  if not(request ? 'cursor') or request-array['operation','cursor']<>'{}' or jsonb_typeof(request->'cursor') not in ('null','string') then raise exception 'VALIDATION_FAILED';end if;
  cursor:=(request->>'cursor')::uuid;perform private.consume_identity_quota('identity_read');
  select coalesce(jsonb_agg(jsonb_build_object('id',page.id,'revision',page.revision,'content',page.content,'savedAt',page.created_at) order by page.id),'[]') into items from
   (select distinct on(d.id) d.id,d.revision,d.content,d.created_at from private.offer_draft_revisions d where d.actor_id=actor and (cursor is null or d.id>cursor) order by d.id,d.revision desc limit 20) page;
  return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'id' else null end);
 else raise exception 'VALIDATION_FAILED';end if;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_user_exec;
alter function api.offer_drafts(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.offer_drafts(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.offer_drafts(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
