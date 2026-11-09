import { z } from "zod";

// Applications to listings on this platform. The employer side receives only the applicant's display name (at the time of applying) and the message they chose to send.
// Nothing from their CV, Passport, vault or offers is shared by this feature, and nothing here verifies anybody.
export const reviewStatuses = ["reviewing", "shortlisted", "declined"] as const;
export const applicationStatusList = ["submitted", "reviewing", "shortlisted", "declined", "withdrawn"] as const;
const status = z.enum(applicationStatusList);

export const submitInput = z.strictObject({ action: z.literal("submit"), id: z.uuid(), listingId: z.uuid(), message: z.string().trim().max(1000) });
export const reviewInput = z.strictObject({ action: z.literal("review"), id: z.uuid(), status: z.enum(reviewStatuses), expectedRevision: z.number().int().min(1) });
export const withdrawInput = z.strictObject({ action: z.literal("withdraw"), id: z.uuid(), expectedRevision: z.number().int().min(1) });
export const applicationCommand = z.discriminatedUnion("action", [submitInput, reviewInput, withdrawInput]);

export const commandResult = z.strictObject({ id: z.uuid(), revision: z.number().int().positive(), status: z.enum(reviewStatuses).optional() });
export const mineList = z.strictObject({
  items: z.array(z.strictObject({ id: z.uuid(), listingId: z.uuid(), listingTitle: z.string(), message: z.string(), status, revision: z.number().int().positive(), createdAt: z.string(), updatedAt: z.string() })).max(100),
  limit: z.literal(100),
});
export const inbox = z.strictObject({
  listingId: z.uuid(), listingTitle: z.string(),
  items: z.array(z.strictObject({ id: z.uuid(), applicantName: z.string(), message: z.string(), status, revision: z.number().int().positive(), createdAt: z.string() })).max(200),
  limit: z.literal(200),
});
const counts = z.strictObject({ submitted: z.number(), reviewing: z.number(), shortlisted: z.number(), declined: z.number(), withdrawn: z.number() });
export const dashboard = z.strictObject({
  items: z.array(z.strictObject({ listingId: z.uuid(), title: z.string(), status: z.enum(["draft", "published", "closed"]), expiresAt: z.string(), counts })).max(100),
  limit: z.literal(100),
});
export type MineItem = z.infer<typeof mineList>["items"][number];
export type Inbox = z.infer<typeof inbox>;
export type Dashboard = z.infer<typeof dashboard>;
