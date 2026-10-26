begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Private review notes and supporting documents for a saved offer (module 04). Both belong to the worker alone: they are never shown to the employer,
-- a representative, a reviewer or a Passport recipient. Notes can be deleted by their author; deleting one removes its text. Documents are
-- links to the worker's own Evidence Vault documents (they cascade away when the document is deleted).
create table private.offer_notes (
 id uuid primary key,
 offer_id uuid not null,
 owner_id uuid not null references private.profiles(id),
 body text not null check(char_length(btrim(body)) between 1 and 1000),
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 unique(owner_id,idempotency_key)
);
create index offer_notes_owner_idx on private.offer_notes(owner_id,offer_id,created_at desc,id);
create table private.vault_offer_attachments (
 document_id uuid not null references private.vault_documents(id) on delete cascade,
 offer_id uuid not null,
 owner_id uuid not null references private.profiles(id),
 attached_at timestamptz not null default transaction_timestamp(),
 primary key(document_id,offer_id)
);
create index vault_offer_attachments_idx on private.vault_offer_attachments(owner_id,offer_id,attached_at desc);
alter table private.offer_notes owner to fw_schema_owner;alter table private.vault_offer_attachments owner to fw_schema_owner;
alter table private.offer_notes enable row level security;alter table private.offer_notes force row level security;
alter table private.vault_offer_attachments enable row level security;alter table private.vault_offer_attachments force row level security;
revoke all on private.offer_notes,private.vault_offer_attachments from public,anon,authenticated,service_role;
grant select,insert,delete on private.offer_notes,private.vault_offer_attachments to fw_user_exec;
create policy offer_notes_owner_read on private.offer_notes for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy offer_notes_owner_insert on private.offer_notes for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and created_at=transaction_timestamp());
create policy offer_notes_owner_delete on private.offer_notes for delete to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_offer_attachments_owner_read on private.vault_offer_attachments for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_offer_attachments_owner_insert on private.vault_offer_attachments for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and attached_at=transaction_timestamp());
create policy vault_offer_attachments_owner_delete on private.vault_offer_attachments for delete to fw_user_exec using(private.is_active() and owner_id=private.request_uid());

-- Only the worker named on a saved offer may attach to it or note it; anyone else gets the same answer as for an offer that does not exist.
create function private.is_offer_worker(offer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.day3_offers o where o.offer_id=offer and o.worker_id=private.request_uid());
$$;
grant create on schema private to fw_policy_exec;
alter function private.is_offer_worker(uuid) owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.is_offer_worker(uuid) from public,anon,authenticated,service_role;
grant execute on function private.is_offer_worker(uuid) to fw_user_exec;

