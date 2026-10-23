-- Forward-only repair: SELECT FOR UPDATE also applies UPDATE USING policies.
-- Read an existing immutable receipt before trying to lock an active profile.
-- Preserve the strict active-only UPDATE policy; never allow self-reactivation.
begin;
create or replace function api.deactivate_account(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid;key uuid;expected bigint;state text;current_revision bigint;removed timestamptz;receipt private.account_deactivations%rowtype;
begin
 caller:=private.require_identity();
 if coalesce(private.request_jwt()->>'aal','')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['expectedRevision','confirmation','idempotencyKey']) or request-array['expectedRevision','confirmation','idempotencyKey']<>'{}' or request->>'confirmation' is distinct from 'DEACTIVATE' or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or request->>'expectedRevision' !~ '^[1-9][0-9]{0,14}$' or jsonb_typeof(request->'idempotencyKey') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 key:=(request->>'idempotencyKey')::uuid;expected:=(request->>'expectedRevision')::bigint;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,0));
 perform private.consume_deactivation_quota('identity_write');
 select account_state,revision,deleted_at into state,current_revision,removed from private.profiles where id=caller;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into receipt from private.account_deactivations where actor_id=caller;
 if found then
  if receipt.request_id<>key or receipt.previous_revision<>expected then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  if state<>'suspended' then raise exception 'ACTION_FORBIDDEN';end if;
  return jsonb_build_object('deactivated',true,'recordedAt',receipt.recorded_at,'revision',receipt.previous_revision+1);
 end if;
 select account_state,revision,deleted_at into state,current_revision,removed from private.profiles where id=caller for update;
 if not found or state<>'active' or removed is not null then raise exception 'ACTION_FORBIDDEN';end if;
 if current_revision<>expected then raise exception 'VERSION_CONFLICT';end if;
 update private.profiles set account_state='suspended' where id=caller;
 insert into private.account_deactivations(actor_id,request_id,previous_revision) values(caller,key,expected) returning * into receipt;
 return jsonb_build_object('deactivated',true,'recordedAt',receipt.recorded_at,'revision',expected+1);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'VALIDATION_FAILED';end $$;
notify pgrst,'reload schema';
commit;
