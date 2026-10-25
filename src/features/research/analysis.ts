import type { Finding, RegistryRecord, ResearchResult } from "./schema";

const LEGAL_SUFFIXES = new Set(["ltd", "limited", "plc", "pvt", "private", "public", "inc", "incorporated", "corp", "corporation", "llc", "gmbh", "ag", "co", "company", "sa", "bv", "nv", "pte", "aktiengesellschaft", "kg", "ab", "oy", "srl", "spa"]);
const strip = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
export function nameTokens(value: string): string[] {
  const tokens = strip(value).split(" ").filter(Boolean);
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1]!)) tokens.pop();
  return tokens;
}

export type NameMatch = ResearchResult["nameMatch"];
// Explainable, deliberately conservative name comparison. It is never used to claim identity.
export function nameMatch(query: string, record: Pick<RegistryRecord, "legalName" | "otherNames">): NameMatch {
  const wanted = strip(query);
  const candidates = [record.legalName, ...record.otherNames];
  if (candidates.some(candidate => strip(candidate) === wanted)) return "exact";
  const wantedTokens = nameTokens(query);
  let best: NameMatch = "weak";
  for (const candidate of candidates) {
    const tokens = nameTokens(candidate);
    if (tokens.length && tokens.join(" ") === wantedTokens.join(" ")) return "close";
    const overlap = wantedTokens.filter(token => tokens.includes(token)).length;
    if (wantedTokens.length && overlap === wantedTokens.length) best = "partial";
  }
  return best;
}

const DAY = 86_400_000;
const daysSince = (from: string | null, now: Date) => from && !Number.isNaN(Date.parse(from)) ? Math.max(0, Math.floor((now.getTime() - Date.parse(from)) / DAY)) : null;

// Source freshness: how old is the registry's own last update, and when should this research be
// repeated. Research older than 30 days should be re-run before it is relied on.
export function sourceFreshness(record: Pick<RegistryRecord, "sourceLastUpdated" | "retrievedAt">, now: Date) {
  const age = daysSince(record.sourceLastUpdated, now);
  const status = age === null ? "unknown" as const : age <= 400 ? "current" as const : age <= 800 ? "aging" as const : "stale" as const;
  const retrieved = Date.parse(record.retrievedAt);
  return { status, sourceAgeDays: age, verifyAgainBy: Number.isNaN(retrieved) ? null : new Date(retrieved + 30 * DAY).toISOString() };
}

export function buildFindings(record: RegistryRecord, input: { name: string; country: string | null }, now: Date): Finding[] {
  const out: Finding[] = [];
  const match = nameMatch(input.name, record);
  out.push({
    id: "name-match", kind: match === "weak" ? "contradicts" : match === "partial" ? "info" : "supports",
    title: match === "exact" ? "Registered name matches your search" : match === "close" ? "Registered name matches apart from the legal-form suffix" : match === "partial" ? "Registered name contains your search terms" : "Registered name differs from your search",
    detail: `You searched for “${input.name}”; the registry lists “${record.legalName}”. A matching name does not prove that a job offer, recruiter or website belongs to this entity.`,
  });
  if (input.country && record.country && input.country !== record.country) {
    out.push({ id: "country-mismatch", kind: "contradicts", title: "Registered country differs from the country you expected", detail: `You expected ${input.country}; the registry lists ${record.country}. Confirm which legal entity is actually offering the job.` });
  }
  out.push(record.entityStatus === "ACTIVE"
    ? { id: "entity-active", kind: "supports", title: "Registry lists the entity as active", detail: "This concerns the legal entity's registry status only." }
    : { id: "entity-status", kind: "contradicts", title: `Registry lists the entity as ${record.entityStatus.toLowerCase()}`, detail: "An inactive or ended entity cannot be relied on as a current employer. Confirm directly with the entity." });
  if (record.registrationStatus !== "ISSUED") {
    out.push({ id: "registration-status", kind: "outdated", title: `The LEI registration is ${record.registrationStatus.toLowerCase()}`, detail: "A lapsed or retired registration means the registry data may no longer be maintained." });
  }
  const renewal = record.nextRenewal ? Date.parse(record.nextRenewal) : NaN;
  if (!Number.isNaN(renewal) && renewal < now.getTime()) {
    out.push({ id: "renewal-overdue", kind: "outdated", title: "The registration renewal date has passed", detail: `The registry's own renewal date was ${record.nextRenewal!.slice(0, 10)}; details may be out of date until it is renewed.` });
  }
  if (record.corroboration) {
    out.push({ id: "corroboration", kind: "info", title: `Registry corroboration level: ${record.corroboration.replaceAll("_", " ").toLowerCase()}`, detail: "GLEIF's own indication of how its data was validated against the business registry named in the record." });
  }
  const fresh = sourceFreshness(record, now);
  if (fresh.status === "stale" || fresh.status === "aging") {
    out.push({ id: "source-age", kind: "outdated", title: `The registry record was last updated ${fresh.sourceAgeDays} days ago`, detail: "Check for newer information before relying on it." });
  }
  out.push({ id: "scope", kind: "limitation", title: "What this research does not establish", detail: "It confirms that a legal entity is recorded in a public registry. It does not verify that this entity made a specific offer, that a recruiter is authorized to act for it, or that its employment practices are fair." });
  return out;
}

export const standardLimitations = [
  "Data comes from the GLEIF Global LEI Index, a third-party registry of legal entities that have an LEI. It is not complete: many employers have none.",
  "ORYQEN does not score or rank employers. Findings are labelled by what the record shows; identity checks and general trust judgments are kept separate.",
  "Employer-submitted claims are shown separately and are compared with registry data, never merged into it.",
];
export const noMatchLimitation = "No registry record was found. Many genuine employers have no LEI, so this is not evidence of anything either way. Try the official company registry of the employer's country.";
