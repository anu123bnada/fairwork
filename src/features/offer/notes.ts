import { z } from "zod";

// Private review notes a worker keeps on one of their own saved offers (module 04). Never shown to the employer, a representative or a reviewer.
export const offerNoteLimits = { maxLength: 1000, maxPerOffer: 50 } as const;
export const offerNoteBody = z.string().trim().min(1).max(offerNoteLimits.maxLength);
export const offerNoteInput = z.strictObject({ noteId: z.uuid(), offerId: z.uuid(), body: offerNoteBody, idempotencyKey: z.uuid() });
export const offerNoteList = z.strictObject({ offerId: z.uuid(), items: z.array(z.strictObject({ noteId: z.uuid(), body: z.string(), createdAt: z.string() })).max(offerNoteLimits.maxPerOffer) });
export const offerNoteAdded = z.strictObject({ noteId: z.uuid(), replayed: z.boolean() });
export const offerNoteDeleted = z.strictObject({ noteId: z.uuid() });
