// Generates read-only stage assertions. Never connects to or mutates a database.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const pending = [
  ['202610100001_day3_offer_agreement.sql', 'effcd3fe1aabca632f86f383c972a3d44efa4459a6de8c41ed6dafda365b62d6'],
  ['202610120001_agreement_participant_read.sql', '482e92b957020a87ef65b41574f5be8279e710a0b82f7edb5acd102b2f1d1c2b'],
  ['202610140001_versioned_agreements.sql', 'c8833649e89c7b15e4073404fb71226b7e0b123f7679d94a6b8ffd7d047527ce'],
  ['202610140002_work_records.sql', '75e2dc2b1cb84068c9525bcb27f267ce253fe88fa0d321b12160d2389843b10d'],
  ['202610140003_work_integrity_passport.sql', 'f24bae17ea2dc1a1308f4aa3d15125f41bab5afe21b5fafeedbf1a805f71ad6b'],
  ['202610150001_work_case_review.sql', '84051535c9108b9fb388e6b6190ef73181e484a5030ebb897186eaa8e9be2629'],
];
const foundation = ['202610070001','202610080002','202610090001','202610090002'];
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const array = values => `array[${values.map(quote).join(',')}]::text[]`;
export function constraintSQL(stage, rows) {
  const allowed = ['audit_logs_action_check','audit_logs_reason_code_check','rate_limit_buckets_operation_check', ...(stage >= 4 ? ['work_record_versions_state_check'] : [])];
  if (!Number.isInteger(stage) || stage < 0 || stage > 6 || rows.length !== allowed.length || new Set(rows.map(r=>r.name)).size !== allowed.length || rows.some(r=>!allowed.includes(r.name)||!/^[0-9a-f]{64}$/.test(r.hash))) throw new Error('Invalid constraint baseline');
  const values=rows.map(c=>`('${c.name}','${c.hash}')`).join(',\n');
  return `-- Read-only comparison with the constrained local PostgreSQL rehearsal, stage ${stage}.\nbegin transaction read only;\nset local statement_timeout='30s';\nwith expected(name,hash) as (values ${values}) select e.name as check_name, case when c.convalidated and encode(sha256(convert_to(pg_get_constraintdef(c.oid),'UTF8')),'hex')=e.hash then 'PASS' else 'FAIL' end as result from expected e left join pg_constraint c on c.conname=e.name and c.connamespace='private'::regnamespace order by e.name;\nrollback;\n`;
}
export function inventory() {
  return pending.map(([name, expectedSha256]) => {
    const bytes = readFileSync(`supabase/migrations/${name}`), sql = bytes.toString('utf8');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== expectedSha256) throw new Error(`STOP: reviewed migration hash changed: ${name}`);
    return { name, version: name.split('_')[0], sha256,
      tables: [...sql.matchAll(/create table private\.(\w+)/gi)].map(m => m[1]),
      functions: [...sql.matchAll(/create(?: or replace)? function ((?:api|private)\.\w+)/gi)].map(m => m[1]),
      policies: [...sql.matchAll(/create policy (\w+) on private\.(\w+)/gi)].map(m => ({ name: m[1], table: m[2] })),
      // Literal declarations only; dynamic DO-block policies/triggers remain in the reviewed SQL.
      indexes: [...sql.matchAll(/create (?:unique )?index (\w+)/gi)].map(m => m[1]),
    };
  });
}

