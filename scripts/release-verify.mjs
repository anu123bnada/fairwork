// Single release-validation command: `npm run release:verify` (add `-- --full` for the long gates).
//
// Every check ends as exactly one of PASS, FAIL, SKIPPED or BLOCKED:
//   PASS     it ran and succeeded.
//   FAIL     it ran and found a defect. Fix it; the command exits 1.
//   SKIPPED  it was not run here (a long gate without --full, or a toolchain that is absent). Not a pass.
//   BLOCKED  it cannot pass until the owner supplies something (a key, an approval, a signing certificate). Not a pass.
// The verdict is READY only when nothing failed, was skipped or is blocked. It never prints a secret value:
// configuration is reported as present/absent by name only.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const full = process.argv.includes('--full');
const only = process.argv.find(argument => argument.startsWith('--only='))?.slice(7).split(',');
const node = process.execPath;
const results = [];

const add = (id, category, status, detail, extra = {}) => { results.push({ id, category, status, detail, ...extra }); console.log(`${status.padEnd(8)} ${id}: ${detail}`); };
const wanted = id => !only || only.includes(id);

function run(command, args, { cwd = process.cwd(), env = {}, timeout = 1_800_000 } = {}) {
  const started = Date.now();
  const outcome = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024, shell: command === 'npm' });
  const output = `${outcome.stdout ?? ''}\n${outcome.stderr ?? ''}`;
  return { ok: outcome.status === 0, output, tail: output.trim().split('\n').slice(-6).join('\n'), seconds: Math.round((Date.now() - started) / 1000), timedOut: outcome.error?.code === 'ETIMEDOUT' };
}

// A command check. `blockedOnExit` marks scripts whose non-zero exit means "owner input needed", not "defect".
function command(id, category, spec, args, options = {}) {
  if (!wanted(id)) return;
  if (options.needsFull && !full) return add(id, category, 'SKIPPED', 'long gate; rerun with --full', { reason: 'not requested' });
  const outcome = run(spec, args, options);
  if (outcome.ok) return add(id, category, 'PASS', `${options.passDetail ?? 'succeeded'} (${outcome.seconds}s)`);
  if (options.blockedOnExit) return add(id, category, 'BLOCKED', options.blockedDetail ?? 'needs owner input', { evidence: outcome.tail });
  add(id, category, 'FAIL', outcome.timedOut ? 'timed out' : 'failed', { evidence: outcome.tail });
}

