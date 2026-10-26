begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Recruiter Identity & Affiliation Verification (docs/ORYQEN_RECRUITER_VERIFICATION.md).
-- A person records who a recruiter CLAIMS to be and which employer they claim to represent. The claim is immutable. The only authoritative
-- fact stored here is a decision by an approved representative of that employer (confirm, dispute or withdraw), with its reason and, for a
-- confirmation, an expiry. Everything else (domain control, registry records, page checks) is read live by the application each time a
-- result is shown, so it is always dated and never stored as if it were permanent. Nothing here stores communications or profile content.
create table private.company_domains (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references private.companies(id),
 domain text not null check(char_length(domain)<=253 and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
 token text not null check(token ~ '^[0-9a-f]{40}$'),
 created_by uuid not null references private.profiles(id),
 created_at timestamptz not null default transaction_timestamp(),
 unique(company_id,domain)
);
create table private.company_domain_events (
 id uuid primary key default gen_random_uuid(),
 domain_id uuid not null references private.company_domains(id),
 actor_id uuid not null references private.profiles(id),
 event text not null check(event in ('claimed','removed')),
 at timestamptz not null default transaction_timestamp(),
 unique(domain_id,event)
);
create table private.recruiter_verifications (
 id uuid primary key,
 requester_id uuid not null references private.profiles(id),
 company_id uuid references private.companies(id),
 recruiter_name text not null check(char_length(recruiter_name) between 2 and 120 and recruiter_name=btrim(recruiter_name)),
 claimed_employer text not null check(char_length(claimed_employer) between 2 and 120 and claimed_employer=btrim(claimed_employer)),
 role_title text check(role_title is null or char_length(role_title) between 1 and 120),
 email text check(email is null or (char_length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 profile_url text check(profile_url is null or (char_length(profile_url)<=300 and profile_url ~ '^https://[^[:space:]]+$')),
 employer_site text check(employer_site is null or (char_length(employer_site)<=300 and employer_site ~ '^https://[^[:space:]]+$')),
 posting_url text check(posting_url is null or (char_length(posting_url)<=500 and posting_url ~ '^https://[^[:space:]]+$')),
 registry_lei text check(registry_lei is null or registry_lei ~ '^[A-Z0-9]{20}$'),
 notice_version text not null check(notice_version='recruiter-verification.v1'),
 idempotency_key uuid not null,
 created_at timestamptz not null default transaction_timestamp(),
 expires_at timestamptz not null,
 check(expires_at=created_at+interval '90 days'),
 unique(requester_id,idempotency_key)
);
create index recruiter_verifications_requester_idx on private.recruiter_verifications(requester_id,created_at desc);
create index recruiter_verifications_company_idx on private.recruiter_verifications(company_id,created_at desc);
create table private.recruiter_decisions (
 id uuid primary key default gen_random_uuid(),
 verification_id uuid not null references private.recruiter_verifications(id),
 company_id uuid not null references private.companies(id),
 decider_id uuid not null references private.profiles(id),
 decision text not null check(decision in ('confirm','dispute','withdraw')),
 reason text not null check(char_length(reason) between 1 and 500),
 valid_until timestamptz,
 created_at timestamptz not null default transaction_timestamp(),
 idempotency_key uuid not null,
 check((decision='confirm' and valid_until is not null and valid_until>created_at and valid_until<=created_at+interval '181 days') or (decision<>'confirm' and valid_until is null)),
 unique(decider_id,idempotency_key)
);
create index recruiter_decisions_verification_idx on private.recruiter_decisions(verification_id,created_at desc);
-- Audit of what happened, without any personal content.
create table private.recruiter_events (
 id uuid primary key default gen_random_uuid(),
 verification_id uuid not null,
 company_id uuid,
 kind text not null check(kind in ('created','deleted','confirm','dispute','withdraw')),
 at timestamptz not null default transaction_timestamp()
);
alter table private.company_domains owner to fw_schema_owner;
alter table private.company_domain_events owner to fw_schema_owner;
alter table private.recruiter_verifications owner to fw_schema_owner;
alter table private.recruiter_decisions owner to fw_schema_owner;
alter table private.recruiter_events owner to fw_schema_owner;
alter table private.company_domains enable row level security;alter table private.company_domains force row level security;
alter table private.company_domain_events enable row level security;alter table private.company_domain_events force row level security;
alter table private.recruiter_verifications enable row level security;alter table private.recruiter_verifications force row level security;
alter table private.recruiter_decisions enable row level security;alter table private.recruiter_decisions force row level security;
alter table private.recruiter_events enable row level security;alter table private.recruiter_events force row level security;
revoke all on private.company_domains,private.company_domain_events,private.recruiter_verifications,private.recruiter_decisions,private.recruiter_events from public,anon,authenticated,service_role;
grant select,insert on private.company_domains,private.company_domain_events to fw_user_exec;
grant select,insert,delete on private.recruiter_verifications,private.recruiter_decisions to fw_user_exec;
grant select,insert on private.recruiter_events to fw_user_exec;

-- Domains: approved representatives of the company manage them. People who can already see the company (an offer with it) or who
-- named it in a verification request can read them, because they are public by design: the token is meant to be published at the domain.
create policy company_domains_read on private.company_domains for select to fw_user_exec using(private.is_active() and (
 private.active_authority(company_id,private.request_uid()) is not null
 or exists(select 1 from private.day3_offers o where o.company_id=company_domains.company_id)
 or exists(select 1 from private.recruiter_verifications v where v.company_id=company_domains.company_id and v.requester_id=private.request_uid())));
create policy company_domains_insert on private.company_domains for insert to fw_user_exec with check(private.is_active() and created_by=private.request_uid() and private.active_authority(company_id,private.request_uid()) is not null and created_at=transaction_timestamp());
create policy company_domain_events_read on private.company_domain_events for select to fw_user_exec using(private.is_active() and exists(select 1 from private.company_domains d where d.id=domain_id));
create policy company_domain_events_insert on private.company_domain_events for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and at=transaction_timestamp() and exists(select 1 from private.company_domains d where d.id=domain_id and private.active_authority(d.company_id,private.request_uid()) is not null));
create trigger company_domains_immutable before update or delete on private.company_domains for each row execute function private.day3_reject_history_mutation();
create trigger company_domain_events_immutable before update or delete on private.company_domain_events for each row execute function private.day3_reject_history_mutation();

-- Verification claims: the requester owns them; approved representatives of the named company can read the claim so they can decide.
create policy recruiter_verifications_read on private.recruiter_verifications for select to fw_user_exec using(private.is_active() and (requester_id=private.request_uid() or (company_id is not null and private.active_authority(company_id,private.request_uid()) is not null)));
create policy recruiter_verifications_insert on private.recruiter_verifications for insert to fw_user_exec with check(private.is_active() and requester_id=private.request_uid() and created_at=transaction_timestamp());
create policy recruiter_verifications_delete on private.recruiter_verifications for delete to fw_user_exec using(private.is_active() and requester_id=private.request_uid());

-- Decisions: only an approved representative of the verification's own company may add one, never the requester, never after expiry.
create policy recruiter_decisions_read on private.recruiter_decisions for select to fw_user_exec using(private.is_active() and (private.active_authority(company_id,private.request_uid()) is not null
 or exists(select 1 from private.recruiter_verifications v where v.id=verification_id and v.requester_id=private.request_uid())));
create policy recruiter_decisions_insert on private.recruiter_decisions for insert to fw_user_exec with check(private.is_active() and decider_id=private.request_uid() and created_at=transaction_timestamp()
 and exists(select 1 from private.recruiter_verifications v where v.id=verification_id and v.company_id=recruiter_decisions.company_id and v.requester_id<>private.request_uid() and v.expires_at>transaction_timestamp())
 and private.active_authority(company_id,private.request_uid()) is not null);
create policy recruiter_decisions_delete on private.recruiter_decisions for delete to fw_user_exec using(private.is_active() and exists(select 1 from private.recruiter_verifications v where v.id=verification_id and v.requester_id=private.request_uid()));
create policy recruiter_events_read on private.recruiter_events for select to fw_user_exec using(private.is_active() and company_id is not null and private.active_authority(company_id,private.request_uid()) is not null);
create policy recruiter_events_insert on private.recruiter_events for insert to fw_user_exec with check(private.is_active() and at=transaction_timestamp());
create trigger recruiter_events_immutable before update or delete on private.recruiter_events for each row execute function private.day3_reject_history_mutation();

-- Helpers owned by the policy role: they read only what they must and return counts, dates and company names, never claim content.
grant select on private.recruiter_decisions to fw_policy_exec;
create policy recruiter_decisions_state on private.recruiter_decisions for select to fw_policy_exec using(true);
grant create on schema private to fw_policy_exec;
-- For one verification: how many representatives currently confirm it (their latest decision is an unexpired confirmation) and how many dispute it.
create function private.recruiter_state(verification uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with latest as (select distinct on (decider_id) decider_id,decision,valid_until,created_at from private.recruiter_decisions where verification_id=verification order by decider_id,created_at desc,id desc)
 select jsonb_build_object(
  'confirmations',(select count(*) from latest where decision='confirm' and valid_until>transaction_timestamp()),
  'disputes',(select count(*) from latest where decision='dispute'),
  'confirmedUntil',(select max(valid_until) from latest where decision='confirm' and valid_until>transaction_timestamp()),
  'lastDecisionAt',(select max(created_at) from latest));
$$;
-- Companies a person may name in a verification request: only those that currently have an approved representative, matched by name prefix.
create function private.recruiter_company_search(query text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('companyId',c.id,'name',c.name) order by c.name,c.id),'[]'::jsonb) from (
  select c.id,c.name from private.companies c where c.deleted_at is null and lower(c.name) like lower(query)||'%'
   and exists(select 1 from private.company_memberships m where m.company_id=c.id and private.active_authority(c.id,m.subject_id) is not null) order by c.name,c.id limit 5) c;
$$;
alter function private.recruiter_state(uuid) owner to fw_policy_exec;
alter function private.recruiter_company_search(text) owner to fw_policy_exec;
revoke create on schema private from fw_policy_exec;
revoke all on function private.recruiter_state(uuid),private.recruiter_company_search(text) from public,anon,authenticated,service_role;
grant execute on function private.recruiter_state(uuid),private.recruiter_company_search(text) to fw_user_exec;

create function api.recruiter_company_search(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q text;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'query') or request-array['query']<>'{}' or jsonb_typeof(request->'query') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 q:=btrim(request->>'query');
 if char_length(q) not between 4 and 80 or q ~ '[%_\\]' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 return jsonb_build_object('items',private.recruiter_company_search(q));
end $$;

create function api.recruiter_create(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['verificationId','companyId','recruiterName','claimedEmployer','roleTitle','email','profileUrl','employerSite','postingUrl','registryLei','noticeVersion','idempotencyKey']; prior private.recruiter_verifications; company uuid; id uuid; total integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or (select count(*) from jsonb_each(request) e where jsonb_typeof(e.value) not in ('string','null'))>0
  or jsonb_typeof(request->'verificationId') is distinct from 'string' or jsonb_typeof(request->'recruiterName') is distinct from 'string' or jsonb_typeof(request->'claimedEmployer') is distinct from 'string'
  or jsonb_typeof(request->'noticeVersion') is distinct from 'string' or request->>'noticeVersion'<>'recruiter-verification.v1' or jsonb_typeof(request->'idempotencyKey') is distinct from 'string'
  or char_length(btrim(request->>'recruiterName')) not between 2 and 120 or char_length(btrim(request->>'claimedEmployer')) not between 2 and 120
  then raise exception 'VALIDATION_FAILED';end if;
 id:=(request->>'verificationId')::uuid;company:=nullif(request->>'companyId','')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2810));
 select * into prior from private.recruiter_verifications where requester_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.id<>id or prior.recruiter_name<>btrim(request->>'recruiterName') or prior.claimed_employer<>btrim(request->>'claimedEmployer') then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('verificationId',prior.id,'replayed',true);
 end if;
 select count(*) into total from private.recruiter_verifications where requester_id=actor and expires_at>transaction_timestamp();
 if total>=20 then raise exception 'RATE_LIMITED';end if;
 if company is not null and private.work_company_label(company) is null then raise exception 'NOT_FOUND';end if;
 insert into private.recruiter_verifications(id,requester_id,company_id,recruiter_name,claimed_employer,role_title,email,profile_url,employer_site,posting_url,registry_lei,notice_version,idempotency_key,expires_at)
  values(id,actor,company,btrim(request->>'recruiterName'),btrim(request->>'claimedEmployer'),nullif(btrim(coalesce(request->>'roleTitle','')),''),nullif(btrim(coalesce(request->>'email','')),''),nullif(btrim(coalesce(request->>'profileUrl','')),''),nullif(btrim(coalesce(request->>'employerSite','')),''),nullif(btrim(coalesce(request->>'postingUrl','')),''),nullif(request->>'registryLei',''),request->>'noticeVersion',(request->>'idempotencyKey')::uuid,transaction_timestamp()+interval '90 days');
 insert into private.recruiter_events(verification_id,company_id,kind) values(id,company,'created');
 return jsonb_build_object('verificationId',id,'replayed',false);
exception when invalid_text_representation or check_violation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'IDEMPOTENCY_CONFLICT';end $$;

create function api.recruiter_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or request<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 -- Retention: the requester's expired claims (and their decisions) are erased the next time they look.
 delete from private.recruiter_decisions d where exists(select 1 from private.recruiter_verifications v where v.id=d.verification_id and v.requester_id=actor and v.expires_at<=transaction_timestamp());
 delete from private.recruiter_verifications where requester_id=actor and expires_at<=transaction_timestamp();
 select coalesce(jsonb_agg(jsonb_build_object('verificationId',v.id,'recruiterName',v.recruiter_name,'claimedEmployer',v.claimed_employer,'roleTitle',v.role_title,'companyId',v.company_id,'createdAt',v.created_at,'expiresAt',v.expires_at,'employer',private.recruiter_state(v.id)) order by v.created_at desc,v.id),'[]') into items
  from (select * from private.recruiter_verifications where requester_id=actor order by created_at desc,id limit 20) v;
 return jsonb_build_object('items',items);
end $$;

create function api.recruiter_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; v private.recruiter_verifications; decisions jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'verificationId') or request-array['verificationId']<>'{}' or jsonb_typeof(request->'verificationId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select * into v from private.recruiter_verifications where id=(request->>'verificationId')::uuid and requester_id=actor and expires_at>transaction_timestamp();
 if not found then raise exception 'NOT_FOUND';end if;
 -- The requester sees what was decided and why, never which representative decided.
 select coalesce(jsonb_agg(jsonb_build_object('decision',d.decision,'reason',d.reason,'validUntil',d.valid_until,'at',d.created_at) order by d.created_at desc,d.id),'[]') into decisions from private.recruiter_decisions d where d.verification_id=v.id;
 return jsonb_build_object('verificationId',v.id,'companyId',v.company_id,'recruiterName',v.recruiter_name,'claimedEmployer',v.claimed_employer,'roleTitle',v.role_title,'email',v.email,'profileUrl',v.profile_url,'employerSite',v.employer_site,'postingUrl',v.posting_url,'registryLei',v.registry_lei,
  'createdAt',v.created_at,'expiresAt',v.expires_at,'employer',private.recruiter_state(v.id),'decisions',decisions);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.recruiter_delete(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; v private.recruiter_verifications;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'verificationId') or request-array['verificationId']<>'{}' or jsonb_typeof(request->'verificationId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');
 select * into v from private.recruiter_verifications where id=(request->>'verificationId')::uuid and requester_id=actor;
 if not found then raise exception 'NOT_FOUND';end if;
 delete from private.recruiter_decisions where verification_id=v.id;
 delete from private.recruiter_verifications where id=v.id;
 insert into private.recruiter_events(verification_id,company_id,kind) values(v.id,v.company_id,'deleted');
 return jsonb_build_object('verificationId',v.id,'deleted',true);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

-- For approved representatives: requests that name their company, with their own current decision. The requester is never shown.
create function api.recruiter_queue(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb; cursor uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'cursor') or request-array['cursor']<>'{}' then raise exception 'VALIDATION_FAILED';end if;
 cursor:=nullif(request->>'cursor','')::uuid;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('verificationId',v.id,'companyId',v.company_id,'companyName',v.company_name,'recruiterName',v.recruiter_name,'roleTitle',v.role_title,'email',v.email,'postingUrl',v.posting_url,'createdAt',v.created_at,'expiresAt',v.expires_at,
   'mine',(select jsonb_build_object('decision',d.decision,'validUntil',d.valid_until,'at',d.created_at) from private.recruiter_decisions d where d.verification_id=v.id and d.decider_id=actor order by d.created_at desc,d.id desc limit 1),
   'employer',private.recruiter_state(v.id)) order by v.id),'[]') into items
  from (select r.*,private.work_company_label(r.company_id) company_name from private.recruiter_verifications r
        where r.company_id is not null and private.active_authority(r.company_id,actor) is not null and r.requester_id<>actor and r.expires_at>transaction_timestamp() and (cursor is null or r.id>cursor) order by r.id limit 20) v;
 return jsonb_build_object('items',items,'nextCursor',case when jsonb_array_length(items)=20 then items->19->>'verificationId' else null end);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.recruiter_decide(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['verificationId','decision','reason','validDays','idempotencyKey']; v private.recruiter_verifications; prior private.recruiter_decisions; days integer; saved private.recruiter_decisions;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or jsonb_typeof(request->'verificationId') is distinct from 'string' or jsonb_typeof(request->'idempotencyKey') is distinct from 'string'
  or request->>'decision' is null or request->>'decision' not in ('confirm','dispute','withdraw')
  or jsonb_typeof(request->'reason') is distinct from 'string' or char_length(btrim(request->>'reason')) not between 1 and 500
  or (request->>'decision'='confirm' and (jsonb_typeof(request->'validDays') is distinct from 'number' or request->>'validDays' !~ '^[1-9][0-9]{0,2}$'))
  or (request->>'decision'<>'confirm' and jsonb_typeof(request->'validDays') is distinct from 'null')
  then raise exception 'VALIDATION_FAILED';end if;
 days:=case when request->>'decision'='confirm' then (request->>'validDays')::integer else null end;
 if days is not null and days>180 then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2811));
 select * into prior from private.recruiter_decisions where decider_id=actor and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.verification_id<>(request->>'verificationId')::uuid or prior.decision<>request->>'decision' then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('verificationId',prior.verification_id,'decision',prior.decision,'validUntil',prior.valid_until,'replayed',true);
 end if;
 select * into v from private.recruiter_verifications where id=(request->>'verificationId')::uuid;
 if not found or v.company_id is null or private.active_authority(v.company_id,actor) is null then raise exception 'NOT_FOUND';end if;
 if v.requester_id=actor then raise exception 'ACTION_FORBIDDEN';end if;
 if v.expires_at<=transaction_timestamp() then raise exception 'VERSION_CONFLICT';end if;
 if request->>'decision'='withdraw' and not exists(select 1 from private.recruiter_decisions d where d.verification_id=v.id and d.decider_id=actor) then raise exception 'VALIDATION_FAILED';end if;
 insert into private.recruiter_decisions(verification_id,company_id,decider_id,decision,reason,valid_until,idempotency_key)
  values(v.id,v.company_id,actor,request->>'decision',btrim(request->>'reason'),case when days is null then null else transaction_timestamp()+make_interval(days=>days) end,(request->>'idempotencyKey')::uuid) returning * into saved;
 insert into private.recruiter_events(verification_id,company_id,kind) values(v.id,v.company_id,saved.decision);
 return jsonb_build_object('verificationId',v.id,'decision',saved.decision,'validUntil',saved.valid_until,'replayed',false);
