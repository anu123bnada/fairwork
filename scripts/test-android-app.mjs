import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';

// Drives the installed ORYQEN Online Preview app through its WebView's DevTools socket: where it is, what it shows, and one wrong-credentials sign-in.
const adb = 'C:/Users/vehiv/AppData/Local/Android/Sdk/platform-tools/adb.exe', serial = 'emulator-5554', pkg = 'org.fairwork.localpoc.online';
const sh = (...args) => spawnSync(adb, ['-s', serial, ...args], { encoding: 'utf8' }).stdout.trim();
const pid = sh('shell', 'pidof', pkg);
const socket = sh('shell', 'cat', '/proc/net/unix').split(/\r?\n/).map(line => line.trim().split(/\s+/).pop()).find(name => name === `@webview_devtools_remote_${pid}`);
if (!socket) { console.log(`FAIL  no WebView DevTools socket for pid ${pid}`); process.exit(1); }
sh('forward', 'tcp:9333', `localabstract:${socket.slice(1)}`);
let failures = 0;
const check = async (id, action) => { try { const detail = await action(); console.log(`PASS  ${id}${detail ? `: ${detail}` : ''}`); } catch (error) { failures++; console.log(`FAIL  ${id}: ${error.message.split('\n')[0].slice(0, 220)}`); } };
const must = (ok, message) => { if (!ok) throw new Error(message); };
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts().flatMap(context => context.pages()).find(p => /oryqen/.test(p.url())) ?? browser.contexts()[0]?.pages()[0];
await check('the app is showing the staging sign-in page inside its WebView', async () => {
  await page.getByLabel('Email address').waitFor({ timeout: 60000 }); must(page.url().startsWith('https://oryqen-staging.vercel.app/'), page.url()); return page.url();
});
await check('wrong synthetic credentials get the plain sign-in message from the real staging auth service', async () => {
  await page.getByLabel('Email address').fill('nobody-synthetic@example.test'); await page.getByLabel('Password', { exact: true }).fill('synthetic-wrong-password-1');
  await page.getByRole('button', { name: 'Continue securely' }).click();
  const alert = page.locator('[role=alert]').filter({ hasText: /\S/ }); await alert.first().waitFor({ timeout: 30000 });
  const shown = (await alert.allInnerTexts()).join(' '); must(/email and password do not match/.test(shown), `message was "${shown.slice(0, 100)}"`);
});
await check('create-account page opens inside the app', async () => { await page.goto('https://oryqen-staging.vercel.app/register'); await page.getByText(/Create your account/).waitFor({ timeout: 30000 }); });
await browser.close();
sh('forward', '--remove', 'tcp:9333');
console.log(failures ? `\n${failures} FAILED` : '\nAll in-app checks passed');
process.exitCode = failures ? 1 : 0;
