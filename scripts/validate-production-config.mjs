// Production configuration validator. Reads the process environment (plus .env.local / .env.production through Next's loader unless
// --no-files is given, or a file passed with --env-file=<path>) and reports each check as PASS, FAIL or WARN. It prints names and
// verdicts only, never values. Exit 1 when any check FAILS.
//   node scripts/validate-production-config.mjs [--env-file=<path>] [--json]
import { readFileSync, existsSync } from 'node:fs';
import nextEnv from '@next/env';

const args = process.argv.slice(2);
const fileArg = args.find(argument => argument.startsWith('--env-file='))?.slice(11);
let env = { ...process.env };
if (fileArg) {
  if (!existsSync(fileArg)) { console.error(`Environment file not found: ${fileArg}`); process.exit(2); }
  for (const line of readFileSync(fileArg, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !line.trim().startsWith('#')) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
} else if (!args.includes('--no-files')) {
  nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  env = { ...process.env };
}

const results = [];
const add = (id, status, detail) => results.push({ id, status, detail });
const has = name => Boolean(env[name]?.trim());
const https = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
const loopback = value => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname); } catch { return false; } };
const jwtRole = value => { try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8')).role ?? null; } catch { return null; } };

// ---- origin and data mode
const origin = env.APP_ORIGIN?.trim() ?? '';
add('APP_ORIGIN', https(origin) && !loopback(origin) && new URL(origin).pathname === '/' ? 'PASS' : 'FAIL', 'must be the https production origin with no path (it is the issuer of credentials and the same-origin check)');
add('FAIRWORK_DATA_MODE', env.FAIRWORK_DATA_MODE === 'supabase' ? 'PASS' : 'FAIL', 'must be supabase for a hosted release');
add('AUTH_REGISTRATION_ENABLED', ['true', 'false'].includes(env.AUTH_REGISTRATION_ENABLED ?? '') ? 'PASS' : 'FAIL', 'must be set explicitly to true or false (true only after the confirmation email template and sender are approved)');

// ---- Supabase connection data (browser-safe values only)
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
add('NEXT_PUBLIC_SUPABASE_URL', https(url) && !loopback(url) ? 'PASS' : 'FAIL', 'must be the hosted project https URL');
const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
const role = publishable.startsWith('eyJ') ? jwtRole(publishable) : null;
add('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', publishable && !/^sb_secret_/.test(publishable) && role !== 'service_role' ? 'PASS' : 'FAIL', 'must be present and must be a publishable or anon key, never a secret or service-role key');
const publicNames = Object.keys(env).filter(name => name.startsWith('NEXT_PUBLIC_') && /(SECRET|SERVICE|PRIVATE|SIGNING|GEMINI|API_KEY|PASSWORD|TOKEN)/i.test(name));
add('public-variable-names', publicNames.length === 0 ? 'PASS' : 'FAIL', `no NEXT_PUBLIC_ variable may be named like a secret${publicNames.length ? ` (found: ${publicNames.join(', ')})` : ''}`);
add('service-role-key', has('SUPABASE_SERVICE_ROLE_KEY') ? 'FAIL' : 'PASS', 'the application does not use a service-role key; none should be set in its environment');

// ---- credential signing (module 18)
const credentialVars = ['ORYQEN_CREDENTIAL_KEY_ID', 'ORYQEN_CREDENTIAL_SIGNING_KEY'].filter(has);
if (credentialVars.length === 0) add('credential-signing', 'FAIL', 'no signing key configured: credentials cannot be issued (run scripts/generate-credential-key.mjs and set both variables as hosting secrets)');
else {
  let jwk; try { jwk = JSON.parse(env.ORYQEN_CREDENTIAL_SIGNING_KEY ?? ''); } catch { jwk = null; }
  const ok = credentialVars.length === 2 && /^[A-Za-z0-9._-]{1,64}$/.test(env.ORYQEN_CREDENTIAL_KEY_ID) && jwk?.kty === 'OKP' && jwk?.crv === 'Ed25519' && typeof jwk?.d === 'string' && typeof jwk?.x === 'string';
  add('credential-signing', ok ? 'PASS' : 'FAIL', 'key id and an Ed25519 private JWK must both be set and well formed');
}

// ---- evidence vault storage (module 6)
if (has('ORYQEN_VAULT_LOCAL_DIR')) add('vault-local-store', 'FAIL', 'ORYQEN_VAULT_LOCAL_DIR is for development only and must not be set in production');
const vaultUrl = env.ORYQEN_VAULT_STORAGE_URL?.trim() ?? '';
add('vault-storage', https(vaultUrl) && has('ORYQEN_VAULT_STORAGE_SERVICE_KEY') ? 'PASS' : 'FAIL', 'ORYQEN_VAULT_STORAGE_URL (https) and ORYQEN_VAULT_STORAGE_SERVICE_KEY (server-only secret) must both be set, with a private bucket (default name evidence-vault)');

// ---- AI (module 1 and 11): real-user processing needs the owner's explicit approval
const aiOn = env.ORYQEN_AI_ENABLED === 'true', aiApproved = env.ORYQEN_AI_POLICY_APPROVED === 'true';
if (!aiOn && !aiApproved) add('ai', 'WARN', 'AI is disabled (the safe default). Enable only after the owner approves the provider, region and retention terms');
else {
  const complete = aiOn && aiApproved && (has('GEMINI_API_KEY') || has('GOOGLE_API_KEY')) && has('GEMINI_MODEL') && has('ORYQEN_AI_POLICY_APPROVAL_REF') && has('ORYQEN_AI_PROCESSING_REGION') && has('ORYQEN_AI_DATA_USE');
  add('ai', complete ? 'PASS' : 'FAIL', 'AI flags are inconsistent: enabling needs approval, key, model, approval reference, processing region and data-use text together');
}

// ---- telemetry and downloads
if (has('ORYQEN_TELEMETRY_DB_URL')) {
  let user; try { user = new URL(env.ORYQEN_TELEMETRY_DB_URL).username; } catch { user = ''; }
  add('telemetry-role', user === 'oryqen_telemetry_writer' ? 'PASS' : 'FAIL', 'telemetry must connect as the restricted oryqen_telemetry_writer role, never an owner or service role');
} else add('telemetry-role', 'WARN', 'no telemetry connection: runtime events are not recorded');
for (const name of ['NEXT_PUBLIC_WINDOWS_URL', 'NEXT_PUBLIC_APK_URL']) add(name, https(env[name] ?? '') ? 'PASS' : 'WARN', 'download links stay disabled on the landing page until an approved https host exists');
add('NEXT_PUBLIC_CONTACT_EMAIL', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.NEXT_PUBLIC_CONTACT_EMAIL ?? '') ? 'PASS' : 'WARN', 'a public contact address for privacy and support requests');

const failed = results.filter(item => item.status === 'FAIL');
if (args.includes('--json')) console.log(JSON.stringify({ failed: failed.length, results }, null, 2));
else {
  for (const item of results) console.log(`${item.status.padEnd(5)} ${item.id}: ${item.detail}`);
  console.log(`\n${failed.length ? `${failed.length} check(s) failed: production configuration is not ready.` : 'No failed checks.'} Values are never printed.`);
}
process.exit(failed.length ? 1 : 0);
