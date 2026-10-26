"use client";
import { useState } from "react";
import { appRequest } from "@/features/authority/client";
import { buildDataExport, type DataExport } from "@/features/privacy/export";
import { useI18n } from "@/i18n/use-i18n";

// Builds the export in the browser from the person's own authorized endpoints and saves it as a file on their device.
export function DataExportPanel() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [summary, setSummary] = useState<DataExport | null>(null);
  async function run() {
    setBusy(true); setError(""); setSummary(null);
    try {
      const result = await buildDataExport(path => appRequest(path), new Date());
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = `oryqen-data-export-${result.exportedAt.slice(0, 10)}.json`; document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setSummary(result);
    } catch { setError("The export could not be created. Retry when connected."); }
    finally { setBusy(false); }
  }
  const entries = summary ? Object.entries(summary.sections) : [];
  return <section className="fw-list-card" aria-label={t("export.title")}>
    <p>{t("export.intro")}</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="fw-primary" disabled={busy} onClick={() => void run()}>{busy ? t("export.working") : t("export.button")}</button>
    {summary && <div role="status">
      <p>{t("export.done")}</p>
      <ul>{entries.map(([name, section]) => <li key={name}>{name}: {section.status === "ok" ? `${section.count ?? "ok"}` : `${t("export.unavailable")}`}</li>)}</ul>
    </div>}
  </section>;
}
