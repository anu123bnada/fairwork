import { expect, test, type Page } from '@playwright/test';

// Layout sweep over every signed-in screen: no horizontal overflow, no page errors, a main landmark and navigation, no tiny targets, at phone, tablet and desktop widths.
// The signed-in identity is an intercepted /api/v1/me response and every other API call is answered with an authorization-free empty result, so this checks layout and
// rendering only. It is not evidence that any feature works against real data.
const screens = ['home', 'add-offer', 'check', 'questions', 'agreement', 'agreement-workflow', 'work-record', 'cases', 'passport', 'settings', 'employer', 'notifications', 'share', 'opportunities', 'guidance', 'analyzing'];
const widths = [320, 375, 430, 768, 1024, 1280, 1440, 1920];
const me = { data: { id: '40000000-0000-4000-8000-000000000001', displayName: 'Synthetic worker', locale: 'en', timeZone: 'UTC', revision: 1, capabilities: [] } };

async function open(page: Page, screen: string, width: number) {
  await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
  await page.route('**/api/v1/**', route => route.request().url().includes('/api/v1/me') && !route.request().url().includes('/api/v1/me/')
    ? route.fulfill({ json: me })
    : route.fulfill({ json: { data: { items: [], threads: [], turns: [], records: [], providerAvailable: false } } }));
  await page.goto(`/app/${screen}`);
  await page.waitForLoadState('networkidle');
}

for (const screen of screens) for (const width of widths) test(`/app/${screen} lays out at ${width}px`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page, screen, width);
  expect(errors, 'uncaught page errors').toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'horizontal overflow (px)').toBeLessThanOrEqual(0);
  expect(await page.locator('main, [role=main], .fw-product-body').count(), 'content landmark').toBeGreaterThan(0);
  const small = await page.evaluate(() => [...document.querySelectorAll('a,button,input:not([type=hidden]),select,textarea,[role=button]')].filter(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('[hidden],[aria-hidden=true]') && (r.height < 24 || r.width < 24) && !(el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)); }).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`));
  expect(small, 'targets smaller than 24 CSS px').toEqual([]);
  if ([375, 1440].includes(width)) await page.screenshot({ path: `test-results/sweep/${screen}-${width}.png`, fullPage: true });
});

for (const width of [375, 1440]) test(`landing page has no controls under 24 CSS px at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const small = await page.evaluate(() => [...document.querySelectorAll('a,button,input:not([type=hidden]),select,textarea')].filter(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && s.visibility !== 'hidden' && (r.height < 24 || r.width < 24); }).map(el => `${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
  expect(small).toEqual([]);
});
