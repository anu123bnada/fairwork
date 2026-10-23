import { z } from "zod";
import { authContinuationSchema } from "./auth-navigation";
export const recoveryRequestSchema = z.strictObject({ email: z.email().max(254), continuation: authContinuationSchema });
export const recoveryTokenSchema = z.strictObject({ tokenHash: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/) });
export const passwordUpdateSchema = z.strictObject({ password: z.string().min(12).max(128) });
