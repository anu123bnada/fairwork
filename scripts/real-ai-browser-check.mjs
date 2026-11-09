// Opt-in end-to-end check in a REAL browser: paste an offer, tick the AI consent box, press Analyze offer, watch the popup stages, and read the report. It makes ONE real model call
// on made-up text (provider quota), so it is never part of the default gates. Local stack only (the account is registered through the real flow and the confirmation mail is read
// from the local mail sink). The app must be running with AI configured:
//   node scripts/real-ai-browser-check.mjs [http://127.0.0.1:3100] [--mail=http://127.0.0.1:55424]
// Screenshots go to test-results/real-ai-browser/ (git-ignored).
import { chromium } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';

const origin = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:3100';
const mail = (process.argv.find(arg => arg.startsWith('--mail=')) ?? '--mail=http://127.0.0.1:55424').slice(7);
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) { console.error('Local origins only.'); process.exit(2); }
const out = 'test-results/real-ai-browser'; mkdirSync(out, { recursive: true });
const TEXT = 'Warehouse Picker at Example Stores\nSalary: LKR 85000 per month\n40 hours per week\nYou must pay a registration fee of LKR 5000 before you start. Guaranteed visa for everyone.';
const results = []; const note = (status, id, detail = '') => { results.push(status); console.log(`${status.padEnd(5)} ${id}${detail ? `: ${detail}` : ''}`); };

const browser = await chromium.launch(); const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { Origin: origin } });
const post = async (path, data) => { const r = await context.request.post(origin + path, { data, headers: { 'Idempotency-Key': randomUUID() } }); if (!r.ok()) throw new Error(`${path} answered ${r.status()}`); return (await r.json()).data; };
try {
  const email = `real-ai-${randomUUID()}@example.test`, password = randomBytes(24).toString('base64url');
  await post('/api/v1/auth/register', { email, password });
  let link = null;
  for (let i = 0; i < 40 && !link; i++) {
    const list = await fetch(mail + '/api/v1/messages').then(r => r.json());
    const item = list.messages.find(m => m.Subject.includes('Confirm') && m.To.some(t => t.Address === email));
    if (item) link = (await fetch(mail + '/api/v1/message/' + item.ID).then(r => r.json())).HTML.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&'); else await new Promise(r => setTimeout(r, 500));
  }
  await post('/api/v1/auth/confirm', { tokenHash: new URLSearchParams(new URL(link).hash.slice(1)).get('token_hash') });
  await post('/api/v1/me', { displayName: 'Synthetic AI check', locale: 'en', timeZone: 'Asia/Colombo' });
  await post('/api/v1/auth/sign-in', { email, password });
  note('PASS', 'Signed in with a throwaway local account');

  const page = await context.newPage();
  await page.goto(origin + '/app/add-offer', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Paste offer text').fill(TEXT);
  await page.getByRole('button', { name: 'Suggest terms with local rules' }).click();
  await page.getByLabel('Role title', { exact: true }).fill('Warehouse Picker');
  const consent = page.getByLabel('AI analysis choice');
  await consent.waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${out}/1-add-offer-with-ai-choice.png`, fullPage: true });
  await consent.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Analyze offer', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Analyzing your offer' });
  await dialog.waitFor({ timeout: 30000 });
  await dialog.locator('[data-stage="ai"][data-state="active"]').waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${out}/2-popup-waiting-for-the-model.png` });
  note('PASS', 'The popup shows real stages and is waiting for the model', (await dialog.locator('[data-stage]').evaluateAll(items => items.map(item => `${item.dataset.stage}=${item.dataset.state}`).join(', '))));

  const report = page.getByLabel('Offer analysis report', { exact: true });
  await report.waitFor({ timeout: 170000 });
  await page.screenshot({ path: `${out}/3-report.png`, fullPage: true });
  const summary = await report.getByLabel('Executive summary').innerText();
  if (/AI analysis ran/.test(summary)) {
    const findings = await report.getByLabel('AI analysis findings').innerText();
    note('PASS', 'The report opened with real AI findings kept separate from the rules', `${findings.length} characters of AI findings`);
  } else note('FAIL', 'The AI step did not complete', summary.split('\n').filter(line => /AI/.test(line)).join(' | ').slice(0, 300));
  await report.getByLabel('Confidence and limitations').waitFor();
  note('PASS', 'The report shows its confidence and limitations');
} catch (error) { note('FAIL', 'Check stopped', String(error.message).split('\n')[0].slice(0, 300)); }
await browser.close();
console.log(`\n${results.filter(r => r === 'PASS').length} passed, ${results.filter(r => r === 'FAIL').length} failed. Screenshots: ${out}`);
process.exit(results.includes('FAIL') ? 1 : 0);
