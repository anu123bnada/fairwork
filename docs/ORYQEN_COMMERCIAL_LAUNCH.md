# ORYQEN commercial launch readiness

Status as of 6 Nov 2026: **NOT READY for paid customers.** This file lists what exists, what is missing, and what needs an adult or an outside party. It makes no legal or compliance claim.

## What exists
- **Plans and limits (module 22):** an entitlement catalog with essential worker protections that are never gated (`src/features/entitlements/catalog.ts`), `worker_free` and `worker_plus` plans assigned by an operator, organization plans (basic 5 / team 50 live opportunities) and metering for credentials. The API says `billing.available: false`. Nothing can be bought.
- **Account safety:** email confirmation, recovery, TOTP MFA, forced row-level security, a self-service data download, a deactivation flow (not an erasure), a privacy-request flow reviewed by an operator, a retention statement in Settings, and a per-account security activity log.
- **Abuse handling:** private user reporting for listings and recruiters with reviewer triage; rate limits and quotas; upload limits; vault file validation.
- **Public pages with some legal text:** `/about` and `/sign-in/information` exist. There is **no full Terms of Service or Privacy Policy page** in the product yet.

## What is missing before real customers
| Area | Gap |
|---|---|
| Terms and privacy | A Terms of Service and a Privacy Policy written or reviewed by a qualified person for the countries served (Sri Lanka's data protection law, and others if users come from elsewhere). Do not copy a template and claim compliance. |
| Payments | No payment provider, invoices, receipts, tax handling or refunds. Nothing is built, and nothing should be collected until the provider and legal requirements below are met. |
| Support | No support inbox, ticket flow or response policy. |
| Account deletion | Deactivation exists; erasing append-only records is deliberately a reviewed manual step. A deletion policy and procedure need to be decided. |
| Monitoring and backup | Telemetry exists locally; hosted error monitoring, uptime checks, and a tested backup-restore drill for the production database are not set up (a logical backup script exists for staging). |
| Hosting costs | Not estimated. Supabase, Vercel, AI usage and email each have free-tier limits and paid tiers; see Costs below. |
| Android | Debug-signed preview only; a signed release needs the owner's keystore (see `ORYQEN_ANDROID.md`). |

## Accounts and services that need an adult account holder
Services that need an adult account holder, legal guardian or registered business (to be confirmed with each provider's current terms, not assumed):
- A payment processor account (and any bank account that receives money).
- Apple or Google developer accounts for publishing apps; domain registration; paid hosting plans.
- A LinkedIn developer application tied to a LinkedIn Page (`ORYQEN_LINKEDIN.md`).
- Signing the Terms of Service and Privacy Policy as the operator, and being the legal "data controller" for users' personal data.
- Business registration and tax obligations once money is received.
A parent or guardian, or a registered company with an adult director, should hold these accounts and approve spending. The code and brand can stay with the project owner; who holds each account is a separate decision.

## Costs to estimate with real numbers before charging anyone
Hosting (Vercel plan), database and storage (Supabase plan, backups, egress), AI provider usage (per-token cost times expected use; the free tier ran out of quota in testing), transactional email, domain, error monitoring, app-store fees, and payment-processor fees. None of these were purchased or activated.

## Suggested launch order (all need owner approval)
1. **Exhibition (9-10 Nov):** free, synthetic demonstration accounts, honest "demonstration" labelling, no payments, AI off or limited to approved demo use (`ORYQEN_EXHIBITION.md`).
2. **Controlled pilot:** invite-only schools and employers on the free plan, a reviewed Terms and Privacy Policy, a support email, a backup drill.
3. **Paid plans:** only after an adult account holder, a payment provider, tax advice and the legal text are in place. Keep essential worker protections free, as the code already enforces.
