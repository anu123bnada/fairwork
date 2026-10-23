import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requirePublicEnvironment } from "@/lib/env";
import type { Database } from "@/types/database";
import { getServerEnvironment } from "./env";

export async function createServerSupabase(canWriteCookies = false) {
  getServerEnvironment();
  const { url, key } = requirePublicEnvironment();
  const jar = await cookies();
  return createServerClient<Database>(url, key, {
    db: { schema: "api" },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        // Proxy performs refresh for read-only Server Components. Route handlers
        // opt into writes; never swallow a failed cookie mutation there.
        if (canWriteCookies) for (const { name, value, options } of values) jar.set(name, value, options);
      },
    },
  });
}
