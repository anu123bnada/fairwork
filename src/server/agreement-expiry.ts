import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { expiryList, expiryRead, expirySet } from "@/features/offer/expiry";
import type { z } from "zod";
import type { Json } from "@/types/database";

async function call<T>(name: string, request: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const client = await createServerSupabase(true);
  const { data: identity, error: authError } = await client.auth.getUser();
  if (isAuthServiceUnavailable(authError)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const { data, error } = await (client.rpc as unknown as (n: string, a: { request: Json }) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>)(name, { request: request as Json });
  if (error) throw mapDatabaseError(error);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
export const readExpiry = (agreementId: string) => call("agreement_expiry_read", { agreementId }, expiryRead);
export const setExpiry = (input: { agreementId: string; expectedVersion: number; expiresAt: string }) => call("agreement_expiry_set", input, expirySet);
export const listExpiries = () => call("agreement_expiries", {}, expiryList);
