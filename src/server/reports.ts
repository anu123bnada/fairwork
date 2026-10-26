import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { reportList, reportQueue, type reportInput, type reviewInput } from "@/features/reports/schema";
import type { z } from "zod";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
async function call<T>(rpc: Rpc, name: string, request: Record<string, unknown>, schema?: z.ZodType<T>): Promise<T> {
  const { data, error } = await rpc(name, request);
  if (error) throw mapDatabaseError(error);
  if (!schema) return data as T;
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
export const createReport = (rpc: Rpc, input: z.infer<typeof reportInput>) => call<{ reportId: string; replayed: boolean }>(rpc, "report_create", input);
export const listReports = (rpc: Rpc) => call(rpc, "report_list", {}, reportList);
export const withdrawReport = (rpc: Rpc, reportId: string) => call(rpc, "report_withdraw", { reportId });
export const reviewQueue = (rpc: Rpc, status: "open" | "closed") => call(rpc, "report_queue", { status }, reportQueue);
export const reviewReport = (rpc: Rpc, input: z.infer<typeof reviewInput>) => call(rpc, "report_review", { reportId: input.reportId, expectedRevision: input.expectedRevision, event: input.event, note: input.note ?? null });
