// Reconcile self-hosted OCR assets against committed SHA-256 pins. Never processes user images.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const directory = 'public/ocr/vendor';
const manifestPath = `${directory}/manifest.json`;
const pinned = JSON.parse(readFileSync(manifestPath, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (pinned.tesseract !== '7.0.0' || pinned.english !== '1.0.0' || !Array.isArray(pinned.files) || pinned.files.length === 0) {
  throw new Error('Unexpected OCR manifest version or format');
}
const expectedNames = [
  'tesseract.min.js', 'worker.min.js', 'worker.min.js.LICENSE.txt',
  'tesseract.min.js.LICENSE.txt', 'TESSERACT-LICENSE.txt', 'CORE-LICENSE.txt',
  'ENGLISH-PACKAGE.json', 'eng.traineddata.gz',
  'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
];
if (pinned.files.length !== expectedNames.length ||
    pinned.files.some((entry, i) => entry.name !== expectedNames[i])) {
  throw new Error('OCR manifest asset list differs from the expected pinned set');
}
mkdirSync(directory, { recursive: true });
let totalBytes = 0;
for (const entry of pinned.files) {
  if (typeof entry.source !== 'string' || !/^(tesseract\.js|tesseract\.js-core|@tesseract\.js-data\/eng)\//.test(entry.source) ||
      typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) {
    throw new Error(`Invalid pinned OCR manifest entry: ${entry.name}`);
  }
  const source = `node_modules/${entry.source}`;
  const target = `${directory}/${entry.name}`;
  const bytes = readFileSync(source);
  const actual = hash(bytes);
  if (actual !== entry.sha256 || bytes.length !== entry.bytes) {
    throw new Error(`OCR npm artifact fails committed SHA-256/size pin: ${entry.name} (actual ${actual})`);
  }
  if (existsSync(target) && hash(readFileSync(target)) !== actual) {
    console.warn(`Recreating checkout-different OCR asset from verified pin: ${entry.name}`);
  }
  writeFileSync(target, bytes);
  totalBytes += bytes.length;
}
console.log(`PASS: ${pinned.files.length} self-hosted OCR assets match committed SHA-256 pins; ${totalBytes} bytes; no document processed`);
