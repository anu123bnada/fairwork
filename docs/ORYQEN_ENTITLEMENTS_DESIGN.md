# ORYQEN entitlements and plans (module 22)

Status 26 Oct 2026: **entitlement model, operator assignment and one metered limit are implemented and tested
locally. Billing is not built, and nothing is simulated.** There is no payment provider, price, checkout,
invoice or subscription record anywhere in the code or database.

## Principles

- **Essential worker protections are never gated.** The list is pinned in `src/features/entitlements/catalog.ts`
  (`essentialFeatures`) and by a test: passport, work records, case review, employment history, offer assessment,
  guidance, saved analyses, Trust Chain view, credential verification, privacy requests, language choice.
  `featureAllowed` returns true for them on every plan, for an unknown plan value, and when the plan cannot be read.
- **Fail toward the free plan.** An unrecognised or unreadable plan resolves to `worker_free`. A failure can lower
  a limit; it cannot remove an essential protection or raise a limit.
- **Unknown features are closed.** No non-essential feature flag exists yet, so `featureAllowed` is false for them.
- **No billing claim.** The API returns `billing.available: false`. A plan is an administrative grant.

## Plans (placeholders pending the owner's commercial decision)

| Plan | Active credentials | Notes |
|---|---|---|
| `worker_free` | 10 | Default for everyone |
| `worker_plus` | 50 | Assigned by an operator; not purchasable |

Organization and enterprise plans are **not built**: they need a stable organization subject model and a real
commercial design. The hard database cap of 50 active credentials remains as a backstop.

## What is built

- Migration `20261026160000_plan_entitlements.sql`: append-only `private.plan_assignments` (forced RLS, immutable
  history), `api.entitlement_read` (the caller's own plan) and `api.entitlement_assign` (authority operator with a
  second factor; no self-assignment; idempotent; unknown person returns NOT_FOUND). Five SQL tests pass on PGlite and on
  real PostgreSQL.
- `GET /api/v1/entitlements`: plan, essential features, metered limits and usage, billing unavailable.
- `POST /api/v1/operator/entitlements`: operator assignment (the database enforces the capability).
- Metering: credential issuing checks active credentials against the plan limit; `GET /api/v1/credentials` returns the
  allowance and the credentials panel shows it.

## Not built

Payment provider and billing boundary, invoices and subscription records, organization plans, administrator
interface for assignments (API only), usage metering beyond credentials, plan-change notifications and expiry of an
assignment. A retry of an already-issued credential at the exact limit is refused until one is revoked.

## Owner decisions needed

Real plan names, limits and any pricing; whether any worker protection should ever be paid (the current answer in
code is no); which payment provider, if any; organization plan model.
