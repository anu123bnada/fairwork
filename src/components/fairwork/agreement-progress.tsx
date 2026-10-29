"use client";
import { agreementProgress, progressSteps } from "@/features/offer/agreement-progress";
import type { AgreementVersion } from "@/features/offer/workflow-schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import "./agreement-progress.css";

export function AgreementProgress({ status }: { status: AgreementVersion["status"] }) {
  const { t } = useI18n();
  const state = agreementProgress(status);
  if (state.kind === "stopped") return <p className="oq-agpr-stopped" role="status">{t(`agpr.stopped.${state.reason}` as MessageKey)}</p>;
  return <ol className="oq-agpr" aria-label={t("agpr.aria")}>{progressSteps.map((step, index) => {
    const complete = state.done || index < state.reached, current = !state.done && index === state.reached;
    return <li key={step} className={complete ? "is-done" : current ? "is-current" : ""} aria-current={current ? "step" : undefined}>
      <span className="oq-agpr-dot" aria-hidden>{complete ? "✓" : index + 1}</span>
      <span>{t(`agpr.step.${step}` as MessageKey)}<span className="oq-agpr-sr">{complete ? ` — ${t("agpr.done")}` : current ? ` — ${t("agpr.now")}` : ""}</span></span>
    </li>;
  })}</ol>;
}
