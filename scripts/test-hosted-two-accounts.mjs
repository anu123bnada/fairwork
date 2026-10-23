// Default is a network-free plan. NEVER execute writes without explicit approval.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { twoAccountFlow } from './hosted-two-account-flow.mjs';

const plan = ['Confirm all ten migration versions and catalog/RLS checks', 'Approve canonical HTTPS origin, email delivery/template and signup settings', 'Register two distinct real email accounts and confirm each through its own inbox', 'Create separate profiles; sign out/in; verify cookies survive reload', 'Authorized operator independently provisions synthetic company/membership (outside this script)', 'Create offer; propose agreement; acknowledge and confirm independently', 'Create work record; submit; deny self-verification; employer verifies exact revision', 'Read private eligible Passport; deny owner injection; sign out and confirm access denial'];
if (!process.argv.includes('--execute-approved-hosted-writes')) {
  console.log(JSON.stringify({ status: 'PLAN_ONLY_NO_NETWORK_NO_WRITES', plan }, null, 2));
  process.exit(0);
}
if (!process.stdin.isTTY || process.env.DEBUG || process.env.PWDEBUG || process.env.NODE_DEBUG || process.env.NODE_OPTIONS) throw new Error('Clean interactive terminal required.');
const env = { ...parseEnv(readFileSync('.env.local', 'utf8')), ...process.env };
const origin = env.APP_ORIGIN;
const project = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if (!origin || new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin || project.protocol !== 'https:' || !project.hostname.endsWith('.supabase.co') || readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== project.hostname.split('.')[0] || env.FAIRWORK_DATA_MODE !== 'synthetic' || env.AUTH_REGISTRATION_ENABLED !== 'true') throw new Error('Approved HTTPS origin, linked project, synthetic data and enabled registration are required.');
const readinessPath = process.argv.find(arg => arg.startsWith('--readiness='))?.slice(12);
if (!readinessPath) throw new Error('Fresh read-only readiness report required.');
const readiness = JSON.parse(readFileSync(readinessPath, 'utf8'));
const age = Date.now() - Date.parse(readiness.capturedAt);
if (!(age >= 0 && age < 3600000) || readiness.projectFingerprint !== createHash('sha256').update(project.origin).digest('hex') ||
    readiness.missingHostedVersions?.length !== 0 || readiness.unexpectedHostedVersions?.length !== 0 ||
    !['Hosted migration history', 'Email confirmation required', 'Provider registration enabled', 'Hosted canonical application origin'].every(name => readiness.checks.some(check => check.name === name && check.status === 'PASS')) ||
    !readiness.localMigrations.every(row => createHash('sha256').update(readFileSync(`supabase/migrations/${row.name}`)).digest('hex') === row.sha256)) throw new Error('Readiness evidence is stale, mismatched or incomplete.');

