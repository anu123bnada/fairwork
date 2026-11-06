import { randomBytes, randomUUID } from 'node:crypto';

// Real local stack (Auth, mail sink, PostgreSQL, the app). Covers three Tier 2 gaps the other journeys do not:
// anonymous route and API protection, direct-URL access by an unrelated signed-in account, and password recovery through the local mail sink.
// No mocks. Uses the synthetic reviewing account as the outsider; its password is changed at the end, so run this last among the outsider's journeys.
const PRIVATE_ROUTES = ['/app/home', '/app/passport', '/app/work-record', '/app/employer', '/admin'];
const PRIVATE_APIS = ['/api/v1/me', '/api/v1/offers', '/api/v1/passport', '/api/v1/vault', '/api/v1/credentials', '/api/v1/notifications', '/api/v1/security-events', '/api/v1/opportunities/history', '/api/v1/cv'];

export async function localTier2Journey({ browser, worker, outsider, offerId, secrets, request, record, origin, evidence, mail, totp }) {
  const must = (ok, label) => { if (!ok) throw new Error(label); record(label); };
  const leaks = text => secrets.filter(secret => text.includes(secret));
  // The local app is a development server that compiles routes on first use and can drop one connection while it does. Retry connection-level errors only (never an HTTP status), at most three attempts.
  const fetchAs = async (context, url) => {
    for (let attempt = 1; ; attempt++) {
      try { return await context.request.fetch(url, { maxRedirects: 0, timeout: 60000 }); }
      catch (error) { if (attempt === 3 || !/ECONNRESET|socket hang up|ECONNREFUSED/.test(error.message)) throw error; await new Promise(resolve => setTimeout(resolve, 2000)); }
    }
  };

  // Anonymous visitors: no private data in the document or after the client renders, and every private API fails closed.
  const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await anonymous.newPage();
  for (const route of PRIVATE_ROUTES) {
    const raw = await fetchAs(anonymous, `${origin}${route}`);
    must(leaks(await raw.text()).length === 0, `Anonymous document for ${route} contains no private data (HTTP ${raw.status()})`);
    await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const rendered = await page.locator('body').innerText();
    must(leaks(rendered).length === 0, `Anonymous rendered ${route} shows no private data (ends on ${new URL(page.url()).pathname})`);
  }
  await page.screenshot({ path: `${evidence}/anonymous-admin.png` });
  for (const api of [...PRIVATE_APIS, `/api/v1/agreements?offerId=${offerId}`, `/api/v1/offers/assessment?offerId=${offerId}`]) {
    const response = await fetchAs(anonymous, `${origin}${api}`);
    must(response.status() === 401 && leaks(await response.text()).length === 0, `Anonymous ${api.split('?')[0]} returns 401 with no private data`);
  }
  await anonymous.close();

  // An unrelated signed-in account opening the worker's private offer by URL sees nothing of it.
  const outsiderPage = outsider.context.pages()[0] ?? await outsider.context.newPage();
  for (const route of [`/app/agreement?offerId=${offerId}`, `/app/analyzing?offerId=${offerId}`]) {
    await outsiderPage.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
    await outsiderPage.waitForTimeout(4000);
    must(leaks(await outsiderPage.locator('body').innerText()).length === 0, `Unrelated account opening ${route.split('?')[0]} by URL sees no private offer content`);
  }
  const denied = await fetchAs(outsider.context, `${origin}/api/v1/agreements?offerId=${offerId}`);
  must([403, 404].includes(denied.status()) && leaks(await denied.text()).length === 0, `Unrelated account API read of the private offer is denied without leaking content (HTTP ${denied.status()})`);
  void worker;

  // Own security activity: the worker's real sign-in and sign-out were recorded by the server and are readable only by that worker.
  // Telemetry is best effort (F-45), so poll briefly instead of asserting on the first read.
  let own;
  for (let attempt = 0; attempt < 10; attempt++) {
    own = await request(worker, '/api/v1/security-events');
    if (own.items.some(item => item.kind === 'login_success') && own.items.some(item => item.kind === 'logout_success')) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  must(own.items.some(item => item.kind === 'login_success') && own.items.some(item => item.kind === 'logout_success'), 'Own security activity lists the real sign-in and sign-out recorded for this account');
  must(own.items.every(item => Object.keys(item).sort().join() === 'kind,occurredAt') && own.items.length <= 30, 'Security activity exposes only kind and time, at most 30 entries');
  must(own.items.every((item, index, all) => index === 0 || Date.parse(all[index - 1].occurredAt) >= Date.parse(item.occurredAt)), 'Security activity is newest first');
  await request(worker, `/api/v1/security-events?subjectId=${outsider.id}`, undefined, [422]);
  record('Security activity refuses a client-supplied subject');

  // Recommendation history: a saved-listing snapshot is private to its owner, holds only criterion outcomes, rejects invented content and is deletable only by the owner.
  const listingId = randomUUID();
  const snapshot = { listingId, listingTitle: 'Synthetic local warehouse role', companyName: null, preferenceVersion: 1, reasons: [{ id: 'role', outcome: 'matches' }, { id: 'payUnknown', outcome: 'unknown' }] };
  const added = await request(worker, '/api/v1/opportunities/history', snapshot);
  must(added.replayed === false, 'A saved-listing snapshot is stored for the worker');
  const mine = await request(worker, '/api/v1/opportunities/history');
  const entry = mine.items.find(item => item.listingId === listingId);
  must(entry && entry.reasons.length === 2 && entry.reasons.every(reason => ['id', 'outcome'].join() === Object.keys(reason).sort().join()), 'The snapshot keeps only criterion ids and outcomes');
  must((await request(outsider, '/api/v1/opportunities/history')).items.every(item => item.listingId !== listingId), 'Another account cannot see the owner recommendation history');
  await request(worker, '/api/v1/opportunities/history', { ...snapshot, listingId: randomUUID(), reasons: [{ id: 'role', outcome: 'matches', detail: 'Your preference: nurse' }] }, [422]);
  await request(worker, '/api/v1/opportunities/history', { ...snapshot, listingId: randomUUID(), ownerId: outsider.id }, [422]);
  record('Recommendation history rejects invented reason content and a client-supplied owner');
  await request(outsider, '/api/v1/opportunities/history/remove', { entryId: entry.entryId }, [404]);
  await request(worker, '/api/v1/opportunities/history/remove', { entryId: entry.entryId });
  must((await request(worker, '/api/v1/opportunities/history')).items.every(item => item.entryId !== entry.entryId), 'Only the owner can delete a recommendation-history entry');

  // Smart CV Builder: documents are private to their owner, strictly validated, revision-checked and deletable only by the owner.
  const cvId = randomUUID();
  const cvContent = { basics: { fullName: 'Synthetic Local Person', headline: '', email: '', phone: '', location: '', links: [{ label: 'Portfolio', url: 'https://example.test/me' }] }, summary: 'Synthetic summary typed by the person.', education: [], experience: [], skills: ['Welding'], projects: [], achievements: [], certifications: [], references: [], includeVerifiedWork: false };
  const cvBody = { id: cvId, title: 'Synthetic local CV', template: 'modern', targetRole: 'Welder', content: cvContent, expectedRevision: 0 };
  must((await request(worker, '/api/v1/cv', cvBody)).revision === 1, 'A CV document is saved for the worker');
  const cvRead = await request(worker, `/api/v1/cv?id=${cvId}`);
  must(JSON.stringify(cvRead.content) === JSON.stringify(cvContent) && cvRead.template === 'modern', 'The CV reads back exactly what was saved');
  must((await request(outsider, '/api/v1/cv')).items.every(item => item.id !== cvId), 'Another account cannot see the owner CV list');
  await request(outsider, `/api/v1/cv?id=${cvId}`, undefined, [404]);
  await request(outsider, '/api/v1/cv', { ...cvBody, expectedRevision: 1 }, [404]);
  await request(worker, '/api/v1/cv', { ...cvBody, id: randomUUID(), content: { ...cvContent, basics: { ...cvContent.basics, links: [{ label: 'x', url: 'javascript:alert(1)' }] } } }, [422]);
  await request(worker, '/api/v1/cv', { ...cvBody, id: randomUUID(), content: { ...cvContent, verified: true } }, [422]);
  await request(worker, '/api/v1/cv', { ...cvBody, id: randomUUID(), ownerId: outsider.id }, [422]);
  record('The CV API refuses an unsafe link, a verification flag and a client-supplied owner');
  await request(worker, '/api/v1/cv', { ...cvBody, expectedRevision: 0 }, [404, 409]);
  must((await request(worker, '/api/v1/cv', { ...cvBody, title: 'Renamed CV', expectedRevision: 1 })).revision === 2, 'A CV is updated only with the current revision');
  await request(worker, '/api/v1/cv', { ...cvBody, expectedRevision: 1 }, [409]);
  await request(outsider, '/api/v1/cv/remove', { id: cvId }, [404]);
  await request(worker, '/api/v1/cv/remove', { id: cvId });
  await request(worker, `/api/v1/cv?id=${cvId}`, undefined, [404]);
  record('Only the owner can delete a CV');

  // Password recovery end to end through the local mail sink, then old password rejected and new password accepted.
  const visitor = { context: await browser.newContext() };
  const unknown = await request(visitor, '/api/v1/auth/recovery', { email: `nobody-${randomUUID()}@example.test` }, [200, 202]);
  const known = await request(visitor, '/api/v1/auth/recovery', { email: outsider.email }, [200, 202]);
  must(JSON.stringify(unknown) === JSON.stringify(known), 'Recovery answers identically for an unknown and a known address (no account enumeration)');
  let tokenHash;
  for (let i = 0; i < 30 && !tokenHash; i++) {
    const list = await fetch(`${mail}/api/v1/messages`).then(r => r.json());
    for (const message of (list.messages ?? []).filter(m => m.To?.some(to => to.Address === outsider.email))) {
      const detail = await fetch(`${mail}/api/v1/message/${message.ID}`).then(r => r.json());
      const match = detail.HTML?.includes('recovery') ? detail.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&') : undefined;
      if (match && new URL(match).origin === origin && new URL(match).pathname === '/auth/recover') tokenHash = new URL(match).hash.match(/token_hash=([A-Za-z0-9_-]+)/)?.[1];
      if (tokenHash) break;
    }
    if (!tokenHash) await new Promise(resolve => setTimeout(resolve, 500));
  }
  must(Boolean(tokenHash), 'A recovery email reaches the local mail sink with a same-origin /auth/recover link');
  const newPassword = randomBytes(24).toString('base64url');
  await request(visitor, '/api/v1/auth/recovery/confirm', { tokenHash });
  // The recovery link alone must not change the password of an account that has a second factor.
  await request(visitor, '/api/v1/auth/password', { password: newPassword }, [403]);
  record('A recovery link alone cannot change the password of an account with MFA enrolled (MFA_REQUIRED)');
  await request(visitor, '/api/v1/auth/mfa', { action: 'verify', factorId: outsider.factorId, code: totp(outsider.factorSecret) });
  await request(visitor, '/api/v1/auth/password', { password: newPassword });
  await request(visitor, '/api/v1/auth/sign-out', {});
  await request(visitor, '/api/v1/auth/recovery/confirm', { tokenHash }, [400, 401, 403, 404, 410, 422]);
  record('A used recovery link cannot be confirmed again');
  const fresh = { context: await browser.newContext() };
  await request(fresh, '/api/v1/auth/sign-in', { email: outsider.email, password: outsider.password }, [401, 422]);
  await request(fresh, '/api/v1/auth/sign-in', { email: outsider.email, password: newPassword });
  outsider.password = newPassword;
  record('After recovery the old password is rejected and the new password signs in');
  await visitor.context.close();
  await fresh.context.close();
}