// ---------------------------------------------------------------- code quality and tests
command('typecheck', 'code', node, ['node_modules/typescript/bin/tsc', '--noEmit']);
command('lint', 'code', node, ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings=0']);
command('unit-integration', 'tests', node, ['node_modules/vitest/vitest.mjs', 'run'], { passDetail: 'vitest (PGlite database tests included)' });
command('dependency-audit', 'security', 'npm', ['audit', '--omit=dev', '--audit-level=high'], { passDetail: 'no high or critical production vulnerabilities' });
command('brand-assets', 'release', node, ['scripts/check-brand-assets.mjs']);
command('electron-policy', 'windows', node, ['--test', 'policy.test.cjs'], { cwd: 'desktop', passDetail: 'desktop navigation and permission policy tests' });

// ---------------------------------------------------------------- long gates (--full)
command('production-build', 'build', node, ['node_modules/next/dist/bin/next', 'build'], { needsFull: true, env: { APP_ORIGIN: 'http://localhost:3000' } });
command('browser-journeys', 'tests', node, ['scripts/test-browser.mjs'], { needsFull: true, env: { AUTH_REGISTRATION_ENABLED: 'true' }, passDetail: 'isolated production-build Playwright suite' });
command('database-security', 'security', node, ['scripts/test-day7-postgres.mjs', '--extended-setup'], { needsFull: true, passDetail: 'real PostgreSQL case-review tests' });

// ---------------------------------------------------------------- configuration (names only, never values)
const present = name => Boolean(process.env[name]?.trim());
const origin = process.env.APP_ORIGIN ?? '';
if (wanted('configuration')) {
  const problems = [];
  if (!/^https:\/\//.test(origin)) problems.push('APP_ORIGIN must be the https production origin');
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) if (!present(name)) problems.push(`${name} is not set`);
  if (process.env.FAIRWORK_DATA_MODE !== 'supabase') problems.push('FAIRWORK_DATA_MODE must be supabase for a hosted release');
  if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.NEXT_PUBLIC_ORYQEN_CREDENTIAL_SIGNING_KEY) add('configuration-secrets', 'security', 'FAIL', 'a server secret is set under a public name or a service-role key is present in this environment');
  add('configuration', 'config', problems.length ? 'BLOCKED' : 'PASS', problems.length ? `production values missing: ${problems.join('; ')}` : 'production environment values present');
}
if (wanted('ai-policy')) {
  const aiReady = present('GEMINI_API_KEY') && process.env.ORYQEN_AI_POLICY_APPROVED === 'true' && present('ORYQEN_AI_POLICY_APPROVAL_REF') && present('ORYQEN_AI_PROCESSING_REGION');
  add('ai-policy', 'ai', aiReady ? 'PASS' : 'BLOCKED', aiReady ? 'AI processing policy fields present (presence only; not live-verified)' : 'real-user AI stays disabled until the owner supplies the key and the approved policy fields');
}
if (wanted('credential-key')) {
  const keyed = present('ORYQEN_CREDENTIAL_KEY_ID') && present('ORYQEN_CREDENTIAL_SIGNING_KEY');
  add('credential-key', 'credentials', keyed ? 'PASS' : 'BLOCKED', keyed ? 'owner-held signing key configured (presence only)' : 'no credential signing key; credentials cannot be issued until the owner runs the key ceremony');
}
if (wanted('download-links')) {
  const links = ['NEXT_PUBLIC_WINDOWS_URL', 'NEXT_PUBLIC_APK_URL'].filter(name => !/^https:\/\//.test(process.env[name] ?? ''));
  add('download-links', 'release', links.length ? 'BLOCKED' : 'PASS', links.length ? `no approved https host for: ${links.join(', ')}` : 'download links are https URLs');
}

// ---------------------------------------------------------------- platforms and artifacts
if (wanted('android-release')) {
  const preflight = run(node, ['mobile/poc/scripts/release-preflight.mjs', '--require-ready']);
  add('android-release', 'android', preflight.ok ? 'PASS' : 'BLOCKED', preflight.ok ? 'release preflight passed' : 'release preflight lists owner decisions (application ID, domain, keystore, device acceptance)', preflight.ok ? {} : { evidence: preflight.tail });
}
if (wanted('android-toolchain')) {
  const doctor = run(node, ['mobile/poc/scripts/doctor.mjs']);
  add('android-toolchain', 'android', doctor.ok ? 'PASS' : 'SKIPPED', doctor.ok ? 'Android SDK and Java found' : 'Android toolchain not available on this machine; no Android build was attempted', doctor.ok ? {} : { evidence: doctor.tail });
}
if (wanted('windows-release')) {
  const certified = present('CSC_LINK') || present('WIN_CSC_LINK') || present('ORYQEN_WINDOWS_CERTIFICATE_PATH');
  add('windows-release', 'windows', certified ? 'PASS' : 'BLOCKED', certified ? 'code-signing certificate configured (presence only)' : 'no Windows code-signing certificate; only unsigned builds can be produced');
}
function artifactIntegrity() {
  const roots = ['desktop/dist', 'mobile/poc/android/app/build/outputs'].filter(existsSync);
  const files = [];
  const walk = directory => { for (const name of readdirSync(directory)) { const file = path.join(directory, name); if (statSync(file).isDirectory()) walk(file); else if (/\.(exe|apk|aab)$/i.test(name)) files.push(file); } };
  roots.forEach(walk);
  if (!files.length) return add('artifact-integrity', 'release', 'SKIPPED', 'no built installer or APK found; nothing to hash');
  const entries = files.map(file => ({ file, bytes: statSync(file).size, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }));
  add('artifact-integrity', 'release', 'PASS', `${entries.length} artifact(s) hashed and recorded (these are unsigned or debug builds unless the platform checks above pass; integrity is not signing)`, { artifacts: entries });
}
if (wanted('artifact-integrity')) artifactIntegrity();

// ---------------------------------------------------------------- report
const counts = Object.fromEntries(['PASS', 'FAIL', 'SKIPPED', 'BLOCKED'].map(status => [status, results.filter(result => result.status === status).length]));
const verdict = counts.FAIL ? 'NOT READY: defects found' : counts.BLOCKED ? 'NOT READY: owner input required' : counts.SKIPPED ? 'INCOMPLETE: checks were skipped' : 'READY';
const report = { generatedAt: new Date().toISOString(), mode: full ? 'full' : 'quick', verdict, counts, results };
mkdirSync('release-results', { recursive: true });
writeFileSync('release-results/release-verify.json', JSON.stringify(report, null, 2));
const icon = { PASS: 'PASS', FAIL: 'FAIL', SKIPPED: 'SKIPPED', BLOCKED: 'BLOCKED' };
writeFileSync('release-results/release-verify.md', [
  `# ORYQEN release verification (${report.mode})`, '', `Generated ${report.generatedAt}. **Verdict: ${verdict}.**`, '',
  `PASS ${counts.PASS} | FAIL ${counts.FAIL} | SKIPPED ${counts.SKIPPED} | BLOCKED ${counts.BLOCKED}`, '',
  'SKIPPED and BLOCKED are not passes. BLOCKED means the owner must supply a key, approval or certificate.', '',
  '| Status | Check | Category | Detail |', '|---|---|---|---|',
  ...results.map(result => `| ${icon[result.status]} | ${result.id} | ${result.category} | ${result.detail.replace(/\|/g, '/')} |`), '',
].join('\n'));
console.log(`\nVerdict: ${verdict}\nPASS ${counts.PASS} | FAIL ${counts.FAIL} | SKIPPED ${counts.SKIPPED} | BLOCKED ${counts.BLOCKED}\nReport: release-results/release-verify.md and .json`);
if (counts.FAIL) process.exitCode = 1;
