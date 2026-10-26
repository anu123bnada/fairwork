// Verifies a REAL Supabase Storage project for the Evidence Vault, end to end with synthetic bytes. Never runs automatically and is
// not part of release:verify. The owner (or an approved session) runs it after the bucket exists:
//   ORYQEN_VAULT_STORAGE_URL=https://<ref>.supabase.co ORYQEN_VAULT_STORAGE_SERVICE_KEY=<secret> node scripts/verify-vault-storage.mjs
// It writes one tiny synthetic object under a random key, checks that it can be signed and fetched, that direct unauthenticated access
// is refused, and that it can be deleted. It prints verdicts only, never the key.
import { randomUUID } from 'node:crypto';

const base = process.env.ORYQEN_VAULT_STORAGE_URL?.replace(/\/+$/, '');
const key = process.env.ORYQEN_VAULT_STORAGE_SERVICE_KEY;
const bucket = process.env.ORYQEN_VAULT_BUCKET || 'evidence-vault';
if (!base || !/^https:\/\//.test(base) || !key) { console.error('Set ORYQEN_VAULT_STORAGE_URL (https) and ORYQEN_VAULT_STORAGE_SERVICE_KEY.'); process.exit(2); }
const headers = { Authorization: `Bearer ${key}`, apikey: key };
const objectKey = `${randomUUID()}/${randomUUID()}`;
const bytes = Buffer.from('%PDF-1.7\nORYQEN storage verification, synthetic bytes\n');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`); };

try {
  const bucketInfo = await fetch(`${base}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers }).then(r => r.json());
  check('bucket exists and is private', bucketInfo.public === false, `public=${bucketInfo.public}`);
  check('bucket limits the file size to 5 MiB', Number(bucketInfo.file_size_limit) === 5242880, `limit=${bucketInfo.file_size_limit}`);
  check('bucket limits file types', Array.isArray(bucketInfo.allowed_mime_types) && bucketInfo.allowed_mime_types.length === 4);

  const put = await fetch(`${base}/storage/v1/object/${bucket}/${objectKey}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/pdf', 'x-upsert': 'true' }, body: bytes });
  check('server can store an object', put.ok, `HTTP ${put.status}`);
  const signed = await fetch(`${base}/storage/v1/object/sign/${bucket}/${objectKey}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }) }).then(r => r.json());
  const url = signed.signedURL ? `${base}/storage/v1${signed.signedURL}` : null;
  check('server can create a signed link', Boolean(url));
  if (url) {
    const download = await fetch(url);
    check('the signed link returns the exact bytes', download.ok && Buffer.from(await download.arrayBuffer()).equals(bytes), `HTTP ${download.status}`);
  }
  const anonymous = await fetch(`${base}/storage/v1/object/${bucket}/${objectKey}`);
  check('an unauthenticated request for the object is refused', !anonymous.ok, `HTTP ${anonymous.status}`);
  const publicUrl = await fetch(`${base}/storage/v1/object/public/${bucket}/${objectKey}`);
  check('the public URL form does not serve the object', !publicUrl.ok, `HTTP ${publicUrl.status}`);
  const wrongType = await fetch(`${base}/storage/v1/object/${bucket}/${randomUUID()}/${randomUUID()}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/html' }, body: '<script>1</script>' });
  check('the bucket refuses a type that is not allowed', !wrongType.ok, `HTTP ${wrongType.status}`);
} finally {
  const removed = await fetch(`${base}/storage/v1/object/${bucket}/${objectKey}`, { method: 'DELETE', headers });
  check('the test object is removed', removed.ok || removed.status === 404, `HTTP ${removed.status}`);
}
process.exit(results.every(Boolean) ? 0 : 1);