exception when invalid_text_representation or check_violation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'IDEMPOTENCY_CONFLICT';end $$;

create function api.company_domain_claim(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; company uuid; d text; existing private.company_domains; saved private.company_domains; total integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['companyId','domain']) or request-array['companyId','domain']<>'{}' or jsonb_typeof(request->'companyId') is distinct from 'string' or jsonb_typeof(request->'domain') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 company:=(request->>'companyId')::uuid;d:=lower(btrim(request->>'domain'));
 if private.active_authority(company,actor) is null then raise exception 'ACTION_FORBIDDEN';end if;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(company::text,2812));
 select * into existing from private.company_domains where company_id=company and domain=d;
 if found then
  if exists(select 1 from private.company_domain_events e where e.domain_id=existing.id and e.event='removed') then raise exception 'VERSION_CONFLICT';end if;
  return jsonb_build_object('domainId',existing.id,'domain',existing.domain,'token',existing.token,'replayed',true);
 end if;
 select count(*) into total from private.company_domains cd where cd.company_id=company and not exists(select 1 from private.company_domain_events e where e.domain_id=cd.id and e.event='removed');
 if total>=5 then raise exception 'RATE_LIMITED';end if;
 insert into private.company_domains(company_id,domain,token,created_by) values(company,d,left(encode(sha256(convert_to(gen_random_uuid()::text||clock_timestamp()::text||company::text,'utf8')),'hex'),40),actor) returning * into saved;
 insert into private.company_domain_events(domain_id,actor_id,event) values(saved.id,actor,'claimed');
 return jsonb_build_object('domainId',saved.id,'domain',saved.domain,'token',saved.token,'replayed',false);
