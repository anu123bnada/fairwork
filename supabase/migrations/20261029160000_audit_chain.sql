begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Cross-record audit integrity (module 10). Every row written to either audit table (private.audit_logs and private.admin_audit) is appended, in one global order, to a hash chain:
-- chain_hash = sha256(previous chain_hash : source : source id : sha256(row as jsonb text)). Existing rows are chained first, oldest first. The chain table is append-only and
-- unreadable by ordinary roles. An administrator (MFA) can ask for a verification that recomputes every link and every source row hash and counts source rows that never reached
-- the chain; any edit, deletion or silent insertion in either audit table, or any edit to the chain itself, makes the answer not ok. This detects tampering after the fact; it
-- does not prevent a database superuser from rewriting both a row and the chain, which is why the head hash is returned for off-database anchoring.
create table private.audit_chain (
 seq bigint generated always as identity primary key,
 source text not null check(source in ('audit_logs','admin_audit')),
 source_id uuid not null,
 record_hash text not null check(record_hash ~ '^[0-9a-f]{64}$'),
 prev_hash text not null check(prev_hash ~ '^[0-9a-f]{64}$'),
 chain_hash text not null check(chain_hash ~ '^[0-9a-f]{64}$'),
 chained_at timestamptz not null default clock_timestamp(),
 unique(source,source_id)
);
alter table private.audit_chain owner to fw_schema_owner;
alter table private.audit_chain enable row level security;alter table private.audit_chain force row level security;
revoke all on private.audit_chain from public,anon,authenticated,service_role;
create policy audit_chain_owner_rw on private.audit_chain for all to fw_schema_owner using(true) with check(true);
create policy audit_logs_chain_owner_read on private.audit_logs for select to fw_schema_owner using(true);
create policy admin_audit_chain_owner_read on private.admin_audit for select to fw_schema_owner using(true);
create trigger audit_chain_immutable before update or delete on private.audit_chain for each row execute function private.day3_reject_history_mutation();

create function private.audit_chain_hash(source text,source_id uuid,record_hash text,prev text) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(prev||':'||source||':'||source_id::text||':'||record_hash,'UTF8')),'hex');
$$;
create function private.audit_chain_append() returns trigger language plpgsql security definer set search_path='' as $$
declare prev text; rh text; src text:=tg_argv[0];
begin
 perform pg_advisory_xact_lock(hashtextextended('oryqen.audit_chain',1));
 select c.chain_hash into prev from private.audit_chain c order by c.seq desc limit 1;prev:=coalesce(prev,repeat('0',64));
 rh:=encode(sha256(convert_to(to_jsonb(new)::text,'UTF8')),'hex');
 insert into private.audit_chain(source,source_id,record_hash,prev_hash,chain_hash) values(src,new.id,rh,prev,private.audit_chain_hash(src,new.id,rh,prev));
 return null;
end $$;
create function private.audit_chain_verify() returns jsonb language plpgsql security definer set search_path='' as $$
declare expected_prev text:=repeat('0',64); r record; rec jsonb; first_bad bigint; total bigint:=0; bad_links bigint:=0; bad_records bigint:=0; missing bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('oryqen.audit_chain',1));
 for r in select * from private.audit_chain order by seq loop
  total:=total+1;
  if r.prev_hash<>expected_prev or r.chain_hash<>private.audit_chain_hash(r.source,r.source_id,r.record_hash,r.prev_hash) then bad_links:=bad_links+1;first_bad:=coalesce(first_bad,r.seq);end if;
  if r.source='audit_logs' then select to_jsonb(a) into rec from private.audit_logs a where a.id=r.source_id; else select to_jsonb(b) into rec from private.admin_audit b where b.id=r.source_id; end if;
  if rec is null or encode(sha256(convert_to(rec::text,'UTF8')),'hex')<>r.record_hash then bad_records:=bad_records+1;first_bad:=coalesce(first_bad,r.seq);end if;
  expected_prev:=r.chain_hash;
 end loop;
 select (select count(*) from private.audit_logs a where not exists(select 1 from private.audit_chain c where c.source='audit_logs' and c.source_id=a.id))
  +(select count(*) from private.admin_audit b where not exists(select 1 from private.audit_chain c where c.source='admin_audit' and c.source_id=b.id)) into missing;
 return jsonb_build_object('checked',total,'ok',bad_links=0 and bad_records=0 and missing=0,'brokenLinks',bad_links,'alteredOrDeletedRecords',bad_records,'recordsNotInChain',missing,'firstProblemSeq',first_bad,'head',case when total=0 then null else expected_prev end);
end $$;
grant create on schema private to fw_schema_owner;
alter function private.audit_chain_hash(text,uuid,text,text) owner to fw_schema_owner;
alter function private.audit_chain_append() owner to fw_schema_owner;
alter function private.audit_chain_verify() owner to fw_schema_owner;
revoke create on schema private from fw_schema_owner;
revoke all on function private.audit_chain_hash(text,uuid,text,text),private.audit_chain_append(),private.audit_chain_verify() from public,anon,authenticated,service_role;
grant execute on function private.audit_chain_verify() to fw_admin_exec;

-- Chain what already exists, oldest first, then start chaining new rows.
do $$ declare r record; prev text:=repeat('0',64); rh text; ch text;
begin
 for r in select src,id,rec from (select 'audit_logs' src,a.id,to_jsonb(a) rec,a.db_time ts from private.audit_logs a union all select 'admin_audit',b.id,to_jsonb(b),b.created_at from private.admin_audit b) x order by ts,id loop
  rh:=encode(sha256(convert_to(r.rec::text,'UTF8')),'hex');ch:=private.audit_chain_hash(r.src,r.id,rh,prev);
  insert into private.audit_chain(source,source_id,record_hash,prev_hash,chain_hash) values(r.src,r.id,rh,prev,ch);prev:=ch;
 end loop;
end $$;
create trigger audit_chain_audit_logs after insert on private.audit_logs for each row execute function private.audit_chain_append('audit_logs');
create trigger audit_chain_admin_audit after insert on private.admin_audit for each row execute function private.audit_chain_append('admin_audit');

create function api.audit_chain_verify(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin(false);
 if request is null or request<>'{}'::jsonb then raise exception 'VALIDATION_FAILED';end if;
 return private.audit_chain_verify();
end $$;
grant create on schema api to fw_admin_exec;
alter function api.audit_chain_verify(jsonb) owner to fw_admin_exec;
revoke create on schema api from fw_admin_exec;
revoke all on function api.audit_chain_verify(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.audit_chain_verify(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
