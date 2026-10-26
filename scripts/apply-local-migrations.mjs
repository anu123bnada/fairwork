// Applies any migration files the LOCAL Docker database has not yet recorded, in order, then records each version.
// Local development only: it talks to one fixed container name through `docker exec` and never to a hosted project.
// Usage: node scripts/apply-local-migrations.mjs [--check]   (--check only reports what is pending and exits 1 if anything is)
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const container = 'supabase_db_oryqen-local-dev';
const psql = (sql, extra = []) => spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', ...extra], { input: sql, encoding: 'utf8', windowsHide: true });

const probe = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', container], { encoding: 'utf8', windowsHide: true });
if (probe.status !== 0 || probe.stdout.trim() !== 'true') { console.error(`The local database container ${container} is not running. Start the local stack first.`); process.exit(2); }

const recorded = psql('select version from supabase_migrations.schema_migrations order by version;');
if (recorded.status !== 0) { console.error('Could not read the local migration history.'); process.exit(2); }
const applied = new Set(recorded.stdout.split('\n').map(line => line.trim()).filter(Boolean));
const pending = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()
  .map(name => ({ name, version: name.match(/^([0-9]{12}|[0-9]{14})_/)?.[1] })).filter(item => item.version && !applied.has(item.version));

if (!pending.length) { console.log('Local database is up to date with supabase/migrations.'); process.exit(0); }
if (process.argv.includes('--check')) { console.log(`Pending local migrations: ${pending.map(item => item.name).join(', ')}`); process.exit(1); }
for (const item of pending) {
  const result = psql(readFileSync(`supabase/migrations/${item.name}`, 'utf8'));
  if (result.status !== 0) { console.error(`Migration ${item.name} failed locally: ${result.stderr.split('\n').slice(0, 3).join(' ')}`); process.exit(1); }
  const record = psql(`insert into supabase_migrations.schema_migrations(version) values('${item.version}') on conflict do nothing;`);
  if (record.status !== 0) { console.error(`Could not record ${item.name}.`); process.exit(1); }
  console.log(`Applied locally: ${item.name}`);
}
