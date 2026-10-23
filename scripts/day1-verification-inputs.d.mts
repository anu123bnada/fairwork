import type { Session } from "@supabase/supabase-js";

export const catalogChecks: readonly string[];
export function validCatalogReport(value: unknown, projectRef: string, nowMs?: number): boolean;
export function expiryWaitPlan(expiresAt: number, nowMs?: number): { expiresAtMs: number; waitUntilMs: number; remainingMs: number };
export function isExpiredJwtResponse(response: unknown): boolean;
export function rpcSurfaceVerdict(response: unknown, catalogVerified: boolean, directRpcVerified: boolean): boolean | null;
export function readSessionWithoutRefresh(projectUrl: string, publishableKey: string, cookies: { name: string; value: string }[]): Promise<Session | null>;
