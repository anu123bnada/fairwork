import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import assert from 'node:assert/strict';

const root = 'test-results/auth-correction-20261016';
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const baseline = JSON.parse(readFileSync('test-results/oryqen-rollback-1792117199643/manifest.json', 'utf8'));
const allowed = new Set(['CONTINUE_HERE.md', 'src/app/sign-in/page.tsx', 'src/components/fairwork/auth-shell.tsx', 'src/components/fairwork/product-app.tsx', 'tests/e2e/foundation.spec.ts', 'tests/e2e/oryqen.spec.ts']);
const entries = baseline.files.map(file => ({ path: file.path.replaceAll('\\', '/'), before: file.sha256, after: existsSync(file.path) ? hash(file.path) : null }));
const changed = entries.filter(row => row.before !== row.after);
const unexpected = changed.filter(row => !allowed.has(row.path));
writeFileSync(`${root}/preservation.json`, JSON.stringify({ compared: entries.length, unchanged: entries.length - changed.length, changed, unexpected }, null, 2));
assert.deepEqual(unexpected, [], 'An unrelated source changed; investigate before claiming preservation.');
if (!existsSync(`${root}/after/measurements.json`)) process.exit(0);
const before = JSON.parse(readFileSync(`${root}/before/measurements.json`, 'utf8'));
const after = JSON.parse(readFileSync(`${root}/after/measurements.json`, 'utf8'));
const controls = after.filter(row => /control|onboarding/.test(row.name)).map(row => ({ file: row.file, before: hash(`${root}/before/${row.file}`), after: hash(`${root}/after/${row.file}`) }));
writeFileSync(`${root}/unchanged-screen-checks.json`, JSON.stringify(controls, null, 2));
const pairs = [['sign-in', '00-Sign-in'], ['entry', '00-Sign-in'], ['otp', '00-OTP'], ['onboarding-1', '00-Onboarding-1-derived'], ['onboarding-2', '00-Onboarding-2'], ['onboarding-3', '00-Onboarding-3']];
mkdirSync(`${root}/reference`, { recursive: true });
mkdirSync(`${root}/comparisons`, { recursive: true });
const records = [];
for (const [name, originalName] of pairs) {
  const source = originalName.endsWith('-derived') ? `test-results/day3-visual/reference/${originalName}.png` : `C:/Users/vehiv/Downloads/Untitled/${originalName}.png`;
  const reference = `${root}/reference/${originalName}.png`;
  if (!existsSync(reference)) copyFileSync(source, reference);
  const output = `${root}/comparisons/${name}.png`;
  if (!existsSync(output)) await sharp({ create: { width: 1170, height: 844, channels: 3, background: '#ffffff' } }).composite([{ input: reference, left: 0, top: 0 }, { input: `${root}/before/390-${name}.png`, left: 390, top: 0 }, { input: `${root}/after/390-${name}.png`, left: 780, top: 0 }]).png().toFile(output);
  records.push({ name, original: source, originalHash: hash(source), beforeHash: hash(`${root}/before/390-${name}.png`), afterHash: hash(`${root}/after/390-${name}.png`), derived: originalName.endsWith('-derived') });
}
writeFileSync(`${root}/comparison-manifest.json`, JSON.stringify(records, null, 2));
const links = after.map(row => `<li><a href="after/${row.file}">${row.width}px ${row.name}</a>${before.some(old => old.file === row.file) ? ` · <a href="before/${row.file}">before</a>` : ''} · <a href="after/${row.file.replace('.png', '-full.png')}">full page</a></li>`).join('');
writeFileSync(`${root}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ORYQEN authentication comparison</title><style>body{font:16px system-ui;margin:24px;background:#edf1fa;color:#0b1b33}img{max-width:100%;height:auto}section{margin-block:40px}li{margin:10px 0}</style><h1>Authentication composition — October 16</h1><p>Original (left), preceding recovery (middle), current correction (right). All are 390×844. Two real email/password inputs and six authenticator digits remain different from the original phone/SMS flow. No phone OTP is implemented or simulated. OTP captures use a synthetic verified-factor response and test digits, not a real verification.</p>${records.map(row => `<section><h2>${row.name}</h2><p>${row.derived ? 'Onboarding 1: derived rendering of supplied original SVG, no original PNG available.' : 'Original supplied PNG reference.'}</p><a href="comparisons/${row.name}.png"><img alt="Original, before and after ${row.name}" src="comparisons/${row.name}.png"></a></section>`).join('')}<h2>Matching 360px and 390px captures</h2><ul>${links}</ul><p>Operator and Home are unchanged-screen controls; see unchanged-screen-checks.json for byte comparisons. Color similarity alone is not a parity claim.</p></html>`);
console.log(JSON.stringify({ comparedSource: entries.length, changedSource: changed.map(row => row.path), beforeScreens: before.length, afterScreens: after.length, unchangedPixelChecks: controls.filter(row => row.before === row.after).length, pixelChecks: controls.length, changedPixelControls: controls.filter(row => row.before !== row.after).map(row => row.file) }));
