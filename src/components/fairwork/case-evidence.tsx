"use client";
import { useCallback, useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { caseEvidenceList, type CaseEvidenceItem } from "@/features/cases/evidence";
import { vaultListResponse, type VaultDocument } from "@/features/vault/schema";
import { useI18n } from "@/i18n/use-i18n";

// Evidence references on a dispute: a snapshot (title, type, size, SHA-256) of the opener's own vault documents. The file itself is not shared by this.
export function CaseEvidence({ caseId, open }: { caseId: string; open: boolean }) {
  const { t } = useI18n();
  const [items, setItems] = useState<CaseEvidenceItem[] | null>(null), [docs, setDocs] = useState<VaultDocument[]>([]), [pick, setPick] = useState(""), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const load = useCallback(async () => caseEvidenceList.parse(await appRequest(`/api/v1/work-cases/evidence?caseId=${caseId}`)).items, [caseId]);
  useEffect(() => {
    let active = true;
    load().then(value => { if (active) setItems(value); }).catch(() => { if (active) setItems(null); });
    return () => { active = false; };
  }, [load]);
  async function openPicker() {
    try { const raw = await appRequest("/api/v1/vault") as Record<string, unknown>; setDocs(vaultListResponse.parse({ items: raw.items, limit: raw.limit, used: raw.used }).items); } catch { setDocs([]); }
  }
  async function attach() {
    if (!pick) return;
    setBusy(true); setFailed(false);
    try { await appRequest("/api/v1/work-cases/evidence", { caseId, documentId: pick }); setPick(""); setItems(await load()); } catch { setFailed(true); } finally { setBusy(false); }
  }
  if (items === null) return null;
  const attached = new Set(items.map(item => item.documentId));
  return <section className="fw-card fw-offer-detail-card" aria-label={t("ce.title")}>
    <h3>{t("ce.title")}</h3>
    <p>{t("ce.intro")}</p>
    {items.length === 0 ? <p>{t("ce.none")}</p> : <ul>{items.map(item => <li key={item.documentId}><strong>{item.title}</strong> · {item.fileName} · <span title={item.sha256}>{t("ce.checksum", { hash: item.sha256.slice(0, 12) })}</span></li>)}</ul>}
    {failed && <p role="alert">{t("ce.error")}</p>}
    {open && <details onToggle={event => { if (event.currentTarget.open) void openPicker(); }}>
      <summary>{t("ce.attachSummary")}</summary>
      <label className="fw-field">{t("ce.pick")}<select value={pick} onChange={event => setPick(event.target.value)}><option value="">—</option>{docs.filter(doc => !attached.has(doc.documentId)).map(doc => <option key={doc.documentId} value={doc.documentId}>{doc.title}</option>)}</select></label>
      <button type="button" className="fw-secondary" disabled={busy || !pick} onClick={() => void attach()}>{t("ce.attach")}</button>
      <p>{t("ce.openerOnly")}</p>
    </details>}
  </section>;
}
