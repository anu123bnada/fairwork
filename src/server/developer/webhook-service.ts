import "server-only";
import { z } from "zod";
import { buildEvent, deliver, type AttemptResult, type Transport, type WebhookEvent } from "./webhook";
import { webhookTargets } from "@/features/developer/schema";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
type Options = { transport?: Transport; sleep?: (ms: number) => Promise<void>; delays?: readonly number[]; now?: () => Date };

async function targetsFor(rpc: Rpc) {
  const { data, error } = await rpc("webhook_targets", {});
  if (error) return [];
  const parsed = webhookTargets.safeParse(data);
  return parsed.success ? parsed.data.items : [];
}

async function send(rpc: Rpc, target: { webhookId: string; url: string; secret: string }, event: WebhookEvent, options: Options): Promise<AttemptResult[]> {
  try {
    return await deliver({
      url: target.url, secret: target.secret, event, ...options,
      onAttempt: async result => { await rpc("webhook_log", { webhookId: target.webhookId, eventId: event.id, eventType: event.type, attempt: result.attempt, outcome: result.outcome, statusCode: result.statusCode }).catch(() => undefined); },
    });
  } catch { return [{ attempt: 1, outcome: "failed", statusCode: null }]; } // an address that fails validation is a failed delivery, never a request
}

// Sends one event to every endpoint the caller registered. Never throws: webhooks must not break the action that caused them.
export async function notifyOwner(rpc: Rpc, type: WebhookEvent["type"], data: Record<string, unknown>, options: Options = {}) {
  const event = buildEvent(type, data, (options.now ?? (() => new Date()))());
  const targets = await targetsFor(rpc).catch(() => []);
  const results = await Promise.all(targets.map(async target => ({ webhookId: target.webhookId, attempts: await send(rpc, target, event, options) })));
  return { eventId: event.id, results };
}

// A single immediate ping to one endpoint, so the owner can see whether it answers.
export async function pingEndpoint(rpc: Rpc, webhookId: string, options: Options = {}) {
  const target = (await targetsFor(rpc)).find(item => item.webhookId === webhookId);
  if (!target) return null;
  const event = buildEvent("ping", { message: "This is a test event from ORYQEN." }, (options.now ?? (() => new Date()))());
  const attempts = await send(rpc, target, event, { ...options, delays: [0] });
  return { eventId: event.id, attempt: attempts[attempts.length - 1]! };
}

export const pingRequest = z.strictObject({ webhookId: z.uuid() });
