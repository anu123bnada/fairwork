begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Day 3 migration requires the offline postgres identity';
  end if;
end;
$$;

create table private.day3_offers (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null,
  company_id uuid not null references private.companies(id) on delete restrict,
  worker_id uuid not null references private.profiles(id) on delete restrict,
  representative_id uuid references private.profiles(id) on delete restrict,
  check (representative_id is null or representative_id <> worker_id),
  requester_id uuid not null references private.profiles(id) on delete restrict,
  requester_role text not null check (requester_role in ('EMPLOYER','WORKER')),
  version bigint not null default 1 check (version >= 1),
  authority_decision_id uuid references private.company_membership_decisions(id) on delete restrict,
  term_hash text not null,
  snapshot jsonb not null,
  changes jsonb not null default '[]'::jsonb,
  unresolved jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default transaction_timestamp(),
  created_by uuid not null references private.profiles(id) on delete restrict,
  unique (offer_id, version),
  unique (offer_id, version, company_id, worker_id)
);

create table private.day3_offer_questions (
  id uuid primary key,
  offer_id uuid not null,
  offer_version bigint not null,
  company_id uuid not null,
  worker_id uuid not null,
  field text not null,
  question text not null,
  required boolean not null,
  created_at timestamptz not null default transaction_timestamp(),
  unique (offer_id, offer_version, field),
  unique (id, offer_id, offer_version),
  foreign key (offer_id, offer_version, company_id, worker_id)
    references private.day3_offers(offer_id, version, company_id, worker_id) on delete restrict
);

create table private.day3_offer_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  offer_id uuid not null,
  offer_version bigint not null,
  answer text not null check (char_length(btrim(answer)) between 1 and 2000),
  answered_by uuid not null references private.profiles(id) on delete restrict,
  answered_at timestamptz not null default transaction_timestamp(),
  unique (question_id),
  unique (id, answered_by),
  foreign key (question_id, offer_id, offer_version)
    references private.day3_offer_questions(id, offer_id, offer_version) on delete restrict
);

create table private.day3_agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null,
  offer_id uuid not null,
  offer_version bigint not null,
  company_id uuid not null references private.companies(id) on delete restrict,
  worker_id uuid not null references private.profiles(id) on delete restrict,
  version bigint not null check (version >= 1),
  confirmed_by uuid not null references private.profiles(id) on delete restrict,
  confirmation_role text not null check (confirmation_role in ('EMPLOYER','WORKER')),
  authority_decision_id uuid references private.company_membership_decisions(id) on delete restrict,
  previous_hash text not null,
  current_hash text not null,
  unresolved jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default transaction_timestamp(),
  created_by uuid not null references private.profiles(id) on delete restrict,
  unique (offer_id, offer_version, agreement_id, confirmed_by),
  unique (agreement_id, confirmed_by),
  unique (agreement_id, confirmation_role),
  foreign key (offer_id, offer_version, company_id, worker_id)
    references private.day3_offers(offer_id, version, company_id, worker_id) on delete restrict
);

create table private.day3_command_receipts (
  actor_id uuid not null,
  command_name text not null,
  idempotency_key uuid not null,
  result_id uuid not null,
  request_hash text not null,
  created_at timestamptz not null default transaction_timestamp(),
  primary key (actor_id, command_name, idempotency_key)
);

create table private.day3_effective_agreements (
  offer_id uuid primary key,
  offer_version bigint not null,
  company_id uuid not null,
  worker_id uuid not null,
  agreement_id uuid not null,
  agreement_hash text not null,
  effective_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  foreign key (offer_id, offer_version, company_id, worker_id)
    references private.day3_offers(offer_id, version, company_id, worker_id) on delete restrict
);

alter table private.day3_offers owner to fw_schema_owner;
alter table private.day3_offer_questions owner to fw_schema_owner;
alter table private.day3_offer_answers owner to fw_schema_owner;
alter table private.day3_agreements owner to fw_schema_owner;
alter table private.day3_command_receipts owner to fw_schema_owner;
alter table private.day3_effective_agreements owner to fw_schema_owner;

alter table private.audit_logs drop constraint audit_logs_action_check;
alter table private.audit_logs add constraint audit_logs_action_check
  check (action in ('create_profile','update_profile','provision_company','decide_membership','bootstrap_capability','review_offer','answer_offer_question','confirm_agreement'));
alter table private.audit_logs drop constraint audit_logs_reason_code_check;
alter table private.audit_logs add constraint audit_logs_reason_code_check
  check (reason_code in ('owner_profile_command','synthetic_authority_command','offline_capability_bootstrap','day3_offer_command'));
