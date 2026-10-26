import { randomUUID } from 'node:crypto';

// Real local stack: real Auth sessions and PostgreSQL. An operator sets an organization's plan, the approved representative sees it,
// the live-listing allowance is enforced on publication, and outsiders and conflicted operators are refused.
export async function localOrgPlanJourney({ worker, employer, operator, companyId, request, record }) {
  const must = (ok, label) => { if (!ok) throw new Error(label); record(label); };
  const listing = (status, id = randomUUID(), version = 0) => ({ operation: 'listing', id, companyId, fields: { title: 'Synthetic plan listing', description: 'Synthetic fixture only, not a real vacancy.', location: 'Colombo', workMode: 'onsite', salary: 50000, currency: 'LKR', payPeriod: 'month' }, status, expectedVersion: version, expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(), idempotencyKey: randomUUID() });

  const before = await request(employer, `/api/v1/organizations/plan?companyId=${companyId}`);
  must(before.plan.id === 'org_free' && before.limits[0].limit === 5 && before.limits[0].used === 0 && before.billing.available === false, 'An organization starts on the basic plan with no billing');
  await request(worker, `/api/v1/organizations/plan?companyId=${companyId}`, undefined, [403]);

  const live = [];
  for (let index = 0; index < 5; index += 1) { const body = listing('published'); await request(employer, '/api/v1/opportunities', body); live.push(body); }
  must((await request(employer, `/api/v1/organizations/plan?companyId=${companyId}`)).limits[0].used === 5, 'Five published listings use the whole basic allowance');
  await request(employer, '/api/v1/opportunities', listing('published'), [429]);
  await request(employer, '/api/v1/opportunities', listing('draft'));
  const first = live[0];
  await request(employer, '/api/v1/opportunities', { ...first, expectedVersion: 1, idempotencyKey: randomUUID(), fields: { ...first.fields, title: 'Edited synthetic plan listing' } });
  must(true, 'At the limit a new publication is refused, but a draft and the edit of a live listing are allowed');

  await request(employer, '/api/v1/operator/org-entitlements', { companyId, plan: 'org_team', reason: 'Employer cannot grant itself a plan', idempotencyKey: randomUUID() }, [403]);
  await request(worker, '/api/v1/operator/org-entitlements', { companyId, plan: 'org_team', reason: 'Not an operator', idempotencyKey: randomUUID() }, [403]);
  const assignment = { companyId, plan: 'org_team', reason: 'Synthetic organization plan for the real-stack journey', idempotencyKey: randomUUID() };
  const granted = await request(operator, '/api/v1/operator/org-entitlements', assignment);
  const replay = await request(operator, '/api/v1/operator/org-entitlements', assignment);
  must(granted.plan === 'org_team' && replay.replayed === true && replay.assignmentId === granted.assignmentId, 'An operator assigns the team plan; replaying the same request does not duplicate it');

  const after = await request(employer, `/api/v1/organizations/plan?companyId=${companyId}`);
  must(after.plan.id === 'org_team' && after.limits[0].limit === 50, 'The representative now sees the team plan and its larger allowance');
  await request(employer, '/api/v1/opportunities', listing('published'));
  must((await request(employer, `/api/v1/organizations/plan?companyId=${companyId}`)).limits[0].used === 6, 'A sixth publication succeeds under the team plan');
  return { skipped: false };
}
