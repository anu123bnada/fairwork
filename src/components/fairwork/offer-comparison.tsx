"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
import { agreementReadSchema, type AgreementRead } from "@/features/offer/read-schema";
import { compareOfferTerms, requireComparisonOffer } from "@/features/offer/comparison";

export function OfferComparison({ ids }: { ids: string[] }) {
  const [offers, setOffers] = useState<AgreementRead["offer"][] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all(ids.map(async id => requireComparisonOffer(
      agreementReadSchema.parse(await appRequest(`/api/v1/agreements?offerId=${encodeURIComponent(id)}`)), id,
    ))).then(result => { if (active) setOffers(result); })
      .catch(() => { if (active) setError("Comparison is unavailable. One of these offers may no longer be accessible. Check your connection or choose other offers."); });
    return () => { active = false; };
  }, [ids, attempt]);
  const rows = offers ? compareOfferTerms(offers) : [];
  return <section className="fw-offer-comparison" aria-label="Offer comparison">
    <h4>Compare saved terms</h4>
    <p>These are the saved revisions loaded now. Amounts are shown as recorded: currencies, pay periods and gross/net basis may differ. This comparison does not rank employers or verify their claims.</p>
    {!offers && !error && <p role="status">Loading authorized offer revisions…</p>}
    {error && <><p role="alert">{error}</p><button className="fw-secondary" onClick={() => { setError(""); setOffers(null); setAttempt(value => value + 1); }}>Retry comparison</button></>}
    {offers && <>
      <label><input type="checkbox" checked={differencesOnly} onChange={event => setDifferencesOnly(event.target.checked)} /> Show differing terms only</label>
      <div className="fw-comparison-scroll" role="region" aria-label="Saved terms comparison table" tabIndex={0}>
        <table><caption>Saved offer revisions — missing terms mean “Not stated”</caption><thead><tr><th scope="col">Term</th>{offers.map(offer => <th scope="col" key={offer.offerId}><Link href={`/app/agreement?offerId=${offer.offerId}`}>{offer.snapshot.role || "Untitled offer"}</Link><small>Revision {offer.version} · {offer.unresolved.length} open questions</small></th>)}</tr></thead>
          <tbody>{rows.filter(row => !differencesOnly || row.differs).map(row => <tr key={row.field} data-differs={row.differs}><th scope="row">{row.field.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ")}</th>{row.values.map((value, index) => <td key={index}>{value ?? "Not stated"}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {differencesOnly && !rows.some(row => row.differs) && <p>No differing saved terms in these revisions.</p>}
      <button className="fw-secondary" onClick={() => { setOffers(null); setError(""); setAttempt(value => value + 1); }}>Reload current revisions</button>
    </>}
  </section>;
}