alter table private.rate_limit_buckets drop constraint rate_limit_buckets_operation_check;
alter table private.rate_limit_buckets add constraint rate_limit_buckets_operation_check
  check (operation in ('identity_read','identity_write','authority_write','day3_offer_write'));
create policy audit_day3_insert on private.audit_logs for insert to fw_user_exec with check (
  actor_id = private.request_uid()
  and action in ('review_offer','answer_offer_question','confirm_agreement')
  and db_time = transaction_timestamp()
  and reason_code = 'day3_offer_command'
  and retention_class = 'authority'
);
create policy limits_day3_select on private.rate_limit_buckets for select to fw_user_exec
  using (subject_hash = encode(sha256(convert_to(private.request_uid()::text, 'UTF8')), 'hex') and operation = 'day3_offer_write');
create policy limits_day3_insert on private.rate_limit_buckets for insert to fw_user_exec
  with check (subject_hash = encode(sha256(convert_to(private.request_uid()::text, 'UTF8')), 'hex') and operation = 'day3_offer_write');
create policy limits_day3_update on private.rate_limit_buckets for update to fw_user_exec
  using (subject_hash = encode(sha256(convert_to(private.request_uid()::text, 'UTF8')), 'hex') and operation = 'day3_offer_write')
  with check (subject_hash = encode(sha256(convert_to(private.request_uid()::text, 'UTF8')), 'hex') and operation = 'day3_offer_write');

create function private.consume_day3_quota() returns void
language plpgsql set search_path = '' as $$
declare
  total integer;
begin
  insert into private.rate_limit_buckets(subject_hash, operation, window_start, count, expires_at)
  values (
    encode(sha256(convert_to(private.request_uid()::text, 'UTF8')), 'hex'),
    'day3_offer_write',
    date_trunc('minute', transaction_timestamp()),
    1,
    date_trunc('minute', transaction_timestamp()) + interval '2 minutes'
  )
  on conflict (subject_hash, operation, window_start)
  do update set count = private.rate_limit_buckets.count + 1
  returning count into total;
  if total > 30 then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
end;
$$;

create function private.day3_reject_history_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
end;
$$;

create trigger day3_offers_immutable
before update or delete on private.day3_offers
for each row execute function private.day3_reject_history_mutation();
create trigger day3_questions_immutable
before update or delete on private.day3_offer_questions
for each row execute function private.day3_reject_history_mutation();
create trigger day3_answers_immutable
before update or delete on private.day3_offer_answers
for each row execute function private.day3_reject_history_mutation();
create trigger day3_agreements_immutable
before update or delete on private.day3_agreements
for each row execute function private.day3_reject_history_mutation();
create trigger day3_receipts_immutable
before update or delete on private.day3_command_receipts
for each row execute function private.day3_reject_history_mutation();

create function private.day3_guard_effective_agreement() returns trigger
language plpgsql set search_path = '' as $$
declare
  confirmation_count integer;
  employer_valid boolean;
  latest_version bigint;
begin
  if tg_op = 'UPDATE' and new.offer_version <= old.offer_version then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;
  select count(*) into confirmation_count
  from private.day3_agreements a
  where a.agreement_id = new.agreement_id
    and a.offer_id = new.offer_id
    and a.offer_version = new.offer_version
    and a.company_id = new.company_id
    and a.worker_id = new.worker_id
    and a.current_hash = new.agreement_hash;
  select exists (
    select 1 from private.day3_agreements a
    where a.agreement_id = new.agreement_id
      and a.offer_id = new.offer_id
      and a.offer_version = new.offer_version
      and a.company_id = new.company_id
      and a.worker_id = new.worker_id
      and a.confirmation_role = 'EMPLOYER'
      and a.authority_decision_id = private.active_authority(new.company_id, a.confirmed_by)
      and exists (select 1 from private.day3_offers o
        where o.offer_id = new.offer_id and o.version = new.offer_version
          and a.confirmed_by = o.representative_id and a.confirmed_by <> o.worker_id
          and a.authority_decision_id = o.authority_decision_id)
      and exists (select 1 from private.day3_agreements w
        where w.agreement_id = new.agreement_id and w.offer_id = new.offer_id
          and w.offer_version = new.offer_version and w.confirmation_role = 'WORKER'
          and w.confirmed_by = new.worker_id and w.current_hash = new.agreement_hash)
  ) into employer_valid;
  select max(o.version) into latest_version
  from private.day3_offers o where o.offer_id = new.offer_id;
  if confirmation_count <> 2 or not employer_valid or latest_version <> new.offer_version then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;
  new.effective_at := transaction_timestamp();
  new.updated_at := transaction_timestamp();
  return new;
