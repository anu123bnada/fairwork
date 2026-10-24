// Read-only inspection; never prints credentials, email addresses, or template bodies.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

if (!process.argv.includes('--network')) {
  console.log('PLAN_ONLY: --network enables read-only hosted configuration and public route checks.');
  process.exit(0);
}
const origin = 'https://oryqen.vercel.app';
const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const probe = `test-results/auth-template-probe-${Date.now()}`;
mkdirSync(`${probe}/supabase`, { recursive: true });
// A separate comparison file forces template differences into the read-only
// diff. It is never used as application configuration or pushed to Supabase.
let comparison = readFileSync('supabase/config.toml', 'utf8');
for (const type of ['confirmation', 'recovery']) {
  writeFileSync(`${probe}/supabase/${type}.html`, '<p>Read-only configuration comparison</p>');
  comparison += `\n[auth.email.template.${type}]\nsubject = "Read-only comparison"\ncontent_path = "./supabase/${type}.html"\n`;
}
writeFileSync(`${probe}/supabase/config.toml`, comparison);
const result = spawnSync(path.resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe'), ['config', 'diff', '--project-ref', ref, '--workdir', path.resolve(probe), '--output-format', 'json'], { encoding: 'utf8', timeout: 45000, windowsHide: true });
let diff;
try { if (result.status === 0) diff = JSON.parse(result.stdout); } catch { /* Never print raw provider output. */ }
const changes = Array.isArray(diff?.changes) ? diff.changes : [];
const remote = key => changes.find(change => change.path?.join('.') === key)?.remote;
const report = { capturedAt: new Date().toISOString(), mode: 'READ_ONLY', configurationRetrieved: Boolean(diff), siteURLMatchesProduction: typeof remote('auth.site_url') === 'string' ? remote('auth.site_url') === origin : 'UNVERIFIED', redirects: {}, templates: {}, publicRoutes: [] };
const redirects = remote('auth.additional_redirect_urls');
for (const route of ['/auth/confirm', '/auth/recover']) {
  report.redirects[route] = Array.isArray(redirects) ? {
    exactCallbackListed: redirects.includes(`${origin}${route}`),
    queryPatternListed: redirects.includes(`${origin}${route}?*`),
    productionHostWildcardListed: redirects.includes(`${origin}/**`),
  } : 'UNVERIFIED';
}
// CLI versions may omit email template bodies entirely. Absence is not evidence
// that the hosted template is missing; report it as unverified.
for (const type of ['confirmation', 'recovery']) {
  const value = remote(`auth.email.template.${type}.content`) ?? remote(`auth.email.template.${type}.content_path`);
  report.templates[type] = typeof value === 'string' && /<|\{\{/.test(value) ? {
    usesRedirectTo: /\{\{\s*\.RedirectTo\s*\}\}/.test(value),
    usesTokenHash: /\{\{\s*\.TokenHash\s*\}\}/.test(value),
    usesConfirmationURL: /\{\{\s*\.ConfirmationURL\s*\}\}/.test(value),
    expectedFragment: /\{\{\s*\.RedirectTo\s*\}\}#token_hash=\{\{\s*\.TokenHash\s*\}\}/.test(value),
  } : 'UNVERIFIED';
}
for (const route of ['/register', '/auth/confirm']) {
  try {
    const response = await fetch(`${origin}${route}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    report.publicRoutes.push({ route, status: response.status, registrationEnabledUI: body.includes('Account setup progress'), offersConfirmationWithoutContext: body.includes('Confirm my email') });
  } catch { report.publicRoutes.push({ route, status: 'UNREACHABLE' }); }
}
mkdirSync('test-results', { recursive: true });
const file = `test-results/auth-email-configuration-${Date.now()}.json`;
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: file, ...report }, null, 2));
