"use client";
import { useEffect } from "react";
import type { AnalysisStage } from "@/features/analysis/run";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./scan-offer.css";

// The window shown while an offer is analysed. Each stage reflects real work (the save, the rules, the model request); the model stage shows live elapsed seconds and can be cancelled.
export function AnalysisDialog({ stages, elapsed, onCancel }: { stages: AnalysisStage[]; elapsed: number; onCancel: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const aiActive = stages.find(stage => stage.id === "ai")?.state === "active";
  return <div className="oq-scan-backdrop">
    <div className="oq-scan-dialog" role="dialog" aria-modal="true" aria-labelledby="oq-analysis-title">
      <h2 id="oq-analysis-title">{t("arun.title")}</h2>
      <div className={`oq-scan-preview oq-analysis-pulse${aiActive ? " oq-scan-reading" : ""}`} aria-hidden="true"><span className="oq-scan-line" /></div>
      <ol className="oq-scan-stages" aria-live="polite" aria-label={t("arun.stagesAria")}>
        {stages.map(stage => <li key={stage.id} className={`oq-scan-stage oq-scan-${stage.state}`} data-stage={stage.id} data-state={stage.state}>
          <span className="oq-scan-dot" aria-hidden="true" />
          <span><strong>{t(`arun.stage.${stage.id}` as MessageKey)}</strong> <em>{t(`scan.state.${stage.state}` as MessageKey)}{stage.id === "ai" && stage.state === "active" ? ` · ${t("scan.seconds", { seconds: elapsed })}` : ""}</em>
            {stage.detail && <small>{stage.detail}</small>}</span>
        </li>)}
      </ol>
      <div className="oq-scan-actions">{aiActive && <button type="button" className="fw-secondary" autoFocus onClick={onCancel}>{t("arun.cancelAi")}</button>}</div>
    </div>
  </div>;
}