end;
$$;

create trigger day3_effective_guard
before insert or update on private.day3_effective_agreements
for each row execute function private.day3_guard_effective_agreement();

-- No direct client access to private tables; only the RPC boundary is exposed.
revoke all on private.day3_offers, private.day3_offer_questions, private.day3_offer_answers,
  private.day3_agreements, private.day3_command_receipts, private.day3_effective_agreements
from public, anon, authenticated, service_role;
alter table private.day3_offers enable row level security;
alter table private.day3_offer_questions enable row level security;
alter table private.day3_offer_answers enable row level security;
alter table private.day3_agreements enable row level security;
alter table private.day3_command_receipts enable row level security;
alter table private.day3_effective_agreements enable row level security;
alter table private.day3_offers force row level security;
alter table private.day3_offer_questions force row level security;
alter table private.day3_offer_answers force row level security;
alter table private.day3_agreements force row level security;
alter table private.day3_command_receipts force row level security;
alter table private.day3_effective_agreements force row level security;

grant select, insert, update on private.day3_offers, private.day3_offer_questions, private.day3_offer_answers,
  private.day3_agreements, private.day3_command_receipts, private.day3_effective_agreements to fw_user_exec;

grant usage on schema private to fw_user_exec;
create function private.day3_hash_agreement(terms jsonb, unresolved_items jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'terms', coalesce(terms, '{}'::jsonb),
    'unresolved', coalesce(unresolved_items, '[]'::jsonb)
  )::text, 'UTF8')), 'hex');
$$;

-- The designated representative is immutable across a chain. Worker-created
-- reviews stay private drafts with no representative; designation needs a future
-- explicit contract. Company membership alone never makes someone a participant.
create policy day3_offers_executor on private.day3_offers for all to fw_user_exec
  using (private.is_active() and (
    worker_id = private.request_uid()
    or representative_id = private.request_uid()
      and private.active_authority(company_id, representative_id) is not null
  ))
  with check (private.is_active() and created_by = private.request_uid()
    and requester_id = private.request_uid() and (
      requester_role = 'EMPLOYER' and representative_id = private.request_uid()
        and representative_id <> worker_id
        and authority_decision_id = private.active_authority(company_id, representative_id)
      or requester_role = 'WORKER' and worker_id = private.request_uid() and (
        representative_id is null and authority_decision_id is null
        or representative_id is not null
          and authority_decision_id = private.active_authority(company_id, representative_id)
      )
    ));
create policy day3_questions_executor on private.day3_offer_questions for all to fw_user_exec
  using (exists (select 1 from private.day3_offers o
    where (o.offer_id,o.version) = (day3_offer_questions.offer_id,day3_offer_questions.offer_version)))
  with check (exists (select 1 from private.day3_offers o
    where (o.offer_id,o.version,o.company_id,o.worker_id) =
      (day3_offer_questions.offer_id,day3_offer_questions.offer_version,day3_offer_questions.company_id,day3_offer_questions.worker_id)
      and o.created_by = private.request_uid()));
create policy day3_answers_executor on private.day3_offer_answers for all to fw_user_exec
  using (exists (select 1 from private.day3_offer_questions q
    where (q.id,q.offer_id,q.offer_version) =
      (day3_offer_answers.question_id,day3_offer_answers.offer_id,day3_offer_answers.offer_version)))
  with check (answered_by = private.request_uid() and exists (
    select 1 from private.day3_offer_questions q
    where (q.id,q.offer_id,q.offer_version) =
      (day3_offer_answers.question_id,day3_offer_answers.offer_id,day3_offer_answers.offer_version)));
create policy day3_agreements_executor on private.day3_agreements for all to fw_user_exec
  using (exists (select 1 from private.day3_offers o
    where (o.offer_id,o.version) = (day3_agreements.offer_id,day3_agreements.offer_version)))
  with check (created_by = private.request_uid() and confirmed_by = private.request_uid()
    and exists (select 1 from private.day3_offers o
      where (o.offer_id,o.version,o.company_id,o.worker_id) =
        (day3_agreements.offer_id,day3_agreements.offer_version,day3_agreements.company_id,day3_agreements.worker_id)
      and o.representative_id is not null
      and o.authority_decision_id = private.active_authority(o.company_id,o.representative_id)
      and day3_agreements.current_hash = private.day3_hash_agreement(o.snapshot,o.unresolved)
      and (confirmation_role = 'WORKER' and confirmed_by = o.worker_id and day3_agreements.authority_decision_id is null
        or confirmation_role = 'EMPLOYER' and confirmed_by = o.representative_id
          and day3_agreements.authority_decision_id = o.authority_decision_id)));
