import { chromium, expect } from '@playwright/test';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { checkLocalDocker } from './local-development-runtime.mjs';
import { redactStartupOutput } from './local-development-diagnostics.mjs';

// Real local services (local GoTrue, local mailbox, the app on 3100): password recovery and an invitation-style link through the form Supabase's
// DEFAULT email template produces. That template does not use token_hash; its link goes to Supabase's verify endpoint, which redirects to the app with
// access and refresh tokens in the URL fragment. This is the shape the hosted staging project sends, and the shape the recovery page used to reject
// with "Check the supplied fields.". The verify URL is rebuilt from the local template's token hash exactly as Supabase's {{ .ConfirmationURL }} does.
checkLocalDocker();
const origin = 'http://127.0.0.1:3100', mailbox = 'http://127.0.0.1:55424', gotrue = 'http://127.0.0.1:55421/auth/v1';
const results = [], directory = `test-results/recovery-default-link-${Date.now()}`;
mkdirSync(directory, { recursive: true });
const pass = check => { results.push({ check, status: 'PASS' }); console.log(`PASS: ${check}`); };
const browser = await chromium.launch(), context = await browser.newContext({ viewport: { width: 390, height: 844 } });
context.setDefaultTimeout(30000); context.setDefaultNavigationTimeout(60000);
async function api(path, body, status = 200) {
  const r = await context.request.post(origin + path, { headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: body });
  const d = await r.json(); if (r.status() !== status) throw Error(`${path}: ${r.status()} ${d.error?.code ?? ''}`); return d.data;
}
async function mailLink(email, subject) {
  for (let i = 0; i < 30; i++) {
    const list = await fetch(mailbox + '/api/v1/messages').then(r => r.json());
    const item = list.messages.find(m => m.Subject.includes(subject) && m.To.some(t => t.Address === email));
    if (item) { const d = await fetch(mailbox + '/api/v1/message/' + item.ID).then(r => r.json()); return d.HTML.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&'); }
    await new Promise(r => setTimeout(r, 500));
  } throw Error('Expected real local email was not delivered');
}
// What Supabase's default {{ .ConfirmationURL }} resolves to, followed once without letting the browser leave: the Location header carries the fragment.
async function defaultTemplateLink(tokenHash, type, redirectTo) {
  const verify = `${gotrue}/verify?token=${encodeURIComponent(tokenHash)}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`;
  const response = await fetch(verify, { redirect: 'manual' });
  const location = response.headers.get('location');
  if (![302, 303].includes(response.status) || !location) throw Error(`verify answered ${response.status}`);
  return new URL(location);
}
const tokenHashOf = link => new URLSearchParams(new URL(link).hash.slice(1)).get('token_hash');
try {
  const email = `default-link-${randomUUID()}@example.test`, password = randomBytes(24).toString('base64url'), nextPassword = randomBytes(24).toString('base64url');
  await api('/api/v1/auth/register', { email, password });
  await api('/api/v1/auth/confirm', { tokenHash: tokenHashOf(await mailLink(email, 'Confirm')) });
  await api('/api/v1/me', { displayName: 'Synthetic default-link account', locale: 'en', timeZone: 'Asia/Colombo' });
  await api('/api/v1/auth/sign-out', {});
  pass('Account registered and confirmed through the app');

  const page = await context.newPage();
  await page.goto(origin + '/forgot-password');
  await page.getByLabel('Email address').fill(email); await page.getByRole('button', { name: 'Send recovery email' }).click();
  await expect(page.getByRole('status')).toContainText('check its inbox');
  const hash = tokenHashOf(await mailLink(email, 'Recover'));
  const recovery = await defaultTemplateLink(hash, 'recovery', `${origin}/auth/recover`);
  if (recovery.origin !== origin || recovery.pathname !== '/auth/recover' || !/access_token=/.test(recovery.hash) || !/type=recovery/.test(recovery.hash) || /token_hash=/.test(recovery.hash)) throw Error('The default-template link did not have the expected fragment shape');
  pass('Supabase default recovery link carries access and refresh tokens in the fragment (no token_hash)');

  await page.goto(recovery.href);
  await expect(page.getByRole('button', { name: 'Confirm recovery link' })).toBeVisible();
  if (page.url().includes('access_token')) throw Error('Tokens were left in the address bar');
  pass('Recovery page accepts the default-template link and removes the tokens from the address bar');
  await page.getByRole('button', { name: 'Confirm recovery link' }).click();
  await page.getByLabel('New password', { exact: true }).fill(nextPassword); await page.getByLabel('Confirm new password').fill(nextPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status')).toContainText('password was changed');
  await page.screenshot({ path: directory + '/recovered.png', fullPage: true });
  await api('/api/v1/auth/sign-in', { email, password }, 401);
  await api('/api/v1/auth/sign-in', { email, password: nextPassword });
  pass('Real password changed through the default-template link; old password denied, new password signs in');
  await api('/api/v1/auth/sign-out', {});

  // Replay: the same fragment (already consumed) must be refused, not silently accepted.
  const replay = await context.newPage(); await replay.goto(recovery.href);
  await replay.getByRole('button', { name: 'Confirm recovery link' }).click();
  await expect(replay.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
  await expect(replay.getByLabel('New password', { exact: true })).toHaveCount(0);
  pass('Replaying the consumed default-template link is refused with an explanation and no password step');

  // The site root: the same link opened where an invitation from the dashboard lands.
  await api('/api/v1/auth/recovery', { email }, 200);
  const second = await defaultTemplateLink(tokenHashOf(await mailLink(email, 'Recover')), 'recovery', origin + '/');
  const landing = await context.newPage(); await landing.goto(second.href);
  await expect(landing).toHaveURL(/\/auth\/recover$/);
  await expect(landing.getByRole('button', { name: 'Confirm recovery link' })).toBeVisible();
  pass('A recovery link that lands on the site root is forwarded to the recovery page');
  await api('/api/v1/auth/sign-out', {});
} catch (error) {
  const reason = redactStartupOutput(error.message); results.push({ check: 'default-template recovery', status: 'FAIL', reason }); console.error(reason); process.exitCode = 1;
} finally {
  await browser.close(); writeFileSync(directory + '/results.json', JSON.stringify({ environment: 'REAL LOCAL SERVICES', results }, null, 2)); console.log(directory);
}
