import {z} from "zod";
export const adminRole=z.enum(["owner","administrator","support","auditor"]);
export const adminResource=z.enum(["dashboard","search","users","organizations","requests","offers","agreements","work","shares","cases","privacy","ai","roles","settings","incidents","evidence_access","audit","telemetry"]);
export const adminQuery=z.strictObject({resource:adminResource.default("dashboard"),cursor:z.uuid().nullable().default(null),search:z.string().trim().max(80).default(""),status:z.string().max(40).default(""),from:z.iso.date(),to:z.iso.date()}).refine(v=>v.to>=v.from&&(Date.parse(v.to)-Date.parse(v.from))/86400000<=92);
const base={targetId:z.uuid(),expectedRevision:z.number().int().min(0).max(999999999),reason:z.string().trim().min(10).max(500)};
export const adminCommand=z.discriminatedUnion("operation",[
 z.strictObject({...base,operation:z.literal("organization_status"),suspended:z.boolean()}),
 z.strictObject({...base,operation:z.literal("role"),role:adminRole.nullable(),expiresAt:z.iso.datetime({offset:true}).nullable()}),
 z.strictObject({...base,operation:z.literal("restrict"),restricted:z.boolean()}),
 z.strictObject({...base,operation:z.literal("setting"),key:z.enum(["announcement","maintenance_notice","notification_template","support_categories","analysis_paused","ai_daily_platform","ai_daily_account","ai_minute_account"]),value:z.union([z.string().max(500),z.boolean(),z.number().int().min(1).max(100)])}),
 z.strictObject({...base,operation:z.literal("incident"),title:z.string().trim().min(3).max(120),category:z.enum(["security","support","moderation"]),status:z.enum(["open","in_review","resolved"]),priority:z.enum(["normal","high","urgent"]),assignedTo:z.uuid().nullable()}),
 z.strictObject({...base,operation:z.literal("case_note"),priority:z.enum(["normal","high","urgent"])}),
 z.strictObject({...base,operation:z.literal("capability"),capability:z.enum(["authority_operator","review_operator","reviewer","privacy_operator"]),expiresAt:z.iso.datetime({offset:true}).nullable(),revoke:z.boolean()}),
]);
export const adminRow=z.strictObject({id:z.uuid(),label:z.string(),status:z.string(),revision:z.number().int(),recordedAt:z.iso.datetime({offset:true}),detail:z.record(z.string(),z.json())});
export const adminOverview=z.strictObject({
 activity:z.array(z.strictObject({id:z.uuid(),label:z.string(),status:z.string(),recordedAt:z.iso.datetime({offset:true}),kind:z.enum(["audit","requests","agreements","work","cases","privacy","incidents"])})).max(20),
 trends:z.array(z.strictObject({date:z.iso.date(),agreements:z.number().int().nonnegative(),workRecords:z.number().int().nonnegative(),casesOpened:z.number().int().nonnegative(),casesResolved:z.number().int().nonnegative()})).max(93),
 alerts:z.array(z.strictObject({kind:z.enum(["organization_review","privacy_review","open_cases","open_incidents"]),count:z.number().int().nonnegative(),href:z.enum(["/admin/requests","/admin/privacy","/admin/cases","/admin/incidents"]),explanation:z.string()})).max(4),
 suspendedOrganizations:z.number().int().nonnegative(),window:z.strictObject({from:z.iso.date(),to:z.iso.date(),timezone:z.literal("UTC")}),
});
export const telemetrySummary=z.strictObject({coverageStartedAt:z.iso.datetime({offset:true}).nullable(),lastEventAt:z.iso.datetime({offset:true}).nullable(),aiAttempts:z.number().int().nonnegative(),aiSucceeded:z.number().int().nonnegative(),aiFailed:z.number().int().nonnegative(),loginFailures:z.number().int().nonnegative(),authorizationDenials:z.number().int().nonnegative(),providerCost:z.null(),availability:z.literal("observed_requests_only"),scope:z.literal("selected_utc_window")});
export const adminResponse=z.strictObject({role:adminRole,items:z.array(adminRow).max(20),nextCursor:z.uuid().nullable(),metrics:z.record(z.string(),z.number().nullable()).nullable(),trend:z.array(z.strictObject({date:z.iso.date(),offers:z.number(),registrations:z.number()})).nullable(),incidentCategories:z.array(z.enum(["security","support","moderation"])).min(1).max(3).optional(),overview:adminOverview.optional(),telemetry:telemetrySummary.optional(),dataMode:z.literal("synthetic")});
export const adminReceipt=z.strictObject({targetId:z.uuid(),revision:z.number().int().positive(),auditId:z.uuid(),operation:z.string()});
export type AdminData=z.infer<typeof adminResponse>;
export type AdminRow=z.infer<typeof adminRow>;
export type AdminResource=z.infer<typeof adminResource>;
export function adminDefaultQuery(resource:AdminResource="dashboard") {const end=new Date();const start=new Date(end);start.setUTCDate(start.getUTCDate()-29);return {resource,cursor:null,search:"",status:"",from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};}
