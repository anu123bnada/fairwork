import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

// Builds the app the way a real-backend deployment is built (public Supabase variables set) and checks that sample-preview links are not offered to signed-in people.
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_dummykeydummykeydummy', APP_ORIGIN: 'http://127.0.0.1:3102', FAIRWORK_DATA_MODE: 'synthetic', NEXT_TELEMETRY_DISABLED: '1' };
const build = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { env, encoding: 'utf8' });
if (build.status !== 0) { console.log('BUILD FAILED', (build.stdout + build.stderr).slice(-600)); process.exit(1); }
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3102'], { env, stdio: 'ignore' });
let failures = 0;
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:3102')).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/api/v1/**', route => route.request().url().endsWith('/api/v1/me') ? route.fulfill({ json: { data: { id: '40000000-0000-4000-8000-000000000001', displayName: 'Synthetic worker', locale: 'en', timeZone: 'UTC', revision: 1, capabilities: [] } } }) : route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  for (const route of ['/app/home', '/app/check', '/app/passport']) {
    await page.goto(`http://127.0.0.1:3102${route}`); await page.waitForLoadState('networkidle');
    const demo = await page.getByText(/Figma sample|^Demo$/).count();
    console.log(`${demo === 0 ? 'PASS' : 'FAIL'}  ${route}: sample-preview links shown = ${demo}`); if (demo) failures++;
  }
  await page.goto('http://127.0.0.1:3102/app/home?preview=demo'); await page.waitForLoadState('networkidle');
  const label = await page.getByText(/DEMO PREVIEW/).count();
  console.log(`${label > 0 ? 'PASS' : 'FAIL'}  the labelled preview URL still shows its DEMO PREVIEW label (${label})`); if (!label) failures++;
  await browser.close();
} finally { server.kill(); }
console.log(failures ? `${failures} FAILED` : 'All checks passed');
