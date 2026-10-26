# ORYQEN verifiable credentials: design and status (module 18)

Status 26 Oct 2026: **implemented and verified against a throwaway test key; no production key exists.**
Core, register, issuing API, public status endpoint, published-key endpoint, QR sharing and the verify page
are built and tested (unit, SQL, browser with real Ed25519 verification, and the real local stack: 161
harness checks). Nothing has been issued to a real person, and nothing can be until the owner supplies a key.

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

## What is built (all verified locally)

1. **Register and status** (`supabase/migrations/20261026140000_credential_register.sql`): `private.credentials`
   (holder, source record and version, content-bound claim reference, token, expiry) and append-only
   `credential_events`; forced RLS; holder-only reads. Registration re-checks, inside the database, that the
   caller is the record's worker, the version is the current verified one, and the claim reference equals the hash
   recomputed from the stored content, so a forged reference is refused. Status is **computed live**:
   revoked by the holder, expired, or `source_changed` when the work record is withdrawn, retracted or
   corrected. `api.credential_status` is the **only** function in the `api` schema anonymous callers may execute
   (a test asserts this); it returns just `status`, `reason`, `checkedAt`. The policy role that powers it reads
   only `work_id, version, state` and `work_id, version, operation` columns, never content or identities.
2. **Issuing API** `POST /api/v1/credentials`: signed-in holder, same-origin, strict body. The server recomputes
   the Trust Chain claim from the authorized record, signs, then registers. Idempotent: a retry returns the stored
   token. Max 50 active credentials per holder. `GET` lists the holder's credentials with live status.
   `POST /api/v1/credentials/revoke` is holder-only (others get NOT_FOUND).
3. **Published keys** `/.well-known/oryqen-keys.json`: public keys only; 404 when signing is not configured so
   verifiers fail closed. A published entry carrying private material is dropped.
4. **Verify page** `/verify#c=<token>`: verifies the signature in the browser against the published keys, then asks
   the status endpoint for only the random credential id. The token stays in the URL fragment and never reaches
   the server (a browser test asserts no request contains it). Results are worded (Valid, Revoked, Expired,
   Cannot confirm, Not verified, Signature valid but status unchecked); a revoked, expired or unknown credential
   is never shown as valid.
5. **Holder UI** (Trust Chain panel): create from a reviewed claim (shorten the statement, choose 30/90/365
   days), QR code and link, list with live status, revoke with confirmation. Offered only for reviewed, active work
   claims; when no key is configured it says so.
6. **Key ceremony** `scripts/generate-credential-key.mjs` for the owner.

## Not built

Employer-side credential views; credentials for offer terms or self-reported claims (refused by design);
audit export of register events; automatic email or push when a credential is revoked by a source change;
key rotation tooling beyond publishing several public keys; an independent status cache.

## Key custody (owner decision, blocking issuance)

The owner has said they will generate and hold the key. No production key exists, and none was created here. Use
`node scripts/generate-credential-key.mjs --kid <id> --out <path outside the repository>`: it writes the private key
where you choose, refuses repository paths and overwrites, and prints only the public key and the variable names.
Procedure: the owner generates an
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
