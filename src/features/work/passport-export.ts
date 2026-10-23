import { passportSchema } from "./passport-schema";

// Explicit personal-download projection. This creates no recipient access grant.
export function privatePassportExport(input: unknown, exportedAt: string) {
 const passport = passportSchema.parse(input);
 return {
  format: "oryqen-private-passport-page.v1",
  exportedAt,
  notice: "Private personal copy of up to 20 currently eligible records. This is not a signed certificate or a live verification link. Eligibility may change. Downloads cannot be revoked or updated remotely. Keep this file private.",
  moreRecordsAvailable: passport.nextCursor !== null,
  records: passport.entries.map(entry => ({
   role: entry.role, companyName: entry.companyName, periodStart: entry.periodStart,
   periodEnd: entry.periodEnd, hours: entry.hours, summary: entry.summary,
   revision: entry.version, verifiedAt: entry.verifiedAt,
  })),
 };
}

// Re-authorize every page. A partially failed download must never produce a file.
export async function collectPrivatePassportExport(readPage: (cursor: string | null) => Promise<unknown>, exportedAt: string) {
 const records: ReturnType<typeof privatePassportExport>["records"] = [];
 const cursors = new Set<string>(), workIds = new Set<string>();
 let identity: string | undefined, cursor: string | null = null;
 for (let pageNumber = 0; pageNumber < 50; pageNumber++) {
  const page = passportSchema.parse(await readPage(cursor));
  if (!page.passportId) throw new Error("Create your private Passport before downloading.");
  const currentIdentity = JSON.stringify([page.ownerId, page.passportId, page.createdAt, page.policyVersion]);
  identity ??= currentIdentity;
  if (identity !== currentIdentity) throw new Error("Passport changed during download. Reload and retry.");
  for (const entry of page.entries) {
   if (workIds.has(entry.workId)) throw new Error("Passport changed during download. Reload and retry.");
   workIds.add(entry.workId);
  }
  records.push(...privatePassportExport(page, exportedAt).records);
  if (!page.nextCursor) return {
   format: "oryqen-private-passport.v2", exportedAt, moreRecordsAvailable: false,
   notice: "Private personal copy. Each page was authorized when read; this is not an atomic snapshot, signed certificate or live verification link. Eligibility may change during or after download. Downloads cannot be revoked or updated remotely. Keep this file private.",
   records,
  };
  if (cursors.has(page.nextCursor)) throw new Error("Passport pagination did not advance. Reload and retry.");
  cursors.add(page.nextCursor); cursor = page.nextCursor;
 }
 throw new Error("This Passport exceeds the 1,000-record download limit. No partial file was created.");
}
