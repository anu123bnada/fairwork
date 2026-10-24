import type { AgreementRead } from "./read-schema";

export function compareOfferTerms(offers: AgreementRead["offer"][]) {
  const fields = [...new Set(offers.flatMap(offer => Object.keys(offer.snapshot)))].sort();
  return fields.map(field => {
    const values = offers.map(offer => {
      const value = offer.snapshot[field];
      return value === undefined || String(value).trim() === "" ? null : String(value);
    });
    return { field, values, differs: new Set(values).size > 1 };
  });
}

export function requireComparisonOffer(raw: AgreementRead, expectedId: string) {
  if (raw.offer.offerId !== expectedId) throw new Error("Unexpected offer response.");
  return raw.offer;
}
