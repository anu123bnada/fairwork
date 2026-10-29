// There is no "list all my agreements" endpoint. The only agreements a person can pick from without
// typing a reference are ones surfaced by APIs they already use. This merges those sources; an agreement
// that appears in none of them (for example a draft with no expiry and no work record) stays reachable only by its link.
export type ExpiryChoice = { agreementId: string; version: number; expiresAt: string; expired: boolean; role: "worker" | "representative" };
export type PassportChoice = { agreementId: string; agreementVersion: number; role: string; companyName: string | null; periodStart: string; periodEnd: string };
export type AgreementChoice = {
  agreementId: string;
  sources: ("open_proposal" | "verified_work" | "recent")[];
  role: "worker" | "representative" | null;
  version: number | null;
  expiresAt: string | null;
  expired: boolean;
  workRole: string | null;
  companyName: string | null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isAgreementReference = (value: string) => UUID.test(value.trim());

export function mergeAgreementChoices(expiries: ExpiryChoice[], passport: PassportChoice[], recent: string[]): AgreementChoice[] {
  const byId = new Map<string, AgreementChoice>();
  const entry = (agreementId: string) => {
    let value = byId.get(agreementId);
    if (!value) { value = { agreementId, sources: [], role: null, version: null, expiresAt: null, expired: false, workRole: null, companyName: null }; byId.set(agreementId, value); }
    return value;
  };
  for (const item of expiries) { const c = entry(item.agreementId); c.sources.push("open_proposal"); c.role = item.role; c.version = item.version; c.expiresAt = item.expiresAt; c.expired = item.expired; }
  for (const item of passport) { const c = entry(item.agreementId); if (!c.sources.includes("verified_work")) c.sources.push("verified_work"); c.version ??= item.agreementVersion; c.workRole ??= item.role; c.companyName ??= item.companyName; }
  for (const id of recent) if (isAgreementReference(id)) { const c = entry(id.toLowerCase()); if (!c.sources.includes("recent")) c.sources.push("recent"); }
  const rank = (c: AgreementChoice) => c.sources.includes("open_proposal") ? 0 : c.sources.includes("verified_work") ? 1 : 2;
  return [...byId.values()].sort((a, b) => rank(a) - rank(b) || (a.expiresAt ?? "￿").localeCompare(b.expiresAt ?? "￿"));
}

const KEY = "oryqen.recent-agreements";
export function readRecentAgreements(): string[] {
  try { const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]"); return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string" && isAgreementReference(v)).slice(0, 8) : []; } catch { return []; }
}
export function rememberAgreement(id: string) {
  try { window.localStorage.setItem(KEY, JSON.stringify([id, ...readRecentAgreements().filter(v => v !== id)].slice(0, 8))); } catch { /* a convenience only */ }
}
