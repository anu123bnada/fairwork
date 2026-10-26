import { randomUUID } from 'node:crypto';

// Real local stack: a person files a private report, a reviewer (review_operator with a second factor) triages it without learning who filed it,
// writes a note back, and the reporter sees it and withdraws. Others cannot see the report or the queue.
export async function localReportJourney({ worker, employer, reviewer, request, record }) {
  const must = (ok, label) => { if (!ok) throw new Error(label); record(label); };
  const id = randomUUID();
  const body = { reportId: id, subjectKind: 'other', subjectRef: null, subjectLabel: 'Synthetic recruiter named in a message', category: 'fee_request', details: 'Synthetic report: asked for a registration fee before any contract was shared.', idempotencyKey: id };
  const created = await request(worker, '/api/v1/reports', body);
  const replay = await request(worker, '/api/v1/reports', body);
  must(created.reportId === id && created.replayed === false && replay.replayed === true, 'A person files a private report; retrying the same request does not duplicate it');
  await request(worker, '/api/v1/reports', { ...body, details: 'A different statement of the problem entirely.' }, [409]);
  await request(worker, '/api/v1/reports', { ...body, reportId: randomUUID(), idempotencyKey: randomUUID(), subjectKind: 'recruiter_check', subjectRef: randomUUID() }, [404]);
  must((await request(employer, '/api/v1/reports')).items.length === 0, 'Another account sees none of the report');

  await request(employer, '/api/v1/operator/reports', undefined, [403]);
  const queue = await request(reviewer, '/api/v1/operator/reports');
  const item = queue.items.find(row => row.reportId === id);
  must(Boolean(item) && item.status === 'received' && item.own === false && !JSON.stringify(queue).includes(worker.id), 'The reviewer queue shows the report without the reporter\'s identity');
  await request(reviewer, '/api/v1/operator/reports', { reportId: id, expectedRevision: 0, event: 'closed_actioned' }, [422]);
  await request(reviewer, '/api/v1/operator/reports', { reportId: id, expectedRevision: 0, event: 'reviewing' });
  await request(reviewer, '/api/v1/operator/reports', { reportId: id, expectedRevision: 0, event: 'needs_information', note: 'stale revision' }, [409]);
  await request(reviewer, '/api/v1/operator/reports', { reportId: id, expectedRevision: 1, event: 'needs_information', note: 'Which message did this come from?' });
  const mine = (await request(worker, '/api/v1/reports')).items.find(row => row.reportId === id);
  must(mine.status === 'needs_information' && mine.events.map(event => event.event).join() === 'received,reviewing,needs_information' && mine.events[2].note === 'Which message did this come from?', 'The reporter sees the status history and the reviewer\'s note');

  await request(employer, '/api/v1/reports/withdraw', { reportId: id }, [404]);
  await request(worker, '/api/v1/reports/withdraw', { reportId: id });
  await request(worker, '/api/v1/reports/withdraw', { reportId: id }, [409]);
  await request(reviewer, '/api/v1/operator/reports', { reportId: id, expectedRevision: 3, event: 'reviewing' }, [409]);
  const closed = await request(reviewer, '/api/v1/operator/reports?status=closed');
  must(closed.items.some(row => row.reportId === id && row.status === 'withdrawn'), 'Only the reporter can withdraw, once; withdrawn reports leave the open queue');
  return { skipped: false };
}
