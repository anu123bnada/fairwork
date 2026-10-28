// Writes desktop/app-config.json from ORYQEN_DESKTOP_ORIGIN, refusing anything that is not a plain https origin. Run by the build scripts; the file is
// git-ignored and packaged into the installer, so the installer's backend is fixed at build time and visible in the build log.
//   $env:ORYQEN_DESKTOP_ORIGIN = 'https://oryqen-staging.vercel.app'; npm --prefix desktop run build:windows
const { writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { parseOrigin } = require('../policy.cjs');

const origin = parseOrigin(process.env.ORYQEN_DESKTOP_ORIGIN ?? '');
if (!origin) {
  console.error('Refused: set ORYQEN_DESKTOP_ORIGIN to the https origin this build must connect to (for example https://oryqen-staging.vercel.app): https only, no path, no credentials.');
  process.exit(1);
}
const target = path.join(__dirname, '..', 'app-config.json');
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify({ origin, writtenBy: 'scripts/write-config.cjs' }, null, 2) + '\n');
console.log(`Desktop build will connect to ${origin}`);
