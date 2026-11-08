import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { recommendationHistoryAdded, recommendationHistoryDeleted, recommendationHistoryList, type recommendationHistoryAddInput } from "@/features/opportunities/history";
import type { z } from "zod";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
async function call<T>(rpc: Rpc, name: string, request: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await rpc(name, request);
  if (error) throw mapDatabaseError(error);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
export const listRecommendationHistory = (rpc: Rpc) => call(rpc, "recommendation_history_list", {}, recommendationHistoryList);
export const deleteRecommendationHistory = (rpc: Rpc, entryId: string) => call(rpc, "recommendation_history_delete", { entryId }, recommendationHistoryDeleted);
// A retry of the same save sends the same idempotency key, so it replays instead of adding a second entry.
export const addRecommendationHistory = (rpc: Rpc, entry: z.infer<typeof recommendationHistoryAddInput>, idempotencyKey: string) =>
  call(rpc, "recommendation_history_add", { entryId: idempotencyKey, idempotencyKey, ...entry }, recommendationHistoryAdded);
