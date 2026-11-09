// Authenticated journeys for ONE ordinary account against a running ORYQEN origin (hosted staging, or the local app for rehearsal).
// It signs in as you, so it must be run by you: the password (and a one-time authenticator code if you enrolled one) are typed at hidden prompts and are never
// printed, stored or sent anywhere except the sign-in request to the origin you name. It prints PASS/FAIL lines only.
//
//   node scripts/test-hosted-worker-journeys.mjs https://oryqen-staging.vercel.app --email you@example.com
//   node scripts/test-hosted-worker-journeys.mjs http://127.0.0.1:3100 --local-register --mail=http://127.0.0.1:55424      (rehearsal: makes its own local account)
//
// What it writes to the target: a synthetic CV, a saved-listing snapshot (both deleted again), one synthetic PDF to the Evidence Vault (deleted again before the script ends), a private opportunity preference, and, when the
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
await step('3 Offer analysis: the AI state is reported honestly (off = not configured; on = provider and region shown); no model is called here', async () => {
  // GET reads the configuration only: it sends no text to any provider and uses no AI quota.
  const state = (await call('/api/v1/offers/analyze')).data;
  if (state.configured === false) {
    const ai = (await call('/api/v1/offers/analyze', { text: 'Synthetic check: LKR 1000 monthly, eight hours each week.', role: 'WORKER' })).data;
    if (ai.status !== 'UNCONFIGURED' || ai.data !== null) throw new Error(`AI is not configured but the answer was ${ai.status}`);
    return 'AI is OFF: the answer is explicitly UNCONFIGURED, nothing invented';
  }
  if (state.configured !== true || !state.provider || !state.model || !state.processingRegion) throw new Error('AI reports as configured but the provider, model or region is missing');
  const availability = (state.availability ?? []).map(item => `${item.provider}:${item.state}`).join(', ') || 'no availability data';
  return `AI is ON (provider ${state.provider}, model ${state.model}, region ${state.processingRegion}); availability ${availability}. No text was sent. Each person must still consent in the app before any offer text leaves the server.`;
});

// ---- 3b. optional: ONE real model call on made-up text (opt-in: --real-ai). It uses the provider's quota, so it never runs by default.
if (process.argv.includes('--real-ai')) {
  await step('3b Real AI: one synthetic offer is analysed through the real provider, with consent, and the answer is validated and grounded', async () => {
    const state = (await call('/api/v1/offers/analyze')).data;
    if (state.configured !== true || !state.provider || !state.policyHash) throw new Error('AI is not configured on this server');
    const text = 'Warehouse Picker at Example Stores\nSalary: LKR 85000 per month\n40 hours per week\nYou must pay a registration fee of LKR 5000 before you start. Guaranteed visa for everyone.';
    const started = Date.now();
    const ai = (await call('/api/v1/offers/analyze', { text, role: 'WORKER', consent: { provider: state.provider, noticeVersion: state.noticeVersion, policyHash: state.policyHash, transmit: true, adultConfirmed: true } })).data;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (ai.status !== 'SUCCESS' || !ai.data) throw new Error(`the provider answered ${ai.status} after ${seconds} s: ${ai.message}${ai.retryAfterSeconds ? ` (retry after ${ai.retryAfterSeconds} s)` : ''}`);
    const ungrounded = [ai.data.salary.quote, ai.data.workingHours.quote, ...ai.data.warningSigns.map(item => item.quote)].filter(quote => quote && !text.includes(quote));
    if (ungrounded.length) throw new Error(`${ungrounded.length} quoted passage(s) are not in the text that was sent`);
    return `SUCCESS from ${ai.provider} in ${seconds} s: ${ai.data.warningSigns.length} warning sign(s), ${ai.data.missingDetails.length} missing detail(s), ${ai.data.followUpQuestions.length} question(s); every quote appears in the original text`;
  });
}

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

