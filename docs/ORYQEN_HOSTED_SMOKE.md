# Hosted staging smoke-test procedure

Target: https://oryqen-staging.vercel.app only. Never run against production or the `Fairwork` Supabase project.

## Tier 1: anonymous, read-only (no approval needed beyond running it)
```bash
node scripts/verify-hosted-staging.mjs https://oryqen-staging.vercel.app --json
```
It sends GET requests to public pages, private pages and API routes. It creates no account, sends no email, writes nothing and prints no secret. It proves the intended build is deployed and that private screens and APIs fail closed for anonymous visitors. It does not prove sign-in, persistence or AI. Status of the latest run: NOT RUN (no hosted access was requested this session).

## Tier 2: signed-in checks (OWNER APPROVAL REQUIRED)
Needs a staging-only synthetic account, created by the owner, with a password the owner types; the assistant must not enter credentials. Checks, in order:
1. Register, receive the confirmation email, confirm, sign in.
2. Add an offer from pasted synthetic text, analyze (deterministic if AI is off), save, reload, reopen.
3. Sign out, sign in again, confirm the offer persists.
4. Second synthetic account: confirm it cannot see the first account's offer (tenant isolation).
5. Upload a small synthetic PDF to the vault (needs the private bucket `evidence-vault` to exist), download via the signed link.
6. Create a Work Passport share to the second account, then revoke it and confirm access is gone.
Scripts that automate parts: `scripts/hosted-two-account-flow.mjs`, `scripts/verify-vault-storage.mjs`, `scripts/verify-hosted-realtime.mjs`, `scripts/verify-hosted-rendering.mjs`. Read each before running; they write staging data.

## Preconditions
- Vercel build of the release branch deployed (owner approval to push).
- Supabase Auth redirect URLs include the staging origin; `APP_ORIGIN` matches it.
- A database backup exists (`scripts/backup-staging-logical.mjs`).

## Record results
Add one dated row per run to `docs/ORYQEN_TESTING.md`: tier, commit, pass/fail counts, who ran it.
