// Real installed Capacitor WebView + local Auth/PostgreSQL. No browser route mocks.
// Retains synthetic accounts and the installed APK; never clears app/device data.
import { _android, expect as baseExpect } from '@playwright/test';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { checkLocalDocker } from './local-development-runtime.mjs';

checkLocalDocker();
const adb = path.join(process.env.USERPROFILE, 'AppData/Local/Android/Sdk/platform-tools/adb.exe');
const serial = 'emulator-5554', pkg = 'org.fairwork.localpoc';
const origin = 'http://localhost:3102';
const evidence = `test-results/android-real-${Date.now()}`;
mkdirSync(evidence, { recursive: true });
const results = [];
const expect = baseExpect.configure({ timeout: 30000 });
let device, stage = 'preflight';
const pass = check => { results.push({ check, status: 'PASS' }); console.log(`PASS: ${check}`); };
function command(args) {
  const r = spawnSync(adb, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (r.status !== 0) throw new Error(`ADB ${args[0]} failed`);
  return r.stdout;
}
async function pageForApp() {
  command(['shell', 'am', 'start', '-n', `${pkg}/.MainActivity`]);
  return (await device.webView({ pkg }, { timeout: 60000 })).page();
}
try {
  if (command(['get-state']).trim() !== 'device' || command(['shell', 'getprop', 'sys.boot_completed']).trim() !== '1') throw new Error('Authorized, fully booted emulator required');
  if (!(await fetch('http://127.0.0.1:3102/sign-in')).ok) throw new Error('Start the real local Android server first');
  const apk = 'mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk';
  const bytes = readFileSync(apk);
  writeFileSync(`${evidence}/artifact.json`, JSON.stringify({ apk, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), serial, physicalDevice: false }, null, 2));
  stage = 'APK installation';
  if (!command(['install', '-r', apk]).includes('Success')) throw new Error('APK install did not report Success');
  pass('Debug APK installed successfully on authorized Android emulator without clearing data');
  command(['reverse', 'tcp:3102', 'tcp:3102']);
  stage = 'WebView attachment';
  // WebView auth traffic uses Next's server-side Supabase client; no provider key
  // or database URL is installed in the APK or sent to this script's evidence.
  [device] = (await _android.devices({ omitDriverInstall: true })).filter(d => d.serial() === serial);
  if (!device) throw new Error('Playwright could not attach to the authorized emulator');
  device.setDefaultTimeout(60000);
  let page = await pageForApp();
  page.setDefaultTimeout(60000);
  stage = 'startup and onboarding';
  await page.goto(`${origin}/`);
  await page.waitForURL('**/intro/onboarding', { timeout: 90000 });
  await expect(page.getByRole('heading', { name: 'See what’s clear' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.getByRole('link', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  pass('Installed app startup reaches original onboarding, language and real sign-in');
  await page.screenshot({ path: `${evidence}/sign-in.png` });

  stage = 'real registration and confirmation';
  const email = `oryqen-android-${randomUUID()}@example.test`, password = randomBytes(24).toString('base64url');
  await page.goto(`${origin}/register`);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const registration = page.waitForResponse(r => r.url().endsWith('/api/v1/auth/register'));
  await page.getByRole('button', { name: 'Register with email' }).click();
  if ((await registration).status() !== 200) throw new Error('Real registration failed');
  let confirmation;
  for (let i = 0; i < 30; i++) {
    const list = await fetch('http://127.0.0.1:55424/api/v1/messages').then(r => r.json());
    const message = list.messages?.find(m => m.To?.some(t => t.Address === email));
    if (message) {
      const detail = await fetch(`http://127.0.0.1:55424/api/v1/message/${message.ID}`).then(r => r.json());
      confirmation = detail.HTML?.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  const link = new URL(confirmation ?? 'about:blank');
  // Local mail template is fixed to the founder's loopback app. Transfer only the
  // real one-time token to this test's loopback WebView confirmation route.
  if (!['http://127.0.0.1:3100', origin].includes(link.origin) || link.pathname !== '/auth/confirm' || !link.hash.startsWith('#token_hash=')) throw new Error('Unexpected local mail confirmation');
  await page.goto(`${origin}/auth/confirm${link.hash}`);
  await page.getByRole('button', { name: 'Confirm my email' }).click();
  await page.waitForURL('**/register/profile');
  await page.getByLabel('Display name').fill('Synthetic Android user');
  await page.getByRole('button', { name: 'Create my profile' }).click();
  await page.waitForURL('**/app/intro-welcome');
  await page.goto(`${origin}/app/home`);
  await expect(page.getByRole('heading', { name: /Good morning, Synthetic/ })).toBeVisible();
  pass('Real email registration, local confirmation and persistent profile succeed in Android WebView');
  await page.screenshot({ path: `${evidence}/home.png`, fullPage: true });

  stage = 'navigation and native back';
  await page.getByRole('link', { name: 'Open settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  const focus = command(['shell', 'dumpsys', 'window']);
  if (/mCurrentFocus=.*Application Not Responding/.test(focus)) throw new Error('EMULATOR_ANR');
  command(['shell', 'input', 'keyevent', '4']);
  await page.waitForURL('**/app/home');
  pass('Native Android Back returns from Settings to the authenticated home');
  await page.goto(`${origin}/app/employer`);
  await expect(page.getByText('Your employer workspace', { exact: true })).toBeVisible();
  await expect(page.getByText('No saved offers are available in this workspace.')).toBeVisible();
  pass('Employer workspace loads with no unauthorized organization offers for an unassigned account');
  await page.goto(`${origin}/app/passport`);
  await expect(page.getByRole('heading', { name: 'Work Passport', exact: true })).toBeVisible();
  pass('Worker private Passport route loads through real authenticated APIs');

  stage = 'lifecycle and persistence';
  command(['shell', 'input', 'keyevent', '3']);
  page = await pageForApp();
  await page.goto(`${origin}/app/home`);
  await expect(page.getByRole('heading', { name: /Good morning, Synthetic/ })).toBeVisible();
  pass('Background and resume preserve the real authenticated session');
  command(['shell', 'am', 'force-stop', pkg]);
  // A killed Android process invalidates its DevTools socket. Reattach rather
  // than asking the old Playwright device wrapper for its cached WebView.
  await device.close();
  [device] = (await _android.devices({ omitDriverInstall: true })).filter(d => d.serial() === serial);
  if (!device) throw new Error('Authorized emulator disconnected after app restart');
  device.setDefaultTimeout(60000);
  page = await pageForApp();
  await page.goto(`${origin}/app/home`);
  await expect(page.getByRole('heading', { name: /Good morning, Synthetic/ })).toBeVisible();
  pass('App process restart preserves the real session and PostgreSQL profile');

  stage = 'network failure';
  command(['reverse', '--remove', 'tcp:3102']);
  await page.getByRole('region', { name: 'Saved offers' }).getByRole('button', { name: 'Refresh offers' }).click();
  await expect(page.getByRole('region', { name: 'Saved offers' }).getByRole('alert')).toBeVisible();
  pass('Actual reverse-tunnel interruption produces an API error rather than fabricated success');
  command(['reverse', 'tcp:3102', 'tcp:3102']);
  await page.getByRole('region', { name: 'Saved offers' }).getByRole('button', { name: 'Refresh offers' }).click();
  await expect(page.getByText('No saved offers are available in this workspace.')).toBeVisible();
  pass('Restoring connectivity reloads authorized persistent data');

  stage = 'sign-out and sign-in';
  await page.goto(`${origin}/app/settings`);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continue securely' }).click();
  await page.waitForURL('**/app/intro-welcome');
  pass('Real sign-out and fresh password sign-in work in the installed application');
  await page.screenshot({ path: `${evidence}/signed-in-again.png` });
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  const reason = message === 'EMULATOR_ANR' ? 'Emulator ANR dialog intercepts native input' : /Timeout|timed out/i.test(message) ? 'Timed out waiting for the real UI or device' : /closed|ECONNRESET|socket|Target/i.test(message) ? 'Android WebView debugging connection closed or reset' : 'Local assertion failed';
  results.push({ check: stage, status: 'FAIL', reason });
  console.error(`FAIL: ${stage}: ${reason}`); process.exitCode = 1;
} finally {
  // Restore only the dedicated test tunnel; do not stop the founder's services.
  try { command(['reverse', 'tcp:3102', 'tcp:3102']); } catch { /* Recorded failure remains. */ }
  await device?.close();
  writeFileSync(`${evidence}/results.json`, JSON.stringify({ at: new Date().toISOString(), environment: 'Installed debug APK on Android emulator + real local services', results, limits: 'No physical-device, signed release, hosted endpoint or approved brand validation. Synthetic account retained.' }, null, 2));
  console.log(`Evidence: ${evidence}/results.json`);
}
