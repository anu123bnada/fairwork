"use client";
import { useAgreementChoices } from "./agreement-picker";
import { useI18n } from "@/i18n/use-i18n";

// Work is logged against an agreement that is in effect. Choosing one here fills the reference;
// the server still checks that the agreement is the worker's own and effective when its basis is loaded.
export function AgreementBasisSelect({ value, onChange, disabled }: { value: string; onChange: (agreementId: string) => void; disabled: boolean }) {
  const { t } = useI18n();
  const choices = useAgreementChoices();
  if (!choices?.length) return null;
  const known = choices.some(choice => choice.agreementId === value);
  return <label className="fw-field">{t("wr.pick")}
    <select value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
      <option value="">{t("wr.choose")}</option>
      {value && !known && <option value={value}>{t("wr.linked")}</option>}
      {choices.map(choice => <option key={choice.agreementId} value={choice.agreementId}>{choice.companyName ?? choice.workRole ?? t("agp.agreement")} · {t("agp.ref", { id: choice.agreementId.slice(0, 8) })}</option>)}
    </select>
  </label>;
}
