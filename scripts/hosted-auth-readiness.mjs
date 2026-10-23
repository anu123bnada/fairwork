// Read-only. Never emits credentials, URLs, provider bodies or CLI diagnostics.
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const env = { ...(existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {}), ...process.env };
const names = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'APP_ORIGIN', 'FAIRWORK_DATA_MODE', 'AUTH_REGISTRATION_ENABLED'];
const report = { capturedAt: new Date().toISOString(), mode: process.argv.includes('--network') ? 'read-only-network' : 'local-only', environment: Object.fromEntries(names.map(name => [name, Boolean(env[name])])), localMigrations: readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort().map(name => ({ version: name.split('_')[0], name, sha256: createHash('sha256').update(readFileSync(`supabase/migrations/${name}`)).digest('hex') })), checks: [], remoteMigrations: null };
const check = (name, status, detail) => report.checks.push({ name, status, ...(detail ? { detail } : {}) });
let project;
try { project = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { /* Report shape only. */ }
const valid = project?.protocol === 'https:' && project.hostname.endsWith('.supabase.co') && !project.username && !project.password && project.pathname === '/' && !project.search && !project.hash && /^sb_publishable_[A-Za-z0-9_-]+$/.test(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '');
check('Hosted public configuration shape', valid ? 'PASS' : 'BLOCKED');
const linked = existsSync('supabase/.temp/project-ref') && readFileSync('supabase/.temp/project-ref', 'utf8').trim() === project?.hostname.split('.')[0];
check('Linked project matches configured Auth project', linked ? 'PASS' : 'BLOCKED');
report.projectFingerprint = project ? createHash('sha256').update(project.origin).digest('hex') : null;
check('Registration application flag', env.AUTH_REGISTRATION_ENABLED === 'true' ? 'ENABLED' : 'DISABLED');
check('Synthetic employment-data restriction', env.FAIRWORK_DATA_MODE === 'synthetic' ? 'ENFORCED' : 'BLOCKED');
let app;
try { app = new URL(env.APP_ORIGIN); } catch { /* No output of values. */ }
check('Hosted canonical application origin', app?.protocol === 'https:' && app.origin === env.APP_ORIGIN ? 'PASS' : 'BLOCKED', 'Must be the approved reachable HTTPS Next.js origin, not a static export.');
if (report.mode === 'read-only-network' && valid && linked) {
  for (const [name, path, headers] of [['Auth settings', '/auth/v1/settings', {}], ['API PostgREST schema', '/rest/v1/', { 'Accept-Profile': 'api' }]]) {
    try {
      const response = await fetch(project.origin + path, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ...headers }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      const body = await response.json().catch(() => null);
      check(name, response.ok ? 'REACHABLE' : response.status === 401 || response.status === 403 ? 'REACHABLE_DENIED' : 'BLOCKED', `HTTP ${response.status}`);
      if (name === 'Auth settings' && response.ok) for (const [label, value] of [['Email password provider enabled', body?.external?.email === true], ['Email confirmation required', body?.mailer_autoconfirm === false], ['Anonymous signup disabled', body?.external?.anonymous_users === false], ['Provider registration enabled', body?.disable_signup === false]]) check(label, value ? 'PASS' : 'BLOCKED');
      if (name === 'API PostgREST schema') check('Authenticated RPC catalog', 'UNVERIFIED', 'Anonymous gateway status does not prove the authenticated RPC inventory or migrations.');
    } catch { check(name, 'BLOCKED', 'Network request failed; no response data logged.'); }
  }
  if (process.argv.includes('--migration-list')) {
    const executable = 'node_modules/@supabase/cli-windows-x64/bin/supabase.exe';
    if (existsSync(executable)) {
      const result = spawnSync(executable, ['migration', 'list', '--linked', '--output-format', 'json'], { env, encoding: 'utf8', timeout: 30000, input: '', windowsHide: true });
      if (result.status === 0) {
        let inventory;
        try { inventory = JSON.parse(result.stdout); } catch { /* Never print raw CLI output. */ }
        const versions = Array.isArray(inventory?.migrations) ? inventory.migrations.map(row => row.remote).filter(version => typeof version === 'string' && /^\d{12,14}$/.test(version)) : [];
        if (versions.length) {
          report.remoteMigrations = versions;
          report.missingHostedVersions = report.localMigrations.map(row => row.version).filter(version => !versions.includes(version));
          report.unexpectedHostedVersions = versions.filter(version => !report.localMigrations.some(row => row.version === version));
          check('Hosted migration history', report.missingHostedVersions.length || report.unexpectedHostedVersions.length ? 'BLOCKED' : 'PASS');
        } else check('Hosted migration history', 'UNVERIFIED', 'CLI output did not yield an inventory.');
      } else check('Hosted migration history', 'BLOCKED', 'Read-only CLI could not authenticate or complete. Diagnostics suppressed to protect credentials.');
    } else check('Hosted migration history', 'BLOCKED', 'Supabase CLI executable unavailable.');
  } else check('Hosted migration history', 'UNVERIFIED');
}
mkdirSync('test-results', { recursive: true });
const output = `test-results/hosted-auth-readiness-${Date.now()}.json`;
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: output, ...report }, null, 2));
