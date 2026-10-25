import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import type { Json } from "@/types/database";
import { agreementReadSchema } from "@/features/offer/read-schema";
import { offerListSchema } from "@/features/offer/list-schema";
import { offerHistorySchema } from "@/features/offer/history-schema";

export async function readOfferHistory(request: { offerId: string; beforeVersion: number | null }) {
  const client = await createServerSupabase(true);
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError && (authError.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const { data, error } = await client.rpc("offer_history", { request });
  if (error) throw mapDatabaseError(error);
  const parsed = offerHistorySchema.safeParse(data);
  if (!parsed.success || parsed.data.offerId !== request.offerId) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}

export async function listOffers(request: { context: "WORKER" | "EMPLOYER"; cursor: string | null; view?: "active" | "archived" | "all" }) {
  const client = await createServerSupabase(true);
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError && (authError.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const { data, error } = await client.rpc("list_offers", { request });
  if (error) throw mapDatabaseError(error);
  const parsed = offerListSchema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}

export async function readAgreement(request: { offerId: string }) {
  const client = await createServerSupabase(true);
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError && (authError.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const { data, error } = await client.rpc("get_agreement", { request });
  if (error) throw mapDatabaseError(error);
  const parsed = agreementReadSchema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}

export async function offerCommand(command: "review_offer" | "answer_offer_question" | "confirm_agreement", payload: Json) {
  const client = await createServerSupabase(true);
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError && (authError.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);

  const { data, error } = await client.rpc(command, { payload });
  if (error) throw mapDatabaseError(error);
  return data;
}
