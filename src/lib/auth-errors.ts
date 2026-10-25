// Supabase Auth uses status 0 for transport failures. Do not mistake an
// unavailable provider for rejected credentials or a successful email request.
export function isAuthServiceUnavailable(error: { status?: number; name?: string } | null | undefined): boolean {
  return Boolean(error && (error.status === 0 || (error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError"));
}
