import { z } from "zod";
const eventKey=z.string().min(1).max(100);
export const notificationCursor=z.strictObject({cursorAt:z.iso.datetime({offset:true}).nullable().default(null),cursorKey:eventKey.nullable().default(null)}).refine(v=>(v.cursorAt===null)===(v.cursorKey===null));
export const notificationRead=z.strictObject({eventKey});
export const notificationReceipt=z.strictObject({eventKey,read:z.literal(true)});
export const notificationList=z.strictObject({items:z.array(z.strictObject({eventKey,kind:z.enum(["offer_revision","organization_decision","agreement_decision","work_decision","work_integrity","case_followup"]),title:z.string(),message:z.string().max(5000).optional(),href:z.string().regex(/^\/app\/(employer|cases\?caseId=[0-9a-f-]{36}|agreement\?offerId=[0-9a-f-]{36}|agreement-workflow\?workflowId=[0-9a-f-]{36}|work-record\?workId=[0-9a-f-]{36})$/),recordedAt:z.iso.datetime({offset:true}),read:z.boolean()})).max(20),nextCursor:notificationCursor.nullable()});
export type Notifications=z.infer<typeof notificationList>;
