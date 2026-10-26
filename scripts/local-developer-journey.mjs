import { randomUUID } from 'node:crypto';

// Real local stack: a worker creates a developer key, an integrator (plain HTTP, no browser session) verifies a real credential
// with it, revocation of the credential and of the key take effect at once, and bad keys never learn anything.
export async function localDeveloperJourney({ worker, employer, workId, request, record, origin }) {
  const must = (ok, label) => { if (!ok) throw new Error(label); record(label); };
  const configured = (await request(worker, '/api/v1/credentials')).signingConfigured;
  if (!configured) { console.log('SKIPPED: developer API journey (the local app has no credential signing key)'); return { skipped: true }; }
  const created = await request(worker, '/api/v1/developer/keys', { label: 'Synthetic HR integration' });
  must(/^oryq_live_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(created.key) && created.scopes.join() === 'credentials:verify', 'A person creates a developer key; the full key is shown once');
  const listed = await request(worker, '/api/v1/developer/keys');
  must(listed.items.length >= 1 && !JSON.stringify(listed).includes(created.key.split('.')[1]), 'The key list never contains the secret');
  must((await request(employer, '/api/v1/developer/keys')).items.every(item => item.keyId !== created.keyId), 'Another account does not see the key');
  const issued = await request(worker, '/api/v1/credentials', { workId, lifetimeDays: 30, idempotencyKey: randomUUID() });
  const call = (key, body, extra = {}) => fetch(`${origin}/api/v1/developer/credentials/verify`, { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}), ...extra }, body: JSON.stringify(body) });
  const good = await (await call(created.key, { credential: issued.token })).json();
  must(good.data.valid === true && good.data.state === 'valid' && good.data.credential.id === issued.credentialId && JSON.stringify(good).indexOf(workId) === -1, 'An integrator verifies a real credential with the key and learns nothing about the account or record');
  const [header, payload, signature] = issued.token.split('.');
  const bad = await (await call(created.key, { credential: `${header}.${payload.slice(0, -2)}AA.${signature}` })).json();
  must(bad.data.valid === false && bad.data.state === 'not_verified', 'A tampered credential is not valid');
  const wrong = created.key.slice(0, -1) + (created.key.endsWith('A') ? 'B' : 'A');
  const refusals = await Promise.all([call(null, { credential: issued.token }), call('garbage', { credential: issued.token }), call(wrong, { credential: issued.token })]);
  must(refusals.every(response => response.status === 401) && (await Promise.all(refusals.map(response => response.text()))).every((text, _, all) => text.replace(/"requestId":"[^"]+"/g, '') === all[0].replace(/"requestId":"[^"]+"/g, '')), 'Missing, malformed and wrong keys all get the same 401');
  await request(worker, '/api/v1/credentials/revoke', { credentialId: issued.credentialId });
  const revoked = await (await call(created.key, { credential: issued.token })).json();
  must(revoked.data.valid === false && revoked.data.state === 'revoked', 'Revoking the credential is reflected immediately through the developer API');
  await request(employer, '/api/v1/developer/keys/revoke', { keyId: created.keyId }, [404]);
  await request(worker, '/api/v1/developer/keys/revoke', { keyId: created.keyId });
  must((await call(created.key, { credential: issued.token })).status === 401, 'A revoked key stops working at once, and only its owner could revoke it');
  const after = (await request(worker, '/api/v1/developer/keys')).items.find(item => item.keyId === created.keyId);
  must(after.revokedAt !== null && after.callsLast24h >= 3, 'Usage is metered: the owner sees the number of checks and the revocation');
  return { skipped: false };
}
