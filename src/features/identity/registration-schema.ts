import { z } from "zod";

export const registrationSchema = z.strictObject({ email: z.email().max(254), password: z.string().min(12).max(128) });
export const emailConfirmationSchema = z.strictObject({ tokenHash: z.string().regex(/^[a-fA-F0-9]{32,128}$/) });
