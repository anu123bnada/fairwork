# ORYQEN security summary

Authoritative detail: `SECURITY.md`, `ORYQEN_SECURITY_REVIEW.md`, `ORYQEN_AUTH_AUDIT.md`, `ORYQEN_TRUST_LEDGER_THREAT_MODEL.md`.

## Controls in place (code-level)
- Supabase Auth with email verification, recovery, MFA for reviewers and admins.
- Row-Level Security enabled on data tables; privileged operations are SECURITY DEFINER functions with empty `search_path`, executable only by authenticated roles.
- Server-side authorization on API routes; a route audit test enumerates them.
- No self-approval: organization and verification requests need an independent approver.
- Origin checks, per-user quotas, input validation with zod, content-sniffed uploads (private bucket, 60 s signed links).
- AI calls are server-side only, consent-gated, redacted, budgeted; user content is not written to the audit trail.
- Append-only audit tables with a global hash chain; admin exports are themselves audited.

## Secrets
Names only (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN`, `GEMINI_API_KEY`, `ORYQEN_CREDENTIAL_SIGNING_KEY`, `ORYQEN_CREDENTIAL_PUBLIC_KEYS`, `ORYQEN_TELEMETRY_DB_URL`. Set them in Vercel/Supabase dashboards, never in git. `.env.local` is git-ignored.

## Honest limitations
- "Tamper-resistant" means append-only plus hash chaining inside one database; it is not blockchain and does not stop a database owner.
- AI output is guidance, not legal advice or verification. Platform case decisions are not legal judgments.
- Passkeys and automated account deletion are not built; deletion requests are reviewed manually.
- Hosted Auth email, Storage and DNS egress are unverified until the owner approves hosted checks.
- Android is a debug-signed preview until the owner authorizes a release key.
