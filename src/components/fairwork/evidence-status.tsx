"use client";
import { useRef, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { evidenceLimits, type EvidenceStatus } from "@/features/vault/evidence";
import { useI18n } from "@/i18n/use-i18n";

const day = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// Revocation and correction notes for one document. These are the person's own statements about their own document, not verification by anyone else.
export function DocumentStatus({ documentId, title, status, onChanged }: { documentId: string; title: string; status: EvidenceStatus | undefined; onChanged: () => Promise<void> }) {
  const { t } = useI18n();
  const [reason, setReason] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const attempt = useRef<{ fingerprint: string; ids: { correctionId: string; idempotencyKey: string } } | null>(null);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setFailed(false);
    try { await action(); await onChanged(); } catch { setFailed(true); } finally { setBusy(false); }
  }
  const open = status?.corrections.filter(item => !item.resolvedAt) ?? [], resolved = status?.corrections.filter(item => item.resolvedAt) ?? [];
  return <div className="fw-evidence-status" role="group" aria-label={t("ev.group", { title })}>
    {status?.revoked && <p role="status"><strong>{t("ev.revoked")}</strong> {status.reason}{status.revokedAt ? ` · ${day(status.revokedAt)}` : ""} {t("ev.revokedNote")}</p>}
    {failed && <p role="alert">{t("ev.error")}</p>}
    {status?.revoked
      ? <button type="button" className="fw-secondary" disabled={busy} onClick={() => void run(() => appRequest("/api/v1/vault/reinstate", { documentId }))}>{t("ev.reinstate")}</button>
      : <details><summary>{t("ev.revokeSummary")}</summary>
          <label className="fw-field">{t("ev.reason")}<input value={reason} maxLength={evidenceLimits.reasonMax} onChange={event => setReason(event.target.value)} /></label>
          <button type="button" className="fw-secondary" disabled={busy || !reason.trim()} onClick={() => void run(async () => { await appRequest("/api/v1/vault/revoke", { documentId, reason: reason.trim() }); setReason(""); })}>{t("ev.revoke")}</button>
        </details>}
    <details><summary>{t("ev.notesSummary", { count: open.length })}</summary>
      {open.length === 0 && resolved.length === 0 && <p>{t("ev.noNotes")}</p>}
      {open.map(item => <p key={item.correctionId}>{item.note} · {day(item.createdAt)} <button type="button" className="fw-secondary" disabled={busy} onClick={() => void run(() => appRequest("/api/v1/vault/corrections/resolve", { correctionId: item.correctionId }))}>{t("ev.resolve")}</button></p>)}
      {resolved.map(item => <p key={item.correctionId}><s>{item.note}</s> · {t("ev.resolvedOn", { date: day(item.resolvedAt!) })}</p>)}
      <label className="fw-field">{t("ev.noteLabel")}<textarea value={note} maxLength={evidenceLimits.noteMax} onChange={event => setNote(event.target.value)} /></label>
      <button type="button" className="fw-secondary" disabled={busy || !note.trim()} onClick={() => void run(async () => {
        const fingerprint = `${documentId}|${note.trim()}`;
        if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, ids: { correctionId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() } };
        await appRequest("/api/v1/vault/corrections", { ...attempt.current.ids, documentId, note: note.trim() }); attempt.current = null; setNote("");
      })}>{t("ev.addNote")}</button>
    </details>
  </div>;
}
