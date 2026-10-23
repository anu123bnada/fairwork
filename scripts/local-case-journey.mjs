// Invoked only by the guarded local real-service harness. No forged sessions.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

export async function localCaseJourney({ worker, employer, reviewer, operator, workId, request, record, localSql, evidence, origin, sharedRead }) {
  const must = (ok, label) => { if (!ok) throw new Error(label); record(label); };
  // Same audited offline bootstrap, restricted to these two existing capabilities.
  for (const [subject, grantor, capability] of [[operator, reviewer, 'review_operator'], [reviewer, operator, 'reviewer']]) {
    let sql = readFileSync('scripts/day2-bootstrap-capability.sql', 'utf8').replaceAll("'authority_operator'", `'${capability}'`);
    for (const [name, value] of Object.entries({ operator_id: grantor.id, target_subject: subject.id, operator_factor: grantor.factorId, subject_factor: subject.factorId, assignment_id: randomUUID() })) {
      if (!/^[0-9a-f-]{36}$/.test(value)) throw new Error('Invalid local review bootstrap identity');
      sql = sql.replace(`${name} uuid := null;`, `${name} uuid := '${value}';`);
    }
    sql = sql.replace('approval_record text := null;', "approval_record text := 'Owner-authorized local synthetic case review acceptance; independent MFA accounts; no hosted authority';")
      .replace('approved_until timestamptz := null;', "approved_until timestamptz := transaction_timestamp() + interval '1 day';");
    localSql(sql);
  }
  const work = (await request(worker, `/api/v1/work-records?workId=${workId}`)).versions.at(-1);
  const opening = { operation: 'open', caseId: randomUUID(), idempotencyKey: randomUUID(), workId, expectedVersion: work.version, expectedHash: work.contentHash, expectedEvidenceHash: work.evidenceHash, expectedState: work.state, reasonCode: 'evidence_integrity', reason: 'Synthetic local concern for review testing; not an allegation about a real person' };
  const endpoint = '/api/v1/work-cases';
  await request(reviewer, endpoint, opening, [403, 404]);
  await request(worker, endpoint, { ...opening, reporterId: employer.id }, [422]);
  await request(worker, endpoint, { ...opening, expectedHash: '0'.repeat(64) }, [409]);
  record('Real case rejects outsider creation, forged reporter and stale record');
  const first = await request(worker, endpoint, opening);
  must(JSON.stringify(first) === JSON.stringify(await request(worker, endpoint, opening)), 'Duplicate case command returns the identical immutable receipt');
  must(!(await request(worker, '/api/v1/passport')).entries.some(e => e.workId === workId), 'An unresolved real case immediately suppresses verified Passport history');
  if(sharedRead)must((await sharedRead()).entries.length===0,'Unresolved case also suppresses the named-recipient projection');
  await request(reviewer, `${endpoint}?caseId=${opening.caseId}`, undefined, [403, 404]);
  const read = actor => request(actor, `${endpoint}?caseId=${opening.caseId}`);
  must((await read(operator)).basis === null, 'Case operator can assign without access to private evidence');
  const command = (actor, fields, statuses) => request(actor, endpoint, { caseId: opening.caseId, idempotencyKey: randomUUID(), ...fields }, statuses);
  await command(employer, { operation: 'assign', expectedRevision: 1, reviewerId: reviewer.id, expiresAt: new Date(Date.now() + 3600000).toISOString(), reason: 'Unauthorized assignment probe' }, [403]);
  const assign = revision => command(operator, { operation: 'assign', expectedRevision: revision, reviewerId: reviewer.id, expiresAt: new Date(Date.now() + 3600000).toISOString(), reason: 'Independent synthetic evidence review' });
  await assign(1);
  await request(employer, '/api/v1/case-followups', {caseId:opening.caseId,operation:'response',expectedRevision:2,message:'Synthetic employer response to this case'});
  const correspondence = await request(worker, `/api/v1/case-followups?caseId=${opening.caseId}`);
  must(correspondence.items.some(item=>item.actorId===employer.id&&item.message==='Synthetic employer response to this case'), 'Real employer response persists and is visible to the worker');
  await request(operator, `/api/v1/case-followups?caseId=${opening.caseId}`, undefined, [403,404]);
  await request(reviewer, `/api/v1/case-followups?caseId=${opening.caseId}`, undefined, [403,404]);
  record('Operator and unaccepted reviewer cannot disclose participant correspondence');
  must((await read(reviewer)).basis === null, 'Assigned reviewer cannot disclose evidence before accepting independence');
  await command(reviewer, { operation: 'accept', expectedRevision: 2, noConflict: true });
  must((await read(reviewer)).basis?.contentHash === work.contentHash, 'Accepted independent reviewer sees only the exact case evidence revision');
  await command(operator, { operation: 'revoke', expectedRevision: 3, reason: 'Synthetic revocation denial test' });
  await read(reviewer).then(() => { throw new Error('Revoked reviewer retained read access'); }, error => { if (!/HTTP (403|404)/.test(error.message)) throw error; });
  await command(reviewer, { operation: 'decide', expectedRevision: 4, outcome: 'dismiss', rationale: 'Revoked reviewer denial probe' }, [403, 404]);
  record('Revoked reviewer immediately loses evidence and decision access');
  await assign(4);
  await command(reviewer, { operation: 'accept', expectedRevision: 5, noConflict: true });
  const decisions = await Promise.allSettled(['dismiss', 'correction_required'].map(outcome => command(reviewer, { operation: 'decide', expectedRevision: 6, outcome, rationale: 'Synthetic concurrency test decision; no real fraud finding' })));
  must(decisions.filter(d => d.status === 'fulfilled').length === 1 && decisions.filter(d => d.status === 'rejected' && /HTTP 409/.test(d.reason.message)).length === 1, 'Concurrent conflicting reviewer decisions commit exactly one immutable result');
  const resolved = await read(worker);
  must(resolved.status === 'resolved' && resolved.events.length === 7 && resolved.resolution?.reviewerId === reviewer.id, 'Case history preserves assignment, acceptance, revocation and one decision receipt');
  const visible = (await request(worker, '/api/v1/passport')).entries.some(e => e.workId === workId);
  must(visible === (resolved.outcome === 'dismiss'), 'Resolved case eligibility obeys the actual decision and independent integrity checks');
  if(sharedRead)must(((await sharedRead()).entries.length===1)===visible,'Case resolution preserves all independent eligibility conditions in shared projection');
  const page = worker.context.pages()[0];
  await page.goto(`${origin}/app/cases?caseId=${opening.caseId}`);
  await expect(page.getByRole('region', { name: 'Decision receipt' })).toBeVisible();
  await page.screenshot({ path: `${evidence}/real-case-resolution.png`, fullPage: true });
  must(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Real case decision and audit timeline render without mobile horizontal overflow');
  await page.goto(`${origin}/app/passport`);
  await page.getByText('Download a private copy', { exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download private JSON' }).click();
  const download = await downloading;
  await download.saveAs(`${evidence}/synthetic-private-passport.json`);
  const exported = JSON.parse(readFileSync(`${evidence}/synthetic-private-passport.json`, 'utf8'));
  must(exported.records.length === (visible ? 1 : 0) && !JSON.stringify(exported).includes(workId), 'Real private download rechecks case eligibility and excludes internal identifiers');
  const appeal = await request(worker, '/api/v1/case-followups', {caseId:opening.caseId,operation:'appeal',expectedRevision:resolved.revision,message:'Synthetic appeal requires a different independent reviewer'});
  must(Boolean(appeal.linkedCaseId) && (await read(worker)).resolution.recordedAt===resolved.resolution.recordedAt, 'Real appeal opens linked case and retains the original immutable decision');
  await request(operator, endpoint, {operation:'assign',caseId:appeal.linkedCaseId,expectedRevision:1,reviewerId:reviewer.id,expiresAt:new Date(Date.now()+3600000).toISOString(),reason:'Previous reviewer denial probe',idempotencyKey:randomUUID()}, [403]);
  must(!(await request(worker, '/api/v1/passport')).entries.some(e=>e.workId===workId), 'Real appeal suppresses Passport while original reviewer reassignment is denied');
  await page.goto(`${origin}/app/cases?caseId=${opening.caseId}`);
  await expect(page.getByRole('link',{name:'Open linked appeal case'})).toBeVisible();
  record('Real linked appeal is reopenable from the original case screen');
}
