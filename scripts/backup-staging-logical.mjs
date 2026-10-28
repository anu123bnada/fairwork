// Usage: node scripts/backup-staging-logical.mjs   (Docker-free logical backup of the LINKED Supabase project; writes git-ignored backups/staging-logical-<time>/)
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Docker-free logical backup of the linked STAGING project through the Supabase CLI's management-API query path.
// All table data is read in ONE statement (one snapshot), written to a git-ignored folder; nothing from it is printed except per-table row counts.
const query = sql => {
  mkdirSync('.tmp', { recursive: true }); writeFileSync('.tmp/q.sql', sql);
  const r = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '--file', '.tmp/q.sql'], { encoding: 'utf8', shell: true, maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('query failed: ' + ((r.stdout || '') + (r.stderr || '')).replace(/Initialising login role...s*/, '').slice(0, 400));
  const text = r.stdout; const j = JSON.parse(text.slice(text.indexOf('{')));
  return j.rows;
};
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-') + 'Z';
const dir = `backups/staging-logical-${stamp}`; mkdirSync(dir, { recursive: true });
const tables = query("select n.nspname s, c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('auth','private','storage','supabase_migrations') order by 1,2");
const parts = tables.map(({ s, t }) => `'${s}.${t}', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from ${JSON.stringify(s).replace(/"/g, '')}."${t}" x)`);
const snapshot = query(`select now() as taken_at, current_setting('server_version') as server_version, ${Array.from({ length: Math.ceil(parts.length / 40) }, (_, i) => `jsonb_build_object(${parts.slice(i * 40, i * 40 + 40).join(',')})`).join(' || ')} as data`)[0];
const counts = Object.fromEntries(Object.entries(snapshot.data).map(([k, v]) => [k, v.length]));
const catalog = query(`select jsonb_build_object(
  'functions', (select coalesce(jsonb_agg(jsonb_build_object('name', p.oid::regprocedure::text, 'owner', pg_get_userbyid(p.proowner), 'secdef', p.prosecdef, 'def', pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text), '[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private','public')),
  'policies', (select coalesce(jsonb_agg(to_jsonb(x) order by schemaname, tablename, policyname), '[]') from pg_policies x where schemaname in ('private','public','storage')),
  'columns', (select coalesce(jsonb_agg(to_jsonb(c) order by table_schema, table_name, ordinal_position), '[]') from information_schema.columns c where table_schema in ('private','public','auth','storage')),
  'rls', (select coalesce(jsonb_agg(jsonb_build_object('table', n.nspname||'.'||c.relname, 'enabled', c.relrowsecurity, 'forced', c.relforcerowsecurity)), '[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('private','public')),
  'grants', (select coalesce(jsonb_agg(to_jsonb(g)), '[]') from information_schema.role_table_grants g where table_schema in ('private','public'))) as catalog`)[0].catalog;
writeFileSync(`${dir}/data.json`, JSON.stringify({ takenAt: snapshot.taken_at, serverVersion: snapshot.server_version, tables: snapshot.data }));
writeFileSync(`${dir}/catalog.json`, JSON.stringify(catalog));
writeFileSync(`${dir}/row-counts.json`, JSON.stringify({ takenAt: snapshot.taken_at, counts }, null, 1));
const migrations = readdirSync('supabase/migrations').sort(); const lines = [];
for (const m of migrations) lines.push(`${createHash('sha256').update(readFileSync(`supabase/migrations/${m}`)).digest('hex')}  migrations/${m}`);
for (const f of ['data.json', 'catalog.json', 'row-counts.json']) lines.push(`${createHash('sha256').update(readFileSync(`${dir}/${f}`)).digest('hex')}  ${f}`);
writeFileSync(`${dir}/SHA256SUMS.txt`, lines.join('\n') + '\n');
writeFileSync('.tmp/last-logical-backup.txt', dir);
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`folder: ${dir}\ntaken_at: ${snapshot.taken_at}  server ${snapshot.server_version}\ntables: ${tables.length}, rows: ${total}`);
for (const s of ['auth', 'private', 'storage', 'supabase_migrations']) { const rows = Object.entries(counts).filter(([k]) => k.startsWith(s + '.')); console.log(`${s}: ${rows.length} tables, ${rows.reduce((a, [, v]) => a + v, 0)} rows`); }
console.log('non-empty:', Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(' '));
