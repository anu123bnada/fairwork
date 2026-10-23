import {z} from "zod";
export const followupRead=z.strictObject({caseId:z.uuid(),cursor:z.uuid().nullable().default(null)});
export const followupCommand=z.strictObject({caseId:z.uuid(),operation:z.enum(["response","appeal"]),expectedRevision:z.number().int().positive().max(999999999),message:z.string().trim().min(10).max(2000)});
export const followupReceipt=z.strictObject({eventId:z.uuid(),caseId:z.uuid(),linkedCaseId:z.uuid().nullable()});
export const followupPage=z.strictObject({items:z.array(z.strictObject({id:z.uuid(),actorId:z.uuid(),kind:z.enum(["response","appeal"]),message:z.string(),linkedCaseId:z.uuid().nullable(),createdAt:z.iso.datetime({offset:true})})).max(20),nextCursor:z.uuid().nullable(),canRespond:z.boolean(),canAppeal:z.boolean()});
export type FollowupPage=z.infer<typeof followupPage>;
