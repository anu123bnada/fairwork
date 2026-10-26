# ORYQEN Evidence Vault: design and status (module 6)

Status 27 Oct 2026: **implemented and verified locally with a local disk store; the hosted Supabase Storage path is
written and unit-tested against a fake HTTP layer but NOT verified against real hosted Storage** (the local Supabase
stack has no Storage service, and nothing hosted may be touched without approval).

## What it is

Private documents a person keeps as supporting evidence: certificates, letters, payslips, contracts. Only the owner can
list, download or delete them. Nothing is shared with employers, reviewers or operators from the vault, and documents are
not yet attached to work records or Passport claims (a later, deliberate step).

## Rules

- Allowed types: PDF, PNG, JPEG, WebP, identified by their first bytes, not the file name or declared type. A mismatch,
  an executable, HTML or an unknown type is refused (415). Empty files are refused. Maximum 5 MB per file (413), 50 documents
  per person. The stored name is cleaned (no path parts, markup or control characters) and always carries the verified extension.
- Metadata lives in PostgreSQL (`private.vault_documents`, forced RLS, owner-only). The storage key is forced by a table check to
  be `<owner id>/<document id>`, so a caller cannot register a key pointing at someone else's file.
- Deleting a document deletes its row (title and file name are personal data) and leaves an append-only audit event with only the
  id, checksum and size. Then the stored file is removed; if storage is unreachable the API says `fileRemoved: false` honestly.
- Upload order: register metadata (database authorises, limits, deduplicates), then store bytes; a failed store rolls back a fresh
  registration. The document id is the client's idempotency key, so a retry addresses the same object.
- Downloads: after the database authorises the owner, the server returns a signed URL valid for 60 seconds. Files are never rendered
  inside ORYQEN; the local store serves `Content-Disposition: attachment`, `nosniff`, `no-store` and a sandboxing CSP.

## Storage

| Store | Used when | Notes |
|---|---|---|
| Supabase Storage | `ORYQEN_VAULT_STORAGE_URL` (https) and `ORYQEN_VAULT_STORAGE_SERVICE_KEY` are set | Private bucket (`ORYQEN_VAULT_BUCKET`, default `evidence-vault`). Server-only secret, never sent to browsers. Bucket must be created private with no public or authenticated-role policies |
| Local disk | `ORYQEN_VAULT_LOCAL_DIR` is set **and** the app origin is loopback | Development and tests only; refused on any non-loopback origin |
| None | otherwise | Uploads return 503 and the screen says storage is not set up |

## Not built, and known limits

- **No malware scanning.** The screen and docs say so. Mitigations: type and size checks, attachment-only downloads, never inline.
- Hosted Storage not verified end to end; sharing a document with a named person, attaching it to a work record or dispute, bulk export,
  and an orphan-file reconciliation job (a crash between steps can leave a stored file with no row, or a row whose file removal failed).
- Per-file limit of 5 MB; no resumable uploads; no OCR or content extraction.

## Owner actions before hosted use

Create the private bucket, set the two server secrets, approve applying the migration (`20261027100000_evidence_vault`), then run
`scripts/verify-vault-storage.mjs` (to be added with the hosted approval) against the hosted project.
