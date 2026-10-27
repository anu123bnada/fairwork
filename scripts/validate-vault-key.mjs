// Validates the REAL Evidence Vault service key against the staging project without ever displaying, logging or writing it.
// The key is read only from this process's environment (set it for this one PowerShell session; see OWNER_ACTIONS.md F6c). It makes two READ-ONLY requests to the
// project's own Storage API and prints status codes and verdicts only. It uploads and deletes nothing.
//
//   $env:ORYQEN_VAULT_STORAGE_URL = 'https://jpvgsmzomlmowarlfkdl.supabase.co'
//   $env:ORYQEN_VAULT_STORAGE_SERVICE_KEY = <the key, entered through a hidden prompt>
//   node scripts/validate-vault-key.mjs [--ref=jpvgsmzomlmowarlfkdl] [--bucket=evidence-vault]
import { createHash } from 'node:crypto';

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ref = arg('ref') ?? 'jpvgsmzomlmowarlfkdl', bucket = arg('bucket') ?? 'evidence-vault';
const url = (process.env.ORYQEN_VAULT_STORAGE_URL ?? '').replace(/\/+$/, '');
const key = (process.env.ORYQEN_VAULT_STORAGE_SERVICE_KEY ?? '').trim();
const out = (status, id, detail) => console.log(`${status.padEnd(22)} ${id}: ${detail}`);
let bad = 0;
const fail = (id, detail, status = 'FAIL') => { out(status, id, detail); bad++; };

if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)) { fail('ORYQEN_VAULT_STORAGE_URL', 'must be https://<20-character project ref>.supabase.co'); process.exit(1); }
if (url !== `https://${ref}.supabase.co`) { fail('project', `the URL is for a different project than ${ref}; no request was made`); process.exit(1); }
out('PASS', 'project', `URL is the staging project ${ref}`);
if (!key) { fail('ORYQEN_VAULT_STORAGE_SERVICE_KEY', 'not set in this session', 'MISSING'); process.exit(1); }
if (/^\[?(sensitive|redacted|hidden|encrypted)\]?$/i.test(key)) { fail('ORYQEN_VAULT_STORAGE_SERVICE_KEY', 'this is Vercel\'s placeholder, not a key. Paste the real key from the Supabase dashboard', 'UNVERIFIABLE_SENSITIVE'); process.exit(1); }
if (/^sb_publishable_/.test(key)) { fail('key type', 'this is a PUBLISHABLE key; the Vault needs the secret key', 'INVALID_CREDENTIAL'); process.exit(1); }
if (key.startsWith('eyJ')) {
  try { const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')); if (claims.ref && claims.ref !== ref) fail('key project', `the key belongs to project ${claims.ref}`, 'INVALID_CREDENTIAL'); else if (claims.role && claims.role !== 'service_role') fail('key role', `role ${claims.role}, expected service_role`, 'INVALID_CREDENTIAL'); else out('PASS', 'key shape', 'legacy service key for this project'); } catch { fail('key shape', 'not a well-formed key', 'INVALID_CREDENTIAL'); }
} else if (/^sb_secret_/.test(key)) out('PASS', 'key shape', 'secret key (its project is proven by the requests below)');
else fail('key shape', 'unrecognized key format', 'INVALID_CREDENTIAL');

const ask = async (path, init = {}) => { try { return await fetch(url + path, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) }); } catch (error) { return { status: 0, error: String(error.cause?.code ?? error.message), json: async () => null }; } };

// 1. Bucket metadata. Only a privileged key can read it; a publishable key gets 400/404 because the buckets table has no public policy.
const meta = await ask(`/storage/v1/bucket/${encodeURIComponent(bucket)}`);
const info = meta.status === 200 ? await meta.json().catch(() => null) : null;
if (meta.status === 200 && info?.public === false) out('PASS', 'bucket', `${bucket} exists, is private, ${info.file_size_limit ?? 'no'} byte limit, ${(info.allowed_mime_types ?? []).length} allowed types`);
else if (meta.status === 200) fail('bucket', `${bucket} is PUBLIC; it must be private`);
else if ([400, 401, 403].includes(meta.status)) fail('bucket', `Storage rejected the key (${meta.status}): not a valid privileged key for ${ref}`, 'INVALID_CREDENTIAL');
else if (meta.status === 404) fail('bucket', `${bucket} does not exist on ${ref}`);
else fail('bucket', `Storage answered ${meta.status}${meta.error ? ` ${meta.error}` : ''}`, 'WARN');

// 2. Object listing (read-only): proves the key may reach the bucket's contents. Expected on staging today: an empty bucket.
const list = await ask(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 1 }) });
if (list.status === 200) { const items = await list.json().catch(() => []); out('PASS', 'object listing', `allowed (${Array.isArray(items) ? items.length : '?'} object(s) in the first page)`); }
else fail('object listing', `Storage answered ${list.status}${list.error ? ` ${list.error}` : ''}`, [400, 401, 403].includes(list.status) ? 'INVALID_CREDENTIAL' : 'FAIL');

// A short fingerprint, so you can recognise afterwards which key you tested. It is a one-way hash prefix, not the key.
out('INFO', 'fingerprint', `sha256 starts ${createHash('sha256').update(key).digest('hex').slice(0, 8)} (not reversible; not the key)`);
console.log(bad ? '\nNOT VALID: do not deploy with this key.' : '\nVALID: this key works against the private evidence-vault bucket on the staging project. Store the same key in Vercel (Sensitive).');
process.exitCode = bad ? 1 : 0;