async function hidden(label) {
  process.stdout.write(`${label} (hidden): `); process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = cancelled => { process.stdin.off('data', input); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); if (cancelled) reject(new Error('CANCELLED')); else resolve(value); };
    const input = chunk => { for (const c of chunk) { if (c === '\u0003') return finish(true); if (c === '\r' || c === '\n') return finish(false); if (c === '\u007f' || c === '\b') value = value.slice(0, -1); else if (c >= ' ' && c !== '\u001b') value += c; } };
    process.stdin.on('data', input);
  });
}
const results = [], actors = [];
let browser, stage = 'approval';
const record = label => { results.push({ check: label, status: 'PASS' }); console.log(`PASS: ${label}`); };
async function request(actor, path, body, statuses = [200]) {
  const response = await actor.context.request.fetch(`${origin}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(path === '/api/v1/me' && body ? { 'Idempotency-Key': crypto.randomUUID() } : {}) }, ...(body === undefined ? {} : { data: body }), maxRedirects: 0, timeout: 30000 });
  if (!statuses.includes(response.status())) throw new Error('UNEXPECTED_HTTP_STATUS');
  if (response.headers()['cache-control'] !== 'private, no-store') throw new Error('PRIVATE_CACHE_REQUIRED');
  const json = await response.json();
  return json.data;
}
try {
  if (await hidden('Type APPROVED only after owner authorization for signup, email, sessions and synthetic record writes') !== 'APPROVED') throw new Error('APPROVAL_REQUIRED');
  browser = await chromium.launch();
  for (const role of ['worker', 'employer']) {
    stage = `${role} registration`;
    const actor = { context: await browser.newContext({ baseURL: origin }), role };
    actors.push(actor);
    const email = await hidden(`${role} fresh email`), password = await hidden(`${role} password (12–128 characters)`);
    if (actors.some(other => other !== actor && other.email?.toLowerCase() === email.toLowerCase())) throw new Error('DISTINCT_EMAILS_REQUIRED');
    actor.email = email;
    await request(actor, '/api/v1/auth/register', { email, password });
    const link = new URL(await hidden(`${role} confirmation link received in its real inbox`));
    if (link.origin !== origin || link.pathname !== '/auth/confirm') throw new Error('CONFIRMATION_ORIGIN_MISMATCH');
    const tokenHash = new URLSearchParams(link.hash.slice(1)).get('token_hash');
    await request(actor, '/api/v1/auth/confirm', { tokenHash });
    await request(actor, '/api/v1/me', { displayName: `Synthetic ${role}`, locale: 'en', timeZone: 'Asia/Colombo' });
    actor.id = (await request(actor, '/api/v1/me')).id;
    await request(actor, '/api/v1/auth/sign-out', {});
    await request(actor, '/api/v1/me', undefined, [401]);
    await request(actor, '/api/v1/auth/sign-in', { email, password });
    if ((await request(actor, '/api/v1/me')).id !== actor.id) throw new Error('IDENTITY_CHANGED');
    const page = await actor.context.newPage(); await page.goto('/app/home'); await page.reload();
    if ((await request(actor, '/api/v1/me')).id !== actor.id) throw new Error('SESSION_NOT_PERSISTED');
    const factors = (await request(actor, '/api/v1/auth/mfa')).factors.filter(f => f.status === 'verified');
    if (factors.length) await request(actor, '/api/v1/auth/mfa', { action: 'verify', factorId: factors[0].id, code: await hidden(`${role} current authenticator code`) });
    record(`${role}: real registration, email confirmation, profile, logout/login and reload`);
    console.log(`${role} subject for separately approved membership review: ${actor.id}`);
  }
  stage = 'independent authority prerequisite';
  console.log('An authorized operator must now review/provision the synthetic company and employer membership. This script cannot grant authority. Do not continue without that separately approved step.');
  const companyId = await hidden('Approved company UUID after operator review');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) throw new Error('INVALID_COMPANY_ID');
  stage = 'offer through private Passport';
  const ids = await twoAccountFlow({ worker: actors[0], employer: actors[1], companyId, request, record });
  stage = 'session closure';
  for (const actor of actors) { await request(actor, '/api/v1/auth/sign-out', {}); await request(actor, '/api/v1/passport', undefined, [401]); }
  record('Both logged-out sessions denied private Passport');
  results.push({ check: 'Hosted journey', status: 'PASS', ids });
} catch {
  results.push({ check: stage, status: 'BLOCKED_OR_FAILED' }); process.exitCode = 1;
  console.error(`STOP: ${stage}. No response bodies, credentials or tokens are logged. Existing created records remain; no automatic cleanup.`);
} finally {
  for (const actor of actors) await actor.context.close();
  if (browser) await browser.close();
  mkdirSync('test-results', { recursive: true });
  writeFileSync(`test-results/hosted-two-accounts-${Date.now()}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), results, limits: 'Two account subjects do not independently prove two human identities. Natural token-expiry refresh, MFA enrollment and production employer verification require separate evidence.' }, null, 2));
}
