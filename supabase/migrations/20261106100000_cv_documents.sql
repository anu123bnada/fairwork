begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Smart CV Builder (private drafts). A person keeps up to 20 CV documents (one per role or version). A document is only what the person typed: a title, a template, an optional
-- target role and a bounded content object. Nothing here is verified, and nothing is added by a model. Verified employment from the Work Passport is never copied into a CV;
-- it is read live from the Passport when the CV is shown, so it cannot be forged or go stale. Every document belongs to its owner alone (forced RLS, no sharing path), updates
-- use an optimistic revision, and the owner can delete it.
create table private.cv_documents (
 id uuid primary key,
 owner_id uuid not null references private.profiles(id),
 title text not null check(char_length(btrim(title)) between 1 and 80),
 template text not null check(template in ('classic','modern','compact')),
 target_role text check(target_role is null or char_length(btrim(target_role)) between 1 and 120),
 content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=24000),
 revision integer not null check(revision>=1),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp()
);
create index cv_documents_owner_idx on private.cv_documents(owner_id,updated_at desc,id);
alter table private.cv_documents owner to fw_schema_owner;
alter table private.cv_documents enable row level security;alter table private.cv_documents force row level security;
revoke all on private.cv_documents from public,anon,authenticated,service_role;
grant select,insert,update,delete on private.cv_documents to fw_user_exec;
create policy cv_documents_owner_read on private.cv_documents for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy cv_documents_owner_insert on private.cv_documents for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid());
create policy cv_documents_owner_update on private.cv_documents for update to fw_user_exec using(private.is_active() and owner_id=private.request_uid()) with check(private.is_active() and owner_id=private.request_uid());
create policy cv_documents_owner_delete on private.cv_documents for delete to fw_user_exec using(private.is_active() and owner_id=private.request_uid());

create function api.cv_save(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['id','title','template','targetRole','content','expectedRevision']; doc_id uuid; expected integer; current_row private.cv_documents; total integer; top_keys text[]:=array['basics','summary','education','experience','skills','projects','achievements','certifications','references','includeVerifiedWork'];
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or jsonb_typeof(request->'id') is distinct from 'string' or jsonb_typeof(request->'title') is distinct from 'string' or jsonb_typeof(request->'template') is distinct from 'string'
  or jsonb_typeof(request->'targetRole') not in ('string','null') or jsonb_typeof(request->'content') is distinct from 'object' or jsonb_typeof(request->'expectedRevision') is distinct from 'number'
  or (request->>'expectedRevision')::numeric<>trunc((request->>'expectedRevision')::numeric) or (request->>'expectedRevision')::numeric<0
  or (request->'content')-top_keys<>'{}'::jsonb or octet_length((request->'content')::text)>24000 then raise exception 'VALIDATION_FAILED';end if;
 doc_id:=(request->>'id')::uuid;expected:=(request->>'expectedRevision')::integer;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2823));
 select * into current_row from private.cv_documents where id=doc_id and owner_id=actor for update;
 if not found then
  if expected<>0 then raise exception 'NOT_FOUND';end if;
  if exists(select 1 from private.cv_documents where id=doc_id) then raise exception 'NOT_FOUND';end if;
  select count(*) into total from private.cv_documents where owner_id=actor;
  if total>=20 then raise exception 'VALIDATION_FAILED';end if;
  insert into private.cv_documents(id,owner_id,title,template,target_role,content,revision) values(doc_id,actor,btrim(request->>'title'),request->>'template',nullif(btrim(request->>'targetRole'),''),request->'content',1);
  return jsonb_build_object('id',doc_id,'revision',1);
 end if;
 if current_row.revision<>expected then raise exception 'VERSION_CONFLICT';end if;
 update private.cv_documents set title=btrim(request->>'title'),template=request->>'template',target_role=nullif(btrim(request->>'targetRole'),''),content=request->'content',revision=current_row.revision+1,updated_at=transaction_timestamp() where id=doc_id and owner_id=actor;
 return jsonb_build_object('id',doc_id,'revision',current_row.revision+1);
exception when invalid_text_representation or invalid_datetime_format then raise exception 'VALIDATION_FAILED'; when check_violation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'NOT_FOUND';
end $$;

create function api.cv_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'template',d.template,'targetRole',d.target_role,'revision',d.revision,'updatedAt',d.updated_at) order by d.updated_at desc,d.id desc),'[]'::jsonb)
  into items from private.cv_documents d where d.owner_id=actor;
 return jsonb_build_object('items',items,'limit',20);
end $$;

create function api.cv_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; doc private.cv_documents;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'id') or request-array['id']<>'{}' or jsonb_typeof(request->'id') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select * into doc from private.cv_documents where id=(request->>'id')::uuid and owner_id=actor;
 if not found then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('id',doc.id,'title',doc.title,'template',doc.template,'targetRole',doc.target_role,'content',doc.content,'revision',doc.revision,'updatedAt',doc.updated_at);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.cv_delete(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; gone integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'id') or request-array['id']<>'{}' or jsonb_typeof(request->'id') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'id')::uuid;
 perform private.consume_identity_quota('identity_write');
 delete from private.cv_documents d where d.id=target and d.owner_id=actor;get diagnostics gone=row_count;
 if gone=0 then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('id',target);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.cv_save(jsonb) owner to fw_user_exec;alter function api.cv_list(jsonb) owner to fw_user_exec;alter function api.cv_read(jsonb) owner to fw_user_exec;alter function api.cv_delete(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.cv_save(jsonb),api.cv_list(jsonb),api.cv_read(jsonb),api.cv_delete(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.cv_save(jsonb),api.cv_list(jsonb),api.cv_read(jsonb),api.cv_delete(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
