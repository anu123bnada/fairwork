import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { cvDeleted, cvDocument, cvList, cvSaved, type cvSaveInput } from "@/features/cv/schema";
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
export const listCvs = (rpc: Rpc) => call(rpc, "cv_list", {}, cvList);
export const readCv = (rpc: Rpc, id: string) => call(rpc, "cv_read", { id }, cvDocument);
export const saveCv = (rpc: Rpc, input: z.infer<typeof cvSaveInput>) => call(rpc, "cv_save", input, cvSaved);
export const deleteCv = (rpc: Rpc, id: string) => call(rpc, "cv_delete", { id }, cvDeleted);
