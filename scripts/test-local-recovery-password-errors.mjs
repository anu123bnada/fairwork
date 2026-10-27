import { chromium, expect } from '@playwright/test';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { checkLocalDocker } from './local-development-runtime.mjs';
import { redactStartupOutput } from './local-development-diagnostics.mjs';

// Real local services. A password reset whose new password the identity provider REFUSES must say why in plain words, not "Check the supplied fields.".
// The hosted staging failure report was exactly that: a real reset email, matching passwords, and the generic field message. The provider refuses a new
// password that equals the current one (same_password) or is too weak (weak_password); the app mapped every such refusal to VALIDATION_FAILED.
checkLocalDocker();
const origin = 'http://127.0.0.1:3100', mailbox = 'http://127.0.0.1:55424', gotrue = 'http://127.0.0.1:55421/auth/v1';
const results = [], directory = `test-results/recovery-password-errors-${Date.now()}`;
mkdirSync(directory, { recursive: true });
const pass = check => { results.push({ check, status: 'PASS' }); console.log(`PASS: ${check}`); };
const browser = await chromium.launch(), context = await browser.newContext({ viewport: { width: 390, height: 844 } });
context.setDefaultTimeout(30000); context.setDefaultNavigationTimeout(60000);
async function api(path, body, status = 200) {
  const r = await context.request.post(origin + path, { headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: body });
  const d = await r.json(); if (r.status() !== status) throw Error(`${path}: ${r.status()} ${d.error?.code ?? ''}`); return d;
}
async function mailLink(email, subject) {
  for (let i = 0; i < 30; i++) {
    const list = await fetch(mailbox + '/api/v1/messages').then(r => r.json());
    const item = list.messages.find(m => m.Subject.includes(subject) && m.To.some(t => t.Address === email));
    if (item) { const d = await fetch(mailbox + '/api/v1/message/' + item.ID).then(r => r.json()); return d.HTML.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&'); }
    await new Promise(r => setTimeout(r, 500));
  } throw Error('Expected real local email was not delivered');
}
const tokenHashOf = link => new URLSearchParams(new URL(link).hash.slice(1)).get('token_hash');
// What Supabase's default {{ .ConfirmationURL }} resolves to: followed once, the Location header carries the fragment.
async function defaultLink(tokenHash) {
  const response = await fetch(`${gotrue}/verify?token=${encodeURIComponent(tokenHash)}&type=recovery&redirect_to=${encodeURIComponent(origin + '/auth/recover')}`, { redirect: 'manual' });
  return new URL(response.headers.get('location'));
}
try {
  const email = `pw-errors-${randomUUID()}@example.test`, password = randomBytes(24).toString('base64url'), next = randomBytes(24).toString('base64url');
  await api('/api/v1/auth/register', { email, password });
  await api('/api/v1/auth/confirm', { tokenHash: tokenHashOf(await mailLink(email, 'Confirm')) });
  await api('/api/v1/me', { displayName: 'Synthetic password-error account', locale: 'en', timeZone: 'Asia/Colombo' });
  await api('/api/v1/auth/sign-out', {});
  const page = await context.newPage();
  await page.goto(origin + '/forgot-password');
  await page.getByLabel('Email address').fill(email); await page.getByRole('button', { name: 'Send recovery email' }).click();
  await expect(page.getByRole('status')).toContainText('check its inbox');
  const link = await defaultLink(tokenHashOf(await mailLink(email, 'Recover')));
  await page.goto(link.href);
  await page.getByRole('button', { name: 'Confirm recovery link' }).click();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();

  // The provider refuses the SAME password. The person typed matching passwords; the message must name the actual problem.
  await page.getByLabel('New password', { exact: true }).fill(password); await page.getByLabel('Confirm new password').fill(password);
  await page.getByRole('button', { name: 'Save new password' }).click();
  const alert = page.locator('[role=alert]').filter({ hasText: /\S/ });
  await alert.first().waitFor();
  const shown = (await alert.allInnerTexts()).join(' ');
  if (/Check the supplied fields/.test(shown)) throw Error(`REPRODUCED: the new password equal to the old one still gives the generic "${shown.trim()}"`);
  if (!/different from your current/i.test(shown)) throw Error(`unexpected message: "${shown.trim()}"`);
  pass('A new password equal to the current one is refused by the provider and the person is told to choose a different one');
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  pass('The password step stays open so the person can try again without a new link');

  // A real, different password then succeeds on the same recovery session.
  await page.getByLabel('New password', { exact: true }).fill(next); await page.getByLabel('Confirm new password').fill(next);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status')).toContainText('password was changed');
  await api('/api/v1/auth/sign-in', { email, password }, 401);
  await api('/api/v1/auth/sign-in', { email, password: next });
  pass('A different password changes the password; the old one is refused and the new one signs in');
  await api('/api/v1/auth/sign-out', {});
  await page.screenshot({ path: directory + '/recovered.png', fullPage: true });
} catch (error) {
  const reason = redactStartupOutput(error.message); results.push({ check: 'recovery password errors', status: 'FAIL', reason }); console.error('FAIL: ' + reason); process.exitCode = 1;
} finally {
  await browser.close(); writeFileSync(directory + '/results.json', JSON.stringify({ environment: 'REAL LOCAL SERVICES', results }, null, 2)); console.log(directory);
}
