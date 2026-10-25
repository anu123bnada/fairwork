import "server-only";
import { z } from "zod";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { offerLifecycleRequest, offerLifecycleResult } from "@/features/offer/lifecycle-schema";
export async function updateOfferLifecycle(request: z.infer<typeof offerLifecycleRequest>) {
  const client = await createServerSupabase(true);
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError && (authError.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const { data, error } = await client.rpc("offer_lifecycle", { request });
  if (error) throw mapDatabaseError(error);
  const parsed = offerLifecycleResult.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
