begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Enforce the worker's own revocation of an Evidence Vault document (module 06): a document marked revoked cannot be newly attached to a work record or a saved offer.
-- Only these two functions change (create or replace keeps owner, execute grants and security settings); each gains one check after the ownership checks and before the
-- replay and limit checks. Existing links are untouched. The error is a controlled token the application turns into a plain message.
create or replace function api.vault_attach(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 -- A document the worker has marked as revoked cannot be newly attached; links made earlier stay and show the document's status.
 if exists(select 1 from private.vault_document_status where document_id=doc and owner_id=actor) then raise exception 'EVIDENCE_REVOKED';end if;
 if exists(select 1 from private.vault_attachments where document_id=doc and work_id=work) then return jsonb_build_object('documentId',doc,'workId',work,'replayed',true);end if;
 select count(*) into total from private.vault_attachments where owner_id=actor and work_id=work;
 if total>=10 then raise exception 'RATE_LIMITED';end if;
 insert into private.vault_attachments(document_id,work_id,owner_id) values(doc,work,actor);
 return jsonb_build_object('documentId',doc,'workId',work,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
create or replace function api.vault_attach_offer(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; doc uuid; offer uuid; total integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['documentId','offerId']) or request-array['documentId','offerId']<>'{}' or jsonb_typeof(request->'documentId') is distinct from 'string' or jsonb_typeof(request->'offerId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 doc:=(request->>'documentId')::uuid;offer:=(request->>'offerId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2816));
 if not exists(select 1 from private.vault_documents where id=doc and owner_id=actor) or not private.is_offer_worker(offer) then raise exception 'NOT_FOUND';end if;
 -- A document the worker has marked as revoked cannot be newly attached; links made earlier stay and show the document's status.
 if exists(select 1 from private.vault_document_status where document_id=doc and owner_id=actor) then raise exception 'EVIDENCE_REVOKED';end if;
 if exists(select 1 from private.vault_offer_attachments where document_id=doc and offer_id=offer) then return jsonb_build_object('documentId',doc,'offerId',offer,'replayed',true);end if;
 select count(*) into total from private.vault_offer_attachments where owner_id=actor and offer_id=offer;
 if total>=10 then raise exception 'RATE_LIMITED';end if;
 insert into private.vault_offer_attachments(document_id,offer_id,owner_id) values(doc,offer,actor);
 return jsonb_build_object('documentId',doc,'offerId',offer,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
notify pgrst,'reload schema';
commit;
