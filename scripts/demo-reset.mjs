// Reset a DEMO account to its baseline using that account's OWN permissions (the app's own API), so it cannot touch anyone else's data.
//   node scripts/demo-reset.mjs [origin] --email demo@example.test        (password: DEMO_PASSWORD, or typed at a hidden prompt; never printed or stored)
// Guards: the origin must be a loopback address or exactly https://oryqen-staging.vercel.app (never production); the email must end in @example.test; the profile display name
// must contain "DEMO". It deletes the account's CVs, saved-listing history and company-research history, then recreates the baseline: a labelled DEMO CV plus the demo
// employment entries and offer drafts from scripts/demo-seed-data.json (fixed ids and idempotency keys, so re-running never duplicates). The account itself must already exist
// (the owner creates and confirms it; this script never registers accounts).
import { request as playwrightRequest } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const STAGING = 'https://oryqen-staging.vercel.app';
const positional = process.argv.slice(2).find(arg => !arg.startsWith('--') && /^https?:/.test(arg));
const origin = (positional ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
const emailIndex = process.argv.indexOf('--email');
const email = emailIndex > 0 ? process.argv[emailIndex + 1] : undefined;
const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
const fail = message => { console.error(message); process.exit(1); };
if (!local && origin !== STAGING) fail(`Refusing: ${origin} is not a loopback address or ${STAGING}.`);
if (!email || !email.toLowerCase().endsWith('@example.test')) fail('Refusing: pass --email with a demo address ending in @example.test.');

function ask(label) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = text => { if (text.includes(label)) process.stdout.write(text); };
    rl.question(`${label}: `, answer => { rl.close(); process.stdout.write('\n'); resolve(answer.trim()); });
  });
}
let password = process.env.DEMO_PASSWORD ?? '';
if (!password) { if (!process.stdin.isTTY) fail('Set DEMO_PASSWORD or run this in an interactive terminal (the password is typed at a hidden prompt).'); password = await ask('Demo account password (hidden)'); }

const ctx = await playwrightRequest.newContext({ extraHTTPHeaders: { Origin: origin } });
const call = async (path, body, statuses = [200]) => {
  const response = await ctx.fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Idempotency-Key': randomUUID() }, ...(body === undefined ? {} : { data: body }), timeout: 60000, maxRedirects: 0 });
  const json = await response.json().catch(() => null);
  if (!statuses.includes(response.status())) throw new Error(`${path.split('?')[0]} answered HTTP ${response.status()} ${json?.error?.code ?? ''}`.trim());
  return json?.data;
};

try {
  const signed = await call('/api/v1/auth/sign-in', { email, password });
  password = '';
  if (signed?.signedIn !== true) fail('Sign-in did not report a session.');
  const me = await call('/api/v1/me');
  if (!/\bDEMO\b/.test(me?.displayName ?? '')) fail(`Refusing: the profile "${me?.displayName ?? ''}" is not labelled DEMO.`);
  console.log(`Signed in as the DEMO account "${me.displayName}" on ${origin}`);

  let removed = 0;
  for (const cv of (await call('/api/v1/cv')).items) { await call('/api/v1/cv/remove', { id: cv.id }); removed++; }
  for (const entry of (await call('/api/v1/opportunities/history')).items) { await call('/api/v1/opportunities/history/remove', { entryId: entry.entryId }); removed++; }
  for (const entry of (await call('/api/v1/research/history')).items) { await call('/api/v1/research/history/remove', { entryId: entry.entryId }); removed++; }
  console.log(`Removed ${removed} record(s) this account had created (CVs, saved-listing history, research history).`);

  const baselineCv = { basics: { fullName: 'DEMO Visitor', headline: 'DEMO: warehouse and welding assistant', email: '', phone: '', location: 'Kandy (demo)', links: [] },
    summary: 'DEMO data for the exhibition. Reliable assistant with warehouse and workshop experience, looking for a first full-time role. Everything here is made up.',
    education: [{ school: 'DEMO Technical College', qualification: 'NVQ Level 3 (demo)', start: '2020', end: '2022', notes: '' }],
    experience: [{ employer: 'DEMO Stores', role: 'Warehouse Assistant', start: '2023', end: '2025', details: 'Prepared about 120 orders a week and kept the stock room tidy (demo data).' }],
    skills: ['Stock handling', 'MIG welding', 'Forklift', 'Teamwork', 'Safety'], projects: [], achievements: ['Employee of the month, DEMO Stores (demo)'], certifications: [], references: [], includeVerifiedWork: false };
  await call('/api/v1/cv', { id: '40000000-0000-4000-8000-0000000d0001', title: 'DEMO CV (reset baseline)', template: 'classic', targetRole: 'Warehouse Assistant', content: baselineCv, expectedRevision: 0 });
  const data = JSON.parse(readFileSync(new URL('./demo-seed-data.json', import.meta.url), 'utf8'));
  for (const entry of data.employment) await call('/api/v1/me/employment-history', { operation: 'save', id: entry.id, expectedRevision: 0, idempotencyKey: entry.idempotencyKey, content: entry.content }, [200, 409]);
  for (const draft of data.offerDrafts) await call('/api/v1/offers/drafts', { operation: 'save', id: draft.id, expectedRevision: 0, idempotencyKey: draft.idempotencyKey, content: draft.content }, [200, 409]);
  console.log(`Baseline restored: 1 DEMO CV, ${data.employment.length} employment entries, ${data.offerDrafts.length} offer drafts.`);
  await call('/api/v1/auth/sign-out', {});
  console.log('Done. Signed out.');
} catch (error) { console.error(`Reset stopped: ${error.message}`); process.exitCode = 1; }
await ctx.dispose();
