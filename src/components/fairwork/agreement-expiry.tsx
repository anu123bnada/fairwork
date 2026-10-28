"use client";
import { useCallback, useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { bcp47 } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";
import { expiryRead, expiryMaxDays, type ExpiryRead } from "@/features/offer/expiry";

// The expiry of the current proposed version. The worker who proposed it can set or renew it; the employer representative can see it. A past date blocks acknowledging and deciding,
// never changes the agreement's recorded history.
export function AgreementExpiry({ agreementId, version, state }: { agreementId: string; version: number; state: string }) {
  const { t, locale } = useI18n();
  const [info, setInfo] = useState<ExpiryRead | null>(null), [date, setDate] = useState(""), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  // Chosen once per mount so rendering stays pure.
  const [{ min, max }] = useState(() => ({ min: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), max: new Date(Date.now() + expiryMaxDays * 86_400_000).toISOString().slice(0, 10) }));
  const load = useCallback(async () => expiryRead.parse(await appRequest(`/api/v1/agreement-expiry?agreementId=${agreementId}`)), [agreementId]);
  useEffect(() => {
    let active = true;
    load().then(value => { if (active) setInfo(value); }).catch(() => { if (active) setInfo(null); });
    return () => { active = false; };
  }, [load, version, state]);
  if (!info || info.version !== version) return null;
  const shown = info.expiresAt ? new Date(info.expiresAt).toLocaleString(bcp47(locale), { dateStyle: "medium", timeStyle: "short" }) : null;
  const open = state === "draft" || state === "proposed";
  async function save() {
    if (!date) return;
    setBusy(true); setFailed(false);
    try {
      // End of the chosen day in the person's own time zone.
      const when = new Date(`${date}T23:59:00`).toISOString();
      await appRequest("/api/v1/agreement-expiry", { agreementId, expectedVersion: version, expiresAt: when });
      setInfo(await load()); setDate("");
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  return <section className="fw-card fw-offer-detail-card" aria-label={t("exp.title")}>
    <h3>{t("exp.title")}</h3>
    {shown ? <p role="status" className={info.expired ? "fw-error" : "fw-notice"}>{t(info.expired ? "exp.expired" : "exp.until", { date: shown })}{info.renewals > 0 ? ` · ${t("exp.renewed", { count: info.renewals })}` : ""}</p> : <p>{t("exp.none")}</p>}
    {info.expired && !info.canSet && <p>{t("exp.askRenew")}</p>}
    {failed && <p role="alert">{t("exp.error")}</p>}
    {info.canSet && open && <>
      <label className="fw-field">{t(shown ? "exp.newDate" : "exp.date")}<input type="date" min={min} max={max} value={date} onChange={event => setDate(event.target.value)} /></label>
      <button type="button" className="fw-secondary" disabled={busy || !date} onClick={() => void save()}>{t(shown ? "exp.renew" : "exp.set")}</button>
    </>}
  </section>;
}
