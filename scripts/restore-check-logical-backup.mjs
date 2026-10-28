// Usage: node scripts/restore-check-logical-backup.mjs   (reads the folder named in .tmp/last-logical-backup.txt, written by backup-staging-logical.mjs)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

// Restore rehearsal for the Docker-free logical backup: rebuild the schema from the 51 applied migrations in a scratch database, load the backup's private.* rows,
// and prove every restored row equals the snapshot row (jsonb equality), not merely the count. Nothing is printed except counts. Auth data is checked for the
// users that private rows reference (a bare Postgres has no GoTrue, so full auth restore is not rehearsed).
const dir = readFileSync('.tmp/last-logical-backup.txt', 'utf8').trim();
const backup = JSON.parse(readFileSync(`${dir}/data.json`, 'utf8'));
const db = new PGlite();
await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
const applied = new Set(backup.tables['supabase_migrations.schema_migrations'].map(r => r.version));
const files = readdirSync('supabase/migrations').sort().filter(f => applied.has(f.split('_')[0]));
for (const f of files) await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
console.log(`schema rebuilt from ${files.length} migrations (backup lists ${applied.size} applied)`);
for (const u of backup.tables['auth.users']) await db.query('insert into auth.users(id) values($1)', [u.id]);
await db.exec('set session_replication_role = replica');
let tables = 0, rows = 0, mismatched = [];
for (const [name, data] of Object.entries(backup.tables)) {
  if (!name.startsWith('private.')) continue;
  tables++;
  await db.exec(`truncate ${name} cascade`);
  if (data.length) await db.query(`insert into ${name} select * from jsonb_populate_recordset(null::${name}, $1::jsonb)`, [JSON.stringify(data)]);
  const back = (await db.query(`select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) j from ${name} x`)).rows[0].j;
  const ts = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(\.\d+)?(Z|[+-]\d\d(?::?\d\d)?)?$/;
  const instant = m => { const tz = m[4] ?? 'Z'; const zone = tz === 'Z' ? 'Z' : /^[+-]\d\d$/.test(tz) ? `${tz}:00` : /^[+-]\d\d\d\d$/.test(tz) ? `${tz.slice(0, 3)}:${tz.slice(3)}` : tz; return `${Date.parse(`${m[1]}T${m[2]}${zone}`)}${(m[3] ?? '').replace(/0+$/, '').replace(/^\.$/, '')}`; };
  const canon = v => typeof v === 'string' ? (ts.test(v) ? instant(v.match(ts)) : v) : Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1).map(([k, x]) => [k, canon(x)])) : v;
  const norm = list => JSON.stringify(list.map(r => JSON.stringify(canon(r))).sort());
  rows += data.length;
  const same = back.length === data.length && norm(back.map(r => r)) === norm(data.map(r => r));
  if (!same) { const shapes = new Set(); for (const row of data) for (const k of Object.keys(row)) { const hit = back.some(b => JSON.stringify(canon(b[k])) === JSON.stringify(canon(row[k]))); if (!hit) shapes.add(`${k}:${typeof row[k]}:${String(row[k]).replace(/[0-9]/g, '9').replace(/[a-f]/gi, 'x').slice(0, 40)}|restored:${String(back[0]?.[k]).replace(/[0-9]/g, '9').replace(/[a-f]/gi, 'x').slice(0, 40)}`); } console.log(`  ${name}: ${[...shapes].slice(0, 4).join(' ;; ')}`); }
  if (!same) mismatched.push(`${name} (${data.length} backed up, ${back.length} restored)`);
}
console.log(`private tables restored: ${tables}, rows restored: ${rows}, tables whose restored rows differ from the snapshot: ${mismatched.length}`);
mismatched.forEach(m => console.log('  ' + m));
await db.close();
