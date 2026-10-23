begin;
do $$ begin if current_user <> 'postgres' then raise exception 'Offline postgres identity required'; end if; end $$;

-- Reuse participant RLS; organization membership alone does not disclose offers.
create index day3_offers_worker_listing on private.day3_offers(worker_id,offer_id,version desc);
create index day3_offers_representative_listing on private.day3_offers(representative_id,offer_id,version desc);
create function api.list_offers(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb; cursor uuid; actor uuid;
begin
 actor:=private.require_identity();
 if not private.is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['cursor','context']) or request-array['cursor','context']<>'{}'
 or request->>'context' is null or request->>'context' not in ('WORKER','EMPLOYER') then raise exception 'VALIDATION_FAILED'; end if;
 cursor:=(request->>'cursor')::uuid;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('offerId',offer_id,'companyId',company_id,'version',version,
 'role',snapshot->>'role','createdAt',created_at,'questions',jsonb_array_length(unresolved)) order by offer_id),'[]') into items
 from (select distinct on (offer_id) offer_id,company_id,version,snapshot,created_at,unresolved
 from private.day3_offers
 where (cursor is null or offer_id>cursor) and
 ((request->>'context'='WORKER' and worker_id=actor) or (request->>'context'='EMPLOYER' and representative_id=actor))
 order by offer_id,version desc limit 20) page;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'offerId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';
end $$;
grant create on schema api to fw_user_exec;
alter function api.list_offers(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.list_offers(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.list_offers(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