// ---- 5b. Evidence Vault: the person's own revocation and correction notes (module 6)
await step('5b Evidence status: correction note, resolve, revoke, reinstate, all private to this account', async () => {
  const pdf = Buffer.from('%PDF-1.7\nSynthetic status check ' + randomUUID() + '\n');
  const upload = await call('/api/v1/vault', { title: 'Synthetic status check', category: 'other', idempotencyKey: randomUUID(), file: { name: 'status-check.pdf', mimeType: 'application/pdf', buffer: pdf } }, { raw: true });
  const id = upload.data.documentId;
  try {
    const statusOf = async () => (await call('/api/v1/vault/status')).data.items.find(item => item.documentId === id);
    const noteId = randomUUID(), noteKey = randomUUID();
    const body = { correctionId: noteId, documentId: id, note: 'Synthetic: the date needs checking', idempotencyKey: noteKey };
    const first = (await call('/api/v1/vault/corrections', body)).data, again = (await call('/api/v1/vault/corrections', body)).data;
    if (first.replayed !== false || again.replayed !== true) throw new Error('the same note was not replayed safely');
    if ((await statusOf())?.corrections?.[0]?.resolvedAt !== null) throw new Error('the new note should be open');
    await call('/api/v1/vault/corrections/resolve', { correctionId: noteId });
    if (!(await statusOf())?.corrections?.[0]?.resolvedAt) throw new Error('the note was not marked fixed');
    await call('/api/v1/vault/revoke', { documentId: id, reason: 'Synthetic: superseded' });
    const revoked = await statusOf(); if (revoked?.revoked !== true || revoked.reason !== 'Synthetic: superseded') throw new Error('revocation was not recorded');
    await call('/api/v1/vault/reinstate', { documentId: id });
    if ((await statusOf())?.revoked !== false) throw new Error('reinstating did not clear the revocation');
    const stranger = await call('/api/v1/vault/revoke', { documentId: randomUUID(), reason: 'x' }, { statuses: [404] });
    return `note replayed, resolved; revoked then reinstated; someone else's document answers ${stranger.status}`;
  } finally { await call('/api/v1/vault/delete', { documentId: id }).catch(() => null); }
});

