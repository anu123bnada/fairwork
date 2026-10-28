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
  const outcome = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024, shell: command === 'npm' || command.endsWith('.bat') });
  const output = `${outcome.stdout ?? ''}\n${outcome.stderr ?? ''}`;
  return { ok: outcome.status === 0, output, tail: output.trim().split('\n').slice(-40).join('\n'), seconds: Math.round((Date.now() - started) / 1000), timedOut: outcome.error?.code === 'ETIMEDOUT' };
}

// A command check. `blockedOnExit` marks scripts whose non-zero exit means "owner input needed", not "defect".
function command(id, category, spec, args, options = {}) {
  if (!wanted(id)) return;
  if (options.needsFull && !full) return add(id, category, 'SKIPPED', 'long gate; rerun with --full', { reason: 'not requested' });
  const outcome = run(spec, args, options);
  if (outcome.ok) return add(id, category, 'PASS', `${options.passDetail ?? 'succeeded'} (${outcome.seconds}s)`);
  if (options.blockedOnExit) return add(id, category, 'BLOCKED', options.blockedDetail ?? 'needs owner input', { evidence: outcome.tail });
  mkdirSync('release-results/logs', { recursive: true });
  writeFileSync(`release-results/logs/${id}.log`, outcome.output);
  add(id, category, 'FAIL', outcome.timedOut ? 'timed out' : `failed (full output in release-results/logs/${id}.log)`, { evidence: outcome.tail });
}

