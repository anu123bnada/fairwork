begin;
do $$ begin if current_user <> 'postgres' then raise exception 'Offline postgres identity required'; end if; end $$;

create table private.opportunity_listings (
 id uuid primary key, company_id uuid not null references private.companies(id),
 author_id uuid not null references private.profiles(id), version integer not null check(version > 0),
 fields jsonb not null check(jsonb_typeof(fields)='object'),
 status text not null check(status in ('draft','published','closed')),
 expires_at timestamptz not null, updated_at timestamptz not null default transaction_timestamp()
);
create index opportunity_discovery on private.opportunity_listings(id) where status='published';
create index opportunity_author on private.opportunity_listings(author_id,id);
create table private.opportunity_preferences (
 actor_id uuid primary key references private.profiles(id), version integer not null check(version>0), preferences jsonb not null
);
create table private.opportunity_choices (
 actor_id uuid not null references private.profiles(id), listing_id uuid not null references private.opportunity_listings(id),
 choice text not null check(choice in ('saved','hidden','none')), primary key(actor_id,listing_id)
);
create table private.opportunity_events (
 actor_id uuid not null references private.profiles(id), idempotency_key uuid not null,
 request jsonb not null, created_at timestamptz not null default transaction_timestamp(), primary key(actor_id,idempotency_key)
);
do $$ declare t text; begin foreach t in array array['opportunity_listings','opportunity_preferences','opportunity_choices','opportunity_events'] loop
 execute format('alter table private.%I owner to fw_schema_owner',t);
 execute format('alter table private.%I enable row level security',t);
 execute format('alter table private.%I force row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop; end $$;
grant select,insert,update on private.opportunity_listings,private.opportunity_preferences,private.opportunity_choices to fw_user_exec;
grant select,insert on private.opportunity_events to fw_user_exec;
create policy opportunity_read on private.opportunity_listings for select to fw_user_exec using (
 private.is_active() and private.active_authority(company_id,author_id) is not null and
 (author_id=private.request_uid() or (status='published' and expires_at>clock_timestamp()))
);
create policy opportunity_insert on private.opportunity_listings for insert to fw_user_exec with check (
 private.is_active() and author_id=private.request_uid() and private.active_authority(company_id,author_id) is not null
);
create policy opportunity_update on private.opportunity_listings for update to fw_user_exec
 using(private.is_active() and author_id=private.request_uid() and private.active_authority(company_id,author_id) is not null)
 with check(private.is_active() and author_id=private.request_uid() and private.active_authority(company_id,author_id) is not null);
do $$ declare t text; begin foreach t in array array['opportunity_preferences','opportunity_choices'] loop
 execute format('create policy own_data on private.%I for all to fw_user_exec using(private.is_active() and actor_id=private.request_uid()) with check(private.is_active() and actor_id=private.request_uid())',t);
 end loop; end $$;
create policy opportunity_event_read on private.opportunity_events for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy opportunity_event_insert on private.opportunity_events for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and created_at=transaction_timestamp());
create trigger opportunity_event_immutable before update or delete on private.opportunity_events for each row execute function private.day3_reject_history_mutation();

