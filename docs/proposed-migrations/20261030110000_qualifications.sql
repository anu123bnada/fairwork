begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- PROPOSED (batch 7, B). NOT APPLIED. Private qualification records (certificates, licences, courses, degrees). Same shape as private employment history: immutable
-- revisions, owner-only, idempotent and version-checked. The verification status is NEVER stored and cannot be sent by a client: it is derived on read as
-- 'self_reported' (nothing attached) or 'document_attached' (the owner attached one of their own, non-revoked Evidence Vault documents). Neither means a third party has
-- checked anything; there is deliberately no value, column or function here that can produce an 'issuer_verified' state. Issuer verification, if ever offered, must be a
-- separate authority-backed workflow added by its own reviewed migration.
create table private.qualification_revisions (
 actor_id uuid not null references private.profiles(id), id uuid not null,
 revision integer not null check(revision>0), content jsonb not null, removed boolean not null default false,
 idempotency_key uuid not null, expected_revision integer not null,
 created_at timestamptz not null default transaction_timestamp(),
 primary key(actor_id,id,revision), unique(actor_id,idempotency_key)
);
alter table private.qualification_revisions owner to fw_schema_owner;
alter table private.qualification_revisions enable row level security;alter table private.qualification_revisions force row level security;
revoke all on private.qualification_revisions from public,anon,authenticated,service_role;
grant select,insert on private.qualification_revisions to fw_user_exec;
create policy qualification_read on private.qualification_revisions for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy qualification_insert on private.qualification_revisions for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp());
create trigger qualification_immutable before update or delete on private.qualification_revisions for each row execute function private.day3_reject_history_mutation();

create function api.qualifications(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; token uuid; expected integer; latest integer; prior private.qualification_revisions; content jsonb; items jsonb; cursor uuid; doc uuid; gone boolean; keys text[]:=array['title','issuer','kind','issuedOn','expiresOn','documentId'];
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' then raise exception 'VALIDATION_FAILED';end if;
 if request->>'operation' in ('save','remove') then
  gone:=request->>'operation'='remove';
  if not(request ?& case when gone then array['operation','id','expectedRevision','idempotencyKey'] else array['operation','id','expectedRevision','idempotencyKey','content'] end)
  or request-(case when gone then array['operation','id','expectedRevision','idempotencyKey'] else array['operation','id','expectedRevision','idempotencyKey','content'] end)<>'{}'
  or jsonb_typeof(request->'id') is distinct from 'string' or jsonb_typeof(request->'idempotencyKey') is distinct from 'string'
  or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^(0|[1-9][0-9]{0,8})$' then raise exception 'VALIDATION_FAILED';end if;
  target:=(request->>'id')::uuid;token:=(request->>'idempotencyKey')::uuid;expected:=(request->>'expectedRevision')::integer;
  perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2530));
  select coalesce(max(revision),0) into latest from private.qualification_revisions where actor_id=actor and id=target;
  if gone then
   if expected=0 or latest=0 then raise exception 'NOT_FOUND';end if;
   select * into prior from private.qualification_revisions where actor_id=actor and idempotency_key=token;
   if found then if prior.id<>target or not prior.removed or prior.expected_revision<>expected then raise exception 'IDEMPOTENCY_CONFLICT';end if;return jsonb_build_object('id',target,'revision',prior.revision,'saved',true);end if;
   if latest<>expected then raise exception 'VERSION_CONFLICT';end if;
   select r.content into content from private.qualification_revisions r where r.actor_id=actor and r.id=target and r.revision=latest;
   insert into private.qualification_revisions values(actor,target,latest+1,content,true,token,expected,transaction_timestamp());
   return jsonb_build_object('id',target,'revision',latest+1,'saved',true);
  end if;
  content:=request->'content';
  if jsonb_typeof(content) is distinct from 'object' or not(content ?& keys) or content-keys<>'{}'
  or jsonb_typeof(content->'title') is distinct from 'string' or char_length(btrim(content->>'title')) not between 1 and 120
  or jsonb_typeof(content->'issuer') not in ('null','string') or (jsonb_typeof(content->'issuer')='string' and char_length(btrim(content->>'issuer')) not between 1 and 120)
  or jsonb_typeof(content->'kind') is distinct from 'string' or content->>'kind' not in ('certificate','licence','course','degree','other')
  or jsonb_typeof(content->'issuedOn') not in ('null','string') or (jsonb_typeof(content->'issuedOn')='string' and content->>'issuedOn' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  or jsonb_typeof(content->'expiresOn') not in ('null','string') or (jsonb_typeof(content->'expiresOn')='string' and content->>'expiresOn' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  or (jsonb_typeof(content->'issuedOn')='string' and jsonb_typeof(content->'expiresOn')='string' and content->>'expiresOn'<content->>'issuedOn')
  or jsonb_typeof(content->'documentId') not in ('null','string') then raise exception 'VALIDATION_FAILED';end if;
  if jsonb_typeof(content->'documentId')='string' then
   doc:=(content->>'documentId')::uuid;
   if not exists(select 1 from private.vault_documents v where v.id=doc and v.owner_id=actor) then raise exception 'NOT_FOUND';end if;
   -- A document attached earlier may be revoked later and stays on older revisions; a revoked document cannot be newly attached.
   if exists(select 1 from private.vault_document_status s where s.document_id=doc and s.owner_id=actor)
    and not exists(select 1 from private.qualification_revisions r where r.actor_id=actor and r.id=target and r.content->>'documentId'=doc::text) then raise exception 'EVIDENCE_REVOKED';end if;
  end if;
  select * into prior from private.qualification_revisions where actor_id=actor and idempotency_key=token;
  if found then
   if prior.id<>target or prior.content<>content or prior.removed or prior.expected_revision<>expected then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return jsonb_build_object('id',target,'revision',prior.revision,'saved',true);
  end if;
  if latest<>expected then raise exception 'VERSION_CONFLICT';end if;
  insert into private.qualification_revisions values(actor,target,latest+1,content,false,token,expected,transaction_timestamp());
  return jsonb_build_object('id',target,'revision',latest+1,'saved',true);
 elsif request->>'operation'='list' then
  if not(request ? 'cursor') or request-array['operation','cursor']<>'{}' or jsonb_typeof(request->'cursor') not in ('null','string') then raise exception 'VALIDATION_FAILED';end if;
  cursor:=(request->>'cursor')::uuid;perform private.consume_identity_quota('identity_read');
  select coalesce(jsonb_agg(jsonb_build_object('id',page.id,'revision',page.revision,'content',page.content,'savedAt',page.created_at,
    'verification',case when page.content->>'documentId' is null then 'self_reported' else 'document_attached' end,'independentlyVerified',false) order by page.id),'[]') into items from
   (select * from (select distinct on(d.id) d.id,d.revision,d.content,d.removed,d.created_at from private.qualification_revisions d where d.actor_id=actor and (cursor is null or d.id>cursor) order by d.id,d.revision desc) latest where not latest.removed order by latest.id limit 20) page;
  return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'id' else null end);
 else raise exception 'VALIDATION_FAILED';end if;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_user_exec;
alter function api.qualifications(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.qualifications(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.qualifications(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
