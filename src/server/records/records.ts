import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { recordDeleted, recordDocument, recordList, recordSaved, type recordSaveInput } from "@/features/records/schema";
import type { z } from "zod";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
async function call<T>(rpc: Rpc, name: string, request: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await rpc(name, request);
  if (error) throw mapDatabaseError(error);
  // Stored content is parsed again on the way out, so a row that no longer fits the strict schema fails closed instead of reaching the page.
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
export const listRecords = (rpc: Rpc, kind: "application" | "project") => call(rpc, "personal_record_list", { kind }, recordList);
export const readRecord = (rpc: Rpc, id: string) => call(rpc, "personal_record_read", { id }, recordDocument);
export const saveRecord = (rpc: Rpc, input: z.infer<typeof recordSaveInput>) => call(rpc, "personal_record_save", input, recordSaved);
export const deleteRecord = (rpc: Rpc, id: string) => call(rpc, "personal_record_delete", { id }, recordDeleted);
