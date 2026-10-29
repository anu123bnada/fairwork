"use client";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { expiryList } from "@/features/offer/expiry";
import { passportSchema } from "@/features/work/passport-schema";
import { mergeAgreementChoices, readRecentAgreements, type AgreementChoice } from "@/features/offer/agreement-choices";
import { useI18n } from "@/i18n/use-i18n";
import "./agreement-picker.css";
import "./feature-tokens.css";

// Choose an agreement from the ones this account already knows about instead of typing a reference.
// The server still decides access when one is opened.
export function useAgreementChoices() {
  const [choices, setChoices] = useState<AgreementChoice[] | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const [expiries, passport] = await Promise.allSettled([appRequest("/api/v1/agreement-expiries"), appRequest("/api/v1/passport")]);
      const open = expiries.status === "fulfilled" ? expiryList.safeParse(expiries.value) : null;
      const verified = passport.status === "fulfilled" ? passportSchema.safeParse(passport.value) : null;
      if (active) setChoices(mergeAgreementChoices(open?.success ? open.data.items : [], verified?.success ? verified.data.entries : [], readRecentAgreements()));
    })();
    return () => { active = false; };
  }, []);
  return choices;
}

// Choose an agreement from the ones this account already knows about instead of typing a reference.
// The server still decides access when one is opened.
export function AgreementPicker({ busy, onOpen }: { busy: boolean; onOpen: (agreementId: string) => void }) {
  const { t } = useI18n();
  const choices = useAgreementChoices();
  if (choices === null) return <p role="status" className="fw-notice">{t("agp.loading")}</p>;
  if (!choices.length) return <section className="oq-agp-empty"><strong>{t("agp.emptyTitle")}</strong><span>{t("agp.emptyBody")}</span></section>;
  return <section className="oq-agp" aria-label={t("agp.title")}>
    <h3>{t("agp.title")}</h3>
    <ul>{choices.map(choice => <li key={choice.agreementId}>
      <button type="button" className="oq-agp-item" disabled={busy} onClick={() => onOpen(choice.agreementId)}>
        <span className="oq-agp-main"><strong>{choice.companyName ?? choice.workRole ?? t("agp.agreement")}</strong>
          <span>{choice.workRole && choice.companyName ? choice.workRole : t("agp.ref", { id: choice.agreementId.slice(0, 8) })}</span></span>
        <span className="oq-agp-tags">
          {choice.sources.includes("open_proposal") && <span className={`oq-agp-tag${choice.expired ? " oq-agp-tag-warn" : ""}`}>{choice.expired ? t("agp.expired") : t("agp.open", { date: new Date(choice.expiresAt ?? "").toLocaleDateString() })}</span>}
          {choice.sources.includes("verified_work") && <span className="oq-agp-tag">{t("agp.verifiedWork")}</span>}
          {choice.role && <span className="oq-agp-tag">{choice.role === "worker" ? t("agp.asWorker") : t("agp.asRep")}</span>}
        </span>
      </button>
    </li>)}</ul>
    <p className="oq-agp-note">{t("agp.limit")}</p>
  </section>;
}
