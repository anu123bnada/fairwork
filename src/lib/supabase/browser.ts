"use client";
import { createBrowserClient } from "@supabase/ssr";
import { requirePublicEnvironment } from "@/lib/env";
import type { Database } from "@/types/database";

export function createBrowserSupabase() {
  const { url, key } = requirePublicEnvironment();
  return createBrowserClient<Database>(url, key, { db: { schema: "api" } });
}
