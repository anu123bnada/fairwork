-- Metadata/aggregate sizing only. No individual rows or secret values exported.
begin transaction read only;
set local statement_timeout = '15s';
select current_setting('server_version_num')::integer as server_version_num,
       pg_database_size(current_database()) as database_bytes,
       (select coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where c.relkind in ('r', 'm')
           and n.nspname not in ('pg_catalog', 'information_schema')
           and n.nspname not like 'pg_toast%') as non_system_relation_bytes,
       (select count(*) from auth.users) as auth_users,
       (select count(*) from auth.mfa_factors) as auth_mfa_factors,
       (select count(*) from storage.buckets) as storage_buckets,
       (select count(*) from storage.objects) as storage_objects,
       (select count(*) from vault.secrets) as vault_secrets;
rollback;
