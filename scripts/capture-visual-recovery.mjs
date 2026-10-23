// Local screenshot evidence only: synthetic HTTP fixtures never enter application code.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const phase = process.argv[2];
assert.ok(['before', 'after', 'after-notifications'].includes(phase), 'Pass before, after or after-notifications.');
const directory = `test-results/visual-recovery-20261016/${phase}`;
assert.ok(!existsSync(directory), 'Evidence already exists; choose a new run directory instead of overwriting it.');
mkdirSync(directory, { recursive: true });
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', FAIRWORK_DATA_MODE: 'synthetic', FAIRWORK_BROWSER_SMOKE: '1', APP_ORIGIN: 'http://localhost:3000' };
try { await fetch('http://127.0.0.1:3101', { signal: AbortSignal.timeout(1000) }); throw new Error('Port 3101 occupied.'); }
catch (error) { if (error.message === 'Port 3101 occupied.') throw error; }
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3101'], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', data => { log += data; });
let browser;
const evidence = [];
try {
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (server.exitCode !== null) throw new Error(log);
    try { ready = (await fetch('http://127.0.0.1:3101')).ok; } catch { /* Wait for our own server. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready);
  browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:3101' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const worker = '40000000-0000-4000-8000-000000000001';
  const employer = '40000000-0000-4000-8000-000000000002';
  const offerId = '40000000-0000-4000-8000-000000000003';
  const offer = { offerId, companyId: '40000000-0000-4000-8000-000000000005', workerId: worker, requesterId: employer, requesterRole: 'EMPLOYER', representativeId: employer, version: 1, termHash: 'a'.repeat(64), changes: [], snapshot: { role: 'Motorcycle Technician', salary: 50000, currency: 'LKR', startDate: '2026-11-01', hoursPerWeek: 40 }, unresolved: [{ id: '40000000-0000-4000-8000-000000000006', field: 'responsibilities', question: 'What core responsibilities are still unresolved?', required: true }] };
  await page.route('**/api/v1/me', route => route.fulfill({ json: { data: { id: worker, displayName: 'Synthetic Worker', locale: 'en', timeZone: 'UTC', revision: 1, capabilities: [] } } }));
  await page.route('**/api/v1/auth/mfa', route => route.fulfill({ json: { data: { factors: [{ id: worker, status: 'verified' }] } } }));
  await page.route('**/api/v1/agreements?*', route => route.fulfill({ json: { data: { offer, agreementId: '40000000-0000-4000-8000-000000000004', answers: [], confirmation: null, canConfirm: false } } }));
  await page.route('**/api/v1/work-records*', route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.route('**/api/v1/work-cases*', route => route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  const screens = [
    ['sign-in', '/sign-in'], ['onboarding-1', '/intro/onboarding'], ['onboarding-2', '/intro/onboarding?slide=2'], ['onboarding-3', '/intro/onboarding?slide=3'], ['language', '/intro/language'], ['entry-welcome', '/welcome'], ['otp', '/otp'], ['welcome', '/app/intro-welcome'],
    ['home', `/app/home?offerId=${offerId}`], ['home-sample', '/app/home?preview=demo'], ['add-offer', '/app/add-offer'],
    ...['analyzing', 'check', 'questions', 'agreement'].map(screen => [screen, `/app/${screen}?offerId=${offerId}`]),
    ['work-record', '/app/work-record'], ['work-record-sample', '/app/work-record?preview=demo'], ['passport', '/app/passport'], ['passport-sample', '/app/passport?preview=demo'],
    ['settings', '/app/settings'], ['employer', '/app/employer'], ['share', '/app/share'], ['notifications', '/app/notifications'], ['cases', '/app/cases'], ['splash', '/intro/splash'],
  ];
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/sign-in');
      await page.evaluate(value => localStorage.setItem('oryqen.appearance', value), theme);
      const selectedScreens = phase === 'after-notifications' ? screens.filter(([screen]) => screen === 'notifications') : screens;
      for (const [screen, url] of selectedScreens) {
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        if (url.startsWith('/app/')) await page.locator('.fw-product-body').waitFor();
        if (screen !== 'splash') await page.waitForTimeout(80);
        const metrics = await page.evaluate(() => {
          const main = document.querySelector('main');
          const style = getComputedStyle(main);
          const controls = [...document.querySelectorAll('button,a,input,select,textarea')].filter(el => el.getBoundingClientRect().width > 0);
          return { width: main.getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth, background: style.backgroundImage, font: style.fontFamily, colorScheme: getComputedStyle(document.documentElement).colorScheme,
            smallTargets: controls.filter(el => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; }).map(el => ({ label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 60), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
            images: [...document.images].map(el => ({ src: el.getAttribute('src'), loaded: el.complete && el.naturalWidth > 0, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
            glass: [...document.querySelectorAll('.fw-card,.fw-onboarding-art,.fw-question-card')].map(el => ({ blur: getComputedStyle(el).backdropFilter, shadow: getComputedStyle(el).boxShadow })),
          };
        });
        const file = `${width}-${theme}-${screen}.png`;
        await page.screenshot({ path: `${directory}/${file}`, animations: 'disabled' });
        if (screen !== 'splash') await page.screenshot({ path: `${directory}/${file.replace('.png', '-full.png')}`, fullPage: true, animations: 'disabled' });
        evidence.push({ width, height: 844, theme, screen, url, file, metrics });
        if (phase.startsWith('after')) { assert.equal(metrics.overflow, false, file); assert.ok(metrics.images.every(img => img.loaded), `Missing image: ${file}`); }
      }
      console.log(`${phase}: ${width}px ${theme}: ${selectedScreens.length} screens captured`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(`${directory}/measurements.json`, JSON.stringify(evidence, null, 2));
  if (browser) await browser.close();
  writeFileSync(`${directory}/server.log`, log);
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
}
