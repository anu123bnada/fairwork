begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Private personal records: the person's own job applications (with interview events) and Workroom projects (with tasks and milestones). One owner-only table keeps both in the
-- same safe shape: forced RLS, no sharing path, optimistic revisions, a bounded document, and a per-kind status list enforced by the database. Nothing here is verified by anyone;
-- it is what the person typed. Up to 100 of each kind per person.
create table private.personal_records (
 id uuid primary key,
 owner_id uuid not null references private.profiles(id),
 kind text not null check(kind in ('application','project')),
 title text not null check(char_length(btrim(title)) between 1 and 120),
 status text not null,
 content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=40000),
 revision integer not null check(revision>=1),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 check((kind='application' and status in ('saved','applied','interviewing','offered','accepted','rejected','withdrawn')) or (kind='project' and status in ('planned','active','blocked','done','archived')))
);
create index personal_records_owner_idx on private.personal_records(owner_id,kind,updated_at desc,id);
alter table private.personal_records owner to fw_schema_owner;
alter table private.personal_records enable row level security;alter table private.personal_records force row level security;
revoke all on private.personal_records from public,anon,authenticated,service_role;
grant select,insert,update,delete on private.personal_records to fw_user_exec;
create policy personal_records_owner_read on private.personal_records for select to fw_user_exec using(private.is_active() and owner_id=private.request_uid());
create policy personal_records_owner_insert on private.personal_records for insert to fw_user_exec with check(private.is_active() and owner_id=private.request_uid());
create policy personal_records_owner_update on private.personal_records for update to fw_user_exec using(private.is_active() and owner_id=private.request_uid()) with check(private.is_active() and owner_id=private.request_uid());
create policy personal_records_owner_delete on private.personal_records for delete to fw_user_exec using(private.is_active() and owner_id=private.request_uid());

create function api.personal_record_save(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['id','kind','title','status','content','expectedRevision']; doc_id uuid; expected integer; current_row private.personal_records; total integer; allowed text[];
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or jsonb_typeof(request->'id') is distinct from 'string' or jsonb_typeof(request->'kind') is distinct from 'string' or jsonb_typeof(request->'title') is distinct from 'string'
  or jsonb_typeof(request->'status') is distinct from 'string' or jsonb_typeof(request->'content') is distinct from 'object' or jsonb_typeof(request->'expectedRevision') is distinct from 'number'
  or (request->>'expectedRevision')::numeric<>trunc((request->>'expectedRevision')::numeric) or (request->>'expectedRevision')::numeric<0
  or request->>'kind' not in ('application','project') or octet_length((request->'content')::text)>40000 then raise exception 'VALIDATION_FAILED';end if;
 allowed:=case request->>'kind' when 'application' then array['listingId','organization','location','appliedOn','nextStepAt','notes','events','prep'] else array['description','dueOn','milestones','tasks'] end;
 if (request->'content')-allowed<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 doc_id:=(request->>'id')::uuid;expected:=(request->>'expectedRevision')::integer;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2831));
 select * into current_row from private.personal_records where id=doc_id and owner_id=actor for update;
 if not found then
  if expected<>0 then raise exception 'NOT_FOUND';end if;
  if exists(select 1 from private.personal_records where id=doc_id) then raise exception 'NOT_FOUND';end if;
  select count(*) into total from private.personal_records where owner_id=actor and kind=request->>'kind';
  if total>=100 then raise exception 'VALIDATION_FAILED';end if;
  insert into private.personal_records(id,owner_id,kind,title,status,content,revision) values(doc_id,actor,request->>'kind',btrim(request->>'title'),request->>'status',request->'content',1);
  return jsonb_build_object('id',doc_id,'revision',1);
 end if;
 if current_row.revision<>expected then raise exception 'VERSION_CONFLICT';end if;
 if current_row.kind<>request->>'kind' then raise exception 'VALIDATION_FAILED';end if;
 update private.personal_records set title=btrim(request->>'title'),status=request->>'status',content=request->'content',revision=current_row.revision+1,updated_at=transaction_timestamp() where id=doc_id and owner_id=actor;
 return jsonb_build_object('id',doc_id,'revision',current_row.revision+1);
exception when invalid_text_representation or invalid_datetime_format then raise exception 'VALIDATION_FAILED'; when check_violation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'NOT_FOUND';
end $$;

create function api.personal_record_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'kind') or request-array['kind']<>'{}' or request->>'kind' not in ('application','project') then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'kind',d.kind,'title',d.title,'status',d.status,'revision',d.revision,'updatedAt',d.updated_at,
   'summary',jsonb_build_object('organization',d.content->'organization','nextStepAt',d.content->'nextStepAt','appliedOn',d.content->'appliedOn','dueOn',d.content->'dueOn',
     'taskCount',jsonb_array_length(coalesce(d.content->'tasks','[]'::jsonb)),
     'tasksDone',(select count(*) from jsonb_array_elements(coalesce(d.content->'tasks','[]'::jsonb)) t where t->>'done'='true'),
     'eventCount',jsonb_array_length(coalesce(d.content->'events','[]'::jsonb)))) order by d.updated_at desc,d.id desc),'[]'::jsonb)
  into items from (select * from private.personal_records where owner_id=actor and kind=request->>'kind' order by updated_at desc,id desc limit 100) d;
 return jsonb_build_object('items',items,'limit',100);
end $$;

create function api.personal_record_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; doc private.personal_records;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'id') or request-array['id']<>'{}' or jsonb_typeof(request->'id') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select * into doc from private.personal_records where id=(request->>'id')::uuid and owner_id=actor;
 if not found then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('id',doc.id,'kind',doc.kind,'title',doc.title,'status',doc.status,'content',doc.content,'revision',doc.revision,'updatedAt',doc.updated_at);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.personal_record_delete(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; gone integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'id') or request-array['id']<>'{}' or jsonb_typeof(request->'id') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'id')::uuid;
 perform private.consume_identity_quota('identity_write');
 delete from private.personal_records d where d.id=target and d.owner_id=actor;get diagnostics gone=row_count;
 if gone=0 then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('id',target);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.personal_record_save(jsonb) owner to fw_user_exec;alter function api.personal_record_list(jsonb) owner to fw_user_exec;alter function api.personal_record_read(jsonb) owner to fw_user_exec;alter function api.personal_record_delete(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.personal_record_save(jsonb),api.personal_record_list(jsonb),api.personal_record_read(jsonb),api.personal_record_delete(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.personal_record_save(jsonb),api.personal_record_list(jsonb),api.personal_record_read(jsonb),api.personal_record_delete(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
