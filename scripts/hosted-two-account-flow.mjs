// Shared executable journey: the caller supplies real authenticated app sessions.
// This module creates no credentials, authority, fixtures or success responses.
export async function twoAccountFlow({ worker, employer, companyId, request, record }) {
  const must = (condition, label) => { if (!condition) throw new Error(label); record(label); };
  must(worker.id !== employer.id, 'Two distinct authenticated subjects');
  const uuid = () => crypto.randomUUID();
  const offerId = uuid(), agreementId = uuid(), workId = uuid();
  const offer = await request(employer, '/api/v1/offers', {
    offerId, companyId, workerId: worker.id, requesterRole: 'EMPLOYER', expectedVersion: 1, idempotencyKey: uuid(),
    terms: { salary: 1000, currency: 'LKR', startDate: '2026-10-16', hoursPerWeek: 8, responsibilities: 'Synthetic integration maintenance task' },
  });
  must(offer.offerId === offerId, 'Employer created persistent offer');
  const source = await request(worker, `/api/v1/agreements?offerId=${offerId}`);
  must(source.offer.representativeId === employer.id, 'Offer binds the independent approved representative');
  await request(worker, '/api/v1/agreement-workflows', { operation: 'create', agreementId, idempotencyKey: uuid(), offerId, offerVersion: source.offer.version, expectedSourceHash: source.offer.termHash, representativeId: employer.id });
  const readAgreement = actor => request(actor, `/api/v1/agreement-workflows?agreementId=${agreementId}`);
  const expected = v => ({ expectedVersion: v.version, expectedHash: v.contentHash, expectedState: v.state });
  let agreement = await readAgreement(worker), v = agreement.versions.at(-1);
  await request(worker, '/api/v1/agreement-workflows', { operation: 'propose', agreementId, idempotencyKey: uuid(), ...expected(v), sharedQuestionIds: [] });
  for (const actor of [worker, employer]) {
    agreement = await readAgreement(actor); v = agreement.versions.at(-1);
    const acknowledgement = { acknowledgedItemIds: v.unresolvedIds, expectedItemSetHash: v.itemSetHash };
    await request(actor, '/api/v1/agreement-workflows', { operation: 'acknowledge', agreementId, idempotencyKey: uuid(), ...expected(v), ...acknowledgement });
    await request(actor, '/api/v1/agreement-workflows', { operation: 'decide', agreementId, idempotencyKey: uuid(), ...expected(v), ...acknowledgement, decision: 'confirm' });
    if (actor === worker) must((await readAgreement(worker)).effectiveVersion === null, 'One party cannot make an agreement effective');
  }
  agreement = await readAgreement(worker); v = agreement.versions.at(-1);
  must(agreement.effectiveVersion === v.version && new Set(v.decisions.filter(d => d.decision === 'confirm').map(d => d.actorId)).size === 2, 'Two independent account confirmations persisted');
  await request(worker, '/api/v1/work-records', { operation: 'create', workId, idempotencyKey: uuid(), agreementId, agreementVersion: v.version, payload: { role: 'Synthetic integration worker', periodStart: '2026-10-16', periodEnd: '2026-10-16', hours: '8', tasks: 'Synthetic maintenance completed', evidence: ['Synthetic test evidence only'] } });
  const readWork = actor => request(actor, `/api/v1/work-records?workId=${workId}`);
  let work = await readWork(worker), w = work.versions.at(-1);
  const workExpected = value => ({ ...expected(value), expectedEvidenceHash: value.evidenceHash });
  await request(worker, '/api/v1/work-records', { operation: 'submit', workId, idempotencyKey: uuid(), ...workExpected(w) });
  work = await readWork(employer); w = work.versions.at(-1);
  await request(worker, '/api/v1/work-records', { operation: 'decide', workId, idempotencyKey: uuid(), ...workExpected(w), outcome: 'verified', reason: 'Self-verification denial probe' }, [403]);
  record('Worker self-verification denied');
  await request(employer, '/api/v1/work-records', { operation: 'decide', workId, idempotencyKey: uuid(), ...workExpected(w), outcome: 'verified', reason: 'Reviewed exact synthetic record and evidence for integration test' });
  w = (await readWork(worker)).versions.at(-1);
  must(w.state === 'verified' && w.decision.actorId === employer.id, 'Exact work revision independently verified');
  await request(worker, '/api/v1/passport', { idempotencyKey: uuid() });
  const passport = await request(worker, '/api/v1/passport');
  must(passport.ownerId === worker.id && passport.entries.some(entry => entry.workId === workId && entry.version === w.version), 'Private worker Passport contains eligible verified record');
  const otherPassport = await request(employer, '/api/v1/passport');
  must(otherPassport.ownerId === employer.id && !otherPassport.entries.some(entry => entry.workId === workId), 'Employer cannot obtain the worker Passport as their own');
  await request(employer, `/api/v1/passport?ownerId=${worker.id}`, undefined, [422]);
  record('Client-selected Passport owner denied');
  return { offerId, agreementId, workId };
}
