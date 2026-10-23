import { z } from "zod";
export const shareField = z.enum(["task_summary","observation_date","evidence_kind","confirmation_method","authority_assurance","verification_status"]);
const fields = z.array(shareField).min(1).max(6).refine(items=>new Set(items).size===items.length);
export const shareCommand = z.discriminatedUnion("operation",[
 z.strictObject({operation:z.literal("select"),itemId:z.uuid(),workId:z.uuid(),workVersion:z.number().int().positive(),summary:z.string().trim().min(1).max(240),fields}),
 z.strictObject({operation:z.literal("prepare"),grantId:z.uuid(),itemId:z.uuid(),recipientId:z.uuid(),expiresAt:z.iso.datetime({offset:true}),fields}),
 z.strictObject({operation:z.literal("activate"),grantId:z.uuid()}),
 z.strictObject({operation:z.literal("revoke"),grantId:z.uuid()}),
 z.strictObject({operation:z.literal("remove"),itemId:z.uuid()}),
 z.strictObject({operation:z.literal("remove_field"),itemId:z.uuid(),field:shareField}),
]);
export const shareQuery=z.union([z.strictObject({grantId:z.uuid(),mode:z.enum(["preview","recipient"])}),z.strictObject({cursor:z.uuid().nullable().default(null)})]);
export const shareReceipt=z.strictObject({itemId:z.uuid(),grantId:z.uuid().nullable(),operation:z.enum(["select","prepare","activate","revoke","remove","remove_field"])});
export const projectionEntry=z.strictObject({task_summary:z.string().max(240).optional(),observation_date:z.iso.date().optional(),evidence_kind:z.literal("confirmed_work").optional(),confirmation_method:z.literal("independent_account_confirmation").optional(),authority_assurance:z.literal("synthetic_demo_authority_not_legal_verification").optional(),verification_status:z.literal("currently_eligible").optional()});
export const shareProjection=z.strictObject({projectionVersion:z.literal("passport.v1"),grantId:z.uuid(),expiresAt:z.iso.datetime({offset:true}),active:z.boolean(),entries:z.array(projectionEntry).max(1)});
export const shareList=z.strictObject({items:z.array(z.strictObject({grantId:z.uuid(),itemId:z.uuid().nullable(),recipientId:z.uuid().nullable(),owner:z.boolean(),active:z.boolean(),revoked:z.boolean(),expiresAt:z.iso.datetime({offset:true})})).max(20),nextCursor:z.uuid().nullable()});
