import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requirePublicEnvironment } from "@/lib/env";
import type { Database } from "@/types/database";
import { getServerEnvironment } from "./env";

export async function createServerSupabase(canWriteCookies = false) {
  return (await buildServerSupabase(canWriteCookies, false)).client;
}

// Callback credentials must pass all checks before any auth cookies are written.
export async function createStagedServerSupabase() {
  return buildServerSupabase(true, true);
}

async function buildServerSupabase(canWriteCookies: boolean, staged: boolean) {
  getServerEnvironment();
  const { url, key } = requirePublicEnvironment();
  const jar = await cookies();
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const client = createServerClient<Database>(url, key, {
    db: { schema: "api" },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Proxy performs refresh for read-only Server Components. Route handlers
        // opt into writes; never swallow a failed cookie mutation there.
        if (canWriteCookies) for (const { name, value, options } of values) {
          if (staged) pending.set(name, { name, value, options });
          else jar.set(name, value, options);
        }
      },
    },
  });
  return { client, commitCookies() {
    for (const { name, value, options } of pending.values()) jar.set(name, value, options);
    pending.clear();
  } };
}
