begin;
do $$ begin if current_user <> 'postgres' then raise exception 'Offline postgres identity required'; end if; end $$;

-- Read-only historical projection. Existing participant RLS remains authoritative;
-- no new table privilege or policy, identity parameter, source text or write path.
create function api.offer_history(request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; before_version bigint; items jsonb;
begin
 actor:=private.require_identity();
 if not private.is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if request is null or jsonb_typeof(request)<>'object'
 or not(request ?& array['offerId','beforeVersion']) or request-array['offerId','beforeVersion']<>'{}'
 or jsonb_typeof(request->'offerId') is distinct from 'string'
 or (request->'beforeVersion'<>'null'::jsonb and (jsonb_typeof(request->'beforeVersion')<>'number' or request->>'beforeVersion' !~ '^[1-9][0-9]*$'))
 then raise exception 'VALIDATION_FAILED'; end if;
 target:=(request->>'offerId')::uuid; before_version:=(request->>'beforeVersion')::bigint;
 if before_version>9007199254740991 then raise exception 'VALIDATION_FAILED'; end if;
 perform private.consume_identity_quota('identity_read');
 perform pg_advisory_xact_lock(hashtextextended(target::text,3));
 if not exists(select 1 from private.day3_offers o where o.offer_id=target and actor in(o.worker_id,o.representative_id)) then raise exception 'NOT_FOUND'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('version',o.version,'recordedAt',o.created_at,
 'termHash',o.term_hash,'snapshot',o.snapshot,'changes',o.changes) order by o.version desc),'[]') into items
 from (select version,created_at,term_hash,snapshot,changes from private.day3_offers
 where offer_id=target and (before_version is null or version<before_version)
 order by version desc limit 20) o;
 return jsonb_build_object('offerId',target,'items',items,'nextCursor',case when jsonb_array_length(items)=20 then (items->19->>'version')::bigint else null end);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';
end $$;
grant create on schema api to fw_user_exec;
alter function api.offer_history(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.offer_history(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.offer_history(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
