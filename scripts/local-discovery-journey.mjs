// Actual local application APIs and PostgreSQL. Fictional listings, no route mocks.
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
// The local stack and the browser share one machine, so first loads (the local app runs in development mode and compiles each route on demand) can take much longer than the default 5 s.
const expect = baseExpect.configure({ timeout: 60000 });

export async function localDiscoveryJourney({ worker, employer, outsider, companyId, offerId, request, record, origin, evidence }) {
  const id = randomUUID();
  const fields = { title: `Synthetic role ${id.slice(0, 8)}`, description: 'Fictional local acceptance listing; not a real vacancy.', location: 'Colombo', workMode: 'onsite', salary: 80000, currency: 'LKR', payPeriod: 'month' };
  const listing = version => ({ operation: 'listing', id, companyId, fields, status: 'published', expectedVersion: version, expiresAt: new Date(Date.now() + 86400000).toISOString(), idempotencyKey: randomUUID() });
  await request(worker, '/api/v1/opportunities', listing(0), [403]);
  const draft = { ...listing(0), status: 'draft' };
  await request(employer, '/api/v1/opportunities', draft);
  await request(employer, '/api/v1/opportunities', draft);
  const discover = () => request(worker, `/api/v1/opportunities?query=${encodeURIComponent(fields.title)}`);
  if ((await discover()).items.some(item => item.id === id)) throw new Error('Draft listing leaked');
  await request(employer, '/api/v1/opportunities', listing(1));
  if (!(await discover()).items.some(item => item.id === id && item.version === 2 && item.assurance === 'demo_provisioned')) throw new Error('Published listing missing or misattributed');
  await request(employer, '/api/v1/opportunities', listing(1), [409]);
  record('Real opportunity draft privacy, authorized publication, retry and stale revision denial');
  const preferences = { role: fields.title, location: 'Colombo', workMode: 'onsite', minimumPay: 70000, currency: 'LKR', payPeriod: 'month' };
  await request(worker, '/api/v1/opportunities', { operation: 'preferences', preferences, expectedVersion: 0, idempotencyKey: randomUUID() });
  await request(worker, '/api/v1/opportunities', { operation: 'choice', id, choice: 'saved', idempotencyKey: randomUUID() });
  const saved = await request(worker, '/api/v1/opportunities?view=saved');
  if (!saved.items.some(item => item.id === id && item.choice === 'saved') || saved.preferences?.role !== fields.title) throw new Error('Preference/choice persistence failed');
  if ((await request(employer, '/api/v1/opportunities')).preferences !== null) throw new Error('Private preferences leaked');
  const page = worker.context.pages()[0];
  await page.goto(`${origin}/app/opportunities`);
  await page.reload();
  await expect(page.getByText(fields.title, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${evidence}/real-opportunities.png`, fullPage: true });
  record('Real opportunity preferences and saved choices persist privately; browser reload renders published listing');

  const threadId = randomUUID();
  const question = 'Which missing terms should I ask about in this fictional offer?';
  const send = { operation: 'send', threadId, question, topic: 'offer', offerId, idempotencyKey: randomUUID() };
  await request(worker, '/api/v1/guidance', send);
  await request(worker, '/api/v1/guidance', send);
  const read = await request(worker, `/api/v1/guidance?threadId=${threadId}`);
  if (read.turns.length !== 1 || read.turns[0].question !== question || read.turns[0].response.mode !== 'rules' || read.providerAvailable !== false) throw new Error('Guidance persistence or truthful source failed');
  const other = await request(outsider, `/api/v1/guidance?threadId=${threadId}`);
  if (other.turns.length || other.threads.some(thread => thread.id === threadId)) throw new Error('Private guidance leaked');
  await request(outsider, '/api/v1/guidance', { ...send, threadId: randomUUID(), idempotencyKey: randomUUID() }, [403, 404]);
  await page.goto(`${origin}/app/guidance?threadId=${threadId}`);
  await page.reload();
  await expect(page.getByText(question, { exact: true })).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${evidence}/real-guidance.png`, fullPage: true });
  record('Real private rules guidance persists once on retry; foreign history and unauthorized offer context denied; not AI');
  await request(employer, '/api/v1/opportunities', { ...listing(2), status: 'closed' });
  if ((await discover()).items.some(item => item.id === id)) throw new Error('Closed listing remains discoverable');
  record('Real closed opportunity disappears from discovery');
}
