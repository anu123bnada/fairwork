// Staging configuration preflight. Reads an environment file that YOU pulled from Vercel (the values Vercel would really apply to the branch, with the
// branch-specific Preview entries already taking precedence over shared ones) and checks that it points only at the staging project and enables what the
// 14 features need. It prints names and verdicts only, never a value. It calls no network service.
//
//   vercel env pull .env.preview.staging --environment=preview --git-branch=release/oryqen-oct27     (run by you, in a folder you control; .env* is git-ignored)
//   node scripts/preflight-staging-env.mjs .env.preview.staging [--ref=jpvgsmzomlmowarlfkdl] [--origin=https://oryqen-staging.vercel.app]
import { readFileSync, existsSync, readFileSync as read } from 'node:fs';

const file = process.argv[2];
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!file || !existsSync(file)) { console.error('Usage: node scripts/preflight-staging-env.mjs <env file pulled from Vercel> [--ref=...] [--origin=...]'); process.exit(2); }
const expectedRef = arg('ref') ?? (existsSync('supabase/.temp/project-ref') ? read('supabase/.temp/project-ref', 'utf8').trim() : 'jpvgsmzomlmowarlfkdl');
const expectedOrigin = arg('origin') ?? 'https://oryqen-staging.vercel.app';
const legacyRef = 'cqjxsafeodslmyoqftdj'; // the "Fairwork" project that .env.local names for local work; must never be the staging target

