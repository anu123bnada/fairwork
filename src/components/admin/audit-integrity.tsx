"use client";
import { useState } from "react";
import { appRequest } from "@/features/authority/client";
import { auditChainResult, type AuditChainResult } from "@/features/admin/audit-chain";
import { useI18n } from "@/i18n/use-i18n";
import styles from "./admin.module.css";

// Recomputes every link of the audit hash chain and every audited row's hash. It detects edits, deletions and silent insertions made after the fact; the head hash is shown so it can
// be recorded outside the database.
export function AuditIntegrity() {
  const { t } = useI18n();
  const [result, setResult] = useState<AuditChainResult | null>(null), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  async function verify() {
    setBusy(true); setFailed(false);
    try { setResult(auditChainResult.parse(await appRequest("/api/v1/admin/audit-chain"))); } catch { setResult(null); setFailed(true); } finally { setBusy(false); }
  }
  return <section className={styles.panel} aria-label={t("adm.chain.title")}>
    <h2>{t("adm.chain.title")}</h2>
    <p>{t("adm.chain.intro")}</p>
    <button type="button" disabled={busy} onClick={() => void verify()}>{t("adm.chain.verify")}</button>
    {failed && <p role="alert">{t("adm.chain.error")}</p>}
    {result && <div role="status">
      <p><strong>{result.ok ? t("adm.chain.ok", { count: result.checked }) : t("adm.chain.bad")}</strong></p>
      {!result.ok && <ul>
        <li>{t("adm.chain.links", { count: result.brokenLinks })}</li>
        <li>{t("adm.chain.records", { count: result.alteredOrDeletedRecords })}</li>
        <li>{t("adm.chain.missing", { count: result.recordsNotInChain })}</li>
        {result.firstProblemSeq !== null && <li>{t("adm.chain.first", { seq: result.firstProblemSeq })}</li>}
      </ul>}
      {result.head && <p>{t("adm.chain.head")} <code>{result.head}</code></p>}
    </div>}
  </section>;
}
