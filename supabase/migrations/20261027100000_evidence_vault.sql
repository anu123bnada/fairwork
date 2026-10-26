begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Evidence Vault metadata (module 6, docs/ORYQEN_VAULT_DESIGN.md). The file bytes live in private object storage
-- under the key '<owner>/<document>'; this table is the authority on who may read them. Deleting a document removes
-- its row (title and file name are personal data) and leaves only an audit event with ids, hash and size.
create table private.vault_documents (
 id uuid primary key,
 owner_id uuid not null references private.profiles(id),
 title text not null check(char_length(title) between 1 and 120),
 category text not null check(category in ('certificate','letter','payslip','contract','other')),
 file_name text not null check(char_length(file_name) between 1 and 100 and file_name !~ '[/\\<>]'),
 media_type text not null check(media_type in ('application/pdf','image/png','image/jpeg','image/webp')),
 byte_size integer not null check(byte_size between 1 and 5242880),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 storage_key text not null unique,
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 check(storage_key=owner_id::text||'/'||id::text),
 unique(owner_id,idempotency_key)
);
create index vault_documents_owner_idx on private.vault_documents(owner_id,created_at desc,id);
create table private.vault_events (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references private.profiles(id),
 document_id uuid not null,
 event text not null check(event in ('uploaded','deleted')),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 byte_size integer not null check(byte_size>0),
 at timestamptz not null default transaction_timestamp(),
 unique(document_id,event)
);
alter table private.vault_documents owner to fw_schema_owner;
alter table private.vault_events owner to fw_schema_owner;
alter table private.vault_documents enable row level security;alter table private.vault_documents force row level security;
alter table private.vault_events enable row level security;alter table private.vault_events force row level security;
revoke all on private.vault_documents,private.vault_events from public,anon,authenticated,service_role;
grant select,insert,delete on private.vault_documents to fw_user_exec;
grant select,insert on private.vault_events to fw_user_exec;
create policy vault_documents_owner_read on private.vault_documents for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_documents_owner_insert on private.vault_documents for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and created_at=transaction_timestamp());
create policy vault_documents_owner_delete on private.vault_documents for delete to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_events_owner_read on private.vault_events for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_events_owner_insert on private.vault_events for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid() and at=transaction_timestamp());
create trigger vault_events_immutable before update or delete on private.vault_events for each row execute function private.day3_reject_history_mutation();

create function api.vault_register(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['documentId','title','category','fileName','mediaType','byteSize','sha256','storageKey','idempotencyKey']; prior private.vault_documents; total integer; doc uuid; size integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or (select count(*) from jsonb_each(request) e where jsonb_typeof(e.value)<>'string' and e.key<>'byteSize')>0
  or jsonb_typeof(request->'byteSize') is distinct from 'number' or request->>'byteSize' !~ '^[1-9][0-9]{0,6}$'
  or char_length(btrim(request->>'title')) not between 1 and 120 or request->>'category' not in ('certificate','letter','payslip','contract','other')
  or char_length(request->>'fileName') not between 1 and 100 or request->>'fileName' ~ '[/\\<>]'
  or request->>'mediaType' not in ('application/pdf','image/png','image/jpeg','image/webp') or request->>'sha256' !~ '^[0-9a-f]{64}$'
  then raise exception 'VALIDATION_FAILED';end if;
 doc:=(request->>'documentId')::uuid;size:=(request->>'byteSize')::integer;
 if size>5242880 or request->>'storageKey'<>actor::text||'/'||doc::text then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2710));
 select * into prior from private.vault_documents where owner_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.id<>doc or prior.sha256<>request->>'sha256' or prior.title<>btrim(request->>'title') then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('documentId',prior.id,'replayed',true);
 end if;
 select count(*) into total from private.vault_documents where owner_id=actor;
 if total>=50 then raise exception 'RATE_LIMITED';end if;
 insert into private.vault_documents(id,owner_id,title,category,file_name,media_type,byte_size,sha256,storage_key,idempotency_key)
  values(doc,actor,btrim(request->>'title'),request->>'category',request->>'fileName',request->>'mediaType',size,request->>'sha256',request->>'storageKey',(request->>'idempotencyKey')::uuid);
 insert into private.vault_events(owner_id,document_id,event,sha256,byte_size) values(actor,doc,'uploaded',request->>'sha256',size);
 return jsonb_build_object('documentId',doc,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'IDEMPOTENCY_CONFLICT';end $$;

create function api.vault_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb; total integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or request<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('documentId',d.id,'title',d.title,'category',d.category,'fileName',d.file_name,'mediaType',d.media_type,'byteSize',d.byte_size,'sha256',d.sha256,'createdAt',d.created_at) order by d.created_at desc,d.id),'[]'),count(*) into items,total
  from (select * from private.vault_documents where owner_id=actor order by created_at desc,id limit 50) d;
 return jsonb_build_object('items',items,'limit',50,'used',total);
end $$;

create function api.vault_fetch(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; d private.vault_documents;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'documentId') or request-array['documentId']<>'{}' or jsonb_typeof(request->'documentId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select * into d from private.vault_documents where id=(request->>'documentId')::uuid and owner_id=actor;
 if not found then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('documentId',d.id,'storageKey',d.storage_key,'fileName',d.file_name,'mediaType',d.media_type);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.vault_delete(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; d private.vault_documents;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'documentId') or request-array['documentId']<>'{}' or jsonb_typeof(request->'documentId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2710));
 select * into d from private.vault_documents where id=(request->>'documentId')::uuid and owner_id=actor;
 if not found then raise exception 'NOT_FOUND';end if;
 insert into private.vault_events(owner_id,document_id,event,sha256,byte_size) values(actor,d.id,'deleted',d.sha256,d.byte_size);
 delete from private.vault_documents where id=d.id;
 return jsonb_build_object('documentId',d.id,'storageKey',d.storage_key);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.vault_register(jsonb) owner to fw_user_exec;
alter function api.vault_list(jsonb) owner to fw_user_exec;
alter function api.vault_fetch(jsonb) owner to fw_user_exec;
alter function api.vault_delete(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.vault_register(jsonb),api.vault_list(jsonb),api.vault_fetch(jsonb),api.vault_delete(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.vault_register(jsonb),api.vault_list(jsonb),api.vault_fetch(jsonb),api.vault_delete(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
