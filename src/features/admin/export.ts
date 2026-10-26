// Export of administrative records (module 10). It pages through exactly what the signed-in administrator is already allowed to read,
// so it can never contain more than the screen could show, and it labels what it is: a copy with a checksum, not a signed or
// tamper-proof document. The checksum lets two copies be compared and lets the holder notice later edits to the file; it does not
// prove the records are authentic, because anyone who can edit the file can also recompute the checksum.
export const ADMIN_EXPORT_FORMAT = "oryqen-admin-records.v1" as const;
export const ADMIN_EXPORT_MAX_PAGES = 20;

export type AdminExportPage<Row> = { items: Row[]; nextCursor: string | null };
export type AdminExport<Row> = {
  format: typeof ADMIN_EXPORT_FORMAT; exportedAt: string; resource: string; filters: Record<string, string>; pagesRead: number; complete: boolean; count: number;
  checksumSha256: string; checksumCovers: "items"; notes: string[]; items: Row[];
};

// Stable JSON: object keys sorted, so the same records always produce the same checksum.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildAdminExport<Row>(input: { resource: string; filters: Record<string, string>; getPage: (cursor: string | null) => Promise<AdminExportPage<Row>>; now: Date; maxPages?: number }): Promise<AdminExport<Row>> {
  const items: Row[] = [];
  let cursor: string | null = null, pages = 0;
  const limit = input.maxPages ?? ADMIN_EXPORT_MAX_PAGES;
  do {
    const page = await input.getPage(cursor);
    items.push(...page.items); pages += 1; cursor = page.nextCursor;
  } while (cursor && pages < limit);
  return {
    format: ADMIN_EXPORT_FORMAT, exportedAt: input.now.toISOString(), resource: input.resource, filters: input.filters, pagesRead: pages, complete: cursor === null, count: items.length,
    checksumSha256: await sha256Hex(canonicalJson(items)), checksumCovers: "items",
    notes: [
      "Metadata only, exactly as the administrator could read it on screen at the time of export.",
      "The checksum covers the items array. It helps compare copies and notice later edits; it is not a signature and does not prove authenticity.",
      cursor === null ? "All matching records were read." : `Only the first ${pages} pages were read; narrow the filters or export again for the rest.`,
    ],
    items,
  };
}
