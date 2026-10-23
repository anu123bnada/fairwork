// Offline-only package: hashes and SQL text. No connection, export, migration or deployment.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const pins = new Map();
for (const source of ['scripts/prepare-local-development.mjs','scripts/activation-checks.mjs']) {
  for (const [,name,hash] of readFileSync(source,'utf8').matchAll(/\['([0-9]{12}_[a-z0-9_]+\.sql)', '([a-f0-9]{64})'\]/g)) {
    if (pins.has(name) && pins.get(name)!==hash) throw new Error('Conflicting migration pins');
    pins.set(name,hash);
  }
}
const files=readdirSync('supabase/migrations').sort();
if(files.length!==pins.size)throw new Error('Unreviewed migration inventory; update reviewed pins before packaging');
const migrations=files.map((filename,index)=>{
  const bytes=readFileSync(`supabase/migrations/${filename}`),sha256=createHash('sha256').update(bytes).digest('hex');
  if(pins.get(filename)!==sha256)throw new Error(`Migration checksum mismatch: ${filename}`);
  const sql=bytes.toString('utf8');
  return {order:index+1,filename,version:filename.slice(0,12),sha256,
    dependsOn:index?files[index-1].slice(0,12):null,
    reviewFlags:[...new Set(sql.match(/\b(?:drop\s+(?:table|column|constraint|policy|function)|truncate|delete\s+from|create\s+or\s+replace\s+function|alter\s+table)\b/gi)??[])],
    reviewNote:'Keyword inventory is not a safety proof; read full SQL and test the exact restored baseline.'};
});
const directory=`test-results/stage9-release-${Date.now()}`;mkdirSync(directory,{recursive:true});
const versions=migrations.map(m=>`'${m.version}'`).join(',');
const historical=versions.split(',').slice(0,4).join(',');
const common=`
select 'private_rls' as check_name,not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind in ('r','p') and (not c.relrowsecurity or not c.relforcerowsecurity)) as ok;
select 'private_schema_denied' as check_name,not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(name) where has_schema_privilege(r.name,'private','USAGE')) as ok;
select 'api_relations_absent' as check_name,not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='api' and c.relkind in ('r','p','v','m','f')) as ok;
select 'execution_roles_restricted' as check_name,not exists(select 1 from pg_roles where rolname in ('fw_schema_owner','fw_user_exec','fw_policy_exec','fw_authority_exec','fw_review_exec','fw_admin_exec','fw_telemetry_exec') and (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)) as ok;
select 'api_effective_privileges' as check_name,not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE') or (has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from (p.oid not in (coalesce(to_regprocedure('api.authorize_ai_transmission_v1(jsonb)'),0),coalesce(to_regprocedure('api.work_case_command_before_followups(jsonb)'),0),coalesce(to_regprocedure('api.read_work_case_before_access_audit(jsonb)'),0),coalesce(to_regprocedure('api.admin_command_before_organization_controls(jsonb)'),0),coalesce(to_regprocedure('api.admin_read_before_operations(jsonb)'),0),coalesce(to_regprocedure('api.decide_organization_request_before_appeals(jsonb)'),0),coalesce(to_regprocedure('api.list_organization_requests_before_appeals(jsonb)'),0),coalesce(to_regprocedure('api.list_organization_queue_before_appeals(jsonb)'),0),coalesce(to_regprocedure('api.admin_read_before_telemetry(jsonb)'),0),coalesce(to_regprocedure('api.admin_command_before_setting_consumers(jsonb)'),0),coalesce(to_regprocedure('api.admin_read_before_setting_consumers(jsonb)'),0),coalesce(to_regprocedure('api.notifications_before_template(jsonb)'),0)))) or not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'],false))) as ok;
`;
for(const [name,expected] of [['preflight',historical],['postflight',versions]]) {
  writeFileSync(`${directory}/${name}.sql`,`-- READ ONLY. Historical baseline requires owner re-verification. Every ok must be true.\nbegin transaction read only;\nset local statement_timeout='30s';\nselect 'exact_migration_history' as check_name,(select array_agg(version order by version)=array[${expected}] from supabase_migrations.schema_migrations) as ok;\n${common}\nrollback;\n`);
}
writeFileSync(`${directory}/migration-manifest.json`,JSON.stringify({createdAt:new Date().toISOString(),hostedHistory:'NOT REFRESHED; four-version baseline is historical only',migrations},null,2));
writeFileSync(`${directory}/README.txt`,[
  'NO HOSTED EXECUTION AUTHORIZED. All files are preparation only.',
  '1. Owner verifies intended project and fresh applied history. Abort on drift, unknown versions or changed pins.',
  '2. Approve encrypted backup scope/destination. Export consistent snapshot, inventory roles and migration history, verify hashes and isolated restore before changes.',
  '3. Rehearse this exact ordered manifest against the restored baseline. Read full SQL; keyword flags are incomplete.',
  '4. Review and approve the complete migration/environment/HTTPS/Auth package separately. Put writes into maintenance before the approved window.',
  '5. Apply only missing versions in manifest order, one migration at a time. Stop on any error. Use the reviewed migration runner to record history atomically; do not hand-insert version receipts.',
  '6. Postflight catalog checks plus real two-account authorization tests must pass before enabling traffic/registration.',
  '7. On failure, stop writes. Transaction rollback handles uncommitted DDL only; do not run invented down migrations or discard committed records.',
  '8. Prefer a reviewed forward fix. Restoring a backup requires separate explicit approval and reconciliation of writes, grants, withdrawals, disabled accounts and audit history after the snapshot.',
  '9. Revert application only to a tested schema-compatible artifact. Never deploy old code against new authorization assumptions.',
].join('\n')+'\n');
console.log(`PASS: ${migrations.length} pinned migration files verified; preparation only: ${directory}`);