create function api.offer_note_add(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['noteId','offerId','body','idempotencyKey']; prior private.offer_notes; id uuid; offer uuid; total integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}' or (select count(*) from jsonb_each(request) e where jsonb_typeof(e.value)<>'string')>0
  or char_length(btrim(request->>'body')) not between 1 and 1000 then raise exception 'VALIDATION_FAILED';end if;
 id:=(request->>'noteId')::uuid;offer:=(request->>'offerId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2815));
 select * into prior from private.offer_notes where owner_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.id<>id or prior.offer_id<>offer or prior.body<>btrim(request->>'body') then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('noteId',prior.id,'replayed',true);
 end if;
 if not private.is_offer_worker(offer) then raise exception 'NOT_FOUND';end if;
 select count(*) into total from private.offer_notes where owner_id=actor and offer_id=offer;
 if total>=50 then raise exception 'RATE_LIMITED';end if;
 insert into private.offer_notes(id,offer_id,owner_id,body,idempotency_key) values(id,offer,actor,btrim(request->>'body'),(request->>'idempotencyKey')::uuid);
 return jsonb_build_object('noteId',id,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'IDEMPOTENCY_CONFLICT';end $$;

create function api.offer_note_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; offer uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'offerId') or request-array['offerId']<>'{}' or jsonb_typeof(request->'offerId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 offer:=(request->>'offerId')::uuid;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('noteId',n.id,'body',n.body,'createdAt',n.created_at) order by n.created_at desc,n.id),'[]'::jsonb) into items from private.offer_notes n where n.owner_id=actor and n.offer_id=offer;
 return jsonb_build_object('offerId',offer,'items',items);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.offer_note_delete(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; gone integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'noteId') or request-array['noteId']<>'{}' or jsonb_typeof(request->'noteId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'noteId')::uuid;
 perform private.consume_identity_quota('identity_write');
 delete from private.offer_notes n where n.id=target and n.owner_id=actor;get diagnostics gone = row_count;
 if gone=0 then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('noteId',target);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.vault_attach_offer(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; doc uuid; offer uuid; total integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['documentId','offerId']) or request-array['documentId','offerId']<>'{}' or jsonb_typeof(request->'documentId') is distinct from 'string' or jsonb_typeof(request->'offerId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 doc:=(request->>'documentId')::uuid;offer:=(request->>'offerId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2816));
 if not exists(select 1 from private.vault_documents where id=doc and owner_id=actor) or not private.is_offer_worker(offer) then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from private.vault_offer_attachments where document_id=doc and offer_id=offer) then return jsonb_build_object('documentId',doc,'offerId',offer,'replayed',true);end if;
 select count(*) into total from private.vault_offer_attachments where owner_id=actor and offer_id=offer;
 if total>=10 then raise exception 'RATE_LIMITED';end if;
 insert into private.vault_offer_attachments(document_id,offer_id,owner_id) values(doc,offer,actor);
 return jsonb_build_object('documentId',doc,'offerId',offer,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.vault_detach_offer(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; doc uuid; offer uuid; gone integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['documentId','offerId']) or request-array['documentId','offerId']<>'{}' or jsonb_typeof(request->'documentId') is distinct from 'string' or jsonb_typeof(request->'offerId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 doc:=(request->>'documentId')::uuid;offer:=(request->>'offerId')::uuid;
 perform private.consume_identity_quota('identity_write');
 delete from private.vault_offer_attachments where document_id=doc and offer_id=offer and owner_id=actor;get diagnostics gone = row_count;
 if gone=0 then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('documentId',doc,'offerId',offer);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.vault_offer_attachments(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; offer uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'offerId') or request-array['offerId']<>'{}' or jsonb_typeof(request->'offerId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 offer:=(request->>'offerId')::uuid;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('documentId',d.id,'title',d.title,'category',d.category,'fileName',d.file_name,'mediaType',d.media_type,'byteSize',d.byte_size,'sha256',d.sha256,'attachedAt',a.attached_at) order by a.attached_at desc,d.id),'[]'::jsonb) into items
  from private.vault_offer_attachments a join private.vault_documents d on d.id=a.document_id and d.owner_id=a.owner_id where a.owner_id=actor and a.offer_id=offer;
 return jsonb_build_object('offerId',offer,'items',items);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.offer_note_add(jsonb) owner to fw_user_exec;alter function api.offer_note_list(jsonb) owner to fw_user_exec;alter function api.offer_note_delete(jsonb) owner to fw_user_exec;
alter function api.vault_attach_offer(jsonb) owner to fw_user_exec;alter function api.vault_detach_offer(jsonb) owner to fw_user_exec;alter function api.vault_offer_attachments(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.offer_note_add(jsonb),api.offer_note_list(jsonb),api.offer_note_delete(jsonb),api.vault_attach_offer(jsonb),api.vault_detach_offer(jsonb),api.vault_offer_attachments(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.offer_note_add(jsonb),api.offer_note_list(jsonb),api.offer_note_delete(jsonb),api.vault_attach_offer(jsonb),api.vault_detach_offer(jsonb),api.vault_offer_attachments(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
