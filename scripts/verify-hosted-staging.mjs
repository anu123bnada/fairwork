// Read-only smoke checks against a deployed ORYQEN web app. It creates no account, sends no email, writes nothing and prints no secret.
//   node scripts/verify-hosted-staging.mjs https://oryqen-staging.vercel.app [--json]
// It proves the right build is deployed and that the public surface fails closed. It does NOT replace the signed-in checks in OWNER_ACTIONS.md.
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2];
if (!base || !/^https:\/\/[a-z0-9.-]+$/i.test(base)) { console.error('Usage: node scripts/verify-hosted-staging.mjs https://<host> [--json]'); process.exit(2); }
const results = [];
const check = (id, status, detail) => { results.push({ id, status, detail }); console.log(`${status.padEnd(7)} ${id}: ${detail}`); };
const get = async (path, init = {}) => { try { return await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(30000), ...init }); } catch (error) { return { status: 0, error: String(error.cause?.code ?? error.message), headers: new Headers(), text: async () => '' }; } };

for (const path of ['/', '/sign-in', '/register', '/forgot-password', '/auth/recover', '/auth/confirm', '/verify', '/about', '/downloads']) {
  const response = await get(path);
  check(`public ${path}`, response.status === 200 ? 'PASS' : 'FAIL', `HTTP ${response.status}${response.error ? ` ${response.error}` : ''}`);
}
// Private screens must not render for a signed-out visitor.
for (const path of ['/app/home', '/app/passport', '/app/work-record', '/app/employer', '/admin']) {
  const response = await get(path); const location = response.headers.get('location') ?? '';
  const closed = [301, 302, 303, 307, 308].includes(response.status) && /sign-in|admin|register/.test(location) || response.status === 401 || response.status === 403;
  check(`private ${path} fails closed`, closed ? 'PASS' : response.status === 200 ? 'WARN' : 'FAIL', `HTTP ${response.status}${location ? ` -> ${location.split('?')[0]}` : ''} (200 means the client shell loads and enforces sign-in itself; check by hand)`);
}
// API surface: unauthenticated callers get a JSON envelope with an error, never data.
for (const path of ['/api/v1/me', '/api/v1/offers', '/api/v1/passport', '/api/v1/vault', '/api/v1/credentials', '/api/v1/admin']) {
  const response = await get(path); const body = await response.text().catch(() => '');
  check(`api ${path} denies anonymous`, (path === '/api/v1/admin' ? [401, 403, 422] : [401, 403]).includes(response.status) && !/"data":\{"items":\[\{/.test(body) ? 'PASS' : 'FAIL', `HTTP ${response.status}`);
}
const forged = await get('/api/v1/auth/sign-in', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
check('cross-origin POST refused', forged.status === 403 ? 'PASS' : 'FAIL', `HTTP ${forged.status}`);
// Which build is this? The recovery page changed in the authentication fix; its new explanatory text is in the page script.
const recover = await get('/auth/recover'); const html = await recover.text();
check('page serves HTML with a Next.js build', /_next\//.test(html) ? 'PASS' : 'FAIL', `${html.length} bytes`);
const chunks = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map(match => match[0]).slice(0, 40);
let fixedBuild = false;
for (const chunk of chunks) { const text = await (await get(chunk)).text().catch(() => ''); if (text.includes('au.rec.linkUsedError') || text.includes('This reset link is invalid, has expired, or was already used')) { fixedBuild = true; break; } }
check('deployed build contains the password-recovery fix', fixedBuild ? 'PASS' : 'FAIL', fixedBuild ? 'fix present' : 'fix not found in the first scripts; this is an older build');
// Security headers on the document.
const root = await get('/');
for (const [name, expected] of [['x-content-type-options', /nosniff/i], ['referrer-policy', /./], ['x-frame-options', /deny|sameorigin/i], ['content-security-policy', /./]]) {
  const value = root.headers.get(name); check(`header ${name}`, value && expected.test(value) ? 'PASS' : 'WARN', value ? 'present' : 'absent');
}
// Credential key set: 404 until the owner installs signing keys; never a private key.
const keys = await get('/.well-known/oryqen-keys.json'); const keysBody = await keys.text();
check('published key set is public material only', [200, 404].includes(keys.status) && !/"d"\s*:/.test(keysBody) ? 'PASS' : 'FAIL', keys.status === 404 ? 'no signing key installed (credentials unavailable, as expected before the key ceremony)' : `HTTP ${keys.status}`);
// No secrets in public HTML.
check('no secret-looking values in the home document', /(sk_live|service_role|BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/.test((await (await get('/')).text()).slice(0, 2_000_000)) ? 'FAIL' : 'PASS', 'scanned the home document');

const summary = { PASS: 0, FAIL: 0, WARN: 0 }; for (const result of results) summary[result.status] = (summary[result.status] ?? 0) + 1;
console.log(`\nPASS ${summary.PASS} | FAIL ${summary.FAIL} | WARN ${summary.WARN}  (${base})`);
if (process.argv.includes('--json')) { mkdirSync('test-results', { recursive: true }); const file = `test-results/hosted-smoke-${Date.now()}.json`; writeFileSync(file, JSON.stringify({ base, capturedAt: new Date().toISOString(), summary, results }, null, 2)); console.log(file); }
process.exitCode = summary.FAIL ? 1 : 0;
