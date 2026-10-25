begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required'; end if; end $$;
-- Backward compatibility for clients that predate offer lifecycle: a request without
-- "view" gets the original response shape (no archived/decision/lifecycleRevision keys)
-- and every offer, exactly as before. Clients that send "view" (current application) get
-- lifecycle fields and archive filtering. Apply this migration BEFORE deploying code.
create or replace function api.list_offers(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb; cursor uuid; actor uuid; view_name text; legacy boolean;
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['cursor','context']) or request-array['cursor','context','view']<>'{}'
 or request->>'context' is null or request->>'context' not in ('WORKER','EMPLOYER')
 or jsonb_typeof(request->'cursor') not in ('null','string')
 or (request ? 'view' and (jsonb_typeof(request->'view') is distinct from 'string' or request->>'view' not in ('active','archived','all'))) then raise exception 'VALIDATION_FAILED'; end if;
 cursor:=(request->>'cursor')::uuid; legacy:=not (request ? 'view'); view_name:=case when legacy then 'all' else request->>'view' end;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('offerId',offer_id,'companyId',company_id,'version',version,
 'role',snapshot->>'role','createdAt',created_at,'questions',jsonb_array_length(unresolved))
 || case when legacy then '{}'::jsonb else jsonb_build_object('archived',archived,'decision',decision,'lifecycleRevision',lifecycle_revision) end
 order by offer_id),'[]') into items
 from (select o.*,coalesce(e.archived,false) archived,coalesce(e.decision,'considering') decision,coalesce(e.revision,0) lifecycle_revision
 from (select distinct on (offer_id) offer_id,company_id,version,snapshot,created_at,unresolved
 from private.day3_offers where (cursor is null or offer_id>cursor) and
 ((request->>'context'='WORKER' and worker_id=actor) or (request->>'context'='EMPLOYER' and representative_id=actor)) order by offer_id,version desc) o
 left join lateral (select archived,decision,revision from private.offer_lifecycle_events where actor_id=actor and offer_id=o.offer_id order by revision desc limit 1) e on true
 where view_name='all' or coalesce(e.archived,false)=(view_name='archived') order by o.offer_id limit 20) page;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'offerId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; end $$;
notify pgrst,'reload schema';
commit;