create policy day3_receipts_executor on private.day3_command_receipts for all to fw_user_exec
  using (private.is_active() and actor_id = private.request_uid())
  with check (private.is_active() and actor_id = private.request_uid()
    and command_name in ('review_offer','answer_offer_question','confirm_agreement'));
create policy day3_effective_executor on private.day3_effective_agreements for all to fw_user_exec
  using (exists (select 1 from private.day3_offers o
    where (o.offer_id,o.version) = (day3_effective_agreements.offer_id,day3_effective_agreements.offer_version)))
  with check (exists (select 1 from private.day3_offers o
    where (o.offer_id,o.version,o.company_id,o.worker_id) =
      (day3_effective_agreements.offer_id,day3_effective_agreements.offer_version,day3_effective_agreements.company_id,day3_effective_agreements.worker_id)));

-- A narrow trigger can detect a hidden existing root without disclosing it.
-- The policy executor has no write grant and is neither a login nor a bypass role.
grant select (offer_id,company_id,worker_id,representative_id,version) on private.day3_offers to fw_policy_exec;
create policy day3_offer_guard_read on private.day3_offers for select to fw_policy_exec
  using (private.is_active());
create function private.day3_guard_offer_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare prior record;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.offer_id::text, 3));
  select o.company_id,o.worker_id,o.representative_id,o.version into prior from private.day3_offers o
    where o.offer_id = new.offer_id order by o.version desc limit 1;
  if found then
    if not coalesce((private.request_uid() = prior.worker_id
      or private.request_uid() = prior.representative_id
        and private.active_authority(prior.company_id,prior.representative_id) is not null), false)
      or (new.company_id,new.worker_id,new.representative_id) is distinct from
        (prior.company_id,prior.worker_id,prior.representative_id) then
      raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
    end if;
    if new.version <> prior.version + 1 then
      raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
    end if;
  elsif new.version <> 1 then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  elsif (new.requester_role = 'EMPLOYER' and new.representative_id is distinct from private.request_uid())
    or (new.requester_role = 'WORKER' and new.representative_id is not null) then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;
  return new;
end;
$$;
grant create on schema private to fw_policy_exec;
alter function private.day3_guard_offer_revision() owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.day3_guard_offer_revision() from public, anon, authenticated, service_role;
create trigger day3_offer_revision_guard before insert on private.day3_offers
for each row execute function private.day3_guard_offer_revision();

create function private.day3_hash_terms(value jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(value::text, '{}'), 'UTF8')), 'hex');
$$;

create function private.day3_unresolved_questions(value jsonb, target_offer_id uuid, target_version bigint) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', (
      substr(md5(target_offer_id::text || ':' || target_version::text || ':' || required.field), 1, 8) || '-' ||
      substr(md5(target_offer_id::text || ':' || target_version::text || ':' || required.field), 9, 4) || '-' ||
      '8' || substr(md5(target_offer_id::text || ':' || target_version::text || ':' || required.field), 14, 3) || '-' ||
      '8' || substr(md5(target_offer_id::text || ':' || target_version::text || ':' || required.field), 18, 3) || '-' ||
      substr(md5(target_offer_id::text || ':' || target_version::text || ':' || required.field), 21, 12)
    )::uuid,
    'field', required.field,
    'question', required.question,
    'required', true
  ) order by required.ordinal), '[]'::jsonb)
  from (values
    (1, 'salary', 'What is the final salary amount for this offer?'),
    (2, 'currency', 'Which currency applies to the salary?'),
    (3, 'startDate', 'When does the work or start date begin?'),
    (4, 'hoursPerWeek', 'What is the expected weekly hours?'),
    (5, 'responsibilities', 'What core responsibilities are still unresolved?')
  ) as required(ordinal, field, question)
  where case required.field
    when 'salary' then jsonb_typeof(value->'salary') = 'number' and (value->>'salary')::numeric > 0
    when 'currency' then jsonb_typeof(value->'currency') = 'string' and btrim(value->>'currency') <> ''
    when 'startDate' then jsonb_typeof(value->'startDate') = 'string' and btrim(value->>'startDate') <> ''
    when 'hoursPerWeek' then jsonb_typeof(value->'hoursPerWeek') = 'number' and (value->>'hoursPerWeek')::numeric > 0
    when 'responsibilities' then jsonb_typeof(value->'responsibilities') = 'string' and btrim(value->>'responsibilities') <> ''
    else false
  end is not true;
$$;

