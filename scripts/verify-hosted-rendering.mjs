// Rendered-content check of a deployed ORYQEN origin, in a real browser. An HTTP 200 is not evidence that a person sees a working page, so this asserts what is
// visible and what clicking does. It creates no account and sends one sign-in attempt for a non-existent synthetic address (the answer must be 401).
//   node scripts/verify-hosted-rendering.mjs https://oryqen-staging.vercel.app
import { chromium } from '@playwright/test';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(base)) { console.error('Usage: node scripts/verify-hosted-rendering.mjs https://<host>'); process.exit(2); }
const browser = await chromium.launch(), context = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message.slice(0, 160)));
let failures = 0;
const check = async (id, action) => { try { const detail = await action(); console.log(`PASS  ${id}${detail ? `: ${detail}` : ''}`); } catch (error) { failures++; console.log(`FAIL  ${id}: ${error.message.split('\n')[0].slice(0, 200)}`); } };
const text = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const must = (ok, message) => { if (!ok) throw new Error(message); };
const notUnavailable = async () => must((await page.getByText('Page unavailable').count()) === 0, 'the "Page unavailable" view is showing');

await check('landing page renders and offers sign-in', async () => {
  await page.goto(base + '/', { waitUntil: 'networkidle' }); await notUnavailable();
  must((await page.getByRole('link', { name: /sign in/i }).count()) > 0, 'no Sign in link'); must((await text()).length > 500, 'the page is almost empty');
});
await check('client-side click from the landing page reaches the sign-in form', async () => {
  await page.getByRole('link', { name: /sign in/i }).first().click(); await page.waitForURL('**/sign-in', { timeout: 15000 }); await notUnavailable();
  must(await page.getByLabel('Email address').isVisible(), 'no email field');
});
await check('sign-in page survives a hard reload with the form visible', async () => {
  await page.reload({ waitUntil: 'networkidle' }); await notUnavailable();
  must(await page.getByLabel('Email address').isVisible() && await page.getByRole('button', { name: 'Continue securely' }).isVisible(), 'the form is missing after reload');
});
await check('wrong synthetic credentials give the plain "Sign in to continue." (401), not a blocked-action or error page', async () => {
  await page.getByLabel('Email address').fill('nobody-synthetic@example.test'); await page.getByLabel('Password', { exact: true }).fill('synthetic-wrong-password-1');
  await page.getByRole('button', { name: 'Continue securely' }).click();
  const alert = page.locator('[role=alert]').filter({ hasText: /\S/ }); await alert.first().waitFor({ timeout: 15000 });
  const shown = (await alert.allInnerTexts()).join(' ');
  must(/Sign in to continue/.test(shown), `the message was "${shown.slice(0, 120)}"`);
});
for (const [name, path, expect] of [['Create account', '/register', /Create/i], ['Forgot your password?', '/forgot-password', /Recover|Reset|password/i]]) {
  await check(`"${name}" link opens its page`, async () => {
    await page.goto(base + '/sign-in', { waitUntil: 'networkidle' }); await page.getByRole('link', { name }).first().click(); await page.waitForURL('**' + path, { timeout: 15000 }); await page.waitForLoadState('networkidle'); await notUnavailable();
    let shown = await text(); for (let i = 0; i < 30 && /^\s*Loading/.test(shown); i++) { await page.waitForTimeout(500); shown = await text(); } must(expect.test(shown), `the page has no expected content (saw: ${shown.slice(0, 90)})`);
  });
}
await check('a signed-out visitor to a private screen sees the sign-in prompt, not an error', async () => {
  await page.goto(base + '/app/home', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); await notUnavailable();
  must(/Sign in to continue/.test(await text()), 'no sign-in prompt');
});
await check('admin console asks for sign-in and does not show records', async () => {
  await page.goto(base + '/admin', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  const shown = await text(); must(/Secure access/.test(shown) && /authenticator/i.test(shown), 'no secure-access prompt'); must(!/Audit history|Runtime events/.test(shown), 'admin records are visible');
});
await check('a route that does not exist shows the unavailable page with a way back', async () => {
  await page.goto(base + '/this-route-does-not-exist-' + Date.now()); must((await page.getByRole('heading', { name: 'Page unavailable' }).count()) === 1, 'no unavailable page'); must((await page.getByRole('link', { name: 'Return to ORYQEN' }).count()) === 1, 'no way back');
});
await check('the browser raised no uncaught page error', async () => { must(pageErrors.length === 0, pageErrors.join(' | ')); });
await browser.close();
console.log(failures ? `\n${failures} FAILED on ${base}` : `\nAll rendered checks passed on ${base}`);
process.exitCode = failures ? 1 : 0;
