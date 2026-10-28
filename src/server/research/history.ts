import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { researchHistoryAdded, researchHistoryDeleted, researchHistoryList } from "@/features/research/history";
import type { z } from "zod";
import type { Json } from "@/types/database";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
async function call<T>(rpc: Rpc, name: string, request: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await rpc(name, request);
  if (error) throw mapDatabaseError(error);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
export const listResearchHistory = (rpc: Rpc) => call(rpc, "research_history_list", {}, researchHistoryList);
export const deleteResearchHistory = (rpc: Rpc, entryId: string) => call(rpc, "research_history_delete", { entryId }, researchHistoryDeleted);
export const addResearchHistory = (rpc: Rpc, entry: { queryName: string; queryCountry: string | null; totalMatches: number; topLei: string | null; topName: string | null; topMatch: "exact" | "close" | "partial" | "weak" | "none"; source: string; retrievedAt: string }) => {
  const id = crypto.randomUUID();
  return call(rpc, "research_history_add", { entryId: id, idempotencyKey: id, ...entry }, researchHistoryAdded);
};
export const rpcFor = (client: { rpc: (name: never, args: never) => unknown }): Rpc => async (name, request) => (client.rpc as unknown as (n: string, a: { request: Json }) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>)(name, { request: request as Json });
