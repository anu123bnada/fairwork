begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Adds three more private record kinds to the owner-only personal records table: saved cover letters, portfolio entries and career roadmaps. Same protections as before (forced RLS,
-- owner-only, optimistic revisions, bounded document, per-kind status list and allowed keys enforced by the database). Existing rows are untouched; nothing is verified by anyone.
alter table private.personal_records drop constraint personal_records_kind_check;
alter table private.personal_records drop constraint personal_records_check;
alter table private.personal_records add constraint personal_records_kind_check check(kind in ('application','project','cover_letter','portfolio','roadmap'));
alter table private.personal_records add constraint personal_records_status_check check(
 (kind='application' and status in ('saved','applied','interviewing','offered','accepted','rejected','withdrawn'))
 or (kind='project' and status in ('planned','active','blocked','done','archived'))
 or (kind='cover_letter' and status in ('draft','final'))
 or (kind='portfolio' and status in ('draft','ready'))
 or (kind='roadmap' and status in ('active','done','archived')));

drop function api.personal_record_save(jsonb);
drop function api.personal_record_list(jsonb);

create function api.personal_record_save(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['id','kind','title','status','content','expectedRevision']; doc_id uuid; expected integer; current_row private.personal_records; total integer; allowed text[];
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or jsonb_typeof(request->'id') is distinct from 'string' or jsonb_typeof(request->'kind') is distinct from 'string' or jsonb_typeof(request->'title') is distinct from 'string'
  or jsonb_typeof(request->'status') is distinct from 'string' or jsonb_typeof(request->'content') is distinct from 'object' or jsonb_typeof(request->'expectedRevision') is distinct from 'number'
  or (request->>'expectedRevision')::numeric<>trunc((request->>'expectedRevision')::numeric) or (request->>'expectedRevision')::numeric<0
  or request->>'kind' not in ('application','project','cover_letter','portfolio','roadmap') or octet_length((request->'content')::text)>40000 then raise exception 'VALIDATION_FAILED';end if;
 allowed:=case request->>'kind'
  when 'application' then array['listingId','organization','location','appliedOn','nextStepAt','notes','events','prep']
  when 'project' then array['description','dueOn','milestones','tasks']
  when 'cover_letter' then array['organization','role','tone','body','applicationId']
  when 'portfolio' then array['category','link','summary','skills','outcome','date']
  else array['careerId','milestones','notes'] end;
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
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'kind') or request-array['kind']<>'{}' or request->>'kind' not in ('application','project','cover_letter','portfolio','roadmap') then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'kind',d.kind,'title',d.title,'status',d.status,'revision',d.revision,'updatedAt',d.updated_at,
   'summary',jsonb_build_object('organization',d.content->'organization','nextStepAt',d.content->'nextStepAt','appliedOn',d.content->'appliedOn','dueOn',d.content->'dueOn',
     'taskCount',jsonb_array_length(coalesce(d.content->'tasks','[]'::jsonb)),
     'tasksDone',(select count(*) from jsonb_array_elements(coalesce(d.content->'tasks','[]'::jsonb)) t where t->>'done'='true'),
     'eventCount',jsonb_array_length(coalesce(d.content->'events','[]'::jsonb)),
     'milestoneCount',jsonb_array_length(coalesce(d.content->'milestones','[]'::jsonb)),
     'milestonesDone',(select count(*) from jsonb_array_elements(coalesce(d.content->'milestones','[]'::jsonb)) m where m->>'done'='true'),
     'category',d.content->'category','careerId',d.content->'careerId','role',d.content->'role')) order by d.updated_at desc,d.id desc),'[]'::jsonb)
  into items from (select * from private.personal_records where owner_id=actor and kind=request->>'kind' order by updated_at desc,id desc limit 100) d;
 return jsonb_build_object('items',items,'limit',100);
end $$;

grant create on schema api to fw_user_exec;
alter function api.personal_record_save(jsonb) owner to fw_user_exec;alter function api.personal_record_list(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.personal_record_save(jsonb),api.personal_record_list(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.personal_record_save(jsonb),api.personal_record_list(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
