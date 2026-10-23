import { z } from "zod";
import { authContinuationSchema } from "./auth-navigation";

export const registrationSchema = z.strictObject({ email: z.email().max(254), password: z.string().min(12).max(128), displayName: z.string().trim().min(1).max(80).optional(), continuation: authContinuationSchema });
export const verificationResendSchema = z.strictObject({ email: z.email().max(254), continuation: authContinuationSchema });
export const emailConfirmationSchema = z.strictObject({ tokenHash: z.string().regex(/^[a-fA-F0-9]{32,128}$/) });
