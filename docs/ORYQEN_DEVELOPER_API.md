# ORYQEN Developer API (module 21)

Status 27 Oct 2026: **one scoped endpoint is built and tested (credential verification), with key management, per-key
rate limits and usage metering. Webhooks, further scopes, organization-level keys and a published API specification are NOT built.**
Nothing has been published; a hosted deployment needs the owner's approval (migration 11 of the pending set).

## What exists

| Piece | Detail |
|---|---|
| Keys | A signed-in person creates up to 5 active keys in Settings, Developer access. Format `oryq_live_<key id>.<secret>`. The full key is shown once. Only the key id and the SHA-256 of the secret are stored. Revocation is immediate and permanent. |
| Scope | `credentials:verify` only. A key never reads or changes any account, record or credential of its owner. It identifies an integrator, not a user session. |
| Endpoint | `POST /api/v1/developer/credentials/verify` with `Authorization: Bearer <key>` and body `{"credential":"<token>"}` |
| Limits | 60 successful checks per minute per key (database-enforced, `429 RATE_LIMITED`), and 120 attempts per minute per caller address (guards against key guessing) |
| Metering | Calls in the last 24 hours per key, visible to the owner |
| Errors | Missing, malformed, wrong, revoked or out-of-scope keys all return the same `401 AUTH_REQUIRED`; the response never says which |

## Verify a credential

```bash
curl -X POST https://<your-oryqen-origin>/api/v1/developer/credentials/verify \
  -H "Authorization: Bearer oryq_live_<id>.<secret>" -H "Content-Type: application/json" \
  -d '{"credential":"<the token from the QR code or link fragment>"}'
```

Response `data`:

- `valid` (boolean), `state` (`valid`, `revoked`, `expired`, `unknown`, or `not_verified` when the signature or format fails), `reason` (for example `holder_requested`, `source_changed`, or a fixed code such as `bad_signature` or `expired`), `checkedAt`.
- When the signature verifies: `credential` with `id`, `statement`, `claimType`, `assurance`, `assuranceAt`, `caveat`, `issuedAt`, `expiresAt`, `issuer`.
  This is exactly what the credential already disclosed to anyone holding it. No account id, record id or reviewer identity is returned.

`valid: true` means: ORYQEN issued this credential, it has not been altered, it has not expired, and its source record still stands.
It does **not** mean the person or employer is trustworthy. Reviewed credentials carry the demo-authority caveat; show it to your users.

## Security notes

- Server to server only. Never put a key in a browser, mobile app or client bundle; there is no cross-origin allowance.
- The status check an anonymous holder can make (`/api/v1/credentials/status`) stays public and unchanged.
- The database function that checks keys is callable without a session (it has to be). It returns only valid/invalid plus scopes, and counts the call. This is the second function exposed to anonymous callers after `credential_status`; a test pins the exact list.

## Not built

Webhooks (signed delivery, retries, replay protection, an endpoint registry), additional scopes, organization-owned keys,
key expiry and rotation reminders, IP allow-lists, an OpenAPI document and a developer portal page, sandbox keys.
