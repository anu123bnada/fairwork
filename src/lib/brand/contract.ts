import { z } from "zod";

// Only separately supplied, reviewed masters belong here. Legacy Figma artwork
// and the rejected green identity deliberately cannot be configured as masters.
const asset = z.object({
  src: z.string().regex(/^\/oryqen\/approved\/[a-z0-9-]+\.(svg|png)$/),
  width: z.number().int().positive().max(8192),
  height: z.number().int().positive().max(8192),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
const variants = z.object({ light: asset, dark: asset }).strict();
export const brandManifestSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("awaiting-approved-assets"), identity: z.null() }).strict(),
  z.object({
    status: z.literal("approved"),
    identity: z.object({
      approvalReference: z.string().min(10),
      logo: variants,
      mark: variants,
    }).strict(),
  }).strict(),
]);
export type BrandIdentity = NonNullable<z.infer<typeof brandManifestSchema>["identity"]>;
