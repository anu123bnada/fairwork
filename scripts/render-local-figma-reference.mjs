import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// The supplied PNG collection omits onboarding 1. Render its original SVG
// with its declared local fonts; label it as derived evidence, not an export.
const source = process.argv[2];
if (!source) throw new Error('Pass the original v4 SVG folder.');
const fontCss = [400, 500, 700, 800].map(weight => `@font-face{font-family:Manrope;font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/manrope/files/manrope-latin-${weight}-normal.woff2`).toString('base64')})}`).join('\n');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>${fontCss}body{margin:0}svg{display:block}</style>${readFileSync(join(source, '00-Onboarding-1.svg'), 'utf8')}`);
  await page.evaluate(() => document.fonts.ready);
  mkdirSync('test-results/day3-visual/reference', { recursive: true });
  await page.screenshot({ path: 'test-results/day3-visual/reference/00-Onboarding-1-derived.png' });
  writeFileSync('test-results/day3-visual/reference/00-Onboarding-1-derived.json', JSON.stringify({ source: join(source, '00-Onboarding-1.svg'), description: 'Chromium render of original SVG; supplied export collection has no onboarding 1 PNG.', fonts: [400,500,700,800], viewport: { width:390, height:844 } }, null, 2));
} finally { await browser.close(); }