export function stageSQL(stage, { history = true } = {}) {
  if (!Number.isInteger(stage) || stage < 0 || stage > 6) throw new Error('Stage must be 0..6');
  const items = inventory(), applied = items.slice(0, stage);
  const tables = applied.flatMap(m => m.tables), future = items.slice(stage).flatMap(m => m.tables);
  const apis = [...new Set(applied.flatMap(m => m.functions).filter(f => f.startsWith('api.')).map(f => f.slice(4)))];
  const checks = [];
  const add = (name, expression) => checks.push(`select ${quote(name)} as check_name, (${expression}) as ok`);
  if (history) add('exact migration history', `(select coalesce(array_agg(version order by version),array[]::text[]) = ${array([...foundation, ...applied.map(m => m.version)])} from supabase_migrations.schema_migrations)`);
  add('future tables absent', `not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname=any(${array(future)}))`);
  const existingFunctions = new Set(applied.flatMap(m => m.functions));
  const futureFunctions = [...new Set(items.slice(stage).flatMap(m => m.functions))].filter(f => !existingFunctions.has(f));
  add('future function names absent', `not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname=any(${array(futureFunctions)}))`);
  if (stage < 6) add('review role absent and migration identity can create it', `not exists(select 1 from pg_roles where rolname='fw_review_exec') and (select rolcreaterole or rolsuper from pg_roles where rolname=current_user)`);
  add('private schema denied to clients', `not exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(name) where has_schema_privilege(r.name,'private','USAGE'))`);
  add('API schema exposes no relations', `not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='api' and c.relkind in ('r','p','v','m','f'))`);
  add('restricted execution roles', `(select count(*)=${stage === 6 ? 5 : 4} and bool_and(not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb) from pg_roles where rolname=any(${array(['fw_schema_owner','fw_user_exec','fw_policy_exec','fw_authority_exec', ...(stage === 6 ? ['fw_review_exec'] : [])])}))`);
  add('temporary schema CREATE revoked', `not exists(select 1 from pg_roles r cross join (values('api'),('private')) s(name) where r.rolname in ('fw_user_exec','fw_policy_exec','fw_authority_exec','fw_review_exec') and has_schema_privilege(r.oid,s.name,'CREATE'))`);
  add('all private constraints validated', `not exists(select 1 from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='private' and not c.convalidated)`);
  add('all private indexes valid and ready', `not exists(select 1 from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and (not i.indisvalid or not i.indisready))`);
  add('private user triggers enabled', `not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and not t.tgisinternal and t.tgenabled <> 'O')`);
  if (tables.length) {
    add('cumulative new tables FORCE RLS and owned', `(select count(*)=${tables.length} and bool_and(c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity and pg_get_userbyid(c.relowner)='fw_schema_owner') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname=any(${array(tables)}))`);
    add('no client table or column privileges', `not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values('anon'),('authenticated'),('service_role')) r(name) where n.nspname='private' and c.relname=any(${array(tables)}) and (has_table_privilege(r.name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(r.name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))`);
    add('new tables have RLS policies', `not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname=any(${array(tables)}) and not exists(select 1 from pg_policy p where p.polrelid=c.oid))`);
  }
  if (apis.length) add('expected RPCs secured and granted only to authenticated clients', `(select count(*)=${apis.length} and bool_and(p.prosecdef and p.proconfig @> array['search_path=""'] and pg_get_userbyid(p.proowner)=case when p.proname in ('work_case_command','read_work_case','list_work_cases') then 'fw_review_exec' else 'fw_user_exec' end and has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('service_role',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname=any(${array(apis)}) and pg_get_function_identity_arguments(p.oid) in ('payload jsonb','request jsonb'))`);
  if (stage >= 5) add('old work entrypoints private and client denied', `to_regprocedure('private.work_command_day5(jsonb)') is not null and to_regprocedure('private.read_work_day5(jsonb)') is not null and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join (values('anon'),('authenticated'),('service_role')) r(name) where n.nspname='private' and p.proname in ('work_command_day5','read_work_day5','work_command_day6','passport_eligible','passport_eligible_day6') and has_function_privilege(r.name,p.oid,'EXECUTE'))`);
  if (stage === 6) {
    add('case suppression wrapper and prior eligibility retained', `to_regprocedure('private.passport_eligible_day6(uuid,integer)') is not null and to_regprocedure('private.work_command_day6(jsonb)') is not null and position('passport_eligible_day6' in pg_get_functiondef(to_regprocedure('private.passport_eligible(uuid,integer)'))) > 0 and position('work_case_blocked' in pg_get_functiondef(to_regprocedure('private.passport_eligible(uuid,integer)'))) > 0 and position('work_case_blocked' in pg_get_functiondef(to_regprocedure('api.work_command(jsonb)'))) > 0`);
    add('case history immutable triggers present', `(select count(*)=3 from pg_trigger where tgname in ('case_event_immutable','case_receipt_immutable','case_resolution_immutable') and tgenabled='O')`);
  }
  return `-- Reviewed activation stage ${stage}. Read-only assertions; every result must be PASS.\nbegin transaction read only;\nset local statement_timeout='30s';\nset local lock_timeout='5s';\nwith checks as (\n${checks.join('\nunion all\n')}\n) select check_name, case when ok is true then 'PASS' else 'FAIL' end as result from checks order by check_name;\nrollback;\n`;
}