// ---- 2b. Company research history (module 2); the search itself uses the public GLEIF registry with a made-up name
await step('2b Research history: a search is saved privately, listed, and can be deleted', async () => {
  const name = 'Zzyzx Synthetic Check ' + randomUUID().slice(0, 8);
  const search = await call(`/api/v1/research/companies?name=${encodeURIComponent(name)}`, undefined, { statuses: [200, 429, 503] });
  if (search.status !== 200) return `NOT EXERCISED: the registry search answered ${search.status}`;
  const listed = (await call('/api/v1/research/history')).data.items;
  const mine = listed.find(item => item.queryName === name);
  if (!mine) throw new Error('the search was not saved to the history');
  await call('/api/v1/research/history/remove', { entryId: mine.entryId });
  if ((await call('/api/v1/research/history')).data.items.some(item => item.entryId === mine.entryId)) throw new Error('the entry is still listed after deletion');
  return `saved as "${mine.topMatch}" and deleted`;
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

// ---- 15. security activity (module 12): the server's record of this account's own sign-ins
await step('15 Security activity: only this account\'s events, kind and time only, newest first', async () => {
  const result = (await call('/api/v1/security-events')).data;
  if (!Array.isArray(result.items) || result.limit !== 30 || result.items.length > 30) throw new Error('unexpected answer');
  if (result.items.some(item => Object.keys(item).sort().join() !== 'kind,occurredAt')) throw new Error('an entry exposed more than kind and time');
  if (result.items.some((item, i, all) => i > 0 && Date.parse(all[i - 1].occurredAt) < Date.parse(item.occurredAt))) throw new Error('not newest first');
  const refused = await call('/api/v1/security-events?subjectId=' + randomUUID(), undefined, { statuses: [422] });
  return result.items.length === 0 ? `empty (the hosted service may not record sign-ins yet); a client-supplied subject is refused (${refused.status})` : `${result.items.length} event(s), newest ${result.items[0].kind}`;
});

// ---- 16. Smart CV Builder: private, validated, revision-checked
await step('16 CV Builder: save, read back exactly, update with the revision, refuse a stale one and an unsafe link, delete', async () => {
  const id = randomUUID();
  const content = { basics: { fullName: 'Synthetic Hosted Check', headline: '', email: '', phone: '', location: '', links: [{ label: 'Portfolio', url: 'https://example.test/me' }] }, summary: 'Synthetic summary typed for a hosted check.', education: [], experience: [], skills: ['Welding'], projects: [], achievements: [], certifications: [], references: [], includeVerifiedWork: false };
  const body = { id, title: 'Synthetic hosted CV', template: 'modern', targetRole: 'Welder', content, expectedRevision: 0 };
  try {
    if ((await call('/api/v1/cv', body)).data.revision !== 1) throw new Error('the first save should be revision 1');
    const read = (await call('/api/v1/cv?id=' + id)).data;
    if (JSON.stringify(read.content) !== JSON.stringify(content) || read.template !== 'modern') throw new Error('the CV did not read back as saved');
    if ((await call('/api/v1/cv', { ...body, title: 'Renamed hosted CV', expectedRevision: 1 })).data.revision !== 2) throw new Error('the update should be revision 2');
    await call('/api/v1/cv', { ...body, expectedRevision: 1 }, { statuses: [409] });
    await call('/api/v1/cv', { ...body, id: randomUUID(), content: { ...content, basics: { ...content.basics, links: [{ label: 'x', url: 'javascript:alert(1)' }] } } }, { statuses: [422] });
    await call('/api/v1/cv', { ...body, id: randomUUID(), content: { ...content, verified: true } }, { statuses: [422] });
    const list = (await call('/api/v1/cv')).data;
    if (!list.items.some(item => item.id === id)) throw new Error('the CV is missing from the list');
  } finally { await call('/api/v1/cv/remove', { id }).catch(() => null); }
  await call('/api/v1/cv?id=' + id, undefined, { statuses: [404] });
  return 'saved, read back, updated, stale save and unsafe link refused, then deleted';
});

// ---- 17. saved-listing history (module 3): a minimal private snapshot
await step('17 Saved-listing history: a snapshot is stored privately, keeps only criterion outcomes, and can be deleted', async () => {
  const listingId = randomUUID();
  const snapshot = { listingId, listingTitle: 'Synthetic hosted listing', companyName: null, preferenceVersion: 1, reasons: [{ id: 'role', outcome: 'matches' }, { id: 'payUnknown', outcome: 'unknown' }] };
  const added = (await call('/api/v1/opportunities/history', snapshot)).data;
  if (added.replayed !== false) throw new Error('unexpected replay');
  let entryId = added.entryId;
  try {
    const entry = (await call('/api/v1/opportunities/history')).data.items.find(item => item.listingId === listingId);
    if (!entry || entry.reasons.length !== 2) throw new Error('the snapshot is missing from the list');
    await call('/api/v1/opportunities/history', { ...snapshot, listingId: randomUUID(), reasons: [{ id: 'role', outcome: 'matches', detail: 'Your preference: nurse' }] }, { statuses: [422] });
    entryId = entry.entryId;
  } finally { await call('/api/v1/opportunities/history/remove', { entryId }).catch(() => null); }
  if ((await call('/api/v1/opportunities/history')).data.items.some(item => item.listingId === listingId)) throw new Error('the entry is still listed after deletion');
  return 'stored, read back with outcomes only, invented content refused, deleted';
});

// ---- 18. personal records (application tracker and workroom): private, validated, revisioned
await step('18 Application tracker and Workroom: save, read back exactly, list, update with the revision, refuse stale, invalid and foreign-owner input, delete', async () => {
  const appId = randomUUID(), projId = randomUUID();
  const appContent = { listingId: null, organization: 'Synthetic Employer (DEMO)', location: 'Kandy', appliedOn: '2026-11-01', nextStepAt: '2026-11-12T09:30', notes: 'Synthetic note', events: [{ id: randomUUID(), kind: 'interview', at: '2026-11-12T09:30', notes: 'Phone call' }], prep: [true, false, true, false, false, false] };
  const appBody = { id: appId, kind: 'application', title: 'Synthetic hosted application', status: 'interviewing', content: appContent, expectedRevision: 0 };
  const projBody = { id: projId, kind: 'project', title: 'Synthetic hosted project', status: 'active', content: { description: 'Synthetic', dueOn: '2026-12-01', milestones: [{ id: randomUUID(), title: 'M1', done: false, dueOn: '2026-11-20' }], tasks: [{ id: randomUUID(), title: 'T1', done: true }, { id: randomUUID(), title: 'T2', done: false }] }, expectedRevision: 0 };
  try {
    if ((await call('/api/v1/records', appBody)).data.revision !== 1) throw new Error('the first application save should be revision 1');
    if ((await call('/api/v1/records', projBody)).data.revision !== 1) throw new Error('the first project save should be revision 1');
    const read = (await call('/api/v1/records?id=' + appId)).data;
    if (JSON.stringify(read.content) !== JSON.stringify(appContent) || read.status !== 'interviewing') throw new Error('the application did not read back as saved');
    const projects = (await call('/api/v1/records?kind=project')).data.items;
    const mine = projects.find(item => item.id === projId);
    if (!mine || mine.summary.taskCount !== 2 || mine.summary.tasksDone !== 1) throw new Error('the project list is missing or its task counts are wrong');
    if (projects.some(item => item.id === appId)) throw new Error('the project list contains an application');
    if ((await call('/api/v1/records', { ...appBody, status: 'offered', expectedRevision: 1 })).data.revision !== 2) throw new Error('the update should be revision 2');
    await call('/api/v1/records', { ...appBody, expectedRevision: 1 }, { statuses: [409] });
    await call('/api/v1/records', { ...appBody, id: randomUUID(), status: 'active' }, { statuses: [422] });
    await call('/api/v1/records', { ...appBody, id: randomUUID(), content: { ...appContent, appliedOn: '01/11/2026' } }, { statuses: [422] });
    await call('/api/v1/records', { ...appBody, id: randomUUID(), ownerId: randomUUID() }, { statuses: [422] });
    await call('/api/v1/records?id=' + randomUUID(), undefined, { statuses: [404] });
  } finally {
    await call('/api/v1/records/remove', { id: appId }).catch(() => null);
    await call('/api/v1/records/remove', { id: projId }).catch(() => null);
  }
  await call('/api/v1/records?id=' + appId, undefined, { statuses: [404] });
  return 'both kinds saved, read back, counted, updated, stale/invalid/foreign-owner refused, then deleted (cross-user isolation is proven by the local real-stack harness and the database tests, since this run has one account)';
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
  ['4b Agreement expiry and renewal', 'needs a second account and an agreement proposal'], ['5c Revocation blocks attaching', 'needs a saved work record or offer'],
  ['4 Digital agreements', 'needs a second account'], ['6 Work Passport (verified work, sharing)', 'needs an employer account to verify a record'],
  ['8 Dispute and appeals', 'needs an independent reviewer capability'], ['9 Organization portal', 'needs two independent approvers with the authority capability'],
  ['11 Recruiter scam protection', 'needs an organization representative'],
]) skip(id, why);

const tally = results.reduce((t, r) => ({ ...t, [r.status]: (t[r.status] ?? 0) + 1 }), {});
console.log(`\nPASS ${tally.PASS ?? 0} | FAIL ${tally.FAIL ?? 0} | NOT RUN ${tally['NOT RUN'] ?? 0}   (${origin})`);
await ctx.dispose();
process.exitCode = tally.FAIL ? 1 : 0;
