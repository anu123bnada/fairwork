begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Evidence references on a dispute (module 9). The person who opened a case may attach references to their own Evidence Vault documents: a snapshot of the document's title,
-- type, file name, size and SHA-256 at the moment of attaching. A reference proves what the person says they hold; it does not give anyone the file. Case participants and the
-- reviewer who has accepted the case can list the references (the same visibility rule as the case details); nobody else can. References are append-only: deleting the vault
-- document later does not erase what was shown to the case. A document marked revoked cannot be newly attached.
grant select(id,owner_id,title,category,file_name,media_type,byte_size,sha256) on private.vault_documents to fw_review_exec;
grant select on private.vault_document_status to fw_review_exec;
create policy vault_documents_case_owner_read on private.vault_documents for select to fw_review_exec using(private.is_active() and owner_id=private.request_uid());
create policy vault_status_case_owner_read on private.vault_document_status for select to fw_review_exec using(private.is_active() and owner_id=private.request_uid());

create table private.case_evidence_refs (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references private.work_cases(id),
 document_id uuid not null,
 owner_id uuid not null references private.profiles(id),
 title text not null check(char_length(title) between 1 and 120),
 category text not null check(category in ('certificate','letter','payslip','contract','other')),
 file_name text not null check(char_length(file_name) between 1 and 100),
 media_type text not null check(media_type in ('application/pdf','image/png','image/jpeg','image/webp')),
 byte_size integer not null check(byte_size between 1 and 5242880),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 attached_at timestamptz not null default transaction_timestamp(),
 unique(case_id,document_id)
);
create index case_evidence_refs_case_idx on private.case_evidence_refs(case_id,attached_at,id);
alter table private.case_evidence_refs owner to fw_schema_owner;
alter table private.case_evidence_refs enable row level security;alter table private.case_evidence_refs force row level security;
revoke all on private.case_evidence_refs from public,anon,authenticated,service_role;
grant select,insert on private.case_evidence_refs to fw_review_exec;
create policy case_evidence_refs_visible_read on private.case_evidence_refs for select to fw_review_exec using(private.is_active() and private.case_visible(case_id,true));
create policy case_evidence_refs_opener_insert on private.case_evidence_refs for insert to fw_review_exec with check(private.is_active() and owner_id=private.request_uid() and attached_at=transaction_timestamp()
 and exists(select 1 from private.work_cases c where c.id=case_id and c.opened_by=private.request_uid() and c.status='open'));
create trigger case_evidence_refs_immutable before update or delete on private.case_evidence_refs for each row execute function private.day3_reject_history_mutation();

create function api.case_evidence_attach(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; doc uuid; d record; total integer; made boolean;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['caseId','documentId']) or request-array['caseId','documentId']<>'{}'
  or jsonb_typeof(request->'caseId') is distinct from 'string' or jsonb_typeof(request->'documentId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'caseId')::uuid;doc:=(request->>'documentId')::uuid;
 perform private.case_quota(false);perform pg_advisory_xact_lock(hashtextextended(actor::text,2820));
 if not exists(select 1 from private.work_cases c where c.id=target and c.opened_by=actor and c.status='open') then raise exception 'NOT_FOUND';end if;
 select v.id,v.title,v.category,v.file_name,v.media_type,v.byte_size,v.sha256 into d from private.vault_documents v where v.id=doc and v.owner_id=actor;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from private.case_evidence_refs r where r.case_id=target and r.document_id=doc) then return jsonb_build_object('caseId',target,'documentId',doc,'replayed',true);end if;
 if exists(select 1 from private.vault_document_status s where s.document_id=doc and s.owner_id=actor) then raise exception 'EVIDENCE_REVOKED';end if;
 select count(*) into total from private.case_evidence_refs r where r.case_id=target;
 if total>=10 then raise exception 'RATE_LIMITED';end if;
 insert into private.case_evidence_refs(case_id,document_id,owner_id,title,category,file_name,media_type,byte_size,sha256) values(target,doc,actor,d.title,d.category,d.file_name,d.media_type,d.byte_size,d.sha256);
 return jsonb_build_object('caseId',target,'documentId',doc,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.case_evidence_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; items jsonb;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'caseId') or request-array['caseId']<>'{}' or jsonb_typeof(request->'caseId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 target:=(request->>'caseId')::uuid;
 perform private.case_quota(true);
 if not private.case_visible(target,true) then raise exception 'NOT_FOUND';end if;
 select coalesce(jsonb_agg(jsonb_build_object('documentId',r.document_id,'title',r.title,'category',r.category,'fileName',r.file_name,'mediaType',r.media_type,'byteSize',r.byte_size,'sha256',r.sha256,'attachedAt',r.attached_at,'attachedBy',r.owner_id) order by r.attached_at,r.id),'[]'::jsonb) into items from private.case_evidence_refs r where r.case_id=target;
 return jsonb_build_object('caseId',target,'items',items);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_review_exec;
alter function api.case_evidence_attach(jsonb) owner to fw_review_exec;alter function api.case_evidence_list(jsonb) owner to fw_review_exec;
revoke create on schema api from fw_review_exec;
revoke all on function api.case_evidence_attach(jsonb),api.case_evidence_list(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.case_evidence_attach(jsonb),api.case_evidence_list(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
