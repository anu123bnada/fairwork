// Applies the migrations that the linked STAGING project has not recorded yet, one at a time, then records each version.
// Owner-run: it writes to the shared staging database. Guards: the linked project must be `oryqen-staging`, and a logical backup from the last 24 hours must exist
// (node scripts/backup-staging-logical.mjs). Each migration file is one transaction, so a failure leaves nothing half-applied; the script stops at the first failure.
//   node scripts/apply-staging-migrations.mjs            apply what is pending
//   node scripts/apply-staging-migrations.mjs --check    only list what is pending
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';

const run = args => spawnSync('npx', ['supabase', ...args], { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
const query = sql => { mkdirSync('.tmp', { recursive: true }); writeFileSync('.tmp/staging-q.sql', sql); return run(['db', 'query', '--linked', '--file', '.tmp/staging-q.sql']); };
const fail = message => { console.error(message); process.exit(1); };

const linked = JSON.parse(readFileSync('supabase/.temp/linked-project.json', 'utf8'));
if (linked.name !== 'oryqen-staging') fail(`Refusing: the linked project is "${linked.name}", not oryqen-staging.`);

const backups = existsSync('backups') ? readdirSync('backups').filter(name => name.startsWith('staging-logical-')) : [];
const fresh = backups.some(name => Date.now() - statSync(`backups/${name}`).mtimeMs < 24 * 3600 * 1000);
if (!fresh && !process.argv.includes('--check')) fail('Refusing: no staging backup from the last 24 hours. Run node scripts/backup-staging-logical.mjs first.');

const read = query('select version from supabase_migrations.schema_migrations order by version;');
if (read.status !== 0) fail('Could not read the staging migration history. Are you logged in to the Supabase CLI?');
const applied = new Set([...read.stdout.matchAll(/"version":\s*"([0-9]+)"/g)].map(match => match[1]));
const pending = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()
  .map(name => ({ name, version: name.match(/^([0-9]{12}|[0-9]{14})_/)?.[1] })).filter(item => item.version && !applied.has(item.version));

if (!pending.length) { console.log('Staging is up to date with supabase/migrations.'); process.exit(0); }
console.log(`Pending on staging: ${pending.map(item => item.name).join(', ')}`);
if (process.argv.includes('--check')) process.exit(1);

for (const item of pending) {
  const result = run(['db', 'query', '--linked', '--file', `supabase/migrations/${item.name}`]);
  if (result.status !== 0) fail(`Migration ${item.name} failed on staging and was rolled back: ${(result.stderr || result.stdout).split('\n').filter(line => !/deprecat|trace-dep|new version|recommend updating/i.test(line)).slice(0, 4).join(' ')}`);
  const record = query(`insert into supabase_migrations.schema_migrations(version) values('${item.version}') on conflict do nothing;`);
  if (record.status !== 0) fail(`Applied ${item.name} but could not record its version; record it by hand before running this again.`);
  console.log(`Applied on staging: ${item.name}`);
}
console.log('Done. Verify with: node scripts/verify-hosted-staging.mjs https://oryqen-staging.vercel.app');
