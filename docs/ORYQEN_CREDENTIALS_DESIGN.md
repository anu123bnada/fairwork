# ORYQEN verifiable credentials: design and status (module 18)

Status 26 Oct 2026: **core implemented and tested; issuance, status, verification pages and QR are
designed but not built; no signing key exists.** Nothing here is issued to anyone.

## What a credential says (and does not)

A credential is a compact signed token stating: *ORYQEN's records showed this claim, backed by this
assurance, at this time.* It never says an employer or person is trustworthy, honest or legally verified.

- Source of truth is the Trust Chain (`docs/ORYQEN_MASTER_DELIVERY_TRACKER.md`). Only claims whose
  assurance is `independently_reviewed` (an approved employer representative reviewed the exact record)
  or `counterparty_acknowledged`, and whose validity is `active`, are eligible. Self-reported, unreviewed,
  disputed, rejected, withdrawn, retracted, superseded, draft and pending claims are refused
  (`credentialEligibility`, enforced inside `issueCredential` and again by the verifier's payload schema).
- A `independently_reviewed` credential **must carry the demo-authority caveat** (the reviewer's
  organization was approved under `demo-authority.v1`; ORYQEN has not verified a real employer identity).
  A token without it fails verification as `invalid_payload`. When real employer verification exists the
  caveat requirement is changed deliberately, in code and tests.
- Offer terms are not issued as credentials.

## Format

JWS compact serialization, algorithm **EdDSA (Ed25519)** only, header `typ: oryqen+jwt`, `kid`.
Library: `jose` 6.2.13 (MIT; no custom cryptography). This is JWT-based and VC-like in spirit; **it is not
claimed to conform to W3C Verifiable Credentials or SD-JWT VC** and should not be described that way.

Payload (strict schema, `src/features/credentials/core.ts`): `iss`, `jti` (credential id), `sub` (random per
credential, never the account id or the source record id, so credentials cannot be linked by subject), `iat`,
`nbf`, `exp` (at most 365 days), `vct = oryqen.work-claim.v1`, `claim {type, statement, assurance,
assuranceAt, claimRef, caveat}`, `status {type, url}`. Measured size of a sample: 1,100 bytes (limit enforced
at 4,096; QR-friendly under 1,800).

Minimal disclosure: the holder may disclose a *shorter statement that is a substring of the verified claim*;
invented text is refused. Employer names are included only if they are part of the disclosed text.

## Verification rules (implemented)

`verifyCredential` rejects, with a fixed reason code and no echo of input: malformed or oversized input;
any algorithm other than EdDSA and any other `typ` (blocks `none` and HS256-with-public-key confusion);
unknown `kid`; bad signature (tampered payload, swapped signature, wrong key); wrong issuer; expired;
not yet valid; revoked (against a supplied list); and correctly signed payloads that break the schema
(self-reported assurance, missing caveat, lifetime over a year, extra fields). 11 tests cover these.

## Not built yet (design)

1. **Register and status.** Table `private.credentials(jti, holder_id, source_kind, source_id, source_version,
   claim_ref, issued_at, expires_at, revoked_at, revoked_reason, revoked_by)`: append-only events, forced RLS,
   holder-only reads, issuance only through an RPC that re-reads the live claim. A public status
   endpoint answers `valid | revoked | expired | unknown` for a `jti` (random UUID, unguessable, rate-limited).
   Status is **computed live from the source record**: a retraction, withdrawal or correction of the work
   record revokes the credential automatically, so a revoked claim cannot keep verifying.
2. **Issuance API.** `POST /api/v1/credentials` for the signed-in holder: server recomputes the Trust Chain
   claim (never trusts client data), checks eligibility, signs, stores the register row, returns the token and
   the verify link. Idempotent. Quota-limited.
3. **Verification page and QR.** The QR encodes `https://<origin>/verify#c=<token>`. The token sits in the URL
   *fragment*, so it never reaches server logs. The page verifies in the browser against
   `/.well-known/oryqen-keys.json` and asks the status endpoint only for the `jti`. It displays assurance in
   words, the caveat, issue and expiry dates, and what the credential does not prove.
4. **Holder controls.** List and revoke own credentials; revocation is immediate through status.
5. **Audit.** Issue and revoke events recorded with actor and time in the register's event table.

## Key custody (owner decision, blocking issuance)

No key exists. `generateSigningKey` is a test and ceremony helper. Proposed procedure: the owner generates an
Ed25519 key offline, stores the private JWK in a password manager with an offline backup, and gives the
application only `ORYQEN_CREDENTIAL_SIGNING_KEY` (JWK) and `ORYQEN_CREDENTIAL_KEY_ID` as hosting secrets;
public keys are published via `ORYQEN_CREDENTIAL_PUBLIC_KEYS`. Rotation: add a new `kid`, keep old public keys
until their credentials expire. Compromise: remove the `kid` (all its credentials then fail as `unknown_key`),
rotate, re-issue. A managed KMS/HSM is the better long-term home; the signer is isolated for that swap.

## Threat model (summary)

| Threat | Control |
|---|---|
| Forged or altered credential | Ed25519 signature, pinned algorithm, strict schema |
| Algorithm confusion (`none`, HS256) | Header allow-list, tested |
| Self-reported claim presented as verified | Ineligible at issue; `assurance` enum excludes it; verifier schema rejects it |
| Stale credential after the record changed | Live status from the source record; short lifetimes |
| Linking or tracking a person | Random `sub`, no account or record ids, minimal disclosure, token in URL fragment |
| Key theft | Secret store, rotation by `kid`, KMS path; theft means ORYQEN credentials cannot be trusted until rotated |
| Overclaiming trust | Mandatory caveat, wording limits, no score |

## Limits

A credential is only as strong as ORYQEN's own records and its approval policy. Today that policy is the
demo authority, so credentials prove "ORYQEN's records show a representative approved under that policy
reviewed this", not that a real company stands behind it. Public-registry facts (for example a GLEIF
record) are separate evidence and are not folded into a credential.

## Owner decisions needed

Signing-key custody and ceremony; the issuer URL and production domain; whether to build issuance before
real employer verification replaces the demo authority; credential lifetime defaults.
