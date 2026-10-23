begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Existing applied migrations stay unchanged. Blank configuration keeps defaults.
create function private.incident_categories() returns text[] language sql set search_path='' as $$
 select coalesce((select string_to_array(value#>>'{}',',') from private.admin_settings
 where key='support_categories' and value#>>'{}' ~ '^(security|support|moderation)(,(security|support|moderation)){0,2}$'),array['security','support','moderation'])
$$;
alter function api.admin_command(jsonb) rename to admin_command_before_setting_consumers;
revoke all on function api.admin_command_before_setting_consumers(jsonb) from public,anon,authenticated,service_role;
create function api.admin_command(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(10202026);
 perform private.require_admin(true);
 -- Let the original receipt verify identical retries even after settings change.
 if exists(select 1 from private.admin_receipts where actor_id=private.request_uid() and idempotency_key=(request->>'idempotencyKey')::uuid) then
  return api.admin_command_before_setting_consumers(request);
 end if;
 if request->>'operation'='setting' and request->>'key'='support_categories' then
  if jsonb_typeof(request->'value') is distinct from 'string' or
   (request->>'value'<>'' and request->>'value' !~ '^(security|support|moderation)(,(security|support|moderation)){0,2}$') then raise exception 'VALIDATION_FAILED';end if;
 end if;
 if request->>'operation'='setting' and request->>'key'='notification_template' then
  if jsonb_typeof(request->'value') is distinct from 'string' or (request->>'value'<>'' and
   (strpos(request->>'value','{title}')=0 or replace(request->>'value','{title}','') ~ '[{}]')) then raise exception 'VALIDATION_FAILED';end if;
 end if;
 if request->>'operation'='incident' and not (request->>'category'=any(private.incident_categories())) and
  not exists(select 1 from private.admin_incidents where id=(request->>'targetId')::uuid and category=request->>'category') then raise exception 'VALIDATION_FAILED';end if;
 return api.admin_command_before_setting_consumers(request);
exception when invalid_text_representation then raise exception 'VALIDATION_FAILED';end $$;
alter function api.admin_read(jsonb) rename to admin_read_before_setting_consumers;
revoke all on function api.admin_read_before_setting_consumers(jsonb) from public,anon,authenticated,service_role;
create function api.admin_read(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=api.admin_read_before_setting_consumers(request);
 if request->>'resource'='incidents' then result:=result||jsonb_build_object('incidentCategories',private.incident_categories());end if;
 return result;
end $$;
grant select(key,value) on private.admin_settings to fw_user_exec;
create policy notification_template_read on private.admin_settings for select to fw_user_exec using(key='notification_template' and private.is_active());
alter function api.notifications(jsonb) rename to notifications_before_template;
revoke all on function api.notifications_before_template(jsonb) from public,anon,authenticated,service_role;
create function api.notifications(request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; template text;
begin
 result:=api.notifications_before_template(request);
 if request->>'operation'='list' then
  select value#>>'{}' into template from private.admin_settings where key='notification_template';
  -- Unreviewed historical drafts are ignored until a valid template is saved.
  if template<>'' and strpos(template,'{title}')>0 and replace(template,'{title}','') !~ '[{}]' then
   result:=jsonb_set(result,'{items}',coalesce((select jsonb_agg(item||jsonb_build_object('message',replace(template,'{title}',item->>'title')) order by ordinal)
    from jsonb_array_elements(result->'items') with ordinality as rows(item,ordinal)),'[]'::jsonb));
  end if;
 end if;return result;
end $$;
grant create on schema private,api to fw_admin_exec;
alter function private.incident_categories() owner to fw_admin_exec;
alter function api.admin_command(jsonb) owner to fw_admin_exec;
alter function api.admin_read(jsonb) owner to fw_admin_exec;
revoke create on schema private,api from fw_admin_exec;
grant create on schema api to fw_user_exec;
alter function api.notifications(jsonb) owner to fw_user_exec;
revoke create on schema api from fw_user_exec;
revoke all on function private.incident_categories(),api.admin_command(jsonb),api.admin_read(jsonb),api.notifications(jsonb) from public,anon,authenticated,service_role;
grant execute on function api.admin_command(jsonb),api.admin_read(jsonb),api.notifications(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
