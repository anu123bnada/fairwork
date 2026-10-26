import { randomUUID, createHash } from 'node:crypto';

// Real local stack: real Auth sessions, real PostgreSQL and the local disk store for file bytes.
// Reports SKIPPED, never PASS, when the app was started without a vault store.
export async function localVaultJourney({ worker, employer, outsider, workId, offerId, request, record, origin }) {
  const must = (ok, label) => { if (!ok) throw new Error(label); record(label); };
  const listed = await request(worker, '/api/v1/vault');
  if (!listed.storageConfigured) { console.log('SKIPPED: vault journey (the local app has no document store configured)'); return { skipped: true }; }
  const upload = async (actor, { bytes, name = 'Pay slip March.pdf', type = 'application/pdf', title = 'Synthetic payslip', key = randomUUID() }, statuses = [200]) => {
    const response = await actor.context.request.fetch(`${origin}/api/v1/vault`, {
      method: 'POST', headers: { Origin: origin },
      multipart: { title, category: 'payslip', idempotencyKey: key, file: { name, mimeType: type, buffer: Buffer.from(bytes) } }, timeout: 60000, maxRedirects: 0,
    });
    const json = await response.json();
    if (!statuses.includes(response.status())) throw new Error(`vault upload HTTP ${response.status()} ${json.error?.code ?? 'unknown'}`);
    return { status: response.status(), data: json.data, key };
  };
  const pdf = Buffer.from('%PDF-1.7\nSynthetic payslip for the real-stack journey\n');
  const sent = await upload(worker, { bytes: pdf });
  must(sent.data.replayed === false && sent.data.sha256 === createHash('sha256').update(pdf).digest('hex') && sent.data.fileName === 'Pay slip March.pdf', 'A worker saves a document; the server computes its checksum and a safe name');
  const again = await upload(worker, { bytes: pdf, key: sent.key });
  must(again.data.replayed === true && again.data.documentId === sent.data.documentId, 'Retrying the same upload returns the same document instead of a duplicate');
  must((await request(worker, '/api/v1/vault')).items.length === 1, 'The worker sees exactly one document');
  must((await request(employer, '/api/v1/vault')).items.length === 0 && (await request(outsider, '/api/v1/vault')).items.length === 0, 'No other account, including the reviewing representative, sees the document');
  await request(outsider, `/api/v1/vault/link?id=${sent.data.documentId}`, undefined, [404]);
  await request(employer, `/api/v1/vault/link?id=${sent.data.documentId}`, undefined, [404]);
  const link = await request(worker, `/api/v1/vault/link?id=${sent.data.documentId}`);
  const download = await fetch(link.url);
  const body = Buffer.from(await download.arrayBuffer());
  must(download.status === 200 && body.equals(pdf) && /^attachment/.test(download.headers.get('content-disposition') ?? '') && download.headers.get('x-content-type-options') === 'nosniff', 'The owner downloads the exact bytes through a signed link, as an attachment');
  const tampered = new URL(link.url); tampered.searchParams.set('token', `${tampered.searchParams.get('token').slice(0, -3)}AAA`);
  must((await fetch(tampered)).status === 404 && (await fetch(`${origin}/api/v1/vault/blob?token=garbage`)).status === 404, 'A tampered or invented download link is refused');
  await upload(worker, { bytes: Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]), name: 'invoice.pdf' }, [415]);
  await upload(worker, { bytes: pdf, type: 'image/png' }, [415]);
  await upload(worker, { bytes: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(5 * 1024 * 1024)]) }, [413]);
  must((await request(worker, '/api/v1/vault')).items.length === 1, 'An executable, a mislabelled file and an oversized file are all refused and nothing is saved');
  if (workId) {
    await request(worker, '/api/v1/vault/attachments', { documentId: sent.data.documentId, workId });
    must((await request(worker, `/api/v1/vault/attachments?workId=${workId}`)).items.some(item => item.documentId === sent.data.documentId), 'The worker links a vault document to their own work record');
    must((await request(employer, `/api/v1/vault/attachments?workId=${workId}`)).items.length === 0, 'The employer representative on the record does not see the private link');
    await request(employer, '/api/v1/vault/attachments', { documentId: sent.data.documentId, workId }, [404]);
    await request(outsider, '/api/v1/vault/attachments', { documentId: sent.data.documentId, workId }, [404]);
  }
  if (offerId) {
    const note = { noteId: randomUUID(), offerId, body: 'Ask about the overtime rate', idempotencyKey: randomUUID() };
    must((await request(worker, '/api/v1/offers/notes', note)).replayed === false && (await request(worker, '/api/v1/offers/notes', note)).replayed === true, 'The worker saves a private note on their offer; a retry does not duplicate it');
    must((await request(worker, `/api/v1/offers/notes?offerId=${offerId}`)).items.some(item => item.noteId === note.noteId), 'The worker reads their note back');
    must((await request(employer, `/api/v1/offers/notes?offerId=${offerId}`)).items.length === 0 && (await request(outsider, `/api/v1/offers/notes?offerId=${offerId}`)).items.length === 0, 'The employer and an unrelated account see no notes');
    await request(employer, '/api/v1/offers/notes', { ...note, noteId: randomUUID(), idempotencyKey: randomUUID() }, [404]);
    await request(outsider, '/api/v1/offers/notes/remove', { noteId: note.noteId }, [404]);
    await request(worker, '/api/v1/vault/offers', { documentId: sent.data.documentId, offerId });
    must((await request(worker, `/api/v1/vault/offers?offerId=${offerId}`)).items.some(item => item.documentId === sent.data.documentId), 'The worker links a vault document to their own offer');
    must((await request(employer, `/api/v1/vault/offers?offerId=${offerId}`)).items.length === 0, 'The employer does not see the supporting document');
    await request(employer, '/api/v1/vault/offers', { documentId: sent.data.documentId, offerId }, [404]);
    await request(worker, '/api/v1/offers/notes/remove', { noteId: note.noteId });
    must((await request(worker, `/api/v1/offers/notes?offerId=${offerId}`)).items.length === 0, 'The worker deletes their note');
  }
  await request(outsider, '/api/v1/vault/delete', { documentId: sent.data.documentId }, [404]);
  const removed = await request(worker, '/api/v1/vault/delete', { documentId: sent.data.documentId });
  must(removed.fileRemoved === true, 'Only the owner can delete, and deletion removes the stored file');
  if (offerId) must((await request(worker, `/api/v1/vault/offers?offerId=${offerId}`)).items.length === 0, 'Deleting a document removes its link to the offer');
  if (workId) must((await request(worker, `/api/v1/vault/attachments?workId=${workId}`)).items.length === 0, 'Deleting a document removes its link to the work record');
  await request(worker, `/api/v1/vault/link?id=${sent.data.documentId}`, undefined, [404]);
  must((await fetch(link.url)).status === 404 && (await request(worker, '/api/v1/vault')).items.length === 0, 'After deletion the old signed link and the listing no longer reach the file');
  return { skipped: false };
}
