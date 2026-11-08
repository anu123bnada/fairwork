import { z } from "zod";

// CV documents (Smart CV Builder). Everything here is typed by the person and is self-reported: ORYQEN verifies none of it. Verified employment from the Work Passport is
// never stored in a CV; it is read live when the CV is shown (`includeVerifiedWork`). Links must be https. No field is generated or filled by a model.
export const cvTemplates = ["classic", "modern", "compact"] as const;
export const cvDocumentLimit = 20;
const text = (max: number) => z.string().max(max);
const httpsOrEmpty = z.string().max(300).refine(value => value === "" || /^https:\/\/[^\s<>"']+$/.test(value), "Links must start with https://");
export const cvContent = z.strictObject({
  basics: z.strictObject({
    fullName: text(120), headline: text(120), email: text(254), phone: text(40), location: text(120),
    links: z.array(z.strictObject({ label: text(40), url: httpsOrEmpty })).max(5),
  }),
  summary: text(1000),
  education: z.array(z.strictObject({ school: text(120), qualification: text(160), start: text(20), end: text(20), notes: text(300) })).max(10),
  experience: z.array(z.strictObject({ employer: text(120), role: text(120), start: text(20), end: text(20), details: text(600) })).max(15),
  skills: z.array(z.string().min(1).max(40)).max(30),
  projects: z.array(z.strictObject({ name: text(100), description: text(500), link: httpsOrEmpty })).max(10),
  achievements: z.array(z.string().min(1).max(200)).max(15),
  certifications: z.array(z.strictObject({ name: text(120), issuer: text(120), year: text(10) })).max(10),
  references: z.array(z.strictObject({ name: text(120), relationship: text(120), contact: text(200) })).max(3),
  includeVerifiedWork: z.boolean(),
});
export type CvContent = z.infer<typeof cvContent>;
export const emptyCv: CvContent = {
  basics: { fullName: "", headline: "", email: "", phone: "", location: "", links: [] }, summary: "", education: [], experience: [], skills: [],
  projects: [], achievements: [], certifications: [], references: [], includeVerifiedWork: false,
};
export const cvSaveInput = z.strictObject({
  id: z.uuid(), title: z.string().trim().min(1).max(80), template: z.enum(cvTemplates), targetRole: z.string().trim().max(120).nullable(),
  content: cvContent, expectedRevision: z.number().int().min(0),
});
export const cvSaved = z.strictObject({ id: z.uuid(), revision: z.number().int().positive() });
export const cvSummary = z.strictObject({ id: z.uuid(), title: z.string(), template: z.enum(cvTemplates), targetRole: z.string().nullable(), revision: z.number().int().positive(), updatedAt: z.string() });
export const cvList = z.strictObject({ items: z.array(cvSummary).max(cvDocumentLimit), limit: z.literal(cvDocumentLimit) });
export const cvDocument = z.strictObject({ id: z.uuid(), title: z.string(), template: z.enum(cvTemplates), targetRole: z.string().nullable(), content: cvContent, revision: z.number().int().positive(), updatedAt: z.string() });
export const cvDeleteInput = z.strictObject({ id: z.uuid() });
export const cvDeleted = z.strictObject({ id: z.uuid() });
export type CvDocument = z.infer<typeof cvDocument>;
export type CvSummary = z.infer<typeof cvSummary>;