exception when invalid_text_representation or check_violation then raise exception 'VALIDATION_FAILED';end $$;

create function api.company_domain_list(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb;
begin
 perform private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'companyId') or request-array['companyId']<>'{}' or jsonb_typeof(request->'companyId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('domainId',d.id,'domain',d.domain,'token',d.token,'createdAt',d.created_at) order by d.domain),'[]') into items
  from private.company_domains d where d.company_id=(request->>'companyId')::uuid and not exists(select 1 from private.company_domain_events e where e.domain_id=d.id and e.event='removed');
 return jsonb_build_object('items',items);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.company_domain_remove(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; d private.company_domains;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'domainId') or request-array['domainId']<>'{}' or jsonb_typeof(request->'domainId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');
 select * into d from private.company_domains where id=(request->>'domainId')::uuid;
 if not found or private.active_authority(d.company_id,actor) is null then raise exception 'NOT_FOUND';end if;
 insert into private.company_domain_events(domain_id,actor_id,event) values(d.id,actor,'removed') on conflict(domain_id,event) do nothing;
 return jsonb_build_object('domainId',d.id,'removed',true);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.recruiter_company_search(jsonb) owner to fw_user_exec;
alter function api.recruiter_create(jsonb) owner to fw_user_exec;
alter function api.recruiter_list(jsonb) owner to fw_user_exec;
alter function api.recruiter_read(jsonb) owner to fw_user_exec;
alter function api.recruiter_delete(jsonb) owner to fw_user_exec;
alter function api.recruiter_queue(jsonb) owner to fw_user_exec;
alter function api.recruiter_decide(jsonb) owner to fw_user_exec;
alter function api.company_domain_claim(jsonb) owner to fw_user_exec;
alter function api.company_domain_list(jsonb) owner to fw_user_exec;
alter function api.company_domain_remove(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.recruiter_company_search(jsonb),api.recruiter_create(jsonb),api.recruiter_list(jsonb),api.recruiter_read(jsonb),api.recruiter_delete(jsonb),api.recruiter_queue(jsonb),api.recruiter_decide(jsonb),api.company_domain_claim(jsonb),api.company_domain_list(jsonb),api.company_domain_remove(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.recruiter_company_search(jsonb),api.recruiter_create(jsonb),api.recruiter_list(jsonb),api.recruiter_read(jsonb),api.recruiter_delete(jsonb),api.recruiter_queue(jsonb),api.recruiter_decide(jsonb),api.company_domain_claim(jsonb),api.company_domain_list(jsonb),api.company_domain_remove(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
