# ORYQEN security review (25 October 2026)

Scope: code and local database in this repository. This is an engineering review with
local test evidence, not a penetration test, and nothing hosted was inspected this
session. Hosted findings below come from the earlier sprint's read-only staging check
and are marked as such.

## Fixed in this review

- **High: `zod` 4.6.5 memory exhaustion on oversized constrained collections**
  (GHSA-mrhx-c7xc-m3w5). Upgraded to the exact patch 4.6.7. `npm audit --omit=dev` now
  reports 0 vulnerabilities; typecheck, lint and the full suite pass (480 passed,
  17 skipped).

## Controls checked (with evidence)

| Area | Finding | Evidence |
|---|---|---|
| Cross-user access | New private tables (drafts, employment history) use forced RLS keyed to the verified actor; another user lists nothing and cannot write at the actor's revision | `tests/integration/employment-history-db.test.ts`, `offer-drafts-db.test.ts` |
| Direct table access | `authenticated` has no SELECT on the new private tables; only the RPC is executable | same tests (`has_table_privilege` false) |
| Tamper resistance | Revision tables reject UPDATE/DELETE by trigger | same tests |
| Suspended accounts | Denied (`AUTH_REQUIRED`) by `private.is_active()` | same tests |
| Input validation | Strict Zod at the route and again inside the SQL function; forged `verified`, extra fields, bad dates, oversized arrays rejected | API unit tests and SQL tests |
| CSRF / origin | Writes require `Origin` equal to `APP_ORIGIN`; cross-site fetch is refused | `assertSameOrigin`; API tests return 403 |
| Caching | API responses are `private, no-store` | API tests |
| Idempotency | Retries replay one receipt; changed payload under the same key is a conflict | SQL tests, demo seed rerun on the local stack |
| XSS | No `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `src` (grep); React escapes user text | source scan |
| Secrets | `.env*` ignored except `.env.example`; no provider-key patterns in `src`, `scripts`, `supabase`, `docs` (pattern scan; minified vendor assets excluded); AI key only read server-side | source scan, `.gitignore` |
| Security headers | `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, CSP with `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`, `form-action`; restrictive Permissions-Policy | `next.config.ts` |
| AI privacy | External processing is off unless eight settings are present; consent hash binds provider, model, policy and redaction version; offer text is treated as untrusted; quotes and numbers must match the source | `src/server/ai/config.ts`, `provider.ts`, provider safety tests |
| Logging | 5xx logs request id and code only; AI response bodies are not logged | `src/server/http.ts`, provider code |

## Open risks (honest list)

1. **Hosted acceptance absent.** RLS and API behavior are proven only against the local
   in-process and local Supabase databases.
2. **Global CSP has no `script-src`.** It blocks framing and plugins but does not restrict
   scripts; a stricter nonce-based policy needs Next 16 integration testing.
3. **No HSTS set by the app.** Confirm the hosting platform adds it on HTTPS; do not
   assume.
4. **Rate limiting** is the database identity quota (`consume_identity_quota`) plus
   provider budgets. There is no network-level limiter in front of unauthenticated
   routes; use the host or a WAF for sign-in and registration.
5. **`SECURITY DEFINER` surface.** 47 authenticated RPCs on staging (earlier advisor
   result) are intentional entrypoints but need periodic review.
6. **Leaked-password protection** is disabled on staging Auth (owner setting).
7. **AI prompt injection** is mitigated (untrusted-input rules, schema and grounding
   validation) but not eliminated; output is advisory and never changes verification.
8. **Redaction is heuristic**; names in free text may be sent if AI is ever enabled.
9. **Untracked backup file** `src/server/identity.ts.bak` sits in the source tree;
   remove or ignore it before release (left alone because it predates this work).
10. **Corrupted local container config** (NUL bytes) suggests unclean Docker shutdown;
    local only, but back up the volume before reusing it for important demo data.
11. **Local demo password** is stored in git-ignored `.tmp/demo-password.txt` for a
    synthetic `example.test` account on a loopback-only stack; delete it with the demo.
12. **Dependency review is single-pass**: `npm audit` for production dependencies only;
    dev dependencies and transitive install scripts (`tesseract.js` install script
    pending approval) were not reviewed.

## Verdict

No known critical or high defect remains in the reviewed code after the `zod` upgrade.
Release remains blocked by hosted verification and the open items above, not by a known
local exploit.
