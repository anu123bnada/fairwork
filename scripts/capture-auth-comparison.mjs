import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const phase = process.argv[2];
assert.ok(['before', 'after'].includes(phase));
const directory = `test-results/auth-correction-20261016/${phase}`;
assert.ok(!existsSync(directory), 'Do not overwrite comparison evidence.');
mkdirSync(directory, { recursive: true });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', FAIRWORK_DATA_MODE: 'synthetic', FAIRWORK_BROWSER_SMOKE: '1', APP_ORIGIN: 'http://localhost:3000' };
try { await fetch('http://127.0.0.1:3101', { signal: AbortSignal.timeout(1000) }); throw new Error('Port occupied'); } catch (e) { if (e.message === 'Port occupied') throw e; }
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3101'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', browser;
const rows = [];
for (const stream of [server.stdout, server.stderr]) stream.on('data', data => { log += data; });
try {
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw new Error(log);
    try { ready = (await fetch('http://127.0.0.1:3101')).ok; } catch { /* Our local child is starting. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready);
  browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:3101', reducedMotion: 'reduce', colorScheme: 'light' });
  const id = '40000000-0000-4000-8000-000000000001';
  await page.route('**/api/v1/me', route => route.fulfill({ json: { data: { id, displayName: 'Synthetic Worker', locale: 'en', timeZone: 'UTC', revision: 1, capabilities: [] } } }));
  await page.route('**/api/v1/auth/mfa', route => route.fulfill({ json: { data: { factors: [{ id, status: 'verified' }] } } }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const screens = [['sign-in', '/sign-in'], ['entry', '/welcome'], ['otp', '/otp'], ['onboarding-1', '/intro/onboarding'], ['onboarding-2', '/intro/onboarding?slide=2'], ['onboarding-3', '/intro/onboarding?slide=3'], ['operator-control', '/operator/authority'], ['home-control', '/app/home']];
  if (phase === 'after') screens.push(['information', '/sign-in/information']);
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [name, url] of screens) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      if (name === 'otp') await page.getByLabel('Authenticator digit 1').fill('123456');
      if (name === 'home-control') await page.getByRole('heading', { name: 'Good morning, Synthetic' }).waitFor();
      if (name === 'operator-control') await page.getByLabel('6-digit authenticator code').waitFor();
      const metrics = await page.evaluate(() => {
        const selectors = ['.fw-auth-brand', 'h1', '.fw-auth-subtitle', '.fw-otp-description', 'form', 'input', 'form button', '.fw-otp-fields', '.fw-onboarding-art', '.fw-onboarding-copy', '.fw-primary'];
        return { overflow: document.documentElement.scrollWidth > innerWidth, elements: selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(el => { const s = getComputedStyle(el); return { selector, bounds: el.getBoundingClientRect().toJSON(), font: s.fontFamily, fontSize: s.fontSize, weight: s.fontWeight, background: s.backgroundImage, radius: s.borderRadius, blur: s.backdropFilter }; })) };
      });
      assert.equal(metrics.overflow, false, `${width}-${name}`);
      const file = `${width}-${name}.png`;
      await page.screenshot({ path: `${directory}/${file}`, animations: 'disabled' });
      await page.screenshot({ path: `${directory}/${width}-${name}-full.png`, animations: 'disabled', fullPage: true });
      rows.push({ name, url, width, height: 844, file, metrics });
    }
  }
  assert.deepEqual(errors, []);
  console.log(`${phase}: ${rows.length} viewport captures plus full-page counterparts`);
} finally {
  writeFileSync(`${directory}/measurements.json`, JSON.stringify(rows, null, 2));
  if (browser) await browser.close();
  writeFileSync(`${directory}/server.log`, log);
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
}
