begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Every export of administrative records is written to the same immutable administrative audit trail as any other administrative action (module 10).
-- The entry records who exported which resource, how many records, whether the export was complete, which filter names were used and the checksum of the
-- exported items. It never contains the exported records. The administrator's screen asks for this entry before it hands the file over, so an export that
-- could not be recorded is not delivered.
-- Read-only roles (auditor) may export, so they must be able to leave this one kind of entry; they still cannot write any other audit entry.
create policy admin_export_insert on private.admin_audit for insert to fw_admin_exec with check(action='export' and actor_id=private.request_uid() and private.admin_role() is not null);
create function api.admin_export_log(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; keys text[]:=array['exportId','resource','count','complete','checksum','filterNames']; export_id uuid; entry_resource text; total integer; names jsonb; prior uuid;
begin
 perform private.require_admin(true);actor:=private.request_uid();
 if request is null or jsonb_typeof(request)<>'object' or not(request ?& keys) or request-keys<>'{}'
  or jsonb_typeof(request->'exportId') is distinct from 'string' or jsonb_typeof(request->'resource') is distinct from 'string' or jsonb_typeof(request->'count') is distinct from 'number'
  or jsonb_typeof(request->'complete') is distinct from 'boolean' or jsonb_typeof(request->'checksum') is distinct from 'string' or jsonb_typeof(request->'filterNames') is distinct from 'array'
  or request->>'checksum' !~ '^[0-9a-f]{64}$'
  or request->>'resource' not in ('dashboard','search','users','organizations','requests','offers','agreements','work','shares','cases','privacy','ai','roles','settings','incidents','evidence_access','audit','telemetry')
  or jsonb_array_length(request->'filterNames')>8
  or exists(select 1 from jsonb_array_elements(request->'filterNames') f where jsonb_typeof(f)<>'string' or (f#>>'{}') !~ '^[A-Za-z]{1,30}$') then raise exception 'VALIDATION_FAILED';end if;
 if (request->>'count') !~ '^[0-9]{1,6}$' then raise exception 'VALIDATION_FAILED';end if;
 export_id:=(request->>'exportId')::uuid;entry_resource:=request->>'resource';total:=(request->>'count')::integer;names:=request->'filterNames';
 perform pg_advisory_xact_lock(hashtextextended(actor::text,2817));
 select id into prior from private.admin_audit where actor_id=actor and action='export' and changes->>'exportId'=export_id::text;
 if found then return jsonb_build_object('exportId',export_id,'recorded',true,'replayed',true);end if;
 insert into private.admin_audit(actor_id,action,target_id,revision,reason,changes)
  values(actor,'export',actor,1,'Exported '||entry_resource||' records',
   jsonb_build_object('exportId',export_id,'resource',entry_resource,'count',total,'complete',(request->>'complete')::boolean,'checksum',request->>'checksum','filterNames',names));
 return jsonb_build_object('exportId',export_id,'recorded',true,'replayed',false);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
grant create on schema api to fw_admin_exec;
alter function api.admin_export_log(jsonb) owner to fw_admin_exec;
revoke create on schema api from fw_admin_exec;
revoke all on function api.admin_export_log(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.admin_export_log(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
