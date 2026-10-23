// Real local Auth, mail and application APIs. No route fixtures or forged JWTs.
// Creates synthetic accounts/records and retains their audit history. Never hosted.
import { chromium, expect } from '@playwright/test';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { checkLocalDocker } from './local-development-runtime.mjs';
import { redactStartupOutput } from './local-development-diagnostics.mjs';
import { twoAccountFlow } from './hosted-two-account-flow.mjs';
import { stageSQL } from './activation-checks.mjs';
import { localCaseJourney } from './local-case-journey.mjs';
import { localPrivacyJourney } from './local-privacy-journey.mjs';
import { localSharingJourney } from './local-sharing-journey.mjs';
import { localDeactivationJourney } from './local-deactivation-journey.mjs';
import { localOfferHistoryJourney } from './local-offer-history-journey.mjs';

checkLocalDocker();
const origin = 'http://127.0.0.1:3100';
const mail = 'http://127.0.0.1:55424';
const results = [], actors = [];
const evidence = `test-results/local-real-${Date.now()}`;
mkdirSync(evidence, { recursive: true });
const record = check => { results.push({ check, status: 'PASS' }); console.log(`PASS: ${check}`); };
const must = (value, check) => { if (!value) throw new Error(check); record(check); };
let browser, app, stage = 'startup';
async function startApp() {
  app = spawn(process.execPath, ['scripts/run-local-development.mjs'], { windowsHide: true, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) {
    if (app.exitCode !== null) throw new Error('Owned local app process exited');
    if (await fetch(`${origin}/sign-in`).then(r => r.ok).catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Owned local app did not start');
}
function stopApp() {
  if (!app) return;
  const result = spawnSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Could not stop the test-owned app process tree');
  app = undefined;
}
function localSql(sql) {
  checkLocalDocker();
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_oryqen-local-dev', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input: sql, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (result.status !== 0) throw new Error(`Local SQL failed: ${redactStartupOutput(result.stderr).slice(0, 500)}`);
  return result.stdout;
}

async function request(actor, url, body, statuses = [200]) {
  const response = await actor.context.request.fetch(`${origin}${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, 'Idempotency-Key': randomUUID() },
    ...(body === undefined ? {} : { data: body }), timeout: 60000, maxRedirects: 0,
  });
  const json = await response.json();
  if (!statuses.includes(response.status())) throw new Error(`${url.split('?')[0]} HTTP ${response.status()} ${json.error?.code ?? 'unknown'}`);
  if (response.headers()['cache-control'] !== 'private, no-store') throw new Error('Missing private no-store');
  return json.data;
}
async function confirmationLink(email) {
  for (let i = 0; i < 25; i++) {
    const list = await fetch(`${mail}/api/v1/messages`).then(r => r.json());
    const message = list.messages?.find(m => m.To?.some(to => to.Address === email));
    if (message) {
      const detail = await fetch(`${mail}/api/v1/message/${message.ID}`).then(r => r.json());
      const link = detail.HTML?.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
      if (!link || new URL(link).origin !== origin || new URL(link).pathname !== '/auth/confirm' || !new URL(link).hash.startsWith('#token_hash=')) throw new Error('Unexpected confirmation link');
      return link;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Local confirmation mail not delivered');
}
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.replace(/=+$/, '').toUpperCase()].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  return ((digest.readUInt32BE(digest.at(-1) & 15) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

try {
  if (process.argv.includes('--manage-app')) {
    if (await fetch(`${origin}/sign-in`).then(() => true).catch(() => false)) throw new Error('Port 3100 must be free before --manage-app; existing processes are never killed');
    await startApp();
  }
  browser = await chromium.launch();
  for (const role of ['worker', 'employer', 'approver', 'operator']) {
    stage = `${role} registration and confirmation`;
    const actor = { role, email: `oryqen-${role}-${randomUUID()}@example.test`, password: randomBytes(24).toString('base64url'), context: await browser.newContext({ viewport: { width: 390, height: 844 } }) };
    actors.push(actor);
    const page = await actor.context.newPage();
    await page.goto(`${origin}/register`);
    await page.getByLabel('Email address').fill(actor.email);
    await page.getByLabel('Password', { exact: true }).fill(actor.password);
    const registration = page.waitForResponse(r => r.url().endsWith('/api/v1/auth/register'));
    await page.getByRole('button', { name: 'Register with email' }).click();
    if ((await registration).status() !== 200) throw new Error('Registration failed');
    await request(actor, '/api/v1/me', undefined, [401]);
    record(`${role}: browser registration does not grant an unconfirmed session`);
    await page.goto(await confirmationLink(actor.email));
    await page.getByRole('button', { name: 'Confirm my email' }).click();
    await page.waitForURL('**/register/profile');
    await page.getByLabel('Display name').fill(`Synthetic local ${role}`);
    await page.getByRole('button', { name: 'Create my profile' }).click();
    await page.waitForURL('**/app/intro-welcome');
    actor.id = (await request(actor, '/api/v1/me')).id;
    record(`${role}: delivered local email confirmation and authorized profile creation`);
    await request(actor, '/api/v1/auth/sign-out', {});
    await request(actor, '/api/v1/me', undefined, [401]);
    await page.goto(`${origin}/sign-in`);
    await page.getByLabel('Email address').fill(actor.email);
    await page.getByLabel('Password', { exact: true }).fill(actor.password);
    await page.getByRole('button', { name: 'Continue securely' }).click();
    await page.waitForURL('**/app/intro-welcome');
    await page.goto(`${origin}/app/home`); await page.reload();
    must((await request(actor, '/api/v1/me')).id === actor.id, `${role}: sign-out denial, real sign-in and browser reload preserve identity`);
    await page.screenshot({ path: `${evidence}/${role}-home.png`, fullPage: true });
    stage = `${role} MFA`;
    const factor = await request(actor, '/api/v1/auth/mfa', { action: 'enroll' });
    actor.factorId = factor.factorId;
    actor.factorSecret = factor.secret; // In-memory synthetic test secret; never included in evidence.
    await request(actor, '/api/v1/auth/mfa', { action: 'verify', factorId: factor.factorId, code: totp(factor.secret) });
    must((await request(actor, '/api/v1/auth/mfa')).factors.some(f => f.id === factor.factorId && f.status === 'verified'), `${role}: actual TOTP enrollment and verification`);
  }
  stage = 'independent identity';
  must(actors[0].id !== actors[1].id, 'Worker and employer are distinct authenticated subjects');
  const [worker, employer, approver, operator] = actors;
  stage = 'real admin denial boundary';
  for (const actor of [worker, employer]) {
    await request(actor, '/api/v1/admin?from=2026-10-01&to=2026-10-31', undefined, [403]);
    await request(actor, '/api/v1/admin', {operation:'role',targetId:actor.id,expectedRevision:0,reason:'Synthetic self-promotion denial probe',role:'owner',expiresAt:new Date(Date.now()+3600000).toISOString()}, [403]);
    record(`${actor.role}: real MFA session denied administrative reads and self-promotion`);
  }
  stage = 'local independent authority bootstrap';
  await request(employer, '/api/v1/operator/companies', { name: 'Unauthorized local company' }, [403]);
  record('Unassigned employer denied company provisioning even with MFA');
  // Reuse the reviewed offline procedure with real, independently registered,
  // MFA-verified local actors. This grants no blanket administrator privileges.
  let bootstrap = readFileSync('scripts/day2-bootstrap-capability.sql', 'utf8');
  const values = { operator_id: approver.id, target_subject: operator.id, operator_factor: approver.factorId, subject_factor: operator.factorId, assignment_id: randomUUID() };
  for (const [name, value] of Object.entries(values)) {
    if (!/^[0-9a-f-]{36}$/.test(value)) throw new Error('Invalid local bootstrap identity');
    bootstrap = bootstrap.replace(`${name} uuid := null;`, `${name} uuid := '${value}';`);
  }
  bootstrap = bootstrap.replace('approval_record text := null;', "approval_record text := 'Owner-authorized local MVP acceptance: synthetic independent operator, no hosted or real employer assurance';");
  bootstrap = bootstrap.replace('approved_until timestamptz := null;', "approved_until timestamptz := transaction_timestamp() + interval '1 day';");
  localSql(bootstrap);
  record('Audited one-day local authority capability with distinct real MFA accounts');
  stage = 'organization request and independent approval';
  const organization = { companyId: null, companyName: `Synthetic local organization ${Date.now()}`, statement: 'Synthetic independent local membership test, not a real company claim' };
  await request(employer, '/api/v1/organizations', { ...organization, subjectId: worker.id }, [422]);
  await request(employer, '/api/v1/operator/organization-requests', undefined, [403]);
  const employerPageForRequest = employer.context.pages()[0];
  await employerPageForRequest.goto(`${origin}/app/employer`);
  await employerPageForRequest.getByLabel('Organization name', { exact: true }).fill(organization.companyName);
  await employerPageForRequest.getByLabel('Membership request statement').fill(organization.statement);
  await employerPageForRequest.getByRole('button', { name: 'Request independent approval' }).click();
  await expect(employerPageForRequest.getByRole('status').filter({ hasText: 'Request saved.' })).toBeVisible();
  const submitted = (await request(employer, '/api/v1/organizations')).items[0];
  must(submitted.decision === null && !submitted.active, 'Real browser organization request persists without granting authority');
  must((await request(worker, '/api/v1/organizations')).items.length === 0, 'Organization requests are isolated between accounts');
  const decision = { requestId: submitted.requestId, decision: 'approve', reason: 'Independent synthetic local membership review', expectedRevision: 0, expiresAt: new Date(Date.now() + 86400000).toISOString(), reviewedEvidenceRefs: ['demo:local-independent-account'] };
  await request(employer, '/api/v1/operator/organization-requests', decision, [403]);
  const ownRequest = await request(operator, '/api/v1/organizations', organization);
  await request(operator, '/api/v1/operator/organization-requests', { ...decision, requestId: ownRequest.requestId }, [403]);
  record('Forged applicant, unauthorized reviewer and self-approval denied');
  const queue = await request(operator, '/api/v1/operator/organization-requests');
  must(queue.items.some(r => r.requestId === submitted.requestId && r.subjectId === employer.id), 'Authorized independent operator sees the immutable applicant');
  const approvals = await Promise.all([request(operator, '/api/v1/operator/organization-requests', decision), request(operator, '/api/v1/operator/organization-requests', decision)]);
  must(approvals[0].companyId === approvals[1].companyId, 'Concurrent duplicate approval creates one company and one membership decision');
  await request(operator, '/api/v1/operator/organization-requests', { ...decision, decision: 'reject', expiresAt: null, reviewedEvidenceRefs: [] }, [409]);
  record('Conflicting second organization decision denied');
  const approved = (await request(employer, '/api/v1/organizations')).items[0];
  must(approved.active && approved.decision === 'approve', 'Applicant sees persisted independent approval and current authority');
  const company = { id: approvals[0].companyId };
  stage = 'real organization appeal and isolation';
  const rejected = await request(worker, '/api/v1/organizations', {companyId:null,companyName:`Synthetic appeal ${Date.now()}`,statement:'Synthetic independent appeal test'});
  const rejectBody={requestId:rejected.requestId,decision:'reject',reason:'Insufficient synthetic evidence',expectedRevision:0,expiresAt:null,reviewedEvidenceRefs:[]};
  await request(operator,'/api/v1/operator/organization-requests',rejectBody);
  const appealBody={requestId:rejected.requestId,grounds:'Corrected synthetic evidence; retain original rejection'};
  await request(employer,'/api/v1/organizations/appeals',appealBody,[404]);
  await request(worker,'/api/v1/organizations/appeals',{...appealBody,actorId:employer.id},[422]);
  const linked=await request(worker,'/api/v1/organizations/appeals',appealBody);
  await request(operator,'/api/v1/operator/organization-requests',{...rejectBody,requestId:linked.requestId},[403]);
  const appealList=(await request(worker,'/api/v1/organizations')).items;
  must(appealList.some(r=>r.requestId===rejected.requestId&&r.decision==='reject'&&r.appealRequestId===linked.requestId)&&appealList.some(r=>r.requestId===linked.requestId&&r.parentRequestId===rejected.requestId),'Real organization appeal preserves rejection and links a new review request');
  record('Real appeal rejects foreign applicant, forged identity and previous reviewer');
  const selfRestricted=localSql(`begin transaction read only;select case when count(*)=0 then 'PASS' else 'FAIL' end from private.admin_roles;select case when count(distinct subject_id)=4 then 'PASS' else 'FAIL' end from private.runtime_events where kind='login_success' and subject_id in (${actors.map(a=>`'${a.id}'`).join(',')});select case when count(distinct subject_id)=4 then 'PASS' else 'FAIL' end from private.runtime_events where kind='mfa_success' and subject_id in (${actors.map(a=>`'${a.id}'`).join(',')});rollback;`);
  must(selfRestricted.split('\n').filter(s=>s==='PASS').length===3&&!selfRestricted.includes('FAIL'),'Real login/MFA telemetry persists for all four local actors with zero admin-role grants');
  stage = 'versioned company claims';
  const companyBody = { companyId: company.id, expectedVersion: 0, claims: { description: 'Synthetic company profile supplied by the local representative', website: 'https://example.test', location: 'Synthetic location', industry: 'Synthetic maintenance' } };
  await request(worker, '/api/v1/companies', companyBody, [403, 404]);
  await request(employer, '/api/v1/companies', { ...companyBody, verified: true }, [422]);
  const companyProfile = await request(employer, '/api/v1/companies', companyBody);
  must(companyProfile.verification === 'unverified' && companyProfile.history[0].version === 1, 'Company claims persist with explicit unverified attribution');
  await request(employer, '/api/v1/companies', companyBody, [409]);
  await request(employer, '/api/v1/companies', { ...companyBody, expectedVersion: 1, claims: { ...companyBody.claims, description: 'Corrected synthetic company description' } });
  must((await request(employer, `/api/v1/companies?companyId=${company.id}`)).history.length === 2, 'Company corrections retain immutable prior claims');
  must((await request(approver, '/api/v1/companies')).items.length === 0, 'Company discovery does not disclose unrelated organizations');
  await request(approver, `/api/v1/companies?companyId=${company.id}`, undefined, [404]);
  record('Unauthorized company read/write, forged verification and stale revision denied');
  // A new worker cannot discover an unrelated organization. The independently
  // authorized employer first creates their participant offer through the API.
  // This legitimate relationship makes the company selectable for a private review.
  stage = 'agreement work record passport';
  const ids = await twoAccountFlow({ worker, employer, companyId: company.id, request, record });
  stage = 'worker private offer';
  const workerPage = worker.context.pages()[0];
  await workerPage.goto(`${origin}/app/add-offer`);
  await workerPage.getByLabel('Paste offer text').fill('Role: Synthetic local maintenance\nSalary: LKR 1000 monthly\nResponsibilities: Synthetic local maintenance task');
  await workerPage.getByRole('button', { name: 'Suggest terms with local rules' }).click();
  await expect(workerPage.getByLabel('Role title')).toHaveValue('Synthetic local maintenance');
  await expect(workerPage.getByLabel('Pay amount')).toHaveValue('1000');
  await expect(workerPage.getByRole('textbox', { name: 'Responsibilities', exact: true })).toHaveValue('Synthetic local maintenance task');
  await workerPage.getByLabel('Company organization', { exact: true }).selectOption(company.id);
  await expect(workerPage.getByLabel('Worker account ID')).toHaveValue(worker.id);
  await expect(workerPage.getByLabel('Worker account ID')).toHaveAttribute('readonly', '');
  const savedOffer = workerPage.waitForResponse(r => r.url().endsWith('/api/v1/offers') && r.request().method() === 'POST');
  await workerPage.getByRole('button', { name: 'Analyze offer' }).click();
  const saved = await savedOffer;
  if (saved.status() !== 200) throw new Error('Browser worker offer save failed');
  const privateOfferId = (await saved.json()).data.offerId;
  await workerPage.waitForURL('**/app/analyzing');
  await expect(workerPage.getByText('Checking the terms you entered.', { exact: false })).toBeVisible();
  await workerPage.screenshot({ path: `${evidence}/worker-rule-based-analysis.png`, fullPage: true });
  const privateOffer = await request(worker, `/api/v1/agreements?offerId=${privateOfferId}`);
  must(privateOffer.offer.unresolved.length > 0, 'Worker offer persisted with meaningful missing-term questions');
  const assessment = await request(worker, `/api/v1/offers/assessment?offerId=${privateOfferId}`);
  must(assessment.offerVersion === privateOffer.offer.version && assessment.termHash === privateOffer.offer.termHash && assessment.assessment.version === 'offer-indicators.v1', 'Assessment is derived from authorized persisted offer revision and hash');
  must(assessment.assessment.score === 25 && assessment.assessment.employerVerification === 'not_assessed', 'Persisted extracted role/pay/currency/pay-period/responsibilities support exactly 25 points without employer verification');
  await request(employer, `/api/v1/offers/assessment?offerId=${privateOfferId}`, undefined, [403, 404]);
  await request(approver, `/api/v1/offers/assessment?offerId=${privateOfferId}`, undefined, [403, 404]);
  record('Real assessment API denies unrelated employer and reviewer accounts');
  must(!(await request(worker, `/api/v1/companies?companyId=${company.id}`)).canEdit, 'Worker may read linked company claims without gaining edit authority');
  await request(employer, `/api/v1/agreements?offerId=${privateOfferId}`, undefined, [403, 404]);
  record('Employer denied another account’s private worker draft');
  stage = 'saved offer discovery';
  const notices = await request(worker, '/api/v1/notifications');
  must(['agreement_decision','work_decision'].every(kind => notices.items.some(n => n.kind === kind)), 'Participant activity includes real agreement confirmations and work verification');
  must(notices.items.every(n => Object.keys(n).every(key => ['eventKey','kind','title','href','recordedAt','read'].includes(key))), 'Activity projection excludes evidence, rationale and private source terms');
  must(notices.items.some(n => n.eventKey === `offer:${ids.offerId}:1`), 'Worker receives persisted offer activity');
  must((await request(approver, '/api/v1/notifications')).items.length === 0, 'Unrelated account receives no private activity');
  await request(approver, '/api/v1/notifications', { eventKey: notices.items[0].eventKey }, [404]);
  await request(worker, '/api/v1/notifications', { eventKey: notices.items[0].eventKey, subjectId: employer.id }, [422]);
  await request(worker, '/api/v1/notifications', { eventKey: notices.items[0].eventKey });
  await request(worker, '/api/v1/notifications', { eventKey: notices.items[0].eventKey });
  must((await request(worker, '/api/v1/notifications')).items.find(n => n.eventKey === notices.items[0].eventKey)?.read, 'Owner-only read receipt survives repeated commands and reload');
  await workerPage.goto(`${origin}/app/notifications`);
  await expect(workerPage.getByRole('region', { name: 'Account notifications' }).getByText('Offer revision 1 saved').first()).toBeVisible();
  await workerPage.screenshot({ path: `${evidence}/real-notifications.png`, fullPage: true });
  record('Real notification screen displays persisted authorized activity');
  const mine = await request(worker, '/api/v1/offers');
  must(mine.items.some(o => o.offerId === privateOfferId) && mine.items.some(o => o.offerId === ids.offerId), 'Worker discovers private and participant offers from PostgreSQL');
  const represented = await request(employer, '/api/v1/offers?context=EMPLOYER');
  must(represented.items.some(o => o.offerId === ids.offerId) && !represented.items.some(o => o.offerId === privateOfferId), 'Employer listing includes only designated participant offers');
  must((await request(approver, '/api/v1/offers')).items.length === 0, 'Unrelated account cannot discover offers');
  await request(worker, `/api/v1/offers?workerId=${employer.id}`, undefined, [422]);
  await request(worker, '/api/v1/offers?context=WORKER&context=EMPLOYER', undefined, [422]);
  record('Offer list rejects forged identity and ambiguous duplicate filters');
  await workerPage.goto(`${origin}/app/home`);
  await expect(workerPage.getByRole('region', { name: 'Saved offers' }).getByRole('link', { name: 'Open offer' })).toHaveCount(2);
  await workerPage.screenshot({ path: `${evidence}/saved-offers.png`, fullPage: true });
  const employerPage = employer.context.pages()[0];
  await employerPage.goto(`${origin}/app/employer`);
  await expect(employerPage.getByRole('region', { name: 'Saved offers' }).getByRole('link', { name: 'Open offer' })).toHaveCount(1);
  await employerPage.screenshot({ path: `${evidence}/employer-workspace.png`, fullPage: true });
  record('Real worker and employer dashboards render their persisted scoped offer lists');
  for (const [screen, query] of [['questions', `offerId=${privateOfferId}`], ['agreement-workflow', `workflowId=${ids.agreementId}`], ['work-record', `workId=${ids.workId}`], ['passport', '']]) {
    await workerPage.goto(`${origin}/app/${screen}${query ? `?${query}` : ''}`);
    if (screen === 'passport') await expect(workerPage.getByRole('link', { name: /Synthetic integration worker/ })).toBeVisible({ timeout: 30000 });
    else if (screen === 'work-record') await expect(workerPage.getByRole('status').filter({ hasText: 'Record version' })).toContainText('Verified', { timeout: 30000 });
    else if (screen === 'questions') await expect(workerPage.locator('.fw-question-card')).toHaveCount(2, { timeout: 30000 });
    else await expect(workerPage.getByRole('status').filter({ hasText: 'Version 1' })).toContainText('Both participants confirmed', { timeout: 30000 });
    await workerPage.screenshot({ path: `${evidence}/${screen}.png`, fullPage: true });
    must(await workerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${screen}: real-data mobile screen has no horizontal overflow`);
  }
  record('Real verified Work Record and private Passport are visible in the browser');
  await localOfferHistoryJourney({ worker, employer, outsider: approver, offer: privateOffer.offer, request, record, origin, evidence });
  const ai = await request(worker, '/api/v1/offers/analyze', { text: 'Synthetic maintenance offer: LKR 1000 monthly, eight hours each week.', role: 'WORKER' });
  must(ai.status === 'UNCONFIGURED' && ai.configured === false && ai.data === null, 'Disabled or unapproved AI returns explicit UNCONFIGURED, not fabricated analysis');
  const anonymous = { context: await browser.newContext() };
  await request(anonymous, '/api/v1/offers/analyze', { text: 'Synthetic offer authorization denial test' }, [401]);
  await anonymous.context.close();
  record('Unauthenticated AI analysis request denied by the real server');
  await request(approver, `/api/v1/work-records?workId=${ids.workId}`, undefined, [403, 404]);
  record('Unrelated authenticated account denied Work Record');
  for (const file of ['stage-6.sql', 'constraints-stage-6.sql']) {
    const output = localSql(file === 'stage-6.sql' ? stageSQL(6, { history: false }) : readFileSync(`test-results/activation-plan/${file}`, 'utf8'));
    if (output.includes('|FAIL') || !output.includes('|PASS')) throw new Error(`Catalog assertions failed: ${file}`);
    writeFileSync(`${evidence}/${file}.txt`, output);
    record(`Real PostgreSQL authorization/catalog assertions: ${file}`);
  }
  const expectedVersions = readdirSync('supabase/migrations').map(name => name.match(/^([0-9]{12})_/)[1]).sort();
  const triggerChecks = localSql(`begin transaction read only;
    select case when array_agg(version order by version)=array[${expectedVersions.map(v => `'${v}'`).join(',')}] then 'PASS' else 'FAIL' end from supabase_migrations.schema_migrations;
    select case when count(*)=2 and bool_and(p.prosecdef and pg_get_userbyid(p.proowner)='fw_user_exec' and p.proconfig @> array['search_path=""'] and not has_function_privilege('authenticated',p.oid,'EXECUTE')) then 'PASS' else 'FAIL' end from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('agreement_check_pointers','work_check_pointer'); rollback;`);
  if (triggerChecks.includes('FAIL')) throw new Error('Local migration/trigger repair assertions failed');
  writeFileSync(`${evidence}/deferred-trigger-repair.txt`, triggerChecks);
  record(`${expectedVersions.length} local migrations and restricted deferred integrity trigger contexts verified`);
  stage = 'named-recipient sharing';
  const share = await localSharingJourney({worker,employer,outsider:approver,workId:ids.workId,request,record,origin,evidence,localSql});
  stage = 'privacy request tracking';
  const privacyRequestId = await localPrivacyJourney({worker, employer, approver, operator, localSql, record, evidence, origin});
  if (app) {
    stage = 'application restart persistence';
    stopApp(); await startApp();
    for (const actor of [worker, employer]) must((await request(actor, '/api/v1/me')).id === actor.id, `${actor.role}: authenticated session survives actual app restart`);
    const passport = await request(worker, '/api/v1/passport');
    must((await share.read()).entries.length===1, 'Named-recipient grant survives actual app restart');
    must((await request(worker, `/api/v1/privacy-requests?requestId=${privacyRequestId}`)).revision === 2, 'Privacy request and immutable history survive actual app restart');
    must(passport.entries.some(e => e.workId === ids.workId), 'Verified Passport record survives actual app restart');
    const reopened = await browser.newContext({ storageState: await worker.context.storageState() });
    must((await request({ context: reopened }, '/api/v1/passport')).entries.some(e => e.workId === ids.workId), 'New browser context reopens persisted private Passport');
    await reopened.close();
  }
  stage = 'real case review and suppression';
  await localCaseJourney({ worker, employer, reviewer: approver, operator, workId: ids.workId, request, record, localSql, evidence, origin, sharedRead:share.read });
  stage = 'integrity activity';
  const beforeWithdrawal = await request(worker, `/api/v1/work-records?workId=${ids.workId}`);
  const currentWork = beforeWithdrawal.versions.find(v => v.version === beforeWithdrawal.currentVersion);
  await request(worker, '/api/v1/work-records/integrity', {operation:'withdraw',workId:ids.workId,idempotencyKey:randomUUID(),expectedVersion:currentWork.version,expectedHash:currentWork.contentHash,expectedEvidenceHash:currentWork.evidenceHash,expectedState:currentWork.state,reason:'Synthetic withdrawal activity check; preserve audit history'});
  for(const actor of [worker,employer])must((await request(actor,'/api/v1/notifications')).items.some(n=>n.kind==='work_integrity'&&n.title==='Work record withdrawn'), `${actor.role}: real withdrawal event appears without private rationale`);
  must(!(await request(worker,'/api/v1/passport')).entries.some(e=>e.workId===ids.workId), 'Withdrawal notification does not bypass current Passport suppression');
  const feedBoundary=localSql("begin transaction read only;select case when not (select prosecdef from pg_proc where oid='private.notification_events()'::regprocedure) and (select pg_get_userbyid(proowner) from pg_proc where oid='private.notification_events()'::regprocedure)='fw_user_exec' and not has_function_privilege('authenticated','private.notification_events()','EXECUTE') then 'PASS' else 'FAIL' end;rollback;");
  must(feedBoundary.includes('PASS')&&!feedBoundary.includes('FAIL'),'Activity source remains an invoker function with no direct client execution');
  await request(operator, '/api/v1/operator/membership-decisions', { companyId: company.id, subjectId: employer.id, decision: 'revoke', expectedRevision: 1, expiresAt: null, reviewedEvidenceRefs: ['demo:local/revocation'], reason: 'Synthetic local revocation test', policyVersion: 'demo-authority.v1' });
  must((await request(employer, '/api/v1/offers?context=EMPLOYER')).items.length === 0, 'Revoked employer loses offer discovery immediately');
  await request(employer, `/api/v1/offers/history?offerId=${ids.offerId}`, undefined, [404]);
  record('Revoked representative loses historical offer access immediately');
  await request(employer, `/api/v1/offers/assessment?offerId=${ids.offerId}`, undefined, [403, 404]);
  record('Revoked representative loses assessment access immediately');
  must(!(await request(employer, '/api/v1/organizations')).items[0].active, 'Historical organization approval does not override revoked membership');
  await request(employer, '/api/v1/companies', { ...companyBody, expectedVersion: 2 }, [403, 404]);
  record('Revoked representative cannot edit company claims');
  must(!(await request(employer, '/api/v1/notifications')).items.some(n => ['offer_revision','agreement_decision','work_decision','work_integrity'].includes(n.kind)), 'Revoked employer cannot retain employment access through notifications');
  stage = 'self-service account deactivation';
  await localDeactivationJourney({worker,employer,request,record,origin,evidence,localSql,grantId:share.grantId,totp});
} catch (error) {
  const reason = redactStartupOutput(error.message);
  results.push({ check: stage, status: 'FAIL', reason });
  console.error(`FAIL: ${stage}: ${reason}`); process.exitCode = 1;
} finally {
  for (const actor of actors) await actor.context.close();
  await browser?.close();
  stopApp();
  writeFileSync(`${evidence}/results.json`, JSON.stringify({ at: new Date().toISOString(), backend: 'local Supabase Auth/PostgreSQL; no mocks', results, accountsRetained: actors.map(a => ({ role: a.role, id: a.id })), limits: 'Synthetic account holders; no proof of distinct human identities. Hosted and Android not tested.' }, null, 2));
  console.log(`Evidence: ${evidence}/results.json`);
}
