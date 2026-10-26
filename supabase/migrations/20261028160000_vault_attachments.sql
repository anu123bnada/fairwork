begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Attaching an Evidence Vault document to one of the person's own work records (module 6). The link is private to the
-- worker: it is not shared with the employer, a reviewer or a Passport recipient, which stay separate, explicit steps.
-- Deleting the document deletes its links; the work record itself is never changed.
create table private.vault_attachments (
 document_id uuid not null references private.vault_documents(id) on delete cascade,
 work_id uuid not null references private.work_records(id),
 owner_id uuid not null references private.profiles(id),
 attached_at timestamptz not null default transaction_timestamp(),
 primary key(document_id,work_id)
);
create index vault_attachments_work_idx on private.vault_attachments(owner_id,work_id,attached_at desc);
alter table private.vault_attachments owner to fw_schema_owner;
alter table private.vault_attachments enable row level security;alter table private.vault_attachments force row level security;
revoke all on private.vault_attachments from public,anon,authenticated,service_role;
grant select,insert,delete on private.vault_attachments to fw_user_exec;
create policy vault_attachments_owner_read on private.vault_attachments for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_attachments_owner_insert on private.vault_attachments for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and attached_at=transaction_timestamp());
create policy vault_attachments_owner_delete on private.vault_attachments for delete to fw_user_exec using(private.is_active() and owner_id=private.request_uid());

create function api.vault_attach(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; doc uuid; work uuid; total integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['documentId','workId']) or request-array['documentId','workId']<>'{}'
  or jsonb_typeof(request->'documentId') is distinct from 'string' or jsonb_typeof(request->'workId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 doc:=(request->>'documentId')::uuid;work:=(request->>'workId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2711));
 if not exists(select 1 from private.vault_documents where id=doc and owner_id=actor) then raise exception 'NOT_FOUND';end if;
 -- Only the worker named on the record may attach to it; anyone else gets the same answer as for a record that does not exist.
 if not exists(select 1 from private.work_records where id=work and worker_id=actor) then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from private.vault_attachments where document_id=doc and work_id=work) then return jsonb_build_object('documentId',doc,'workId',work,'replayed',true);end if;
 select count(*) into total from private.vault_attachments where owner_id=actor and work_id=work;
 if total>=10 then raise exception 'RATE_LIMITED';end if;
 insert into private.vault_attachments(document_id,work_id,owner_id) values(doc,work,actor);
 return jsonb_build_object('documentId',doc,'workId',work,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.vault_detach(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; doc uuid; work uuid; gone integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['documentId','workId']) or request-array['documentId','workId']<>'{}'
  or jsonb_typeof(request->'documentId') is distinct from 'string' or jsonb_typeof(request->'workId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 doc:=(request->>'documentId')::uuid;work:=(request->>'workId')::uuid;
 perform private.consume_identity_quota('identity_write');
 delete from private.vault_attachments where document_id=doc and work_id=work and owner_id=actor;
 get diagnostics gone = row_count;
 if gone=0 then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('documentId',doc,'workId',work);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.vault_attachments(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; work uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'workId') or request-array['workId']<>'{}' or jsonb_typeof(request->'workId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 work:=(request->>'workId')::uuid;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('documentId',d.id,'title',d.title,'category',d.category,'fileName',d.file_name,'mediaType',d.media_type,'byteSize',d.byte_size,'sha256',d.sha256,'attachedAt',a.attached_at) order by a.attached_at desc,d.id),'[]'::jsonb) into items
  from private.vault_attachments a join private.vault_documents d on d.id=a.document_id and d.owner_id=a.owner_id where a.owner_id=actor and a.work_id=work;
 return jsonb_build_object('workId',work,'items',items);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.vault_attach(jsonb) owner to fw_user_exec;
alter function api.vault_detach(jsonb) owner to fw_user_exec;
alter function api.vault_attachments(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.vault_attach(jsonb),api.vault_detach(jsonb),api.vault_attachments(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.vault_attach(jsonb),api.vault_detach(jsonb),api.vault_attachments(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
