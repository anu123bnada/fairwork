import { randomUUID } from 'node:crypto';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { expect } from '@playwright/test';

// Real local stack: real Auth sessions, real PostgreSQL, the app's real signing key (a throwaway test key
// supplied to the local app process only) and a real browser verifying against the published public key.
// If the app was started without a signing key this journey reports SKIPPED; it never counts as a pass.
export async function localCredentialJourney({ worker, employer, outsider, workId, request, record, origin, evidence }) {
  const must = (ok, label) => { if (!ok) throw new Error(label); record(label); };
  const plan = await request(worker, '/api/v1/entitlements');
  must(plan.plan.id === 'worker_free' && plan.billing.available === false && plan.essentialFeatures.includes('privacy_requests') && plan.limits[0].limit === 10, 'A new account is on the free worker plan, essential protections are listed and no billing is offered');
  await request(worker, '/api/v1/operator/entitlements', { subjectId: employer.id, plan: 'worker_plus', reason: 'Not an operator', idempotencyKey: randomUUID() }, [403]);
  must((await request(employer, '/api/v1/entitlements')).plan.id === 'worker_free', 'A non-operator cannot grant a plan to anyone');
  const mine = await request(worker, '/api/v1/credentials');
  if (!mine.signingConfigured) { console.log('SKIPPED: credential journey (the local app has no signing key configured)'); return { skipped: true }; }
  const body = { workId, lifetimeDays: 30, idempotencyKey: randomUUID() };

  await request(outsider, '/api/v1/credentials', body, [403, 404]);
  await request(employer, '/api/v1/credentials', body, [403, 404]);
  await request(worker, '/api/v1/credentials', { ...body, holderId: employer.id }, [422]);
  await request(worker, '/api/v1/credentials', { ...body, lifetimeDays: 500 }, [422]);
  const anonymous = await fetch(`${origin}/api/v1/credentials`, { method: 'POST', headers: { Origin: origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  must(anonymous.status === 401, 'Credential issuing requires a signed-in holder; the reviewing representative and unrelated accounts are refused');

  const issued = await request(worker, '/api/v1/credentials', body);
  const payload = decodeJwt(issued.token);
  must(payload.vct === 'oryqen.work-claim.v1' && payload.claim.assurance === 'independently_reviewed' && /demo-authority/.test(payload.claim.caveat) && payload.sub !== worker.id && !JSON.stringify(payload).includes(worker.id),
    'Issued credential carries the reviewed assurance and the demo-authority caveat, and no account identity');
  const replay = await request(worker, '/api/v1/credentials', body);
  must(replay.replayed === true && replay.token === issued.token && replay.credentialId === issued.credentialId, 'Retrying the same request returns the same credential and creates no duplicate');
  await request(worker, '/api/v1/credentials', { ...body, statement: 'Senior director' }, [409, 422]);

  const keys = await (await fetch(`${origin}/.well-known/oryqen-keys.json`)).json();
  must(keys.keys.length >= 1 && !JSON.stringify(keys).includes('"d"') && keys.keys.some(key => key.kid === decodeProtectedHeader(issued.token).kid), 'Published key set contains public material only');
  const statusOf = async id => (await (await fetch(`${origin}/api/v1/credentials/status?id=${id}`)).json()).data;
  must((await statusOf(payload.jti)).status === 'valid', 'An anonymous caller sees the credential as valid, with no identity in the answer');
  must(Object.keys(await statusOf(payload.jti)).sort().join() === 'checkedAt,reason,status', 'The public status answer contains only status, reason and time');
  must((await statusOf(randomUUID())).status === 'unknown', 'An unknown credential id is reported as unknown');

  const page = await worker.context.newPage();
  await page.goto(`${origin}/verify#c=${issued.token}`);
  await expect(page.getByRole('status').filter({ hasText: 'Valid credential' })).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${evidence}/credential-verified.png` });
  record('A real browser verifies the real signature against the published key and the live status, without sending the credential');

  const list = await request(worker, '/api/v1/credentials');
  must(list.items.some(item => item.credentialId === issued.credentialId && item.status === 'valid'), 'The holder sees the credential and its live status');
  must((await request(employer, '/api/v1/credentials')).items.length === 0 && (await request(outsider, '/api/v1/credentials')).items.length === 0, 'Other accounts, including the reviewer, see none of the holder’s credentials');
  await request(outsider, '/api/v1/credentials/revoke', { credentialId: issued.credentialId }, [404]);
  await request(employer, '/api/v1/credentials/revoke', { credentialId: issued.credentialId }, [404]);
  await request(worker, '/api/v1/credentials/revoke', { credentialId: issued.credentialId });
  must((await statusOf(payload.jti)).status === 'revoked' && (await statusOf(payload.jti)).reason === 'holder_requested', 'Only the holder can revoke, and revocation is immediately public');
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Revoked' })).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${evidence}/credential-revoked.png` });
  await page.close();
  record('The verify page shows the revoked credential as revoked, never as valid');
  return { skipped: false, credentialId: issued.credentialId };
}


// Trust Chain on real rows: the same verified record, seen by the worker, the reviewing representative and a stranger.
export async function localTrustChainJourney({ worker, employer, outsider, workId, request, record }) {
  const must = (ok, label) => { if (!ok) throw new Error(label); record(label); };
  const mine = await request(worker, '/api/v1/trust-chain');
  const claim = mine.claims.find(c => c.source.kind === 'work_record' && c.source.id === workId);
  must(!!claim && claim.verification.assurance === 'independently_reviewed' && claim.validity.state === 'active' && claim.type === 'work_performed'
    && /demo-authority/.test(claim.verification.caveat) && claim.verification.verifiedAt && claim.source.contentHash?.length === 64 && claim.visibility.shareable === true,
    'The worker’s Trust Chain shows the verified work as reviewed, valid, hash-bound and carrying the demo-authority caveat (real database rows)');
  must(mine.claims.every(c => c.verification.assurance !== 'independently_reviewed' || c.source.kind === 'work_record'), 'Only second-party-reviewed work is ever shown as reviewed');
  const text = JSON.stringify(mine);
  must(![worker.id, employer.id, outsider.id].some(id => text.includes(id)), 'The Trust Chain exposes no account identifiers, only roles');
  must(!(await request(employer, '/api/v1/trust-chain')).claims.some(c => c.source.id === workId), 'The reviewing representative’s Trust Chain does not present the worker’s record as their own claim');
  must(!(await request(outsider, '/api/v1/trust-chain')).claims.some(c => c.source.id === workId), 'An unrelated account’s Trust Chain contains no trace of the record');
  await request(worker, '/api/v1/trust-chain?workerId=' + employer.id, undefined, [422]);
}
