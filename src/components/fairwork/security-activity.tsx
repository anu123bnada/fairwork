"use client";
import { useRef, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { securityEvents, type SecurityEvents } from "@/features/identity/security-events";
import { useI18n } from "@/i18n/use-i18n";

// The person's own recent sign-in, second-factor, sign-out and password events, loaded only when the section is opened.
export function SecurityActivity() {
  const { t } = useI18n();
  const [data, setData] = useState<SecurityEvents | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0);
  async function load() {
    const current = ++sequence.current; setBusy(true); setError(""); setData(null);
    try { const result = securityEvents.parse(await appRequest("/api/v1/security-events")); if (sequence.current === current) setData(result); }
    catch { if (sequence.current === current) setError(t("sa.error")); }
    finally { if (sequence.current === current) setBusy(false); }
  }
  return <details className="fw-list-card" onToggle={event => { if (event.currentTarget.open) void load(); else { sequence.current++; setData(null); setBusy(false); setError(""); } }}>
    <summary>{t("sa.summary")}</summary>
    <p>{t("sa.intro")}</p>
    {busy && <p role="status">{t("sa.loading")}</p>}{error && <p role="alert">{error}</p>}
    {data && data.items.length === 0 && <p>{t("sa.none")}</p>}
    {data && data.items.length > 0 && <ul aria-label={t("sa.summary")}>{data.items.map((item, index) => <li key={`${item.occurredAt}-${item.kind}-${index}`}>{t(`sa.kind.${item.kind}`)} · {new Date(item.occurredAt).toLocaleString()}</li>)}</ul>}
    <p>{t("sa.note")}</p>
    <button className="fw-secondary" disabled={busy} onClick={() => void load()}>{t("sa.reload")}</button>
  </details>;
}
