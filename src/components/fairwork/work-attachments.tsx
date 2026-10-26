"use client";
import { useCallback, useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { vaultAttachments, vaultListResponse } from "@/features/vault/schema";
import { useI18n } from "@/i18n/use-i18n";

type Linked = ReturnType<typeof vaultAttachments.parse>["items"];
type Document = ReturnType<typeof vaultListResponse.parse>["items"];

// Private links between the worker's Evidence Vault documents and one of their own work records. Nothing here is shared with anyone.
export function WorkAttachments({ workId }: { workId: string }) {
  const { t } = useI18n();
  const [linked, setLinked] = useState<Linked | null>(null), [documents, setDocuments] = useState<Document>([]), [choice, setChoice] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const fetchAll = useCallback(async () => {
    const [attached, vault] = await Promise.all([appRequest(`/api/v1/vault/attachments?workId=${workId}`), appRequest("/api/v1/vault")]);
    return { linked: vaultAttachments.parse(attached).items, documents: vaultListResponse.parse(vault).items };
  }, [workId]);
  useEffect(() => {
    let active = true;
    fetchAll().then(next => { if (active) { setLinked(next.linked); setDocuments(next.documents); } }).catch(() => { if (active) setError(t("wa.error")); });
    return () => { active = false; };
  }, [fetchAll, t]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); const next = await fetchAll(); setLinked(next.linked); setDocuments(next.documents); setChoice(""); } catch { setError(t("wa.error")); } finally { setBusy(false); }
  }
  const available = documents.filter(document => !linked?.some(item => item.documentId === document.documentId));
  return <section aria-label={t("wa.title")}>
    <h4>{t("wa.title")}</h4>
    <p>{t("wa.intro")}</p>
    {error && <p role="alert">{error}</p>}
    {linked?.length === 0 && <p>{t("wa.none")}</p>}
    {linked && linked.length > 0 && <ul>{linked.map(item => <li key={item.documentId}>
      <strong>{item.title}</strong> · {item.fileName}
      <button type="button" className="fw-secondary" disabled={busy} onClick={() => void run(() => appRequest("/api/v1/vault/attachments/remove", { documentId: item.documentId, workId }))}>{t("wa.detach")}</button>
    </li>)}</ul>}
    {documents.length === 0 ? <p>{t("wa.noVault")}</p> : available.length > 0 && <>
      <label className="fw-field">{t("wa.pick")}<select value={choice} onChange={event => setChoice(event.target.value)}>
        <option value="">—</option>{available.map(document => <option key={document.documentId} value={document.documentId}>{document.title} · {document.fileName}</option>)}
      </select></label>
      <button type="button" className="fw-secondary" disabled={busy || !choice} onClick={() => void run(() => appRequest("/api/v1/vault/attachments", { documentId: choice, workId }))}>{t("wa.attach")}</button>
    </>}
  </section>;
}
