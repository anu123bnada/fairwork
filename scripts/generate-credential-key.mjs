// One-time key ceremony for ORYQEN verifiable credentials. Run by the OWNER, on a trusted machine.
//
//   node scripts/generate-credential-key.mjs --kid oryqen-2026-1 --out "D:\\secure\\oryqen-credential-key.json"
//
// It writes the PRIVATE key to the path you choose (owner-readable only where the OS supports it) and
// prints only the PUBLIC key and the exact environment variable names to set in your hosting secrets.
// It refuses to write inside this repository, so the key cannot be committed by accident, and it refuses
// to overwrite an existing file. ORYQEN never sees or stores this key; keep an offline backup.
import { generateKeyPair, exportJWK } from "jose";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const kid = option("kid"), out = option("out");
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function fail(message) { console.error(`Refused: ${message}`); process.exit(1); }

if (!kid || !/^[A-Za-z0-9._-]{1,64}$/.test(kid)) fail("--kid is required (letters, digits, dot, dash, underscore; up to 64), for example oryqen-2026-1");
if (!out) fail("--out is required: the full path where the private key file will be written");
const target = resolve(out), inside = relative(repo, target);
if (!inside.startsWith("..") && !isAbsolute(inside)) fail("the output path is inside the ORYQEN repository. Choose a location outside it, such as a password manager export folder or an encrypted drive.");
if (existsSync(target)) fail("that file already exists. Choose a new path; this tool never overwrites a key.");

const { publicKey, privateKey } = await generateKeyPair("EdDSA", { extractable: true });
const privateJwk = { ...(await exportJWK(privateKey)), kid }, publicJwk = { ...(await exportJWK(publicKey)), kid };
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify({ kid, private: privateJwk, public: publicJwk }, null, 2), { mode: 0o600, flag: "wx" });

console.log(`Private key written to: ${target}`);
console.log("Back it up offline and store it in your password manager. It cannot be recovered if lost.\n");
console.log("Set these in your hosting provider's secret store (never in the repository):");
console.log(`  ORYQEN_CREDENTIAL_KEY_ID=${kid}`);
console.log("  ORYQEN_CREDENTIAL_SIGNING_KEY=<the single-line JSON of the \"private\" object in the file>");
console.log(`  ORYQEN_CREDENTIAL_PUBLIC_KEYS=${JSON.stringify({ [kid]: { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x } })}   (optional; add older public keys here after a rotation)\n`);
console.log("Public key (safe to publish):");
console.log(JSON.stringify(publicJwk));
