// Repeatable ORYQEN demonstration seed. Local development only.
// Drives the real registration, email-confirmation, profile and private-record APIs
// of a running LOCAL stack (see docs/ORYQEN_LOCAL_DEVELOPMENT.md). It writes no SQL,
// forges no sessions and grants no privileges. Every record is synthetic, labeled
// "[DEMO]" and self-reported. Re-running replays fixed idempotency keys, so records
// are not duplicated.
//
//   $env:DEMO_PASSWORD = "<choose a 12+ character password>"
//   node scripts/demo-seed.mjs [--origin http://127.0.0.1:3100]
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('./demo-seed-data.json', import.meta.url), 'utf8'));
const arg = process.argv.indexOf('--origin');
const origin = arg > 0 ? process.argv[arg + 1] : 'http://127.0.0.1:3100';
const mail = 'http://127.0.0.1:55424';
const password = process.env.DEMO_PASSWORD ?? '';

const host = new URL(origin).hostname;
if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error('Refusing to seed a non-local origin.');
if (password.length < 12) throw new Error('Set DEMO_PASSWORD (at least 12 characters) in your shell. It is never stored or printed.');
if (!data.account.email.endsWith('@example.test')) throw new Error('Demo account must use the reserved example.test domain.');

async function call(context, path, body, ok = [200]) {
  const response = await context.request.fetch(`${origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin },
    ...(body === undefined ? {} : { data: body }), timeout: 60000, maxRedirects: 0,
  });
  const json = await response.json().catch(() => ({}));
  if (!ok.includes(response.status())) throw new Error(`${path} failed: HTTP ${response.status()} ${json.error?.code ?? 'unknown'}`);
  return json.data;
}
async function confirmationLink(email) {
  for (let i = 0; i < 30; i++) {
    const list = await fetch(`${mail}/api/v1/messages`).then(r => r.json()).catch(() => ({}));
    const message = list.messages?.find(m => m.To?.some(to => to.Address === email));
    if (message) {
      const detail = await fetch(`${mail}/api/v1/message/${message.ID}`).then(r => r.json());
      const link = detail.HTML?.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
      if (!link || new URL(link).origin !== origin || new URL(link).pathname !== '/auth/confirm') throw new Error('Unexpected confirmation link');
      return link;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Local confirmation mail was not delivered. Is the local mail service running?');
}
async function register(browser, context) {
  const page = await context.newPage();
  await page.goto(`${origin}/register`);
  await page.getByRole('button', { name: /I’m a worker/ }).click();
  await page.getByLabel('Your name', { exact: true }).fill(data.account.displayName);
  await page.getByLabel('Email address').fill(data.account.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  const registration = page.waitForResponse(r => r.url().endsWith('/api/v1/auth/register'));
  await page.getByRole('button', { name: 'Register with email' }).click();
  if ((await registration).status() !== 200) throw new Error('Registration was refused (is AUTH_REGISTRATION_ENABLED=true?).');
  await page.goto(await confirmationLink(data.account.email));
  await page.getByRole('button', { name: 'Confirm my email' }).click();
  await page.waitForURL(url => url.pathname === '/register/profile');
  await page.getByLabel('Display name').fill(data.account.displayName);
  await page.getByRole('button', { name: 'Create my profile' }).click();
  await page.waitForURL(url => url.pathname.startsWith('/app/'));
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await fetch(`${origin}/sign-in`).catch(() => { throw new Error(`Nothing is listening at ${origin}. Start the local stack first.`); });
  const signIn = await context.request.fetch(`${origin}/api/v1/auth/sign-in`, { method: 'POST', headers: { Origin: origin }, data: { email: data.account.email, password }, maxRedirects: 0 });
  if (signIn.status() === 401) { console.log('Demo account not found; registering it through the real flow.'); await register(browser, context); }
  else if (signIn.status() !== 200) throw new Error(`Sign-in failed: HTTP ${signIn.status()}`);
  await call(context, '/api/v1/me');

  for (const entry of data.employment) {
    const receipt = await call(context, '/api/v1/me/employment-history', { operation: 'save', id: entry.id, expectedRevision: 0, idempotencyKey: entry.idempotencyKey, content: entry.content });
    console.log(`Employment: ${entry.content.role} -> revision ${receipt.revision}`);
  }
  for (const draft of data.offerDrafts) {
    const receipt = await call(context, '/api/v1/offers/drafts', { operation: 'save', id: draft.id, expectedRevision: 0, idempotencyKey: draft.idempotencyKey, content: draft.content });
    console.log(`Offer draft: ${draft.content.role} -> revision ${receipt.revision}`);
  }
  console.log(`\nSeeded. Sign in at ${origin}/sign-in as ${data.account.email} with your DEMO_PASSWORD.`);
  console.log('All records are synthetic and self-reported. See docs/ORYQEN_DEMO_GUIDE.md.');
} finally { await browser.close(); }
