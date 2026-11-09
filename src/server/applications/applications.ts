import "server-only";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { applicationCommand, commandResult, dashboard, inbox, mineList } from "@/features/applications/schema";
import type { z } from "zod";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
async function call<T>(rpc: Rpc, name: string, request: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await rpc(name, request);
  if (error) throw mapDatabaseError(error);
  // Stored rows are parsed again on the way out, so anything that no longer fits fails closed instead of reaching the page.
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
export const myApplications = (rpc: Rpc) => call(rpc, "application_mine", {}, mineList);
export const listingDashboard = (rpc: Rpc) => call(rpc, "application_dashboard", {}, dashboard);
export const listingInbox = (rpc: Rpc, listingId: string) => call(rpc, "application_inbox", { listingId }, inbox);
export function runApplicationCommand(rpc: Rpc, command: z.infer<typeof applicationCommand>) {
  if (command.action === "submit") return call(rpc, "application_submit", { id: command.id, listingId: command.listingId, message: command.message }, commandResult);
  if (command.action === "review") return call(rpc, "application_review", { id: command.id, status: command.status, expectedRevision: command.expectedRevision }, commandResult);
  return call(rpc, "application_withdraw", { id: command.id, expectedRevision: command.expectedRevision }, commandResult);
}
