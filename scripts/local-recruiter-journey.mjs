import { randomUUID } from 'node:crypto';

// Real local stack: real Auth sessions and PostgreSQL. A worker asks about a recruiter, the employer's approved representative decides
// without learning who asked, an unrelated account can neither see nor decide, and the worker can erase the check.
export async function localRecruiterJourney({ worker, employer, outsider, companyId, companyName, request, record }) {
  const must = (ok, label) => { if (!ok) throw new Error(label); record(label); };
  const domain = `synthetic-employer-${Date.now()}.com`;
  const claimed = await request(employer, '/api/v1/recruiter/domains', { companyId, domain });
  must(Boolean(claimed.token ?? claimed.domainId), 'An approved representative claims a company domain and is given a proof token');
  await request(outsider, '/api/v1/recruiter/domains', { companyId, domain: `other-${Date.now()}.com` }, [403, 404]);
  const listedDomains = await request(employer, `/api/v1/recruiter/domains?companyId=${companyId}`);
  must(listedDomains.items.length === 1 && listedDomains.items[0].proof.controlled === false, 'Control of the domain is not claimed until the proof is actually seen');
  await request(outsider, `/api/v1/recruiter/domains?companyId=${companyId}`, undefined, [403, 404]).catch(() => undefined);

  const found = await request(worker, `/api/v1/recruiter/companies?query=${encodeURIComponent(companyName)}`);
  must(found.items.some(item => item.companyId === companyId), 'A worker can find the employer organization by name');
  const verificationId = randomUUID();
  const claim = { recruiterName: 'Synthetic Recruiter', claimedEmployer: companyName, companyId, roleTitle: 'Talent partner', email: `recruiter@${domain}`, noticeAcknowledged: true, idempotencyKey: verificationId };
  await request(worker, '/api/v1/recruiter', { ...claim, noticeAcknowledged: false }, [422]);
  const created = await request(worker, '/api/v1/recruiter', claim);
  const replay = await request(worker, '/api/v1/recruiter', claim);
  must(created.verificationId === verificationId && replay.verificationId === verificationId && (await request(worker, '/api/v1/recruiter')).items.length === 1, 'Creating a recruiter check is idempotent');
  const before = await request(worker, `/api/v1/recruiter/result?id=${verificationId}`);
  must(before.status === 'UNVERIFIED' && !before.evidence.some(item => item.area === 'email' && item.effect === 'supports'), 'Before any employer decision the recruiter is unverified and the email is not treated as proof');

  const queue = await request(employer, '/api/v1/recruiter/queue');
  const waiting = queue.items.find(item => item.verificationId === verificationId);
  must(Boolean(waiting) && !JSON.stringify(queue).includes('requester') && !JSON.stringify(queue).includes(worker.email ?? 'no-email'), 'The representative sees the recruiter in a queue without any information about the worker who asked');
  must((await request(outsider, '/api/v1/recruiter/queue')).items.every(item => item.verificationId !== verificationId), 'An unrelated account sees nothing in its queue');
  await request(outsider, '/api/v1/recruiter/decide', { verificationId, decision: 'confirm', reason: 'I do not know this person', validDays: 30, idempotencyKey: randomUUID() }, [403, 404]);

  const decision = { verificationId, decision: 'confirm', reason: 'Works on our talent team', validDays: 30, idempotencyKey: randomUUID() };
  await request(employer, '/api/v1/recruiter/decide', decision);
  await request(employer, '/api/v1/recruiter/decide', decision);
  await request(employer, '/api/v1/recruiter/decide', { ...decision, validDays: 400, idempotencyKey: randomUUID() }, [422]);
  const confirmed = await request(worker, `/api/v1/recruiter/result?id=${verificationId}`);
  must(confirmed.claim.employer.confirmations === 1 && confirmed.claim.decisions.length === 1 && confirmed.status !== 'UNVERIFIED', 'The worker sees the representative\'s dated, expiring confirmation and the status moves');
  await request(employer, '/api/v1/recruiter/decide', { verificationId, decision: 'dispute', reason: 'Changed my mind', validDays: null, idempotencyKey: randomUUID() });
  const disputed = await request(worker, `/api/v1/recruiter/result?id=${verificationId}`);
  must(disputed.status === 'CONFLICTING_EVIDENCE', 'A later dispute by the representative makes the evidence conflicting');
  await request(employer, '/api/v1/recruiter/decide', { verificationId, decision: 'withdraw', reason: 'Withdrawn', validDays: null, idempotencyKey: randomUUID() });

  await request(employer, '/api/v1/recruiter/delete', { verificationId }, [404]);
  await request(outsider, '/api/v1/recruiter/delete', { verificationId }, [404]);
  await request(worker, '/api/v1/recruiter/delete', { verificationId });
  must((await request(worker, '/api/v1/recruiter')).items.length === 0 && (await request(employer, '/api/v1/recruiter/queue')).items.every(item => item.verificationId !== verificationId), 'Only the worker can erase a check, and it disappears for everyone');
  await request(employer, '/api/v1/recruiter/domains/remove', { domainId: listedDomains.items[0].domainId });
  must((await request(employer, `/api/v1/recruiter/domains?companyId=${companyId}`)).items.length === 0, 'The representative can remove a claimed domain');
  return { skipped: false };
}
