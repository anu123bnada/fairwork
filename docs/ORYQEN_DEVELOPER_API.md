# ORYQEN Developer API (module 21)

Status 27 Oct 2026: **one scoped endpoint (credential verification) with key management, per-key rate limits and usage metering, plus
signed webhooks with retries and a delivery log, are built and tested. Further scopes, organization-level keys, a persistent
delivery queue and a published API specification are NOT built.**
Nothing has been published; a hosted deployment needs the owner's approval (migrations 11 and 12 of the pending set).

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

## Webhooks

A signed-in person can register up to three https endpoints of their own (Settings, Developer access). ORYQEN posts a signed JSON
event to each. Events today: `credential.revoked` (sent when the holder revokes one of their credentials) and `ping` (a manual test).
A credential that stops being valid because its source record changed is **not** announced, because that change is computed live rather
than recorded as an event; verifiers see it through the verification endpoint.

```json
{ "id": "<event uuid>", "type": "credential.revoked", "createdAt": "2026-10-27T10:00:00.000Z", "data": { "credentialId": "<uuid>", "reason": "holder_requested" } }
```

Headers: `Oryqen-Signature: t=<unix seconds>,v1=<hex>` where `v1` is HMAC-SHA256 of `<t>.<raw body>` with the endpoint secret;
`Oryqen-Event-Id`; `Oryqen-Event-Type`; `Content-Type: application/json`.

Receiver checklist: recompute the HMAC over the raw body and compare in constant time; reject a timestamp more than 5 minutes
from your clock; remember event ids you have processed and ignore repeats (retries reuse the same id); answer 2xx quickly.

Rules: addresses must be https on port 443 with no credentials and must resolve only to public addresses. The check runs inside the
TLS connection's own DNS lookup, so a name that changes its answer cannot reach a private network, and redirects are never followed.
Delivery makes up to three attempts (immediately, after 1 s, after 5 s) on network errors, 408, 429 and 5xx; other answers are final.
Every attempt is logged and the last one is shown beside the endpoint. The signing secret is shown once at creation, is stored so
ORYQEN can sign deliveries, and is readable only by its owner's session. Delivery is best effort in the background of the revoke request
and is **not** queued across a server restart: a missed event can always be reconstructed through the verification endpoint.

## Not built

A persistent delivery queue with longer retry schedules, more event types, additional scopes, organization-owned keys,
key expiry and rotation reminders, IP allow-lists, an OpenAPI document and a developer portal page, sandbox keys.
