"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import { commandResult, mineList, type MineItem } from "@/features/applications/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./records.css";

// The applications this person sent through ORYQEN, with the status the organization set. Withdrawing is the applicant's own action.
export function SubmittedApplications() {
  const { t } = useI18n();
  const [items, setItems] = useState<MineItem[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(async () => { try { setItems(mineList.parse(await appRequest("/api/v1/applications?view=mine")).items); setError(""); } catch { setError(t("sub.loadError")); } }, [t]);
  useEffect(() => { let live = true; (async () => { try { const result = mineList.parse(await appRequest("/api/v1/applications?view=mine")).items; if (live) setItems(result); } catch { if (live) setError(t("sub.loadError")); } })(); return () => { live = false; }; }, [t]);
  async function withdraw(item: MineItem) {
    if (!window.confirm(t("sub.confirmWithdraw"))) return;
    setBusy(true); setError("");
    try { commandResult.parse(await appRequest("/api/v1/applications", { action: "withdraw", id: item.id, expectedRevision: item.revision })); await load(); }
    catch (caught) { setError(caught instanceof ApiRequestError && caught.code === "VERSION_CONFLICT" ? t("sub.conflict") : t("sub.withdrawError")); await load(); } finally { setBusy(false); }
  }
  return <section className="oq-rec" aria-label={t("sub.aria")}>
    <h3>{t("sub.title")}</h3>
    <p>{t("sub.intro")}</p>
    {error && <p role="alert">{error}</p>}
    {items && items.length === 0 && <p>{t("sub.none")}</p>}
    <ul className="oq-rec-list">{(items ?? []).map(item => <li key={item.id}>
      <strong>{item.listingTitle}</strong> · {t(`sub.s.${item.status}` as MessageKey)} · {new Date(item.createdAt).toLocaleDateString()}
      {item.status !== "withdrawn" && <button className="fw-secondary" disabled={busy} onClick={() => void withdraw(item)}>{t("sub.withdraw")}</button>}
    </li>)}</ul>
  </section>;
}
