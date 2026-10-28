import { _electron as electron } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Launches the built Windows app (unpacked or installed) and checks what a person would see: it starts, it is on the staging origin, it shows the sign-in form,
// wrong credentials give the plain message, and an external link is not opened inside the privileged window.
const exe = process.argv[2];
if (!exe || !existsSync(exe)) { console.error('Usage: node test-windows-app.mjs <path to ORYQEN Preview.exe>'); process.exit(2); }
const expected = 'https://oryqen-staging.vercel.app';
let failures = 0;
const check = async (id, action) => { try { const detail = await action(); console.log(`PASS  ${id}${detail ? `: ${detail}` : ''}`); } catch (error) { failures++; console.log(`FAIL  ${id}: ${error.message.split('\n')[0].slice(0, 220)}`); } };
const must = (ok, message) => { if (!ok) throw new Error(message); };
const userData = path.join(process.env.TEMP ?? '.', `oryqen-desktop-test-${Date.now()}`);
const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`] });
const window = await app.firstWindow();
await check('the app starts and shows a window titled with the staging host', async () => { await window.waitForLoadState('domcontentloaded'); const title = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle()); must(/staging/.test(title ?? ''), `title was "${title}"`); return title; });
await check('it connected to the configured staging origin and shows the sign-in form', async () => {
  await window.waitForURL(`${expected}/sign-in`, { timeout: 60000 }); await window.getByLabel('Email address').waitFor({ timeout: 30000 });
  must(window.url().startsWith(expected), window.url()); return window.url();
});
await check('wrong synthetic credentials show the plain sign-in message (the real staging auth service answered)', async () => {
  await window.getByLabel('Email address').fill('nobody-synthetic@example.test'); await window.getByLabel('Password', { exact: true }).fill('synthetic-wrong-password-1');
  await window.getByRole('button', { name: 'Continue securely' }).click();
  const alert = window.locator('[role=alert]').filter({ hasText: /\S/ }); await alert.first().waitFor({ timeout: 30000 });
  const shown = (await alert.allInnerTexts()).join(' '); must(/email and password do not match/.test(shown), `message was "${shown.slice(0, 100)}"`);
});
await check('a link to another website is not opened inside the app window', async () => {
  const before = window.url();
  await window.evaluate(() => { const a = document.createElement('a'); a.href = 'https://example.com/'; a.textContent = 'x'; a.id = 'probe'; document.body.append(a); a.click(); });
  await window.waitForTimeout(1500);
  must(window.url() === before, `the window navigated to ${window.url()}`);
});
await check('create-account and forgot-password pages open inside the app', async () => {
  await window.goto(`${expected}/forgot-password`); await window.getByLabel('Email address').waitFor({ timeout: 30000 });
  await window.goto(`${expected}/register`); await window.getByText(/Create your account/).waitFor({ timeout: 30000 });
});
await app.close();
console.log(failures ? `\n${failures} FAILED` : '\nAll launch checks passed');
process.exitCode = failures ? 1 : 0;