create function private.day3_diff_terms(previous jsonb, current jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'field', fields.field,
    'previous', previous->fields.field,
    'current', current->fields.field
  ) order by fields.field), '[]'::jsonb)
  from (
    select key as field from jsonb_each(coalesce(previous, '{}'::jsonb))
    union
    select key as field from jsonb_each(coalesce(current, '{}'::jsonb))
  ) fields
  where previous->fields.field is distinct from current->fields.field;
$$;

create function private.day3_authorized_company_role(target_company_id uuid, target_subject_id uuid, expected_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case expected_role
    when 'EMPLOYER' then private.active_authority(target_company_id, target_subject_id) is not null
    when 'WORKER' then target_subject_id = private.request_uid() and private.is_active()
      and exists (select 1 from private.companies c where c.id = target_company_id and c.deleted_at is null)
    else false
  end;
$$;

-- PostgreSQL requires the new owner to hold CREATE on the containing schema.
-- Keep this grant inside the migration transaction and revoke it immediately.
grant create on schema private to fw_user_exec;
grant create on schema private to fw_policy_exec;
alter function private.consume_day3_quota() owner to fw_user_exec;
alter function private.day3_hash_terms(jsonb) owner to fw_user_exec;
alter function private.day3_hash_agreement(jsonb, jsonb) owner to fw_user_exec;
alter function private.day3_unresolved_questions(jsonb, uuid, bigint) owner to fw_user_exec;
alter function private.day3_diff_terms(jsonb, jsonb) owner to fw_user_exec;
alter function private.day3_authorized_company_role(uuid, uuid, text) owner to fw_policy_exec;
revoke create on schema private from fw_user_exec;
revoke create on schema private from fw_policy_exec;

grant execute on function private.day3_hash_terms(jsonb) to fw_user_exec;
grant execute on function private.day3_hash_agreement(jsonb, jsonb) to fw_user_exec;
grant execute on function private.day3_unresolved_questions(jsonb, uuid, bigint) to fw_user_exec;
grant execute on function private.day3_diff_terms(jsonb, jsonb) to fw_user_exec;
grant execute on function private.day3_authorized_company_role(uuid, uuid, text) to fw_user_exec;
revoke all on function private.consume_day3_quota(), private.day3_hash_terms(jsonb), private.day3_hash_agreement(jsonb, jsonb),
  private.day3_unresolved_questions(jsonb, uuid, bigint), private.day3_diff_terms(jsonb, jsonb),
  private.day3_authorized_company_role(uuid, uuid, text),
  private.day3_reject_history_mutation(), private.day3_guard_effective_agreement() from public, anon, authenticated, service_role;
grant execute on function private.consume_day3_quota() to fw_user_exec;
grant execute on function private.day3_reject_history_mutation() to fw_user_exec;

create function api.review_offer(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_actor_id uuid;
  offer_id uuid;
  company_id uuid;
  worker_id uuid;
  requester_role text;
  term_hash text;
  unresolved jsonb;
  changes jsonb;
  version_no bigint;
  latest_version bigint;
  latest_offer private.day3_offers%rowtype;
  representative_id uuid;
  authority_basis_id uuid;
  input_terms jsonb;
  request_hash text;
  receipt private.day3_command_receipts%rowtype;
  offer_row_id uuid;
  result jsonb;
begin
  v_actor_id := private.require_identity();
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  offer_id := coalesce((payload->>'offerId')::uuid, null);
  company_id := coalesce((payload->>'companyId')::uuid, null);
  worker_id := coalesce((payload->>'workerId')::uuid, null);
  requester_role := payload->>'requesterRole';
  version_no := coalesce((payload->>'expectedVersion')::bigint, 1);
  input_terms := payload->'terms';

  if offer_id is null or company_id is null or worker_id is null
    or requester_role not in ('EMPLOYER','WORKER') or input_terms is null or jsonb_typeof(input_terms) <> 'object'
    or version_no < 1 or (payload->>'idempotencyKey') is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if requester_role = 'WORKER' and worker_id <> v_actor_id then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;

  if not private.day3_authorized_company_role(company_id, v_actor_id, requester_role) then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(offer_id::text, 3));
  term_hash := private.day3_hash_terms(input_terms);
  unresolved := private.day3_unresolved_questions(input_terms, offer_id, version_no);
  authority_basis_id := case when requester_role = 'EMPLOYER'
    then private.active_authority(company_id, v_actor_id) else null end;
  request_hash := encode(sha256(convert_to(payload::text, 'UTF8')), 'hex');

  if (payload->>'idempotencyKey') is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;
  select * into receipt from private.day3_command_receipts r
  where r.actor_id = v_actor_id and r.command_name = 'review_offer'
    and r.idempotency_key = (payload->>'idempotencyKey')::uuid;
  if found then
    if receipt.request_hash <> request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select row_to_json(t)::jsonb into result
    from (
      select o.offer_id as "offerId", o.company_id as "companyId", o.worker_id as "workerId",
             o.created_by as "requesterId", o.requester_role as "requesterRole",
             o.version as version, o.term_hash as "termHash", o.snapshot,
             o.representative_id as "representativeId", o.unresolved, o.changes
      from private.day3_offers o
      where o.id = receipt.result_id and o.created_by = v_actor_id
    ) t;
    result := jsonb_set(result, '{idempotent}', 'true'::jsonb, true);
    return result;
  end if;

  perform private.consume_day3_quota();
  select * into latest_offer from private.day3_offers o
  where o.offer_id = offer_id
  order by o.version desc
  limit 1
  for update;
  if found then
    latest_version := latest_offer.version;
    if latest_offer.company_id <> company_id or latest_offer.worker_id <> worker_id
      or (requester_role = 'EMPLOYER' and latest_offer.representative_id is distinct from v_actor_id) then
      raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
    end if;
    representative_id := latest_offer.representative_id;
    changes := private.day3_diff_terms(latest_offer.snapshot, input_terms);
  else
    representative_id := case when requester_role = 'EMPLOYER' then v_actor_id else null end;
    changes := '[]'::jsonb;
  end if;
  if version_no <> coalesce(latest_version + 1, 1) then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  authority_basis_id := private.active_authority(company_id, representative_id);
  if representative_id = worker_id or (representative_id is not null and authority_basis_id is null) then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;
  insert into private.day3_offers (offer_id, company_id, worker_id, representative_id, requester_id, requester_role, version, authority_decision_id, term_hash, snapshot, changes, unresolved, created_by)
  values (offer_id, company_id, worker_id, representative_id, v_actor_id, requester_role, version_no, authority_basis_id, term_hash, input_terms, changes, unresolved, v_actor_id)
  returning id into offer_row_id;

  insert into private.day3_offer_questions(id, offer_id, offer_version, company_id, worker_id, field, question, required)
  select (question.value->>'id')::uuid, offer_id, version_no, company_id, worker_id,
    question.value->>'field', question.value->>'question', (question.value->>'required')::boolean
  from jsonb_array_elements(unresolved) as question(value);

  result := jsonb_build_object(
    'offerId', offer_id,
    'companyId', company_id,
    'workerId', worker_id,
    'requesterId', v_actor_id,
    'requesterRole', requester_role,
    'authorityDecisionId', authority_basis_id,
    'version', version_no,
    'termHash', term_hash,
    'snapshot', input_terms,
    'representativeId', representative_id,
    'changes', changes,
    'unresolved', unresolved,
    'idempotent', false
  );

  insert into private.day3_command_receipts (actor_id, command_name, idempotency_key, result_id, request_hash)
  values (v_actor_id, 'review_offer', (payload->>'idempotencyKey')::uuid, offer_row_id, request_hash);
  insert into private.audit_logs(actor_id, action, target_id, request_id, changed_field_names, reason_code, retention_class)
  values (v_actor_id, 'review_offer', offer_id, (payload->>'idempotencyKey')::uuid,
    array['company_id','worker_id','version','term_hash'], 'day3_offer_command', 'authority');

  return result;
end;
$$;

create function api.answer_offer_question(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_actor_id uuid;
  offer_id uuid;
  offer_version bigint;
  question_id uuid;
  answer_text text;
  idempotency_key uuid;
  request_hash text;
  receipt private.day3_command_receipts%rowtype;
  question private.day3_offer_questions%rowtype;
  answer_id uuid;
  latest_version bigint;
  answer_result jsonb;
begin
  v_actor_id := private.require_identity();
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  offer_id := nullif(payload->>'offerId', '')::uuid;
  offer_version := nullif(payload->>'offerVersion', '')::bigint;
  question_id := nullif(payload->>'questionId', '')::uuid;
  answer_text := btrim(payload->>'answer');
  idempotency_key := nullif(payload->>'idempotencyKey', '')::uuid;
  if offer_id is null or offer_version is null or offer_version < 1 or question_id is null
    or answer_text is null or char_length(answer_text) not between 1 and 2000 or idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(offer_id::text, 3));
  select * into question from private.day3_offer_questions q
  where q.id = question_id and q.offer_id = offer_id and q.offer_version = offer_version
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select max(o.version) into latest_version from private.day3_offers o where o.offer_id = offer_id;
  if latest_version <> offer_version then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;
  if not (
    private.day3_authorized_company_role(question.company_id, v_actor_id, 'EMPLOYER')
      and exists (select 1 from private.day3_offers o
        where o.offer_id = question.offer_id and o.version = question.offer_version
          and o.representative_id = v_actor_id)
    or private.day3_authorized_company_role(question.company_id, v_actor_id, 'WORKER')
      and question.worker_id = v_actor_id
  ) then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;

  request_hash := encode(sha256(convert_to(payload::text, 'UTF8')), 'hex');
  select * into receipt from private.day3_command_receipts r
  where r.actor_id = v_actor_id and r.command_name = 'answer_offer_question'
    and r.idempotency_key = idempotency_key;
  if found then
    if receipt.request_hash <> request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select jsonb_build_object('answerId', a.id, 'questionId', a.question_id, 'offerId', a.offer_id,
      'offerVersion', a.offer_version, 'answeredBy', a.answered_by, 'answer', a.answer, 'idempotent', true)
      into answer_result from private.day3_offer_answers a where a.id = receipt.result_id;
    return answer_result;
  end if;

  perform private.consume_day3_quota();
  insert into private.day3_offer_answers(question_id, offer_id, offer_version, answer, answered_by)
  values(question_id, offer_id, offer_version, answer_text, v_actor_id)
  returning id into answer_id;
  insert into private.day3_command_receipts(actor_id, command_name, idempotency_key, result_id, request_hash)
  values(v_actor_id, 'answer_offer_question', idempotency_key, answer_id, request_hash);
  insert into private.audit_logs(actor_id, action, target_id, request_id, changed_field_names, reason_code, retention_class)
  values(v_actor_id, 'answer_offer_question', question_id, idempotency_key,
    array['answer'], 'day3_offer_command', 'authority');
  return jsonb_build_object('answerId', answer_id, 'questionId', question_id, 'offerId', offer_id,
    'offerVersion', offer_version, 'answeredBy', v_actor_id, 'answer', answer_text, 'idempotent', false);
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
end;
$$;

create function api.confirm_agreement(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_actor_id uuid;
  agreement_id uuid;
  offer_id uuid;
  company_id uuid;
  worker_id uuid;
  confirmation_role text;
  expected_version bigint;
  current_hash text;
  active_offer private.day3_offers%rowtype;
  receipt private.day3_command_receipts%rowtype;
  request_hash text;
  confirmation_row_id uuid;
  confirmation_count bigint;
  existing_agreement_id uuid;
  authority_basis_id uuid;
  latest_version bigint;
  effective_exists boolean;
  agreement_result jsonb;
begin
  v_actor_id := private.require_identity();
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  agreement_id := coalesce((payload->>'agreementId')::uuid, null);
  offer_id := coalesce((payload->>'offerId')::uuid, null);
  company_id := coalesce((payload->>'companyId')::uuid, null);
  worker_id := coalesce((payload->>'workerId')::uuid, null);
  confirmation_role := payload->>'confirmationRole';
  expected_version := coalesce((payload->>'expectedVersion')::bigint, 1);

  if agreement_id is null or offer_id is null or company_id is null or worker_id is null
     or confirmation_role not in ('EMPLOYER','WORKER') or expected_version < 1
     or (payload->>'idempotencyKey') is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if confirmation_role = 'WORKER' and v_actor_id <> worker_id then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;

  if not private.day3_authorized_company_role(company_id, v_actor_id, confirmation_role) then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;
  authority_basis_id := case when confirmation_role = 'EMPLOYER'
    then private.active_authority(company_id, v_actor_id) else null end;

  perform pg_advisory_xact_lock(hashtextextended(offer_id::text, 3));
  select * into active_offer from private.day3_offers
  where private.day3_offers.offer_id = offer_id
    and private.day3_offers.version = expected_version
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  if active_offer.representative_id is null
    or active_offer.representative_id = active_offer.worker_id
    or active_offer.authority_decision_id is distinct from private.active_authority(company_id, active_offer.representative_id)
    or (confirmation_role = 'EMPLOYER' and v_actor_id <> active_offer.representative_id)
    or active_offer.company_id <> company_id or active_offer.worker_id <> worker_id then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
  end if;

  select max(o.version) into latest_version
  from private.day3_offers o where o.offer_id = offer_id;
  if latest_version <> expected_version then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  if exists (
    select 1 from private.day3_offer_questions q
    where q.offer_id = active_offer.offer_id and q.offer_version = active_offer.version and q.required
      and not exists (select 1 from private.day3_offer_answers a where a.question_id = q.id)
  ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;
  current_hash := private.day3_hash_agreement(active_offer.snapshot, active_offer.unresolved);

  if (payload->>'idempotencyKey') is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;
  request_hash := encode(sha256(convert_to(payload::text, 'UTF8')), 'hex');
  select * into receipt from private.day3_command_receipts r
  where r.actor_id = v_actor_id and r.command_name = 'confirm_agreement'
    and r.idempotency_key = (payload->>'idempotencyKey')::uuid;
  if found then
    if receipt.request_hash <> request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select jsonb_build_object(
      'agreementId', a.agreement_id,
      'offerId', a.offer_id,
      'version', a.version,
      'confirmedBy', a.confirmed_by,
      'confirmationRole', a.confirmation_role,
      'currentHash', a.current_hash,
      'status', case when (
        select count(*) from private.day3_agreements peers where peers.agreement_id = a.agreement_id
      ) = 2 then 'confirmed' else 'awaiting_other_party' end,
      'idempotent', true
    ) into agreement_result
    from private.day3_agreements a
    where a.id = receipt.result_id and a.created_by = v_actor_id;
    return agreement_result;
  end if;
  perform private.consume_day3_quota();

  select a.agreement_id into existing_agreement_id
  from private.day3_agreements a
  where a.offer_id = active_offer.offer_id and a.offer_version = active_offer.version
  limit 1;
  if existing_agreement_id is not null and existing_agreement_id <> agreement_id then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  insert into private.day3_agreements (
    agreement_id, offer_id, offer_version, company_id, worker_id, version,
    confirmed_by, confirmation_role, authority_decision_id, previous_hash, current_hash, unresolved, created_by
  )
  values (
    agreement_id, offer_id, expected_version, company_id, worker_id, expected_version,
    v_actor_id, confirmation_role, authority_basis_id, current_hash, current_hash, active_offer.unresolved, v_actor_id
  )
  returning id into confirmation_row_id;

  select count(*) into confirmation_count from private.day3_agreements a where a.agreement_id = agreement_id;
  agreement_result := jsonb_build_object(
    'agreementId', agreement_id,
    'offerId', offer_id,
    'version', expected_version,
    'confirmedBy', v_actor_id,
    'confirmationRole', confirmation_role,
    'currentHash', current_hash,
    'status', case when confirmation_count = 2 then 'confirmed' else 'awaiting_other_party' end,
    'idempotent', false
  );

  if confirmation_count = 2 then
    if not exists (
      select 1 from private.day3_agreements employer_confirmation
      where employer_confirmation.agreement_id = agreement_id
        and employer_confirmation.confirmation_role = 'EMPLOYER'
        and employer_confirmation.authority_decision_id =
          private.active_authority(company_id, employer_confirmation.confirmed_by)
    ) then
      raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
    end if;
    select exists(select 1 from private.day3_effective_agreements e where e.offer_id = offer_id)
      into effective_exists;
    if effective_exists then
      update private.day3_effective_agreements
      set offer_version = expected_version,
          company_id = company_id,
          worker_id = worker_id,
          agreement_id = agreement_id,
          agreement_hash = current_hash
      where private.day3_effective_agreements.offer_id = offer_id
        and private.day3_effective_agreements.offer_version < expected_version;
    else
      insert into private.day3_effective_agreements(
        offer_id, offer_version, company_id, worker_id, agreement_id, agreement_hash
      )
      values(offer_id, expected_version, company_id, worker_id, agreement_id, current_hash);
    end if;
  end if;

  insert into private.day3_command_receipts (actor_id, command_name, idempotency_key, result_id, request_hash)
  values (v_actor_id, 'confirm_agreement', (payload->>'idempotencyKey')::uuid, confirmation_row_id, request_hash);
  insert into private.audit_logs(actor_id, action, target_id, request_id, changed_field_names, reason_code, retention_class)
  values (v_actor_id, 'confirm_agreement', agreement_id, (payload->>'idempotencyKey')::uuid,
    array['confirmation_role','offer_version','term_hash'], 'day3_offer_command', 'authority');

  return agreement_result;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ACTION_FORBIDDEN';
end;
$$;

grant create on schema api to fw_user_exec;
alter function api.review_offer(jsonb) owner to fw_user_exec;
alter function api.answer_offer_question(jsonb) owner to fw_user_exec;
alter function api.confirm_agreement(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.review_offer(jsonb), api.answer_offer_question(jsonb), api.confirm_agreement(jsonb) from public, anon, authenticated, service_role;
grant execute on function api.review_offer(jsonb) to authenticated;
grant execute on function api.answer_offer_question(jsonb) to authenticated;
grant execute on function api.confirm_agreement(jsonb) to authenticated;
revoke create on schema api from fw_user_exec;

commit;
