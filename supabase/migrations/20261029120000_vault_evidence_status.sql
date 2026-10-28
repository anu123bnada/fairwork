begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Evidence correction notes and revocation for Evidence Vault documents (module 06). Both are the worker's own statements about their own document: a document the
-- worker marks as revoked (withdrawn or superseded) stays stored until they delete it, and a correction note records what is wrong or out of date and whether it was
-- put right. Neither is employer or reviewer verification, and neither is visible to anyone but the owner. Absence of a revocation row means the document is active.
create table private.vault_document_status (
 document_id uuid primary key references private.vault_documents(id) on delete cascade,
 owner_id uuid not null references private.profiles(id),
 reason text not null check(char_length(btrim(reason)) between 1 and 300),
 revoked_at timestamptz not null default transaction_timestamp()
);
create table private.vault_corrections (
 id uuid primary key,
 document_id uuid not null references private.vault_documents(id) on delete cascade,
 owner_id uuid not null references private.profiles(id),
 note text not null check(char_length(btrim(note)) between 1 and 500),
 resolved_at timestamptz,
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 unique(owner_id,idempotency_key)
);
create index vault_corrections_doc_idx on private.vault_corrections(owner_id,document_id,created_at desc,id);
alter table private.vault_document_status owner to fw_schema_owner;alter table private.vault_corrections owner to fw_schema_owner;
alter table private.vault_document_status enable row level security;alter table private.vault_document_status force row level security;
alter table private.vault_corrections enable row level security;alter table private.vault_corrections force row level security;
revoke all on private.vault_document_status,private.vault_corrections from public,anon,authenticated,service_role;
grant select,insert,update,delete on private.vault_document_status to fw_user_exec;
grant select,insert,update on private.vault_corrections to fw_user_exec;
create policy vault_status_owner_read on private.vault_document_status for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_status_owner_insert on private.vault_document_status for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and revoked_at=transaction_timestamp());
create policy vault_status_owner_update on private.vault_document_status for update to fw_user_exec using(private.is_active() and owner_id=private.request_uid()) with check(private.is_active() and owner_id=private.request_uid() and revoked_at=transaction_timestamp());
create policy vault_status_owner_delete on private.vault_document_status for delete to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_corrections_owner_read on private.vault_corrections for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_corrections_owner_insert on private.vault_corrections for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and created_at=transaction_timestamp() and resolved_at is null);
create policy vault_corrections_owner_resolve on private.vault_corrections for update to fw_user_exec using(private.is_active() and owner_id=private.request_uid() and resolved_at is null) with check(private.is_active() and owner_id=private.request_uid() and resolved_at=transaction_timestamp());

create function api.vault_revoke(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; doc uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['documentId','reason']) or request-array['documentId','reason']<>'{}'
  or jsonb_typeof(request->'documentId') is distinct from 'string' or jsonb_typeof(request->'reason') is distinct from 'string' or char_length(btrim(request->>'reason')) not between 1 and 300 then raise exception 'VALIDATION_FAILED';end if;
 doc:=(request->>'documentId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2818));
 if not exists(select 1 from private.vault_documents where id=doc and owner_id=actor) then raise exception 'NOT_FOUND';end if;
 insert into private.vault_document_status(document_id,owner_id,reason) values(doc,actor,btrim(request->>'reason'))
  on conflict(document_id) do update set reason=excluded.reason,revoked_at=transaction_timestamp() where private.vault_document_status.owner_id=actor;
 return jsonb_build_object('documentId',doc,'revoked',true);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.vault_reinstate(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; doc uuid; gone integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'documentId') or request-array['documentId']<>'{}' or jsonb_typeof(request->'documentId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 doc:=(request->>'documentId')::uuid;
 perform private.consume_identity_quota('identity_write');
 delete from private.vault_document_status s where s.document_id=doc and s.owner_id=actor;get diagnostics gone = row_count;
 if gone=0 then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('documentId',doc,'revoked',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.vault_correction_add(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['correctionId','documentId','note','idempotencyKey']; prior private.vault_corrections; cid uuid; doc uuid; open_count integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}' or (select count(*) from jsonb_each(request) e where jsonb_typeof(e.value)<>'string')>0
  or char_length(btrim(request->>'note')) not between 1 and 500 then raise exception 'VALIDATION_FAILED';end if;
 cid:=(request->>'correctionId')::uuid;doc:=(request->>'documentId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2819));
 select * into prior from private.vault_corrections where owner_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.id<>cid or prior.document_id<>doc or prior.note<>btrim(request->>'note') then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('correctionId',prior.id,'replayed',true);
 end if;
 if not exists(select 1 from private.vault_documents where id=doc and owner_id=actor) then raise exception 'NOT_FOUND';end if;
 select count(*) into open_count from private.vault_corrections where owner_id=actor and document_id=doc and resolved_at is null;
 if open_count>=20 then raise exception 'RATE_LIMITED';end if;
 insert into private.vault_corrections(id,document_id,owner_id,note,idempotency_key) values(cid,doc,actor,btrim(request->>'note'),(request->>'idempotencyKey')::uuid);
 return jsonb_build_object('correctionId',cid,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'IDEMPOTENCY_CONFLICT';end $$;

create function api.vault_correction_resolve(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; changed integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'correctionId') or request-array['correctionId']<>'{}' or jsonb_typeof(request->'correctionId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'correctionId')::uuid;
 perform private.consume_identity_quota('identity_write');
 update private.vault_corrections c set resolved_at=transaction_timestamp() where c.id=target and c.owner_id=actor and c.resolved_at is null;get diagnostics changed = row_count;
 if changed=0 then
  if exists(select 1 from private.vault_corrections c where c.id=target and c.owner_id=actor) then return jsonb_build_object('correctionId',target,'replayed',true);end if;
  raise exception 'NOT_FOUND';
 end if;
 return jsonb_build_object('correctionId',target,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.vault_evidence_status(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('documentId',d.id,'revoked',s.document_id is not null,'reason',s.reason,'revokedAt',s.revoked_at,
  'corrections',coalesce((select jsonb_agg(jsonb_build_object('correctionId',c.id,'note',c.note,'createdAt',c.created_at,'resolvedAt',c.resolved_at) order by c.created_at desc,c.id desc) from private.vault_corrections c where c.document_id=d.id and c.owner_id=actor),'[]'::jsonb))
  order by d.created_at desc,d.id),'[]'::jsonb) into items
 from private.vault_documents d left join private.vault_document_status s on s.document_id=d.id and s.owner_id=actor
 where d.owner_id=actor and (s.document_id is not null or exists(select 1 from private.vault_corrections c where c.document_id=d.id and c.owner_id=actor));
 return jsonb_build_object('items',items);
end $$;

grant create on schema api to fw_user_exec;
alter function api.vault_revoke(jsonb) owner to fw_user_exec;alter function api.vault_reinstate(jsonb) owner to fw_user_exec;alter function api.vault_correction_add(jsonb) owner to fw_user_exec;
alter function api.vault_correction_resolve(jsonb) owner to fw_user_exec;alter function api.vault_evidence_status(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.vault_revoke(jsonb),api.vault_reinstate(jsonb),api.vault_correction_add(jsonb),api.vault_correction_resolve(jsonb),api.vault_evidence_status(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.vault_revoke(jsonb),api.vault_reinstate(jsonb),api.vault_correction_add(jsonb),api.vault_correction_resolve(jsonb),api.vault_evidence_status(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
