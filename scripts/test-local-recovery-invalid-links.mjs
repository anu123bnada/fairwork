import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { checkLocalDocker } from './local-development-runtime.mjs';
import { redactStartupOutput } from './local-development-diagnostics.mjs';

// Real local GoTrue: what the identity provider REALLY redirects to for a link it will not honour (unknown, expired or already used token), and what
// the recovery page shows for it. The provider decides the fragment; this proves the app understands the provider's real answer, not a hand-written one.
checkLocalDocker();
const origin = 'http://127.0.0.1:3100', gotrue = 'http://127.0.0.1:55421/auth/v1';
const results = [], directory = `test-results/recovery-invalid-links-${Date.now()}`;
mkdirSync(directory, { recursive: true });
const pass = check => { results.push({ check, status: 'PASS' }); console.log(`PASS: ${check}`); };
const browser = await chromium.launch(), context = await browser.newContext({ viewport: { width: 390, height: 844 } });
context.setDefaultTimeout(30000);
try {
  const page = await context.newPage();
  const calls = [];
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/api/v1/auth/')) calls.push(r.url()); });
  for (const [label, type] of [['an unknown recovery token', 'recovery'], ['an unknown invitation token', 'invite']]) {
    const response = await fetch(`${gotrue}/verify?token=${randomBytes(24).toString('hex')}&type=${type}&redirect_to=${encodeURIComponent(origin + '/auth/recover')}`, { redirect: 'manual' });
    const location = new URL(response.headers.get('location'));
    if (!/error/.test(location.hash + location.search)) throw Error(`the provider did not report an error for ${label}`);
    await page.goto(location.href);
    await expect(page.getByRole('heading', { name: /This link (has expired|cannot be used)/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a new reset email' })).toHaveAttribute('href', '/forgot-password');
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Check the supplied fields.')).toHaveCount(0);
    pass(`The provider's real answer for ${label} shows an explanation and a way to request a new email, with no password form`);
  }
  if (calls.length) throw Error(`the page called the auth API for a link that carried no credentials: ${calls.join(', ')}`);
  pass('Nothing was consumed or sent for links the provider rejected');
} catch (error) {
  const reason = redactStartupOutput(error.message); results.push({ check: 'invalid links', status: 'FAIL', reason }); console.error('FAIL: ' + reason); process.exitCode = 1;
} finally {
  await browser.close(); writeFileSync(directory + '/results.json', JSON.stringify({ environment: 'REAL LOCAL SERVICES', results }, null, 2)); console.log(directory);
}
