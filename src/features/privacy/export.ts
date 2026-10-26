// Self-service data export (module 12). The person's own browser session reads each of their own records through the same
// authorized endpoints the screens already use, so the export can never contain more than the person may already see. A section
// that cannot be read is reported as unavailable rather than silently dropped, and secrets (credential tokens) are left out.

export const EXPORT_FORMAT = "oryqen-data-export.v1";
export type ExportSection = { status: "ok"; count: number | null; data: unknown } | { status: "unavailable"; reason: string };
export type DataExport = { format: typeof EXPORT_FORMAT; exportedAt: string; notes: string[]; sections: Record<string, ExportSection> };
export type Getter = (path: string) => Promise<unknown>;

const MAX_PAGES = 20;
type Source =
  | { name: string; path: string; paging?: undefined }
  | { name: string; path: string; paging: "cursor" }
  | { name: string; path: string; paging: "notifications" };

export const sources: Source[] = [
  { name: "profile", path: "/api/v1/me" },
  { name: "offers", path: "/api/v1/offers?context=WORKER&view=all", paging: "cursor" },
  { name: "offerDrafts", path: "/api/v1/offers/drafts", paging: "cursor" },
  { name: "employmentHistory", path: "/api/v1/me/employment-history", paging: "cursor" },
  { name: "workRecords", path: "/api/v1/work-records", paging: "cursor" },
  { name: "workPassport", path: "/api/v1/passport", paging: "cursor" },
  { name: "workCases", path: "/api/v1/work-cases", paging: "cursor" },
  { name: "credentials", path: "/api/v1/credentials" },
  { name: "evidenceVaultDocuments", path: "/api/v1/vault" },
  { name: "plan", path: "/api/v1/entitlements" },
  { name: "developerKeys", path: "/api/v1/developer/keys" },
  { name: "developerWebhooks", path: "/api/v1/developer/webhooks" },
  { name: "notifications", path: "/api/v1/notifications", paging: "notifications" },
  { name: "guidance", path: "/api/v1/guidance" },
  { name: "recruiterChecks", path: "/api/v1/recruiter" },
  { name: "privacyRequests", path: "/api/v1/privacy-requests", paging: "cursor" },
  { name: "passportSharing", path: "/api/v1/passport/sharing", paging: "cursor" },
];

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});
const withQuery = (path: string, query: string) => `${path}${path.includes("?") ? "&" : "?"}${query}`;
const reason = (error: unknown) => error instanceof Error && error.message ? error.message.slice(0, 160) : "The section could not be read.";

// Fields that are secrets or bearer material and must never appear in an export file.
const SECRET_KEYS = new Set(["token", "secret", "secretHash", "signingKey", "password", "accessToken", "refreshToken"]);
export function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !SECRET_KEYS.has(key)).map(([key, inner]) => [key, stripSecrets(inner)]));
  return value;
}

async function pages(source: Source, get: Getter): Promise<unknown> {
  if (!source.paging) return get(source.path);
  const first = asRecord(await get(source.path));
  const collected: unknown[] = Array.isArray(first.items) ? [...first.items] : [];
  let next: unknown = first.nextCursor;
  for (let page = 1; page < MAX_PAGES && next; page += 1) {
    const query = source.paging === "notifications"
      ? new URLSearchParams({ cursorAt: String(asRecord(next).cursorAt ?? ""), cursorKey: String(asRecord(next).cursorKey ?? "") }).toString()
      : `cursor=${encodeURIComponent(String(next))}`;
    const more = asRecord(await get(withQuery(source.path, query)));
    if (Array.isArray(more.items)) collected.push(...more.items);
    next = more.nextCursor;
  }
  const { items: _items, nextCursor: _cursor, ...rest } = first; void _items; void _cursor;
  return { ...rest, items: collected, complete: !next };
}

export async function buildDataExport(get: Getter, now: Date): Promise<DataExport> {
  const sections: Record<string, ExportSection> = {};
  for (const source of sources) {
    try {
      const data = stripSecrets(await pages(source, get));
      const items = asRecord(data).items;
      sections[source.name] = { status: "ok", count: Array.isArray(items) ? items.length : null, data };
    } catch (error) { sections[source.name] = { status: "unavailable", reason: reason(error) }; }
  }
  // Saved analyses belong to individual offers.
  const offerItems = sections.offers?.status === "ok" ? asRecord(sections.offers.data).items : null;
  if (Array.isArray(offerItems)) {
    const analyses: Record<string, unknown> = {}; let failed = 0;
    for (const offer of offerItems.slice(0, 100)) {
      const id = asRecord(offer).offerId; if (typeof id !== "string") continue;
      try { analyses[id] = stripSecrets(await get(`/api/v1/offers/analyses?offerId=${encodeURIComponent(id)}`)); } catch { failed += 1; }
    }
    sections.savedAnalyses = failed && !Object.keys(analyses).length ? { status: "unavailable", reason: "Saved analyses could not be read." } : { status: "ok", count: Object.keys(analyses).length, data: { byOfferId: analyses, unreadable: failed } };
  }
  return {
    format: EXPORT_FORMAT, exportedAt: now.toISOString(),
    notes: [
      "This file contains your own records as ORYQEN shows them to you. It is not signed and is not a legal document.",
      "Credential tokens, signing secrets and API keys are not included. Evidence Vault files are not included; download each document from the vault.",
      "Anything marked unavailable could not be read at export time and is not part of this file.",
      "Keep this file private: it can contain personal and employment information.",
    ],
    sections,
  };
}
