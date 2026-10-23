import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnvironment } from "@/lib/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getPublicEnvironment();
  if (config) {
    const supabase = createServerClient(config.url, config.key, {
      cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // Refresh only. Each protected handler validates identity again and RPCs
    // authorize against protected rows; this proxy never grants permission.
    await supabase.auth.getClaims();
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/api/v1/me", "/admin/:path*"] };
