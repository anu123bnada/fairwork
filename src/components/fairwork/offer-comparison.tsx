"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { agreementReadSchema, type AgreementRead } from "@/features/offer/read-schema";
import { compareOfferTerms, requireComparisonOffer } from "@/features/offer/comparison";
import { useI18n } from "@/i18n/use-i18n";

export function OfferComparison({ ids }: { ids: string[] }) {
  const { t } = useI18n();
  const [offers, setOffers] = useState<AgreementRead["offer"][] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all(ids.map(async id => requireComparisonOffer(
      agreementReadSchema.parse(await appRequest(`/api/v1/agreements?offerId=${encodeURIComponent(id)}`)), id,
    ))).then(result => { if (active) setOffers(result); })
      .catch(() => { if (active) setError(t("oc.error")); });
    return () => { active = false; };
  }, [ids, attempt, t]);
  const rows = offers ? compareOfferTerms(offers) : [];
  return <section className="fw-offer-comparison" aria-label={t("oc.aria")}>
    <h4>{t("oc.title")}</h4>
    <p>{t("oc.intro")}</p>
    {!offers && !error && <p role="status">{t("oc.loading")}</p>}
    {error && <><p role="alert">{error}</p><button className="fw-secondary" onClick={() => { setError(""); setOffers(null); setAttempt(value => value + 1); }}>{t("oc.retry")}</button></>}
    {offers && <>
      <label><input type="checkbox" checked={differencesOnly} onChange={event => setDifferencesOnly(event.target.checked)} /> {t("oc.diffOnly")}</label>
      <div className="fw-comparison-scroll" role="region" aria-label={t("oc.tableAria")} tabIndex={0}>
        <table><caption>{t("oc.caption")}</caption><thead><tr><th scope="col">{t("oc.term")}</th>{offers.map(offer => <th scope="col" key={offer.offerId}><Link href={`/app/agreement?offerId=${offer.offerId}`}>{offer.snapshot.role || t("oc.untitled")}</Link><small>{t("oc.revLine", { version: offer.version, open: offer.unresolved.length })}</small></th>)}</tr></thead>
          <tbody>{rows.filter(row => !differencesOnly || row.differs).map(row => <tr key={row.field} data-differs={row.differs}><th scope="row">{row.field.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ")}</th>{row.values.map((value, index) => <td key={index}>{value ?? t("oc.notStated")}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {differencesOnly && !rows.some(row => row.differs) && <p>{t("oc.noDiff")}</p>}
      <button className="fw-secondary" onClick={() => { setOffers(null); setError(""); setAttempt(value => value + 1); }}>{t("oc.reload")}</button>
    </>}
  </section>;
}
