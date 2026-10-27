import { z } from "zod";
import { authContinuationSchema } from "./auth-navigation";
export const recoveryRequestSchema = z.strictObject({ email: z.email().max(254), continuation: authContinuationSchema });
export const recoveryTokenHashSchema = z.string().regex(/^[A-Za-z0-9_-]{32,256}$/);
// Either the documented token_hash, or the tokens a default Supabase recovery or invitation email puts in the link fragment. Bounds and syntax only:
// Supabase, never decoded client claims, decides whether the tokens are genuine.
export const recoveryTokenSchema = z.union([
  z.strictObject({ tokenHash: recoveryTokenHashSchema }),
  z.strictObject({ accessToken: z.string().min(1).max(16384).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/), refreshToken: z.string().min(1).max(4096).regex(/^[A-Za-z0-9_-]+$/), link: z.enum(["recovery", "invite"]) }),
]);
export const passwordUpdateSchema = z.strictObject({ password: z.string().min(12).max(128) });
