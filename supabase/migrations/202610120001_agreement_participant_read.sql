-- Forward-only recovery/read projection for the existing manual Day 3 slice.
-- No source text, private receipts, directory lookup or bearer access is exposed.
begin;

create function api.get_agreement(request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_identity();
  target uuid;
  saved private.day3_offers%rowtype;
  v_agreement_id uuid;
  own_confirmation jsonb;
  answers jsonb;
  total integer;
  eligible boolean;
begin
  if jsonb_typeof(request) is distinct from 'object' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;
  if (request - 'offerId') <> '{}'::jsonb or jsonb_typeof(request->'offerId') is distinct from 'string' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;
  begin
    target := (request->>'offerId')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end;
  if not private.is_active() then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;
  -- Reuse the existing per-identity read budget (120/minute across these reads
  -- and profile reads). This adds no quota-table grant or policy.
  perform private.consume_identity_quota('identity_read');
  -- Serialize with offer/confirmation commands for one consistent projection.
  perform pg_advisory_xact_lock(hashtextextended(target::text, 3));
  select * into saved from private.day3_offers o
    where o.offer_id = target order by o.version desc limit 1;
  -- RLS and the explicit participant test both apply. Missing and foreign IDs
  -- have identical errors. Merely knowing the identifier never grants access.
  if not found or not coalesce(actor in (saved.worker_id, saved.representative_id), false) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select a.agreement_id into v_agreement_id from private.day3_agreements a
    where a.offer_id = target and a.offer_version = saved.version limit 1;
  -- Stable across both independent sessions before the first confirmation.
  v_agreement_id := coalesce(v_agreement_id, saved.id);
  select count(*) into total from private.day3_agreements a
    where a.offer_id = target and a.offer_version = saved.version and a.agreement_id = v_agreement_id;
  select jsonb_build_object('agreementId',a.agreement_id,'offerId',a.offer_id,
    'version',a.version,'confirmedBy',a.confirmed_by,'confirmationRole',a.confirmation_role,
    'currentHash',a.current_hash,'status',case when total = 2 then 'confirmed' else 'awaiting_other_party' end)
    into own_confirmation from private.day3_agreements a
    where a.offer_id = target and a.offer_version = saved.version and a.confirmed_by = actor;
  select coalesce(jsonb_agg(jsonb_build_object('questionId',a.question_id,'answer',a.answer,
    'answeredBy',a.answered_by) order by a.question_id),'[]'::jsonb) into answers
    from private.day3_offer_answers a where a.offer_id = target and a.offer_version = saved.version;
  eligible := saved.representative_id is not null
    and saved.authority_decision_id = private.active_authority(saved.company_id,saved.representative_id)
    and not exists (select 1 from private.day3_offer_questions q
      where q.offer_id = target and q.offer_version = saved.version and q.required
        and not exists (select 1 from private.day3_offer_answers a where a.question_id = q.id));
  return jsonb_build_object(
    'offer',jsonb_build_object('offerId',saved.offer_id,'companyId',saved.company_id,
      'workerId',saved.worker_id,'representativeId',saved.representative_id,
      'requesterId',saved.requester_id,'requesterRole',saved.requester_role,
      'version',saved.version,'termHash',saved.term_hash,'snapshot',saved.snapshot,
      'changes',saved.changes,'unresolved',saved.unresolved),
    'agreementId',v_agreement_id,'confirmation',own_confirmation,'answers',answers,
    'canConfirm',coalesce(eligible,false) and own_confirmation is null);
end;
$$;

grant create on schema api to fw_user_exec;
alter function api.get_agreement(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.get_agreement(jsonb) from public, anon, authenticated, service_role;
grant execute on function api.get_agreement(jsonb) to authenticated;

do $$
begin
  if has_function_privilege('anon','api.get_agreement(jsonb)','EXECUTE')
    or has_function_privilege('service_role','api.get_agreement(jsonb)','EXECUTE')
    or not has_function_privilege('authenticated','api.get_agreement(jsonb)','EXECUTE') then
    raise exception 'Agreement read effective-privilege postcondition failed';
  end if;
end;
$$;
commit;
