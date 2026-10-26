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
  // Webhooks: real database, real signing, real background delivery. The endpoint name cannot resolve, so every delivery fails
  // honestly; what is proven is validation, secrecy, ownership, retries and the delivery log.
  await request(worker, '/api/v1/developer/webhooks', { url: 'https://127.0.0.1/hook' }, [422]);
  await request(worker, '/api/v1/developer/webhooks', { url: 'http://hooks.oryqen-journey.invalid/in' }, [422]);
  const hook = await request(worker, '/api/v1/developer/webhooks', { url: 'https://hooks.oryqen-journey.invalid/in' });
  must(/^[A-Za-z0-9_-]{43}$/.test(hook.secret), 'A person registers a public https endpoint; private and insecure addresses are refused and the signing secret is shown once');
  const hooks = await request(worker, '/api/v1/developer/webhooks');
  must(hooks.items.length === 1 && !JSON.stringify(hooks).includes(hook.secret) && (await request(employer, '/api/v1/developer/webhooks')).items.length === 0, 'The endpoint list never contains the secret and other accounts do not see it');
  const ping = await request(worker, '/api/v1/developer/webhooks/test', { webhookId: hook.webhookId });
  must(ping.outcome === 'failed' && ping.statusCode === null && (await request(worker, '/api/v1/developer/webhooks')).items[0].lastDelivery.eventType === 'ping', 'A test event to an unreachable endpoint is reported as failed and logged');
  await request(employer, '/api/v1/developer/webhooks/test', { webhookId: hook.webhookId }, [404]);
  const second = await request(worker, '/api/v1/credentials', { workId, lifetimeDays: 30, idempotencyKey: randomUUID() });
  await request(worker, '/api/v1/credentials/revoke', { credentialId: second.credentialId });
  let delivery = null;
  for (let i = 0; i < 40 && !(delivery?.eventType === 'credential.revoked' && delivery.attempt === 3); i += 1) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    delivery = (await request(worker, '/api/v1/developer/webhooks')).items[0].lastDelivery;
  }
  must(delivery?.eventType === 'credential.revoked' && delivery.attempt === 3 && delivery.outcome === 'failed', 'Revoking a credential sends a signed event in the background, retried up to three times, and every attempt is logged');
  await request(employer, '/api/v1/developer/webhooks/delete', { webhookId: hook.webhookId }, [404]);
  await request(worker, '/api/v1/developer/webhooks/delete', { webhookId: hook.webhookId });
  must((await request(worker, '/api/v1/developer/webhooks')).items.length === 0, 'Only the owner can remove an endpoint');
  return { skipped: false };
}
