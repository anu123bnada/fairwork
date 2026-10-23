import { z } from "zod";
import { AppError } from "./errors";

type PublicInput = { url?: string; key?: string };
function isPublishableKey(key: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  // Local/legacy anon keys are public too. Decode only to reject secret roles;
  // this is configuration validation, never session/JWT authentication.
  try {
    const payload = key.split(".")[1];
    return key.split(".").length === 3 && payload !== undefined &&
      JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role === "anon";
  } catch { return false; }
}
export function readPublicEnvironment(input: PublicInput) {
  if (!input.url && !input.key) return null;
  const schema = z.object({
    url: z.url().refine(value => {
      const u = new URL(value);
      return !u.username && !u.password && u.pathname === "/" && !u.search && !u.hash &&
        (u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname)));
    }),
    key: z.string().min(16).refine(isPublishableKey),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
export function getPublicEnvironment() {
  return readPublicEnvironment({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
}
export function requirePublicEnvironment() {
  const config = getPublicEnvironment();
  if (!config) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return config;
}

export function validateServerEnvironment(input: { origin?: string; dataMode?: string }) {
  try {
    const url = new URL(input.origin ?? "http://localhost:3000");
    if (url.origin !== (input.origin ?? "http://localhost:3000") ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) ||
      (input.dataMode ?? "synthetic") !== "synthetic") throw new Error();
    return { origin: url.origin, dataMode: "synthetic" as const };
  } catch { throw new AppError("SERVICE_UNAVAILABLE", 503); }
}
