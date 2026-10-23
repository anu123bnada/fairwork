import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

const root = 'test-results/visual-recovery-20261016';
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const baseline = JSON.parse(readFileSync('test-results/oryqen-rollback-1792098967410/manifest.json', 'utf8'));
const source = baseline.files.map(file => ({ path: file.path.replaceAll('\\', '/'), before: file.sha256, after: existsSync(file.path) ? hash(file.path) : null }));
const protectedFiles = source.filter(file => /^(supabase\/|src\/(server|features|lib|types)\/|src\/app\/api\/|public\/figma\/|\.github\/)/.test(file.path) || ['src/components/oryqen/profile-editor.tsx', 'next.config.ts', 'mobile/poc/android/app/build.gradle', 'mobile/poc/android/app/src/main/java/org/fairwork/localpoc/MainActivity.java', 'mobile/poc/android/app/src/debug/res/xml/local_poc_network_security.xml', 'mobile/poc/capacitor.config.json'].includes(file.path));
const preservation = { baseline: 'oryqen-rollback-1792098967410', compared: source.length, unchanged: source.filter(f => f.before === f.after).length, changed: source.filter(f => f.before !== f.after && f.after), missing: source.filter(f => !f.after), protectedCount: protectedFiles.length, protectedChanged: protectedFiles.filter(f => f.before !== f.after) };
writeFileSync(`${root}/preservation.json`, JSON.stringify(preservation, null, 2));
if (preservation.missing.length || preservation.protectedChanged.length) throw new Error('Preservation check failed.');
console.log(JSON.stringify(preservation));
if (!existsSync(`${root}/after/measurements.json`)) process.exit(0);
const pairs = [
  ['00-Splash', 'splash'], ['00-Onboarding-1-derived', 'onboarding-1'], ['00-Onboarding-2', 'onboarding-2'], ['00-Onboarding-3', 'onboarding-3'], ['00-Language', 'language'], ['00-Sign-in', 'sign-in'], ['00-OTP', 'otp'], ['01-Welcome', 'welcome'], ['02-Home', 'home-sample'], ['03-Add-offer', 'add-offer'], ['04-Analyzing', 'analyzing'], ['05-FAIRWORK-Check', 'check'], ['06-Questions', 'questions'], ['07-Agreement', 'agreement'], ['08-Work-record', 'work-record-sample'], ['09-Work-Passport', 'passport-sample'], ['10-Settings', 'settings'], ['11-Employer', 'employer'], ['12-Share-sheet', 'share'], ['13-Notifications', 'notifications'],
];
const records = [];
const notificationsFixed = existsSync(`${root}/after-notifications/measurements.json`);
mkdirSync(`${root}/reference`, { recursive: true });
mkdirSync(`${root}/comparisons`, { recursive: true });
for (const [name, screen] of pairs) {
  const original = name.endsWith('-derived') ? `test-results/day3-visual/reference/${name}.png` : `C:/Users/vehiv/Downloads/Untitled/${name}.png`;
  const reference = `${root}/reference/${name}.png`;
  if (!existsSync(reference)) copyFileSync(original, reference);
  const before = `${root}/before/390-light-${screen}.png`;
  const finalNotification = notificationsFixed && screen === 'notifications';
  const after = `${root}/${finalNotification ? 'after-notifications' : 'after'}/390-light-${screen}.png`;
  const comparison = `${root}/comparisons/${screen}${finalNotification ? '-final' : ''}.png`;
  // Originals and captures remain unaltered. Composition is a separate artifact.
  if (!existsSync(comparison)) await sharp({ create: { width: 1170, height: 844, channels: 3, background: '#ffffff' } }).composite([{ input: reference, left: 0, top: 0 }, { input: before, left: 390, top: 0 }, { input: after, left: 780, top: 0 }]).png().toFile(comparison);
  records.push({ screen, original: path.resolve(original), originalSha256: hash(original), derived: name.endsWith('-derived'), before, beforeSha256: hash(before), after, afterSha256: hash(after), comparison, dimensions: [390,844] });
}
for (let group = 0; group < 4; group++) {
  const output = `${root}/comparisons/contact-${group + 1}${notificationsFixed && group === 3 ? '-final' : ''}.png`;
  if (existsSync(output)) continue;
  const tiles = await Promise.all(records.slice(group * 5, group * 5 + 5).map(async (record, index) => ({ input: await sharp(record.comparison).resize(702, 506).png().toBuffer(), left: index % 2 * 722, top: Math.floor(index / 2) * 526 })));
  await sharp({ create: { width: 1444, height: 1578, channels: 3, background: '#d0d4df' } }).composite(tiles).png().toFile(output);
}
writeFileSync(`${root}/comparisons.json`, JSON.stringify(records, null, 2));
const measurements = JSON.parse(readFileSync(`${root}/after/measurements.json`, 'utf8')).map(row => ({ ...row, captureDirectory: 'after' }));
if (notificationsFixed) {
  for (const row of JSON.parse(readFileSync(`${root}/after-notifications/measurements.json`, 'utf8'))) {
    const index = measurements.findIndex(old => old.file === row.file);
    measurements[index] = { ...row, captureDirectory: 'after-notifications' };
  }
}
const summary = { viewportCaptures: measurements.length, pngFiles: readdirSync(`${root}/after`).filter(f => f.endsWith('.png')).length, overflow: measurements.filter(r => r.metrics.overflow).map(r => r.file), missingImages: measurements.filter(r => r.metrics.images.some(i => !i.loaded)).map(r => r.file), smallTargets: measurements.filter(r => r.width === 390 && r.theme === 'light' && r.metrics.smallTargets.length).map(r => ({ screen: r.screen, targets: r.metrics.smallTargets })) };
writeFileSync(`${root}/visual-summary.json`, JSON.stringify(summary, null, 2));
const sections = records.map(r => `<section><h2>${r.screen}</h2><p>${r.derived ? 'Original SVG rendering; no supplied PNG.' : 'Supplied original PNG.'} ${r.screen.endsWith('-sample') ? 'Labelled Figma sample; live-data captures are separate.' : 'Synthetic browser transport fixture where authenticated.'}</p><p>Original (left) · rejected ORYQEN (middle) · restored ORYQEN (right)</p><a href="comparisons/${path.basename(r.comparison)}"><img src="comparisons/${path.basename(r.comparison)}" alt="Original, before and restored ${r.screen}"></a></section>`).join('');
const links = measurements.map(r => `<li><a href="${r.captureDirectory}/${r.file}">${r.width}px / ${r.theme} device / ${r.screen}</a> · <a href="before/${r.file}">before</a></li>`).join('');
writeFileSync(`${root}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ORYQEN visual recovery evidence</title><style>body{font:16px system-ui;margin:24px;color:#0b1b33;background:#edf0f8}img{max-width:100%;height:auto}section{margin-block:40px}li{margin:8px 0}</style><h1>Original design recovery — October 16, 2026</h1><p>20 original/before/after comparisons. Captures use identical 390×844 viewports; all four viewport widths and both device preferences are linked below. Dark preference now uses the approved light design. Evidence exposes differences; it does not certify pixel parity. Case Review, profile editing and newer trust workflows are design extensions. Browser fixtures are not hosted verification.</p>${sections}<h2>All 200 viewport comparisons</h2><ul>${links}</ul></html>`);
console.log(JSON.stringify(summary));
