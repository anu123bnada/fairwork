begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Applicant management. A signed-in person applies to a published listing with a short message. What the employer side can see is exactly two things the applicant chose to send:
-- their display name at the time of applying and the message. Nothing from their CV, Passport, vault or offers is shared by this feature. Only the author of the listing
-- (who must still hold active authority for the company, enforced by the existing listing policy) can see applicants for it and set a review status. Nothing here verifies anybody.
create table private.listing_applications (
 id uuid primary key,
 listing_id uuid not null references private.opportunity_listings(id),
 applicant_id uuid not null references private.profiles(id),
 applicant_name text not null check(char_length(btrim(applicant_name)) between 1 and 120),
 message text not null check(char_length(message)<=1000),
 status text not null check(status in ('submitted','reviewing','shortlisted','declined','withdrawn')),
 revision integer not null check(revision>=1),
 created_at timestamptz not null default transaction_timestamp(),
 updated_at timestamptz not null default transaction_timestamp(),
 unique(listing_id,applicant_id)
);
create index listing_applications_applicant_idx on private.listing_applications(applicant_id,updated_at desc,id);
create index listing_applications_listing_idx on private.listing_applications(listing_id,created_at desc,id);
alter table private.listing_applications owner to fw_schema_owner;
alter table private.listing_applications enable row level security;alter table private.listing_applications force row level security;
revoke all on private.listing_applications from public,anon,authenticated,service_role;
grant select,insert,update on private.listing_applications to fw_user_exec;
create policy listing_applications_read on private.listing_applications for select to fw_user_exec using(private.is_active() and (applicant_id=private.request_uid()
 or exists(select 1 from private.opportunity_listings l where l.id=listing_id and l.author_id=private.request_uid())));
create policy listing_applications_insert on private.listing_applications for insert to fw_user_exec with check(private.is_active() and applicant_id=private.request_uid());
create policy listing_applications_update on private.listing_applications for update to fw_user_exec
 using(private.is_active() and (applicant_id=private.request_uid() or exists(select 1 from private.opportunity_listings l where l.id=listing_id and l.author_id=private.request_uid())))
 with check(private.is_active() and (applicant_id=private.request_uid() or exists(select 1 from private.opportunity_listings l where l.id=listing_id and l.author_id=private.request_uid())));

create function api.application_submit(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['id','listingId','message']; app_id uuid; lid uuid; who text; total integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}' or jsonb_typeof(request->'id') is distinct from 'string'
  or jsonb_typeof(request->'listingId') is distinct from 'string' or jsonb_typeof(request->'message') is distinct from 'string' or char_length(request->>'message')>1000 then raise exception 'VALIDATION_FAILED';end if;
 app_id:=(request->>'id')::uuid;lid:=(request->>'listingId')::uuid;
 perform private.consume_identity_quota('identity_write');perform pg_advisory_xact_lock(hashtextextended(actor::text,2832));
 if not exists(select 1 from private.opportunity_listings l where l.id=lid and l.status='published' and l.expires_at>clock_timestamp()) then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from private.opportunity_listings l where l.id=lid and l.author_id=actor) then raise exception 'VALIDATION_FAILED';end if;
 if exists(select 1 from private.listing_applications a where a.listing_id=lid and a.applicant_id=actor) then raise exception 'VALIDATION_FAILED';end if;
 select count(*) into total from private.listing_applications where applicant_id=actor and status in ('submitted','reviewing','shortlisted');
 if total>=100 then raise exception 'VALIDATION_FAILED';end if;
 select btrim(p.display_name) into who from private.profiles p where p.id=actor;
 if who is null or who='' then who:='Applicant';end if;
 insert into private.listing_applications(id,listing_id,applicant_id,applicant_name,message,status,revision) values(app_id,lid,actor,left(who,120),request->>'message','submitted',1);
 return jsonb_build_object('id',app_id,'revision',1);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED'; when check_violation then raise exception 'VALIDATION_FAILED'; when unique_violation then raise exception 'VALIDATION_FAILED';
end $$;

create function api.application_mine(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'listingId',d.listing_id,'listingTitle',coalesce((select l.fields->>'title' from private.opportunity_listings l where l.id=d.listing_id),'Listing no longer available'),
   'message',d.message,'status',d.status,'revision',d.revision,'createdAt',d.created_at,'updatedAt',d.updated_at) order by d.updated_at desc,d.id desc),'[]'::jsonb)
  into items from (select * from private.listing_applications where applicant_id=actor order by updated_at desc,id desc limit 100) d;
 return jsonb_build_object('items',items,'limit',100);
end $$;