// ---------------------------------------------------------------- code quality and tests
command('typecheck', 'code', node, ['node_modules/typescript/bin/tsc', '--noEmit']);
command('lint', 'code', node, ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings=0']);
command('unit-integration', 'tests', node, ['node_modules/vitest/vitest.mjs', 'run'], { passDetail: 'vitest (PGlite database tests included)' });
command('dependency-audit', 'security', 'npm', ['audit', '--omit=dev', '--audit-level=high'], { passDetail: 'no high or critical production vulnerabilities' });
command('brand-assets', 'release', node, ['scripts/check-brand-assets.mjs']);
command('secrets-scan', 'security', node, ['scripts/scan-secrets.mjs'], { passDetail: 'no unexplained secret-like values in tracked or untracked source files (reviewed fixtures are allow-listed with reasons)' });
command('electron-policy', 'windows', node, ['--test', 'policy.test.cjs'], { cwd: 'desktop', passDetail: 'desktop navigation and permission policy tests' });

// ---------------------------------------------------------------- long gates (--full)
command('production-build', 'build', node, ['node_modules/next/dist/bin/next', 'build'], { needsFull: true, env: { APP_ORIGIN: 'http://localhost:3000' } });
command('browser-journeys', 'tests', node, ['scripts/test-browser.mjs'], { needsFull: true, env: { AUTH_REGISTRATION_ENABLED: 'true' }, passDetail: 'isolated production-build Playwright suite' });
command('database-security', 'security', node, ['scripts/test-day7-postgres.mjs', '--extended-setup'], { needsFull: true, passDetail: 'real PostgreSQL case-review tests' });

// ---------------------------------------------------------------- configuration (names only, never values)
const present = name => Boolean(process.env[name]?.trim());
if (wanted('configuration')) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.NEXT_PUBLIC_ORYQEN_CREDENTIAL_SIGNING_KEY) add('configuration-secrets', 'security', 'FAIL', 'a server secret is set under a public name or a service-role key is present in this environment');
  const validation = run(node, ['scripts/validate-production-config.mjs', '--json']);
  let report;
  try { report = JSON.parse(validation.output.slice(validation.output.indexOf('{'), validation.output.lastIndexOf('}') + 1)); } catch { report = null; }
  if (!report) add('configuration', 'config', 'FAIL', 'the configuration validator did not produce a report', { evidence: validation.tail });
  else {
    const failed = report.results.filter(item => item.status === 'FAIL').map(item => item.id);
    add('configuration', 'config', failed.length ? 'BLOCKED' : 'PASS', failed.length ? `production configuration incomplete: ${failed.join(', ')} (run node scripts/validate-production-config.mjs for the reason each one fails)` : 'production configuration passes every check (presence and form only; values are never printed)');
  }
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
// The doctor prints a JSON inventory and exits non-zero when no test device is attached, so the verdict comes from its fields.
let androidInventory = null;
if (wanted('android-toolchain') || wanted('android-build')) {
  const doctor = run(node, ['mobile/poc/scripts/doctor.mjs']);
  try { androidInventory = JSON.parse(doctor.output.slice(doctor.output.indexOf('{'), doctor.output.lastIndexOf('}') + 1)); } catch { androidInventory = null; }
}
if (wanted('android-toolchain')) {
  if (!androidInventory) add('android-toolchain', 'android', 'SKIPPED', 'the Android inventory could not be read; no Android build was attempted');
  else add('android-toolchain', 'android', androidInventory.buildReady ? 'PASS' : 'SKIPPED', androidInventory.buildReady ? `SDK, build tools and Java ${androidInventory.javaMajor} found; device testing ${androidInventory.deviceTestingReady ? 'ready' : 'not ready (no authorized device or emulator running)'}` : 'Android SDK, build tools or a compatible Java were not found; no Android build was attempted');
}
if (wanted('android-build')) {
  if (!full) add('android-build', 'android', 'SKIPPED', 'long gate; rerun with --full');
  else if (!androidInventory?.buildReady) add('android-build', 'android', 'SKIPPED', 'Android toolchain not ready; no Android build was attempted');
  else {
    const javaHome = path.dirname(path.dirname(androidInventory.javaExecutable));
    const env = { JAVA_HOME: javaHome, ANDROID_HOME: androidInventory.androidSdk, GRADLE_USER_HOME: path.resolve('.tmp/android-gradle') };
    const sync = run(node, ['node_modules/@capacitor/cli/bin/capacitor', 'copy', 'android'], { cwd: 'mobile/poc', env });
    const gradle = sync.ok ? run(path.resolve('mobile/poc/android/gradlew.bat'), ['assembleOnline', `-PoryqenOnlineOrigin=${process.env.ORYQEN_ANDROID_ORIGIN ?? 'https://oryqen-staging.vercel.app'}`, '--no-daemon', '--no-watch-fs', '--max-workers=1', '--console=plain'], { cwd: 'mobile/poc/android', env }) : sync;
    const apk = 'mobile/poc/android/app/build/outputs/apk/online/app-online.apk';
    if (gradle.ok && existsSync(apk)) add('android-build', 'android', 'PASS', `debug-signed online preview APK (staging origin) built (${statSync(apk).size} bytes, sha256 ${createHash('sha256').update(readFileSync(apk)).digest('hex').slice(0, 16)}...). Debug-signed: not a release`, { artifact: apk });
    else add('android-build', 'android', 'FAIL', 'the Android debug build failed', { evidence: gradle.tail });
  }
}
if (wanted('windows-build')) {
  if (!full) add('windows-build', 'windows', 'SKIPPED', 'long gate; rerun with --full');
  else {
    // The preview installer's backend comes from configuration, not source: the approved staging origin unless the owner sets another for this run.
    const build = run('npm', ['run', 'build:windows', '--', '-c.directories.output=../test-results/windows-verify'], { cwd: 'desktop', env: { ORYQEN_DESKTOP_ORIGIN: process.env.ORYQEN_DESKTOP_ORIGIN ?? 'https://oryqen-staging.vercel.app' } });
    const installers = existsSync('test-results/windows-verify') ? readdirSync('test-results/windows-verify').filter(name => /\.exe$/i.test(name) && !/uninstall/i.test(name)) : [];
    if (build.ok && installers.length) add('windows-build', 'windows', 'PASS', `unsigned preview installer built: ${installers.join(', ')}. Not code-signed: not a release`);
    else add('windows-build', 'windows', 'FAIL', 'the Windows installer build failed', { evidence: build.tail });
  }
}
if (wanted('windows-release')) {
  const certified = present('CSC_LINK') || present('WIN_CSC_LINK') || present('ORYQEN_WINDOWS_CERTIFICATE_PATH');
  add('windows-release', 'windows', certified ? 'PASS' : 'BLOCKED', certified ? 'code-signing certificate configured (presence only)' : 'no Windows code-signing certificate; only unsigned builds can be produced');
}
function artifactIntegrity() {
  const roots = ['test-results/windows-artifacts', 'test-results/windows-verify', 'mobile/poc/android/app/build/outputs'].filter(existsSync);
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
const verdict = only ? (counts.FAIL ? 'PARTIAL RUN: defects found' : 'PARTIAL RUN: selected checks only; not a release verdict') : counts.FAIL ? 'NOT READY: defects found' : counts.BLOCKED ? 'NOT READY: owner input required' : counts.SKIPPED ? 'INCOMPLETE: checks were skipped' : 'READY';
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
