import { getServerEnvironment } from "@/server/env";
import { isLocalStore, vaultStoreFromEnv } from "@/server/vault/store";
export const dynamic = "force-dynamic";

// ASCII-only fallback name for the plain filename parameter: printable ASCII except quote and backslash.
const asciiName = (name: string) => [...name].map(char => (char >= " " && char <= "~" && char !== '"' && char !== "\\" ? char : "_")).join("");

// Development-only download endpoint for the local disk store. The signed token, not a session, is the capability
// and it expires within a minute. With a hosted store this route answers 404: downloads go to the signed storage URL.
export async function GET(request: Request) {
  const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const store = vaultStoreFromEnv(getServerEnvironment().origin);
  const token = new URL(request.url).searchParams.get("token");
  if (!store || !isLocalStore(store) || !token) return notFound();
  const file = await store.read(token);
  if (!file) return notFound();
  return new Response(new Uint8Array(file.bytes), { headers: {
    "Content-Type": file.mediaType,
    "Content-Disposition": `attachment; filename="${asciiName(file.fileName)}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox; default-src 'none'", "Referrer-Policy": "no-referrer",
  } });
}
