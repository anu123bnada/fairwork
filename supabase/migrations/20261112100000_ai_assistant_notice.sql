begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Career assistant (docs/ORYQEN_AI_GATEWAY.md). The consent receipt accepted exactly one notice ('offer-analysis.v1'). A question sent to the
-- career assistant is a different use with its own notice, so the receipt now records which of the two notices the person accepted.
-- Nothing else changes: the same identity check, the same platform and per-account budgets, the same append-only receipt.
alter table private.ai_transmission_authorizations drop constraint if exists ai_transmission_authorizations_notice_version_check;
alter table private.ai_transmission_authorizations
 add constraint ai_transmission_authorizations_notice_version_check check(notice_version in ('offer-analysis.v1','career-assistant.v1'));

create or replace function api.authorize_ai_transmission_v1(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['provider','model','noticeVersion','inputHash','consent']) or request-array['provider','model','noticeVersion','inputHash','consent']<>'{}'
 or request->'consent' is distinct from 'true'::jsonb
 or jsonb_typeof(request->'noticeVersion') is distinct from 'string' or request->>'noticeVersion' not in ('offer-analysis.v1','career-assistant.v1')
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
