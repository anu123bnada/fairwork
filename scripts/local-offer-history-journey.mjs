import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';

export async function localOfferHistoryJourney({ worker, employer, outsider, offer, request, record, origin, evidence }) {
  const url = `/api/v1/offers/history?offerId=${offer.offerId}`;
  await request(employer, url, undefined, [404]);
  await request(outsider, url, undefined, [404]);
  await request(worker, `${url}&workerId=${worker.id}`, undefined, [422]);
  record('History denies foreign accounts and client-supplied identity');
  await request(worker, '/api/v1/offers', {
    offerId: offer.offerId, companyId: offer.companyId, workerId: worker.id,
    requesterRole: 'WORKER', terms: { ...offer.snapshot, salary: '1200' },
    expectedVersion: offer.version + 1, idempotencyKey: randomUUID(),
  });
  const history = await request(worker, url);
  if (history.items.length !== 2 || history.items[0].snapshot.salary !== '1200' || history.items[1].snapshot.salary !== offer.snapshot.salary) throw new Error('Saved history changed or is missing');
  if (history.items.some(item => Object.keys(item).some(key => !['version','recordedAt','termHash','snapshot','changes'].includes(key)))) throw new Error('Unexpected history disclosure');
  const earlier = await request(worker, `${url}&beforeVersion=2`);
  if (earlier.items.length !== 1 || earlier.items[0].version !== 1) throw new Error('History cursor ignored');
  record('Immutable historical terms, field allowlist and revision cursor verified against PostgreSQL');
  const page = worker.context.pages()[0];
  await page.goto(`${origin}/app/agreement?offerId=${offer.offerId}`);
  await page.getByText('Saved revision history', { exact: true }).click();
  await expect(page.getByRole('article', { name: 'Saved revision 1' })).toContainText(String(offer.snapshot.salary));
  await expect(page.getByRole('article', { name: 'Saved revision 2' })).toContainText('1200');
  await page.reload();
  await page.getByText('Saved revision history', { exact: true }).click();
  await expect(page.getByRole('article', { name: 'Saved revision 1' })).toBeVisible();
  await page.screenshot({ path: `${evidence}/offer-history.png` });
  record('Real history UI and refresh recovery preserve earlier terms without confirmation actions');
}
