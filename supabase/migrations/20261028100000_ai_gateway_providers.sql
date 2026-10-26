begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- AI gateway (docs/ORYQEN_AI_GATEWAY.md). The original authorization receipt pinned each provider to ONE model name
-- (gpt-4o-mini, gemini-2.5-flash), which made any other model the owner configures fail at the database even after the
-- owner's written approval. The model is now any safe model identifier, the provider list gains the self-hosted option,
-- and nothing else about consent, budgets or the append-only receipt changes.
alter table private.ai_transmission_authorizations drop constraint if exists ai_transmission_authorizations_provider_check;
alter table private.ai_transmission_authorizations drop constraint if exists ai_transmission_authorizations_model_check;
alter table private.ai_transmission_authorizations
 add constraint ai_transmission_authorizations_provider_check check(provider in ('openai','gemini','selfhosted')),
 add constraint ai_transmission_authorizations_model_check check(model ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{1,99}$');

create or replace function api.authorize_ai_transmission_v1(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['provider','model','noticeVersion','inputHash','consent']) or request-array['provider','model','noticeVersion','inputHash','consent']<>'{}'
 or request->'consent' is distinct from 'true'::jsonb or request->>'noticeVersion' is distinct from 'offer-analysis.v1'
 or request->>'provider' is null or request->>'provider' not in ('openai','gemini','selfhosted')
 or jsonb_typeof(request->'model') is distinct from 'string' or request->>'model' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{1,99}$'
 or (request->>'provider'='gemini' and request->>'model' !~ '^gemini-')
 or jsonb_typeof(request->'inputHash') is distinct from 'string' or request->>'inputHash' !~ '^[0-9a-f]{64}$'
 then raise exception 'VALIDATION_FAILED';end if;
 perform pg_advisory_xact_lock(hashtextextended('oryqen-ai-global-budget',14));
 perform private.check_ai_budget();
 insert into private.ai_transmission_authorizations(actor_id,provider,model,notice_version,input_hash) values(actor,request->>'provider',request->>'model',request->>'noticeVersion',request->>'inputHash') returning id into receipt;
 return jsonb_build_object('authorizationId',receipt);
end $$;
notify pgrst,'reload schema';
commit;
