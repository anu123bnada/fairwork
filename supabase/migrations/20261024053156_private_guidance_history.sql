begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
create table private.guidance_turns (
 actor_id uuid not null references private.profiles(id), thread_id uuid not null,
 ordinal integer not null check(ordinal between 1 and 100), idempotency_key uuid not null,
 question text not null check(char_length(question) between 1 and 2000), topic text not null,
 offer_id uuid, response jsonb not null, created_at timestamptz not null default transaction_timestamp(),
 primary key(actor_id,thread_id,ordinal), unique(actor_id,idempotency_key)
);
alter table private.guidance_turns owner to fw_schema_owner;
alter table private.guidance_turns enable row level security;
alter table private.guidance_turns force row level security;
revoke all on private.guidance_turns from public,anon,authenticated,service_role;
grant select,insert on private.guidance_turns to fw_user_exec;
create policy guidance_read on private.guidance_turns for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy guidance_insert on private.guidance_turns for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp());
create trigger guidance_immutable before update or delete on private.guidance_turns for each row execute function private.day3_reject_history_mutation();
create function api.guidance(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; thread uuid; token uuid; linked_offer uuid; op text; topic text; question text; answer text; destination text; context jsonb:=null; agreement jsonb; existing private.guidance_turns; count_turns integer; allowed text[]; turns jsonb; threads jsonb; record private.guidance_turns;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 op:=request->>'operation';
 if request is null or jsonb_typeof(request)<>'object' or op is null or op not in ('read','send') then raise exception 'VALIDATION_FAILED';end if;
 allowed:=case op when 'read' then array['operation','threadId'] else array['operation','threadId','question','topic','offerId','idempotencyKey'] end;
 if not(request ?& allowed) or request-allowed<>'{}' or jsonb_typeof(request->'threadId') not in ('string','null') then raise exception 'VALIDATION_FAILED';end if;
 thread:=(request->>'threadId')::uuid;
 if op='send' then
  if thread is null or jsonb_typeof(request->'idempotencyKey') is distinct from 'string'
   or jsonb_typeof(request->'question') is distinct from 'string' or char_length(btrim(request->>'question')) not between 1 and 2000
   or jsonb_typeof(request->'topic') is distinct from 'string' or request->>'topic' not in ('offer','agreement','evidence','passport','opportunities')
   or jsonb_typeof(request->'offerId') not in ('string','null') then raise exception 'VALIDATION_FAILED';end if;
  token:=(request->>'idempotencyKey')::uuid;linked_offer:=(request->>'offerId')::uuid;topic:=request->>'topic';question:=btrim(request->>'question');
  perform pg_advisory_xact_lock(hashtextextended(actor::text,2403));
  perform private.consume_identity_quota('identity_write');
  if linked_offer is not null then
   agreement:=api.get_agreement(jsonb_build_object('offerId',linked_offer));
   context:=jsonb_build_object('offerId',linked_offer,'version',(agreement->'offer'->>'version')::integer,'openQuestions',jsonb_array_length(agreement->'offer'->'unresolved'));
  end if;
  select * into existing from private.guidance_turns where actor_id=actor and idempotency_key=token;
  if found then
   if existing.thread_id<>thread or existing.question<>question or existing.topic<>topic or existing.offer_id is distinct from linked_offer then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  else
   select count(*) into count_turns from private.guidance_turns where actor_id=actor and thread_id=thread;
   if count_turns>=100 then raise exception 'RATE_LIMITED';end if;
   answer:=case topic
    when 'offer' then 'Review the saved role, pay currency and period, hours, duties, deductions and start date. Ask the employer to clarify missing or conflicting terms. A clarity checklist is not a legal or fairness verdict.'
    when 'agreement' then 'Review the exact shared revision and outstanding questions. Each authorized participant must acknowledge independently. Changed terms require fresh review. Platform acknowledgments are not legal electronic signatures.'
    when 'evidence' then 'Save work notes privately first. Include dates, work performed and source context. Review imported text for accuracy and confidential details. Sharing a work revision is a separate explicit action; evidence is not automatically verified.'
    when 'passport' then 'Only eligible work appears in the private Passport. Choose the named recipient, fields and expiry before sharing. Revoke access when it is no longer needed. A link alone grants no access.'
    else 'Use voluntary role, location, work arrangement and pay preferences. Matching shows stated-field comparisons, not a suitability score. Different currencies or pay periods are not equated. Employer-submitted listings are not independently verified.' end;
   destination:=case topic when 'offer' then '/app/home' when 'agreement' then '/app/home' when 'evidence' then '/app/work-record' when 'passport' then '/app/passport' else '/app/opportunities' end;
   insert into private.guidance_turns values(actor,thread,count_turns+1,token,question,topic,linked_offer,
    jsonb_build_object('mode','rules','text',answer,'source','ORYQEN product guide','sourceVersion','guidance.v1','destination',destination,'context',context),transaction_timestamp());
  end if;
 else perform private.consume_identity_quota('identity_read');end if;
 -- Reauthorize every contextual turn before returning historical content.
 if thread is not null then
  for linked_offer in select distinct offer_id from private.guidance_turns where actor_id=actor and thread_id=thread and offer_id is not null loop
   perform api.get_agreement(jsonb_build_object('offerId',linked_offer));
  end loop;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('ordinal',ordinal,'question',g.question,'topic',g.topic,'response',g.response,'createdAt',g.created_at) order by ordinal),'[]') into turns from private.guidance_turns g where actor_id=actor and thread_id=thread;
 select coalesce(jsonb_agg(jsonb_build_object('id',thread_id,'updatedAt',updated_at) order by updated_at desc),'[]') into threads from (select thread_id,max(created_at) updated_at from private.guidance_turns where actor_id=actor group by thread_id order by updated_at desc limit 30) recent;
 return jsonb_build_object('threadId',thread,'turns',turns,'threads',threads,'providerAvailable',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_user_exec;
alter function api.guidance(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.guidance(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.guidance(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
