import "server-only";
import type { FailureKind } from "./failure";

// Per-provider circuit breaker and usage ledger, kept in the memory of the server process. A serverless platform can run several
// instances, so each has its own view; that costs at most a few extra probes and never sends data to a provider that is known to be paused.
// What opens the breaker:
//  - quota: immediately, for the provider's own reset hint (at least 60 s) or 15 minutes when it gave none, so an exhausted quota is not hammered;
//  - configuration or model: immediately for 10 minutes (a rejected key or missing model will not fix itself between requests);
//  - unavailable, network or timeout: after three in a row, for 60 s, doubling up to 10 minutes while probes keep failing.
// Content failures (incomplete, blocked, invalid) belong to one request and never open it.
export type BreakerState = { status: "closed" | "open" | "half_open"; retryAfterSeconds: number; reason: FailureKind | null };
type Entry = { consecutive: number; openUntil: number; reason: FailureKind | null; step: number; probing: boolean };
const TRANSIENT_OPEN_MS = 60_000, TRANSIENT_MAX_MS = 600_000, QUOTA_DEFAULT_MS = 15 * 60_000, QUOTA_MIN_MS = 60_000, CONFIG_OPEN_MS = 600_000, QUOTA_MAX_MS = 24 * 3_600_000;

export class CircuitBreaker {
  private entries = new Map<string, Entry>();
  constructor(private now: () => number = Date.now) {}
  private entry(provider: string) { let value = this.entries.get(provider); if (!value) { value = { consecutive: 0, openUntil: 0, reason: null, step: 0, probing: false }; this.entries.set(provider, value); } return value; }

  // Decides whether a request may go to the provider now. After the pause, exactly one probe request is allowed.
  check(provider: string): BreakerState {
    const entry = this.entry(provider), now = this.now();
    if (entry.openUntil === 0) return { status: "closed", retryAfterSeconds: 0, reason: null };
    if (now < entry.openUntil) return { status: "open", retryAfterSeconds: Math.ceil((entry.openUntil - now) / 1000), reason: entry.reason };
    if (entry.probing) return { status: "open", retryAfterSeconds: 5, reason: entry.reason };
    entry.probing = true;
    return { status: "half_open", retryAfterSeconds: 0, reason: entry.reason };
  }
  // The same answer as check() without taking the single probe slot; used for status screens and for deciding whether to authorize at all.
  peek(provider: string): BreakerState {
    const entry = this.entries.get(provider), now = this.now();
    if (!entry || entry.openUntil === 0) return { status: "closed", retryAfterSeconds: 0, reason: null };
    if (now < entry.openUntil) return { status: "open", retryAfterSeconds: Math.ceil((entry.openUntil - now) / 1000), reason: entry.reason };
    return { status: entry.probing ? "open" : "half_open", retryAfterSeconds: entry.probing ? 5 : 0, reason: entry.reason };
  }
  success(provider: string) { this.entries.set(provider, { consecutive: 0, openUntil: 0, reason: null, step: 0, probing: false }); }
  failure(provider: string, kind: FailureKind, retryAfterSeconds: number | null = null) {
    const entry = this.entry(provider), now = this.now();
    entry.probing = false;
    if (kind === "quota") { entry.reason = kind; entry.openUntil = now + Math.min(QUOTA_MAX_MS, Math.max(QUOTA_MIN_MS, retryAfterSeconds !== null ? retryAfterSeconds * 1000 : QUOTA_DEFAULT_MS)); return; }
    if (kind === "configuration" || kind === "model") { entry.reason = kind; entry.openUntil = now + CONFIG_OPEN_MS; return; }
    if (kind === "unavailable" || kind === "network" || kind === "timeout") {
      entry.consecutive += 1; entry.reason = kind;
      if (entry.consecutive >= 3 || entry.openUntil !== 0) { entry.step += 1; entry.openUntil = now + Math.min(TRANSIENT_MAX_MS, TRANSIENT_OPEN_MS * 2 ** (entry.step - 1)); }
    }
  }
  reset() { this.entries.clear(); }
}

export type UsageSnapshot = { attempts: number; successes: number; failures: Partial<Record<FailureKind, number>>; inputTokens: number; outputTokens: number; windowStartedAt: string };
const DAY_MS = 24 * 3_600_000;

// Daily request and token budgets per provider. A provider over budget is skipped without any request being sent.
export class UsageLedger {
  private windows = new Map<string, { startedAt: number; attempts: number; successes: number; failures: Partial<Record<FailureKind, number>>; inputTokens: number; outputTokens: number }>();
  constructor(private now: () => number = Date.now) {}
  private window(provider: string) {
    const now = this.now(); let value = this.windows.get(provider);
    if (!value || now - value.startedAt >= DAY_MS) { value = { startedAt: now, attempts: 0, successes: 0, failures: {}, inputTokens: 0, outputTokens: 0 }; this.windows.set(provider, value); }
    return value;
  }
  withinBudget(provider: string, budget: { requests: number | null; tokens: number | null }) {
    const window = this.window(provider);
    return (budget.requests === null || window.attempts < budget.requests) && (budget.tokens === null || window.inputTokens + window.outputTokens < budget.tokens);
  }
  attempt(provider: string) { this.window(provider).attempts += 1; }
  success(provider: string, usage: { inputTokens?: number; outputTokens?: number }) { const window = this.window(provider); window.successes += 1; window.inputTokens += usage.inputTokens ?? 0; window.outputTokens += usage.outputTokens ?? 0; }
  failure(provider: string, kind: FailureKind) { const window = this.window(provider); window.failures[kind] = (window.failures[kind] ?? 0) + 1; }
  snapshot(provider: string): UsageSnapshot { const w = this.window(provider); return { attempts: w.attempts, successes: w.successes, failures: { ...w.failures }, inputTokens: w.inputTokens, outputTokens: w.outputTokens, windowStartedAt: new Date(w.startedAt).toISOString() }; }
  reset() { this.windows.clear(); }
}

export const breaker = new CircuitBreaker();
export const ledger = new UsageLedger();
export function resetAiRuntimeState() { breaker.reset(); ledger.reset(); }
