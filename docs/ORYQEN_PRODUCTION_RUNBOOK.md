# ORYQEN production runbook (prepared, not executed)

Status 27 Oct 2026. **Nothing here has been run against a hosted system.** Every step that touches Supabase, Vercel, DNS, a signing key or real-user
AI needs the owner's explicit approval first. This runbook replaces the older `ORYQEN_DEPLOYMENT_CHECKLIST.md` (written when there were
35 migrations); the approval pack with per-migration risk is `ORYQEN_HOSTED_DEPLOYMENT_APPROVAL.md` and the restore drill is
`ORYQEN_BACKUP_RESTORE_EXECUTION.md`.

## 0. Owner decisions that gate everything

1. Which Supabase project and which Vercel project are production (the two Supabase refs seen in this repository's history must be reconciled; do not guess).
2. Approval to apply the twelve pending migrations, in order, with a verified backup first.
3. The credential signing key ceremony (`scripts/generate-credential-key.mjs`), key custody and the production domain (it becomes the credential issuer).
4. The private Storage bucket and its server key for the Evidence Vault.
5. Whether registration opens (`AUTH_REGISTRATION_ENABLED`), after the confirmation email sender and template are approved.
6. Real-user AI: provider terms, region, retention, and a written approval reference. Default stays off.

## 1. Pre-flight on the release commit (no hosted access)

```bash
npm ci
npm run release:verify:full
node scripts/validate-production-config.mjs --env-file=<the production values file kept outside the repository>
node scripts/scan-secrets.mjs
```

Go only if `release:verify:full` shows FAIL 0 and every BLOCKED item is explained and accepted by the owner. `validate-production-config`
prints names and verdicts only. Keep the production values file out of the repository; the repository ignores `.env*` except `.env.example`.

## 2. Backup before any migration

Supabase Free has no point-in-time recovery, so the backup is a logical dump taken by the owner immediately before applying:

```bash
supabase db dump --linked -f backup-pre-oryqen-<date>.sql          # schema and data, stored outside the repository
supabase db dump --linked --data-only -f backup-pre-oryqen-<date>-data.sql
```

Record the location and the SHA-256 of both files, then perform the restore drill from `ORYQEN_BACKUP_RESTORE_EXECUTION.md` into a scratch project at
least once before the first production migration. A backup that has never been restored is not a backup.

## 3. Apply migrations (owner-approved procedure, never `config push`)

Order is the file order in `supabase/migrations`; the approval pack lists the twelve not yet on the hosted project with their risk. The ordering rule: **apply all
migrations first, then deploy the application**; the compatibility migration keeps the older application working in between. After each migration run the matching catalog
script (`scripts/day*-hosted-catalog.sql`) and confirm:

- every private table has row level security enabled and forced;
- `anon` can execute exactly two `api` functions: `credential_status` and `developer_key_check` (query in `tests/integration/developer-keys-db.test.ts`);
- the policy-role grants listed in the approval pack are exactly the reviewed ones.

## 4. Evidence Vault storage

Run `scripts/hosted/vault-storage-setup.sql` in the SQL editor (private bucket, 5 MiB, four file types, no policy for `anon` or `authenticated`). Then, with the server key in the
environment of the shell only:

```bash
node scripts/verify-vault-storage.mjs     # synthetic bytes: private bucket, signed link, anonymous refusal, type limit, cleanup
```

## 5. Secrets and settings

| Name | Where | Who creates it |
|---|---|---|
| `APP_ORIGIN` | Vercel environment (https, no path) | owner |
| `FAIRWORK_DATA_MODE=supabase`, `AUTH_REGISTRATION_ENABLED` | Vercel environment | owner |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel environment (browser-safe) | owner, from the Supabase API settings |
| `ORYQEN_CREDENTIAL_KEY_ID`, `ORYQEN_CREDENTIAL_SIGNING_KEY` (+ `ORYQEN_CREDENTIAL_PUBLIC_KEYS` after a rotation) | Vercel secrets | owner, offline ceremony; private key backed up offline |
| `ORYQEN_VAULT_STORAGE_URL`, `ORYQEN_VAULT_STORAGE_SERVICE_KEY` | Vercel secrets | owner |
| `ORYQEN_TELEMETRY_DB_URL` (role `oryqen_telemetry_writer`) | Vercel secret | owner |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `ORYQEN_AI_*` | Vercel secrets, **only after written AI approval** | owner |
| `NEXT_PUBLIC_WINDOWS_URL`, `NEXT_PUBLIC_APK_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` | Vercel environment | owner, once release hosts exist |

Never set a service-role key for the application, never prefix a secret with `NEXT_PUBLIC_`, never set `ORYQEN_VAULT_LOCAL_DIR` in production. The validator fails on all three.

## 6. Deploy and HTTPS

Deploy from the approved commit through the owner's Vercel project. HTTPS is terminated by Vercel; the application also sends `Strict-Transport-Security`, `X-Content-Type-Options`,
`X-Frame-Options: DENY`, a frame-blocking Content-Security-Policy, `Referrer-Policy: no-referrer` and a restrictive `Permissions-Policy` on every response. Add the production domain to the
Supabase Auth redirect allow-list (only `https://<origin>/auth/confirm` and the recovery callback), set the site URL, and approve the confirmation email template before opening registration.

## 7. Post-deploy verification (all must pass before announcing)

1. `curl -sI https://<origin>/ | grep -i strict-transport` returns the header; `http://` redirects to https.
2. `https://<origin>/.well-known/oryqen-keys.json` returns only public keys (404 if no key is configured, by design).
3. Two controlled accounts run `node scripts/test-hosted-two-accounts.mjs` (worker and approved representative: offer, agreement, work record, verification, Passport, credential, revocation).
4. `/verify#c=<token>` verifies a real credential in the browser and shows it revoked after revocation.
5. `node scripts/verify-vault-storage.mjs` is clean; an upload and download work in the app for a normal account; another account cannot reach the document.
6. Anonymous requests to every `api` function except the two public ones are refused.
7. Windows and Android clients sign in against the production origin (only then enable the download links).

## 8. Monitoring

- Runtime telemetry (`oryqen_telemetry_writer`) records API failures by code without bodies or identities; the administrator dashboard shows the last events. Review it daily for the first week.
- Vercel: enable alerts on function errors and on 5xx rate; Supabase: review the Security Advisor and the auth logs weekly; watch Auth rate limits.
- Credential health: a spike in `/api/v1/credentials/status` 404 or 429 responses suggests probing; a spike in developer-key 401 responses suggests key guessing.
- Gemini: a sustained `RATE_LIMITED` or `UNCONFIGURED` rate means quota or configuration problems; the application degrades to deterministic checks.

## 9. Rollback and kill switches

| Problem | Action | Effect |
|---|---|---|
| Bad application release | Vercel: promote the previous deployment | Immediate. Migrations are additive and the older application keeps working against them |
| A feature misbehaves | Set `AUTH_REGISTRATION_ENABLED=false` / unset `ORYQEN_VAULT_STORAGE_*` (uploads answer 503, existing documents untouched) / unset `ORYQEN_CREDENTIAL_SIGNING_KEY` (no new credentials; existing ones still verify through the published public key) / `ORYQEN_AI_ENABLED=false` | Redeploy or update the environment; no data change |
| Signing key suspected stolen | Remove the key id from `ORYQEN_CREDENTIAL_PUBLIC_KEYS` and the active key; every credential signed by it then fails as `unknown_key`; generate a new key and re-issue | Credentials from that key stop verifying until re-issued |
| A migration caused harm | Prefer a forward-fix migration. If data must be restored: restore from the pre-migration dump into a scratch project, compare, then follow the owner-approved restore plan | Data loss since the dump is possible; decide with the owner |
| A developer key or webhook is abused | Revoke the key (Settings, Developer access) or delete the endpoint; for an account-wide stop use the administrator tools | Immediate |

Last-resort reference for the objects the newest additive migrations created (drop only with the owner's written approval and after a dump; this destroys that data):
`api.entitlement_*`, `private.plan_assignments`; `api.vault_*`, `private.vault_documents`, `private.vault_events`; `api.developer_key_*`, `private.developer_keys`, `private.developer_key_events`,
`private.developer_key_usage`, `private.developer_key_check`; `api.webhook_*`, `private.developer_webhooks`, `private.developer_webhook_deliveries`; `api.credential_*`, `private.credentials`,
`private.credential_events`, `private.credential_status`, `private.credential_source_state`; and the `grant usage on schema api to anon` made by the credential migration.

## 10. Not covered here

Real-user AI activation (needs the privacy approval in `GEMINI_PROCESSING_GATE.md`), Windows and Android signing and store or website distribution (`ORYQEN_RELEASE_SIGNING.md`), billing (none exists), and any DNS change.
