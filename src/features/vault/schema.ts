import { z } from "zod";

// Evidence Vault (module 6, docs/ORYQEN_VAULT_DESIGN.md). Private documents a person keeps as supporting evidence:
// certificates, letters, payslips, contracts. Files are private to their owner, are never rendered inline by the
// application, and are not scanned for malware (see the design note); only the listed types are accepted.
export const vaultLimits = { maxBytes: 5 * 1024 * 1024, maxDocuments: 50 } as const;
export const vaultCategories = ["certificate", "letter", "payslip", "contract", "other"] as const;
export type VaultCategory = (typeof vaultCategories)[number];

export const vaultMediaTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export type VaultMediaType = (typeof vaultMediaTypes)[number];
const extensions: Record<VaultMediaType, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export const vaultDocument = z.strictObject({
  documentId: z.uuid(), title: z.string(), category: z.enum(vaultCategories), fileName: z.string(), mediaType: z.enum(vaultMediaTypes),
  byteSize: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/), createdAt: z.string(),
});
export type VaultDocument = z.infer<typeof vaultDocument>;
export const vaultListResponse = z.strictObject({ items: z.array(vaultDocument).max(vaultLimits.maxDocuments), limit: z.number().int(), used: z.number().int() });
export const vaultAttachment = vaultDocument.omit({ createdAt: true }).extend({ attachedAt: z.string() });
export const vaultAttachments = z.strictObject({ workId: z.uuid(), items: z.array(vaultAttachment).max(10) });
export const vaultAttached = z.strictObject({ documentId: z.uuid(), workId: z.uuid(), replayed: z.boolean().optional() });
export const vaultOfferAttachments = z.strictObject({ offerId: z.uuid(), items: z.array(vaultAttachment).max(10) });
export const vaultOfferAttached = z.strictObject({ documentId: z.uuid(), offerId: z.uuid(), replayed: z.boolean().optional() });
export const vaultRegistered = z.strictObject({ documentId: z.uuid(), replayed: z.boolean() });
export const vaultDeleted = z.strictObject({ documentId: z.uuid(), storageKey: z.string() });
export const vaultFetched = z.strictObject({ documentId: z.uuid(), storageKey: z.string(), fileName: z.string(), mediaType: z.enum(vaultMediaTypes) });

export const vaultUploadFields = z.strictObject({
  title: z.string().trim().min(1).max(120),
  category: z.enum(vaultCategories),
  idempotencyKey: z.uuid(),
});

// Identify the real type from the first bytes, so a renamed executable or a wrong declared type is refused.
export function sniffMediaType(bytes: Uint8Array): VaultMediaType | null {
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp"; // RIFF....WEBP
  return null;
}

// A safe display and download name: no path parts, control characters or markup, always ending in the verified extension.
export function safeFileName(declared: string, mediaType: VaultMediaType): string {
  const base = declared.normalize("NFKC").replace(/^.*[\\/]/, "").replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[^\p{L}\p{M}\p{N} ._()-]+/gu, "").replace(/\s+/g, " ").replace(/^[. ]+|[. ]+$/g, "").slice(0, 80);
  return `${base || "document"}.${extensions[mediaType]}`;
}

export type VaultFileCheck = { ok: true; mediaType: VaultMediaType; fileName: string } | { ok: false; reason: "empty" | "too_large" | "unsupported_type" | "type_mismatch" };
export function checkVaultFile(bytes: Uint8Array, declaredType: string, declaredName: string): VaultFileCheck {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength > vaultLimits.maxBytes) return { ok: false, reason: "too_large" };
  const real = sniffMediaType(bytes);
  if (!real) return { ok: false, reason: "unsupported_type" };
  if (declaredType && declaredType !== real) return { ok: false, reason: "type_mismatch" };
  return { ok: true, mediaType: real, fileName: safeFileName(declaredName, real) };
}
