// Alternative to `test-local-real-workflows.mjs --manage-app`: that mode's development server keeps rebuilding and reloading pages (F-43).
// Starts the app separately (own log, throwaway key, vault dir outside the project) and runs the harness against it.
import { spawn, spawnSync } from 'node:child_process';
import { openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

// Usage (from the repository root, with the local Docker stack running and nothing on port 3100): node scripts/run-local-split-harness.mjs
const root = process.cwd();
const { generateKeyPair, exportJWK } = await import(pathToFileURL(`${root}/node_modules/jose/dist/webapi/index.js`).href);
const { publicKey, privateKey } = await generateKeyPair('EdDSA', { extractable: true });
const kid = `local-test-${Date.now()}`;
const env = { ...process.env };
env.ORYQEN_CREDENTIAL_KEY_ID = kid;
env.ORYQEN_CREDENTIAL_SIGNING_KEY = JSON.stringify({ ...(await exportJWK(privateKey)), kid });
env.ORYQEN_CREDENTIAL_PUBLIC_KEYS = JSON.stringify({ [kid]: (({ kty, crv, x }) => ({ kty, crv, x }))(await exportJWK(publicKey)) });
env.ORYQEN_VAULT_LOCAL_DIR = `${tmpdir()}/oryqen-vault-split-${Date.now()}`;

const log = openSync(`${tmpdir()}/oryqen-split-app-${Date.now()}.log`, 'a');
const app = spawn(process.execPath, ['scripts/run-local-development.mjs'], { env, windowsHide: true, stdio: ['ignore', log, log] });
let ready = false;
for (let i = 0; i < 300 && !ready; i++) {
  if (app.exitCode !== null) throw new Error('app exited');
  ready = await fetch('http://127.0.0.1:3100/sign-in').then(r => r.ok).catch(() => false);
  if (!ready) await new Promise(r => setTimeout(r, 1000));
}
if (!ready) throw new Error('app not ready');
console.log('app ready; running harness against it');
const result = spawnSync(process.execPath, ['scripts/test-local-real-workflows.mjs'], { env, stdio: 'inherit', windowsHide: true });
spawnSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], { windowsHide: true });
process.exit(result.status ?? 1);
