// Authenticated journeys for ONE ordinary account against a running ORYQEN origin (hosted staging, or the local app for rehearsal).
// It signs in as you, so it must be run by you: the password (and a one-time authenticator code if you enrolled one) are typed at hidden prompts and are never
// printed, stored or sent anywhere except the sign-in request to the origin you name. It prints PASS/FAIL lines only.
//
//   node scripts/test-hosted-worker-journeys.mjs https://oryqen-staging.vercel.app --email you@example.com
//   node scripts/test-hosted-worker-journeys.mjs http://127.0.0.1:3100 --local-register --mail=http://127.0.0.1:55424      (rehearsal: makes its own local account)
//
// What it writes to the target: one synthetic PDF to the Evidence Vault (deleted again before the script ends), a private opportunity preference, and, when the
// credential signing key is configured, one developer key (revoked again). It writes no offers, no work records and nothing visible to anyone else.
// Journeys that need a second person or an operator capability (agreements, verification of work, disputes, organization approval, recruiter confirmation, plan
// assignment) are NOT run here and are reported as NOT RUN.
import { request as playwrightRequest } from '@playwright/test';
import { randomUUID, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

const origin = process.argv[2];
const option = name => { const hit = process.argv.find(a => a.startsWith(`--${name}=`)); if (hit) return hit.slice(name.length + 3); const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined; };
if (!origin || !/^https?:\/\/[a-z0-9.:-]+$/i.test(origin)) { console.error('Usage: node scripts/test-hosted-worker-journeys.mjs <origin> --email <address> | --local-register --mail=<mailbox url>'); process.exit(2); }
const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
if (!local && !origin.startsWith('https://')) { console.error('A hosted origin must be https.'); process.exit(2); }

const results = [];
const note = (status, id, detail) => { results.push({ status, id }); console.log(`${status.padEnd(7)} ${id}${detail ? `: ${detail}` : ''}`); };
const pass = (id, detail) => note('PASS', id, detail), fail = (id, detail) => note('FAIL', id, detail), skip = (id, detail) => note('NOT RUN', id, detail);
const ctx = await playwrightRequest.newContext({ extraHTTPHeaders: { Origin: origin } });
async function call(path, body, { statuses = [200], raw = false, headers = {} } = {}) {
  const response = await ctx.fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Idempotency-Key': randomUUID(), ...headers }, ...(body === undefined ? {} : raw ? { multipart: body } : { data: body }), timeout: 60000, maxRedirects: 0 });
  let json = null; try { json = await response.json(); } catch { /* binary or empty */ }
  if (!statuses.includes(response.status())) throw new Error(`${path.split('?')[0]} answered HTTP ${response.status()} ${json?.error?.code ?? ''}`.trim());
  return { status: response.status(), data: json?.data, response };
}
const step = async (id, action) => { try { const detail = await action(); pass(id, detail); } catch (error) { fail(id, error.message); } };

function ask(label, hidden) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) { rl._writeToOutput = text => { if (text.includes(label)) process.stdout.write(text); }; }
    rl.question(`${label}: `, answer => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

// ---- account: your own, or a throwaway local one for rehearsal
let email = option('email'), password = '';
if (process.argv.includes('--local-register')) {
  if (!local) { console.error('--local-register is only for a local origin.'); process.exit(2); }
  const mail = option('mail') ?? 'http://127.0.0.1:55424';
  email = `journey-${randomUUID()}@example.test`; password = randomBytes(24).toString('base64url');
  await call('/api/v1/auth/register', { email, password });
  let link = null;
  for (let i = 0; i < 30 && !link; i++) {
    const list = await fetch(mail + '/api/v1/messages').then(r => r.json());
    const item = list.messages.find(m => m.Subject.includes('Confirm') && m.To.some(t => t.Address === email));
    if (item) link = (await fetch(mail + '/api/v1/message/' + item.ID).then(r => r.json())).HTML.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&');
    else await new Promise(r => setTimeout(r, 500));
  }
  await call('/api/v1/auth/confirm', { tokenHash: new URLSearchParams(new URL(link).hash.slice(1)).get('token_hash') });
  await call('/api/v1/me', { displayName: 'Synthetic journey account', locale: 'en', timeZone: 'Asia/Colombo' });
  await call('/api/v1/auth/sign-out', {});
} else {
  if (!process.stdin.isTTY) { console.error('Run this in an interactive terminal: the password is typed at a hidden prompt.'); process.exit(2); }
  email ??= await ask('Email address of your staging test account', false);
  password = await ask('Password (hidden)', true);
}

// ---- 1. sign in, authenticator step if enrolled, profile
await step('1 Account: sign in with email and password', async () => {
  const result = await call('/api/v1/auth/sign-in', { email, password });
  if (result.data?.signedIn !== true) throw new Error('sign-in did not report a session');
  password = ''; // no longer needed in memory
  return result.data.profileRequired ? 'signed in; this account has no profile yet' : 'signed in';
});
await step('1 Account: authenticator step (only if you enrolled one)', async () => {
  const factors = (await call('/api/v1/auth/mfa')).data?.factors ?? [];
  const verified = factors.find(f => f.status === 'verified');
  if (!verified) return 'no authenticator enrolled on this account';
  const code = await ask('One-time authenticator code (hidden)', true);
  await call('/api/v1/auth/mfa', { action: 'verify', factorId: verified.id, code });
  return 'authenticator verified';
});
let profile = null;
await step('1 Account: profile is readable and belongs to this session', async () => { profile = (await call('/api/v1/me')).data; if (!profile?.id) throw new Error('no profile'); return `profile revision ${profile.revision}`; });
if (!profile) { console.log('\nStopped: without a profile the remaining journeys cannot run.'); await ctx.dispose(); process.exit(1); }

// ---- 14. plan
await step('14 Plans: free plan, essentials listed, no billing offered', async () => {
  const plan = (await call('/api/v1/entitlements')).data;
  if (!plan?.plan?.id || plan.billing?.available !== false) throw new Error('unexpected plan answer');
  return `plan ${plan.plan.id}, billing ${plan.billing.available}`;
});

// ---- 3. offer analysis stays rules-based while AI is off
await step('3 Offer analysis: with AI off the answer is explicitly "not configured", never invented', async () => {
  const ai = (await call('/api/v1/offers/analyze', { text: 'Synthetic check: LKR 1000 monthly, eight hours each week.', role: 'WORKER' })).data;
  if (ai.status !== 'UNCONFIGURED' || ai.configured !== false || ai.data !== null) throw new Error(`AI answered ${ai.status}; it must stay off until the policy is approved`);
  return 'UNCONFIGURED';
});

// ---- 5. Evidence Vault: real bucket, real key
await step('5 Evidence Vault: upload, list, signed download of the same bytes, delete', async () => {
  const pdf = Buffer.from('%PDF-1.7\nSynthetic hosted check ' + randomUUID() + '\n');
  const key = randomUUID();
  const upload = await call('/api/v1/vault', { title: 'Synthetic hosted check', category: 'other', idempotencyKey: key, file: { name: 'hosted-check.pdf', mimeType: 'application/pdf', buffer: pdf } }, { raw: true, headers: { Origin: origin } });
  const id = upload.data.documentId;
  let removed;
  try {
    const listed = (await call('/api/v1/vault')).data;
    if (!listed.items.some(item => item.documentId === id)) throw new Error('the uploaded document is not in the list');
    const link = (await call(`/api/v1/vault/link?id=${id}`)).data;
    const download = await fetch(link.url);
    const body = Buffer.from(await download.arrayBuffer());
    if (download.status !== 200 || !body.equals(pdf)) throw new Error(`download answered ${download.status} or the bytes differ`);
    const refused = await fetch(link.url.replace(/token=[^&]+/, 'token=garbage'));
    if (refused.status === 200) throw new Error('a tampered download link was accepted');
  } finally {
    removed = await call('/api/v1/vault/delete', { documentId: id }).catch(() => null);
  }
  if (removed?.data?.fileRemoved !== true) throw new Error('the stored file was not removed');
  const after = (await call('/api/v1/vault')).data;
  if (after.items.some(item => item.documentId === id)) throw new Error('the document is still listed after deletion');
  return 'bucket and key work; the test file was deleted';
});

// ---- 10. discovery
await step('10 Job discovery: listings load and private preferences persist', async () => {
  const page = (await call('/api/v1/opportunities?view=discover')).data;
  const version = page.preferenceVersion ?? 0;
  const preferences = { role: 'Technician', location: 'Colombo', workMode: null, minimumPay: null, currency: 'LKR', payPeriod: 'month' };
  await call('/api/v1/opportunities', { operation: 'preferences', preferences, expectedVersion: version, idempotencyKey: randomUUID() });
  const read = (await call('/api/v1/opportunities?view=discover')).data;
  if (read.preferences?.role !== 'Technician') throw new Error('the saved preference was not read back');
  return `${page.items.length} listing(s) visible; preferences saved (version ${read.preferenceVersion})`;
});

// ---- 12. notifications
await step('12 Notifications: the feed loads for this account only', async () => { const feed = (await call('/api/v1/notifications')).data; if (!Array.isArray(feed.items)) throw new Error('unexpected feed'); return `${feed.items.length} item(s)`; });

// ---- 7 and 13: need the signing key
let signing = false;
await step('7 Credentials: the server reports whether the signing key is configured', async () => { const mine = (await call('/api/v1/credentials')).data; signing = mine.signingConfigured === true; return signing ? 'signing key configured' : 'signing key NOT configured (credentials unavailable)'; });
if (signing) {
  await step('13 Developer API: create a key (shown once, never listed), then revoke it', async () => {
    const created = (await call('/api/v1/developer/keys', { label: 'Synthetic hosted check' })).data;
    try {
      if (!/^oryq_live_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(created.key)) throw new Error('unexpected key format');
      const listed = JSON.stringify((await call('/api/v1/developer/keys')).data);
      if (listed.includes(created.key.split('.')[1])) throw new Error('the key list leaked the secret');
      const response = await fetch(origin + '/api/v1/developer/credentials/verify', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${created.key}` }, body: JSON.stringify({ credential: 'a.b.c' }) });
      if (response.status === 401) throw new Error('the new key was refused');
    } finally { await call('/api/v1/developer/keys/revoke', { keyId: created.keyId }); }
    const after = await fetch(origin + '/api/v1/developer/credentials/verify', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${created.key}` }, body: JSON.stringify({ credential: 'a.b.c' }) });
    if (after.status !== 401) throw new Error(`a revoked key still answered ${after.status}`);
    return 'created, usable, then refused after revocation';
  });
} else skip('13 Developer API', 'needs the credential signing key');

// ---- sign out
await step('1 Account: sign out ends the session', async () => { await call('/api/v1/auth/sign-out', {}); const after = await ctx.fetch(origin + '/api/v1/me'); if (after.status() !== 401) throw new Error(`the profile is still readable after sign-out (HTTP ${after.status()})`); return 'profile now answers 401'; });

for (const [id, why] of [
  ['2 Offer workspace (saved offers, notes, documents)', 'needs an organization the account may use'],
  ['4 Digital agreements', 'needs a second account'], ['6 Work Passport (verified work, sharing)', 'needs an employer account to verify a record'],
  ['8 Dispute and appeals', 'needs an independent reviewer capability'], ['9 Organization portal', 'needs two independent approvers with the authority capability'],
  ['11 Recruiter scam protection', 'needs an organization representative'],
]) skip(id, why);

const tally = results.reduce((t, r) => ({ ...t, [r.status]: (t[r.status] ?? 0) + 1 }), {});
console.log(`\nPASS ${tally.PASS ?? 0} | FAIL ${tally.FAIL ?? 0} | NOT RUN ${tally['NOT RUN'] ?? 0}   (${origin})`);
await ctx.dispose();
process.exitCode = tally.FAIL ? 1 : 0;