-- Existing RPC executor is NOLOGIN/NOBYPASSRLS. No authenticated table grants.
create function api.opportunity_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; op text; token uuid; value jsonb; saved jsonb; allowed text[]; target_id uuid; company uuid; expected integer; actual integer; old private.opportunity_listings; expiry timestamptz;
begin
 actor:=private.require_identity(); if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 op:=request->>'operation';
 if request is null or jsonb_typeof(request)<>'object' or op is null or op not in ('listing','preferences','choice') then raise exception 'VALIDATION_FAILED';end if;
 allowed:=case op when 'listing' then array['operation','id','companyId','expectedVersion','fields','status','expiresAt','idempotencyKey'] when 'preferences' then array['operation','preferences','expectedVersion','idempotencyKey'] else array['operation','id','choice','idempotencyKey'] end;
 if not(request ?& allowed) or request-allowed<>'{}' or jsonb_typeof(request->'idempotencyKey') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 token:=(request->>'idempotencyKey')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,2401));
 perform private.consume_identity_quota('identity_write');
 if op='listing' then
  target_id:=(request->>'id')::uuid; company:=(request->>'companyId')::uuid;
  if target_id is null or company is null then raise exception 'VALIDATION_FAILED';end if;
  if private.active_authority(company,actor) is null then raise exception 'ACTION_FORBIDDEN';end if;
  perform pg_advisory_xact_lock(hashtextextended(target_id::text,2402));
  select * into old from private.opportunity_listings where opportunity_listings.id=target_id;
  if found and (old.author_id<>actor or old.company_id<>company) then raise exception 'ACTION_FORBIDDEN';end if;
 elsif op='choice' then
  target_id:=(request->>'id')::uuid;
  if target_id is null or jsonb_typeof(request->'choice') is distinct from 'string' or request->>'choice' not in ('saved','hidden','none') then raise exception 'VALIDATION_FAILED';end if;
  if not exists(select 1 from private.opportunity_listings l where l.id=target_id and l.status='published' and l.expires_at>clock_timestamp()) then raise exception 'NOT_FOUND';end if;
 end if;
 select e.request into saved from private.opportunity_events e where actor_id=actor and idempotency_key=token;
 if found then if saved<>request then raise exception 'IDEMPOTENCY_CONFLICT';end if; return jsonb_build_object('saved',true);end if;
 if op in ('listing','preferences') then
  if jsonb_typeof(request->'expectedVersion') is distinct from 'number' or request->>'expectedVersion' !~ '^(0|[1-9][0-9]{0,8})$' then raise exception 'VALIDATION_FAILED';end if;
  expected:=(request->>'expectedVersion')::integer;
  value:=case op when 'listing' then request->'fields' else request->'preferences' end;
  allowed:=case op when 'listing' then array['title','description','location','workMode','salary','currency','payPeriod'] else array['role','location','workMode','minimumPay','currency','payPeriod'] end;
  if value is null or jsonb_typeof(value)<>'object' or not(value ?& allowed) or value-allowed<>'{}' then raise exception 'VALIDATION_FAILED';end if;
  if jsonb_typeof(value->'currency') is distinct from 'string' or value->>'currency' !~ '^[A-Z]{3}$' or jsonb_typeof(value->'payPeriod') is distinct from 'string' or value->>'payPeriod' not in ('hour','month','year')
   or jsonb_typeof(value->'location') is distinct from 'string' or char_length(value->>'location')>120 then raise exception 'VALIDATION_FAILED';end if;
  if value->'workMode'<>'null'::jsonb and (jsonb_typeof(value->'workMode') is distinct from 'string' or value->>'workMode' not in ('onsite','hybrid','remote')) then raise exception 'VALIDATION_FAILED';end if;
  saved:=value->case op when 'listing' then 'salary' else 'minimumPay' end;
  if saved<>'null'::jsonb and (jsonb_typeof(saved)<>'number' or (saved#>>'{}')::numeric<0 or (saved#>>'{}')::numeric>1000000000) then raise exception 'VALIDATION_FAILED';end if;
  if op='listing' then
   if jsonb_typeof(value->'title') is distinct from 'string' or char_length(btrim(value->>'title')) not between 2 and 120
    or jsonb_typeof(value->'description') is distinct from 'string' or char_length(btrim(value->>'description')) not between 10 and 3000
    or char_length(btrim(value->>'location'))<2 or value->'workMode'='null'::jsonb
    or jsonb_typeof(request->'status') is distinct from 'string' or request->>'status' not in ('draft','published','closed')
    or jsonb_typeof(request->'expiresAt') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
   expiry:=(request->>'expiresAt')::timestamptz;
   if not isfinite(expiry) or (request->>'status'<>'closed' and (expiry<=clock_timestamp() or expiry>clock_timestamp()+interval '90 days')) then raise exception 'VALIDATION_FAILED';end if;
   actual:=coalesce(old.version,0); if actual<>expected then raise exception 'VERSION_CONFLICT';end if;
   if actual=0 then insert into private.opportunity_listings values(target_id,company,actor,1,value,request->>'status',expiry,transaction_timestamp());
   else update private.opportunity_listings l set version=actual+1,fields=value,status=request->>'status',expires_at=expiry,updated_at=transaction_timestamp() where l.id=target_id;end if;
  else
   if jsonb_typeof(value->'role') is distinct from 'string' or char_length(value->>'role')>120 then raise exception 'VALIDATION_FAILED';end if;
   select version into actual from private.opportunity_preferences where actor_id=actor;
   if coalesce(actual,0)<>expected then raise exception 'VERSION_CONFLICT';end if;
   insert into private.opportunity_preferences values(actor,expected+1,value) on conflict(actor_id) do update set version=excluded.version,preferences=excluded.preferences;
  end if;
 else
  insert into private.opportunity_choices values(actor,target_id,request->>'choice') on conflict(actor_id,listing_id) do update set choice=excluded.choice;
 end if;
 insert into private.opportunity_events(actor_id,idempotency_key,request) values(actor,token,request);
 return jsonb_build_object('saved',true);
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range or unique_violation then raise exception 'VALIDATION_FAILED';
end $$;

create function api.opportunity_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; pref private.opportunity_preferences; items jsonb; cursor_id uuid; next_id uuid;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['view','query','cursor']) or request-array['view','query','cursor']<>'{}'
 or jsonb_typeof(request->'view') is distinct from 'string' or request->>'view' not in ('discover','mine','saved','hidden')
 or jsonb_typeof(request->'query') is distinct from 'string' or char_length(request->>'query')>120
 or jsonb_typeof(request->'cursor') not in ('string','null') then raise exception 'VALIDATION_FAILED';end if;
 cursor_id:=(request->>'cursor')::uuid;
 perform private.consume_identity_quota('identity_read');
 select * into pref from private.opportunity_preferences where actor_id=actor;
 with candidates as (
 select l.*,coalesce(c.choice,'none') choice from private.opportunity_listings l
 left join private.opportunity_choices c on c.listing_id=l.id and c.actor_id=actor
 where (cursor_id is null or l.id>cursor_id) and strpos(lower(concat_ws(' ',l.fields->>'title',l.fields->>'location')),lower(request->>'query'))>0
 and case request->>'view' when 'mine' then l.author_id=actor when 'hidden' then c.choice='hidden' and l.status='published' and l.expires_at>clock_timestamp() when 'saved' then c.choice='saved' and l.status='published' and l.expires_at>clock_timestamp()
 else l.status='published' and l.expires_at>clock_timestamp() and coalesce(c.choice,'none')<>'hidden' end
 order by l.id limit 21
 ), numbered as (select *,row_number() over(order by id) n from candidates)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'companyId',company_id,'companyName',private.work_company_label(company_id),'version',version,'fields',fields,'status',status,'expiresAt',expires_at,'updatedAt',updated_at,'choice',choice,'canEdit',author_id=actor,'source','representative_submission','assurance','demo_provisioned') order by id) filter(where n<=20),'[]'),
 case when count(*)>20 then (array_agg(id order by id))[20] else null end into items,next_id from numbered;
 return jsonb_build_object('items',items,'nextCursor',next_id,'preferences',pref.preferences,'preferenceVersion',coalesce(pref.version,0));
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_user_exec;
alter function api.opportunity_read(jsonb) owner to fw_user_exec;
alter function api.opportunity_command(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.opportunity_read(jsonb),api.opportunity_command(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.opportunity_read(jsonb),api.opportunity_command(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
