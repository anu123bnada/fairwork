"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { offerNoteList, offerNoteLimits } from "@/features/offer/notes";
import { vaultListResponse, vaultOfferAttachments } from "@/features/vault/schema";
import { useI18n } from "@/i18n/use-i18n";

type Linked = ReturnType<typeof vaultOfferAttachments.parse>["items"];
type Document = ReturnType<typeof vaultListResponse.parse>["items"];
type Notes = ReturnType<typeof offerNoteList.parse>["items"];

// Private review notes and links from the worker's Evidence Vault documents to one of their own saved offers. Nothing here is shared with anyone.
export function OfferNotes({ offerId }: { offerId: string }) {
  const { t } = useI18n();
  const [notes, setNotes] = useState<Notes | null>(null), [linked, setLinked] = useState<Linked | null>(null), [documents, setDocuments] = useState<Document>([]);
  const [text, setText] = useState(""), [choice, setChoice] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const attempt = useRef<{ body: string; noteId: string; key: string } | null>(null);
  const fetchAll = useCallback(async () => {
    const [noteData, attached, vault] = await Promise.all([appRequest(`/api/v1/offers/notes?offerId=${offerId}`), appRequest(`/api/v1/vault/offers?offerId=${offerId}`), appRequest("/api/v1/vault")]);
    return { notes: offerNoteList.parse(noteData).items, linked: vaultOfferAttachments.parse(attached).items, documents: vaultListResponse.parse(vault).items };
  }, [offerId]);
  useEffect(() => {
    let active = true;
    fetchAll().then(next => { if (active) { setNotes(next.notes); setLinked(next.linked); setDocuments(next.documents); } }).catch(() => { if (active) setError(t("on.error")); });
    return () => { active = false; };
  }, [fetchAll, t]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); const next = await fetchAll(); setNotes(next.notes); setLinked(next.linked); setDocuments(next.documents); } catch { setError(t("on.error")); } finally { setBusy(false); }
  }
  function addNote() {
    const body = text.trim();
    if (!body) return;
    if (attempt.current?.body !== body) attempt.current = { body, noteId: crypto.randomUUID(), key: crypto.randomUUID() };
    const current = attempt.current;
    void run(async () => { await appRequest("/api/v1/offers/notes", { noteId: current.noteId, offerId, body, idempotencyKey: current.key }); attempt.current = null; setText(""); });
  }
  const available = documents.filter(document => !linked?.some(item => item.documentId === document.documentId));
  return <section className="fw-list-card" aria-label={t("on.title")}>
    <h4>{t("on.title")}</h4>
    <p>{t("on.intro")}</p>
    {error && <p role="alert">{error}</p>}
    <label className="fw-field">{t("on.noteLabel")}<textarea maxLength={offerNoteLimits.maxLength} rows={3} value={text} onChange={event => setText(event.target.value)} /></label>
    <button type="button" className="fw-secondary" disabled={busy || !text.trim()} onClick={addNote}>{t("on.noteAdd")}</button>
    {notes?.length === 0 && <p>{t("on.noNotes")}</p>}
    {notes && notes.length > 0 && <ul>{notes.map(note => <li key={note.noteId}>
      <span style={{ whiteSpace: "pre-wrap" }}>{note.body}</span> <small>{note.createdAt.slice(0, 10)}</small>
      <button type="button" className="fw-secondary" disabled={busy} onClick={() => void run(() => appRequest("/api/v1/offers/notes/remove", { noteId: note.noteId }))}>{t("on.noteDelete")}</button>
    </li>)}</ul>}
    <h5>{t("on.docs")}</h5>
    {linked?.length === 0 && <p>{t("on.noDocs")}</p>}
    {linked && linked.length > 0 && <ul>{linked.map(item => <li key={item.documentId}>
      <strong>{item.title}</strong> · {item.fileName}
      <button type="button" className="fw-secondary" disabled={busy} onClick={() => void run(() => appRequest("/api/v1/vault/offers/remove", { documentId: item.documentId, offerId }))}>{t("on.detach")}</button>
    </li>)}</ul>}
    {documents.length === 0 ? <p>{t("on.noVault")}</p> : available.length > 0 && <>
      <label className="fw-field">{t("on.pick")}<select value={choice} onChange={event => setChoice(event.target.value)}>
        <option value="">—</option>{available.map(document => <option key={document.documentId} value={document.documentId}>{document.title} · {document.fileName}</option>)}
      </select></label>
      <button type="button" className="fw-secondary" disabled={busy || !choice} onClick={() => void run(async () => { await appRequest("/api/v1/vault/offers", { documentId: choice, offerId }); setChoice(""); })}>{t("on.attach")}</button>
    </>}
  </section>;
}