const env = {};
for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const match = /^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (match && !line.trim().startsWith('#')) env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
}
const results = [];
const add = (id, status, detail) => { results.push({ id, status, detail }); console.log(`${status.padEnd(7)} ${id}: ${detail}`); };
const has = name => Boolean(env[name]?.trim());
const hostRef = value => { try { const host = new URL(value).hostname; const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(host); return match ? match[1] : null; } catch { return null; } };
const jwtClaims = value => { try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8')); } catch { return null; } };

// 1-2. Which Supabase project is this build wired to?
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const urlRef = hostRef(url);
add('NEXT_PUBLIC_SUPABASE_URL', urlRef === expectedRef ? 'PASS' : urlRef === legacyRef ? 'FAIL' : 'FAIL',
  urlRef === expectedRef ? `points at the staging project ${expectedRef}` : urlRef === legacyRef ? `points at the legacy "Fairwork" project ${legacyRef}, not staging` : urlRef ? `points at project ${urlRef}, expected ${expectedRef}` : 'missing or not a https://<ref>.supabase.co URL');
const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const publishableClaims = publishable.startsWith('eyJ') ? jwtClaims(publishable) : null;
add('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', publishable && !/^sb_secret_/.test(publishable) && publishableClaims?.role !== 'service_role' && (!publishableClaims?.ref || publishableClaims.ref === expectedRef) ? 'PASS' : 'FAIL',
  !publishable ? 'missing' : /^sb_secret_/.test(publishable) || publishableClaims?.role === 'service_role' ? 'this is a secret/service key; it must be the publishable key' : publishableClaims?.ref && publishableClaims.ref !== expectedRef ? `key belongs to project ${publishableClaims.ref}, not ${expectedRef}` : publishableClaims ? 'legacy anon key for the staging project' : 'present, publishable form (its project cannot be read from the key; the URL above decides)');

// 4. Origin: it is the same-origin check and the reset-link target.
const origin = env.APP_ORIGIN ?? '';
let originOk = false; try { const u = new URL(origin); originOk = u.protocol === 'https:' && u.pathname === '/' && !u.search && !u.hash && !u.username; } catch { /* reported below */ }
add('APP_ORIGIN', originOk && origin.replace(/\/$/, '') === expectedOrigin ? 'PASS' : originOk ? 'WARN' : 'FAIL',
  originOk ? (origin.replace(/\/$/, '') === expectedOrigin ? `equals ${expectedOrigin}` : `valid but not ${expectedOrigin}; it must be the host people actually use AND be on Supabase's redirect list`) : 'must be an https origin with no path');
add('FAIRWORK_DATA_MODE', env.FAIRWORK_DATA_MODE === 'supabase' ? 'PASS' : 'FAIL', env.FAIRWORK_DATA_MODE === 'supabase' ? 'supabase' : 'must be supabase');
add('AUTH_REGISTRATION_ENABLED', ['true', 'false'].includes(env.AUTH_REGISTRATION_ENABLED ?? '') ? 'PASS' : 'FAIL', env.AUTH_REGISTRATION_ENABLED === 'true' ? 'true (sign-up open)' : env.AUTH_REGISTRATION_ENABLED === 'false' ? 'false: new accounts cannot register (feature 1 sign-up will not work)' : 'must be true or false');

// 3. Evidence Vault must be wired to the same staging project, with its own server-only key.
const vaultUrl = env.ORYQEN_VAULT_STORAGE_URL ?? '', vaultKey = env.ORYQEN_VAULT_STORAGE_SERVICE_KEY ?? '';
add('ORYQEN_VAULT_STORAGE_URL', hostRef(vaultUrl) === expectedRef ? 'PASS' : 'FAIL', hostRef(vaultUrl) === expectedRef ? 'same staging project' : hostRef(vaultUrl) === legacyRef ? 'points at the legacy "Fairwork" project' : 'missing or not the staging project URL');
const vaultClaims = vaultKey.startsWith('eyJ') ? jwtClaims(vaultKey) : null;
add('ORYQEN_VAULT_STORAGE_SERVICE_KEY', vaultKey && vaultKey !== publishable && (!vaultClaims?.ref || vaultClaims.ref === expectedRef) ? 'PASS' : 'FAIL',
  !vaultKey ? 'missing (the Vault cannot store files)' : vaultKey === publishable ? 'identical to the publishable key; it must be the server-only secret' : vaultClaims?.ref && vaultClaims.ref !== expectedRef ? `key belongs to project ${vaultClaims.ref}, not ${expectedRef}` : 'present and distinct from the publishable key');
add('ORYQEN_VAULT_BUCKET', !has('ORYQEN_VAULT_BUCKET') || env.ORYQEN_VAULT_BUCKET === 'evidence-vault' ? 'PASS' : 'WARN', !has('ORYQEN_VAULT_BUCKET') ? 'unset: the default bucket evidence-vault is used (it exists on staging)' : env.ORYQEN_VAULT_BUCKET === 'evidence-vault' ? 'evidence-vault' : 'a different bucket name; it must exist and be private');
add('ORYQEN_VAULT_LOCAL_DIR', has('ORYQEN_VAULT_LOCAL_DIR') ? 'FAIL' : 'PASS', has('ORYQEN_VAULT_LOCAL_DIR') ? 'development-only disk store must not be set on a hosted build' : 'unset');

// 6. Nothing secret may be public or over-privileged.
const publicSecrets = Object.keys(env).filter(name => name.startsWith('NEXT_PUBLIC_') && /(SECRET|SERVICE|PRIVATE|SIGNING|GEMINI|API_KEY|PASSWORD|TOKEN)/i.test(name));
add('public-variable-names', publicSecrets.length ? 'FAIL' : 'PASS', publicSecrets.length ? `secret-like names are public: ${publicSecrets.join(', ')}` : 'no NEXT_PUBLIC_ variable is named like a secret');
add('SUPABASE_SERVICE_ROLE_KEY', has('SUPABASE_SERVICE_ROLE_KEY') ? 'FAIL' : 'PASS', has('SUPABASE_SERVICE_ROLE_KEY') ? 'the application does not use it; remove it' : 'unset');

// AI stays separate: no external AI processing without the written policy approval.
const aiOn = env.ORYQEN_AI_ENABLED === 'true', aiApproved = env.ORYQEN_AI_POLICY_APPROVED === 'true';
add('AI processing', aiOn || aiApproved ? 'WARN' : 'PASS', aiOn || aiApproved ? `ORYQEN_AI_ENABLED=${aiOn} ORYQEN_AI_POLICY_APPROVED=${aiApproved}: external AI data processing needs the owner's written policy approval; the 14 features do not need it` : 'disabled (ORYQEN_AI_ENABLED and ORYQEN_AI_POLICY_APPROVED are not true): analysis answers "not configured", nothing leaves the app');
if (aiOn && !aiApproved) add('AI flags consistent', 'FAIL', 'ORYQEN_AI_ENABLED=true without ORYQEN_AI_POLICY_APPROVED=true');

// 5. Optional pieces that gate specific features.
let jwk = null; try { jwk = JSON.parse(env.ORYQEN_CREDENTIAL_SIGNING_KEY ?? ''); } catch { /* reported below */ }
const keyOk = /^[A-Za-z0-9._-]{1,64}$/.test(env.ORYQEN_CREDENTIAL_KEY_ID ?? '') && jwk?.kty === 'OKP' && jwk?.crv === 'Ed25519' && typeof jwk?.d === 'string';
add('credential signing key', keyOk ? 'PASS' : has('ORYQEN_CREDENTIAL_SIGNING_KEY') || has('ORYQEN_CREDENTIAL_KEY_ID') ? 'FAIL' : 'WARN',
  keyOk ? 'configured: feature 7 (verifiable credentials), the signed Passport copy and feature 13 (developer verify API) can work' : has('ORYQEN_CREDENTIAL_SIGNING_KEY') || has('ORYQEN_CREDENTIAL_KEY_ID') ? 'present but malformed' : 'not set: features 7 and 13 and the signed Passport copy will report "unavailable" on staging; the other 12 do not need it');
add('ORYQEN_TELEMETRY_DB_URL', has('ORYQEN_TELEMETRY_DB_URL') ? 'WARN' : 'PASS', has('ORYQEN_TELEMETRY_DB_URL') ? 'set: it must write to the staging database only' : 'unset (runtime events are not stored)');

const tally = { PASS: 0, FAIL: 0, WARN: 0 }; for (const r of results) tally[r.status]++;
console.log(`\nPASS ${tally.PASS} | FAIL ${tally.FAIL} | WARN ${tally.WARN}   (project ${expectedRef}, origin ${expectedOrigin}; no value was printed)`);
console.log(tally.FAIL ? 'NOT READY TO PUSH: fix the FAIL lines in Vercel.' : 'READY TO PUSH as far as this file shows (the file is only as accurate as the pull; re-pull if anything changed).');
process.exitCode = tally.FAIL ? 1 : 0;
