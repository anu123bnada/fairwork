begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Users may delete their own private guidance conversations. History stays
-- append-only for every other path: rows can be deleted only inside
-- api.guidance_delete, which sets a transaction-local erase flag. A content-free
-- receipt (thread id, turn count, time) is kept for accountability.
create table private.guidance_deletions (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references private.profiles(id), thread_id uuid not null,
 turn_count integer not null check(turn_count>=0),
 deleted_at timestamptz not null default transaction_timestamp()
);
create index guidance_deletions_actor_idx on private.guidance_deletions(actor_id,deleted_at desc);
alter table private.guidance_deletions owner to fw_schema_owner;
alter table private.guidance_deletions enable row level security;
alter table private.guidance_deletions force row level security;
revoke all on private.guidance_deletions from public,anon,authenticated,service_role;
grant select,insert on private.guidance_deletions to fw_user_exec;
create policy guidance_deletion_read on private.guidance_deletions for select to fw_user_exec using(private.is_active() and actor_id=private.request_uid());
create policy guidance_deletion_insert on private.guidance_deletions for insert to fw_user_exec with check(private.is_active() and actor_id=private.request_uid() and deleted_at=transaction_timestamp());
create trigger guidance_deletion_immutable before update or delete on private.guidance_deletions for each row execute function private.day3_reject_history_mutation();

create function private.guidance_turn_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and current_setting('oryqen.guidance_erase',true)='on' then return old;end if;
 raise exception using errcode='P0001',message='ACTION_FORBIDDEN';
end $$;
alter function private.guidance_turn_guard() owner to fw_schema_owner;
drop trigger guidance_immutable on private.guidance_turns;
create trigger guidance_immutable before update or delete on private.guidance_turns for each row execute function private.guidance_turn_guard();
grant delete on private.guidance_turns to fw_user_exec;
create policy guidance_delete on private.guidance_turns for delete to fw_user_exec using(private.is_active() and actor_id=private.request_uid());

create function api.guidance_delete(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; thread uuid; removed integer;
begin
 actor:=private.require_identity();if not private.is_active() then raise exception 'AUTH_REQUIRED';end if;
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& array['operation','threadId']) or request-array['operation','threadId']<>'{}'
  or request->>'operation' is distinct from 'delete' or jsonb_typeof(request->'threadId') is distinct from 'string' then raise exception 'VALIDATION_FAILED';end if;
 thread:=(request->>'threadId')::uuid;
 perform private.consume_identity_quota('identity_write');
 perform pg_advisory_xact_lock(hashtextextended(actor::text,2403));
 perform set_config('oryqen.guidance_erase','on',true);
 delete from private.guidance_turns where actor_id=actor and thread_id=thread;
 get diagnostics removed=row_count;
 perform set_config('oryqen.guidance_erase','off',true);
 if removed>0 then insert into private.guidance_deletions(actor_id,thread_id,turn_count) values(actor,thread,removed);end if;
 return jsonb_build_object('threadId',thread,'deleted',removed);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_user_exec;
alter function api.guidance_delete(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function api.guidance_delete(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.guidance_delete(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