create function api.application_withdraw(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['id','expectedRevision']; row_ private.listing_applications;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}' or jsonb_typeof(request->'id') is distinct from 'string' or jsonb_typeof(request->'expectedRevision') is distinct from 'number'
  or (request->>'expectedRevision')::numeric<>trunc((request->>'expectedRevision')::numeric) or (request->>'expectedRevision')::numeric<1 then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');
 select * into row_ from private.listing_applications where id=(request->>'id')::uuid and applicant_id=actor for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if row_.revision<>(request->>'expectedRevision')::integer then raise exception 'VERSION_CONFLICT';end if;
 if row_.status='withdrawn' then raise exception 'VALIDATION_FAILED';end if;
 update private.listing_applications set status='withdrawn',revision=row_.revision+1,updated_at=transaction_timestamp() where id=row_.id and applicant_id=actor;
 return jsonb_build_object('id',row_.id,'revision',row_.revision+1);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.application_inbox(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; lid uuid; title text; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ? 'listingId') or request-array['listingId']<>'{}' or jsonb_typeof(request->'listingId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 lid:=(request->>'listingId')::uuid;
 perform private.consume_identity_quota('identity_read');
 select l.fields->>'title' into title from private.opportunity_listings l where l.id=lid and l.author_id=actor;
 if not found then raise exception 'NOT_FOUND';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'applicantName',d.applicant_name,'message',d.message,'status',d.status,'revision',d.revision,'createdAt',d.created_at) order by d.created_at desc,d.id desc),'[]'::jsonb)
  into items from (select * from private.listing_applications where listing_id=lid order by created_at desc,id desc limit 200) d;
 return jsonb_build_object('listingId',lid,'listingTitle',coalesce(title,''),'items',items,'limit',200);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

create function api.application_dashboard(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; items jsonb;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_read');
 select coalesce(jsonb_agg(jsonb_build_object('listingId',l.id,'title',coalesce(l.fields->>'title',''),'status',l.status,'expiresAt',l.expires_at,
   'counts',jsonb_build_object('submitted',(select count(*) from private.listing_applications a where a.listing_id=l.id and a.status='submitted'),
     'reviewing',(select count(*) from private.listing_applications a where a.listing_id=l.id and a.status='reviewing'),
     'shortlisted',(select count(*) from private.listing_applications a where a.listing_id=l.id and a.status='shortlisted'),
     'declined',(select count(*) from private.listing_applications a where a.listing_id=l.id and a.status='declined'),
     'withdrawn',(select count(*) from private.listing_applications a where a.listing_id=l.id and a.status='withdrawn'))) order by l.updated_at desc,l.id desc),'[]'::jsonb)
  into items from (select * from private.opportunity_listings where author_id=actor order by updated_at desc,id desc limit 100) l;
 return jsonb_build_object('items',items,'limit',100);
end $$;

create function api.application_review(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['id','status','expectedRevision']; row_ private.listing_applications;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}' or jsonb_typeof(request->'id') is distinct from 'string' or jsonb_typeof(request->'status') is distinct from 'string'
  or request->>'status' not in ('reviewing','shortlisted','declined') or jsonb_typeof(request->'expectedRevision') is distinct from 'number'
  or (request->>'expectedRevision')::numeric<>trunc((request->>'expectedRevision')::numeric) or (request->>'expectedRevision')::numeric<1 then raise exception 'VALIDATION_FAILED';end if;
 perform private.consume_identity_quota('identity_write');
 select a.* into row_ from private.listing_applications a where a.id=(request->>'id')::uuid and exists(select 1 from private.opportunity_listings l where l.id=a.listing_id and l.author_id=actor) for update of a;
 if not found then raise exception 'NOT_FOUND';end if;
 if row_.revision<>(request->>'expectedRevision')::integer then raise exception 'VERSION_CONFLICT';end if;
 if row_.status='withdrawn' then raise exception 'VALIDATION_FAILED';end if;
 update private.listing_applications set status=request->>'status',revision=row_.revision+1,updated_at=transaction_timestamp() where id=row_.id;
 return jsonb_build_object('id',row_.id,'revision',row_.revision+1,'status',request->>'status');
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;

grant create on schema api to fw_user_exec;
alter function api.application_submit(jsonb) owner to fw_user_exec;alter function api.application_mine(jsonb) owner to fw_user_exec;alter function api.application_withdraw(jsonb) owner to fw_user_exec;
alter function api.application_inbox(jsonb) owner to fw_user_exec;alter function api.application_dashboard(jsonb) owner to fw_user_exec;alter function api.application_review(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.application_submit(jsonb),api.application_mine(jsonb),api.application_withdraw(jsonb),api.application_inbox(jsonb),api.application_dashboard(jsonb),api.application_review(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.application_submit(jsonb),api.application_mine(jsonb),api.application_withdraw(jsonb),api.application_inbox(jsonb),api.application_dashboard(jsonb),api.application_review(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
