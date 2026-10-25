# ORYQEN demonstration guide

All demonstration data is synthetic, labeled `[DEMO]`, self-reported and unverified.
Nothing here is a real employer, person or external verification. Accounts use the
reserved `example.test` domain. No credentials are stored in the repository.

## What the seed creates

`scripts/demo-seed.mjs` (data in `scripts/demo-seed-data.json`) drives the real
registration, local email confirmation, profile, employment-history and private offer
draft APIs of a running **local** stack. It writes no SQL, forges no sessions and grants no
privileges. It refuses any origin other than `127.0.0.1` or `localhost`.

- Demo worker `oryqen-demo-worker@example.test`
- Three employment entries (two past, one current), self-reported
- Two private offer drafts: one with missing pay terms; one with LKR 90,000 monthly pay,
  an unpaid training period, an upfront fee, unpaid overtime and certificate retention

Re-running is safe: fixed idempotency keys replay the same receipts and create no
duplicates. This is covered by `tests/integration/demo-seed-db.test.ts` (against the real
migrations in an in-process PostgreSQL).

## Setup (local)

1. Start Docker Desktop, then follow `docs/ORYQEN_LOCAL_DEVELOPMENT.md`
   (`prepare-local-development.mjs`, `start-local-development.mjs`,
   `run-local-development.mjs`). Registration must be enabled in that local run.
2. Choose your own demo password (12+ characters). It is read from the environment and
   never written or printed:

```powershell
$env:DEMO_PASSWORD = "<your chosen password>"
node scripts/demo-seed.mjs
```

## Presentation path

1. Sign in as the demo worker. Open **Add a job offer**, expand *Private offer drafts*,
   edit the "warning signs" draft and use it as a new offer.
2. Run the rule-based analysis and show the flagged terms and follow-up questions.
   Point out that analysis does not verify the company.
3. Open **Work record**: show the employment timeline marked *Self-reported*; edit an
   entry to show revisions.
4. Show that a second account cannot see these records (covered by tests; use a second
   browser profile with another account to demonstrate live).

## Not seeded, and why

Company profiles, shared agreements, employer-verified work and Work Passport sharing
need approved organization membership and a distinct operator with a verified second
factor. Seeding them would mean bypassing those controls, so they are not faked. The
existing `scripts/test-local-real-workflows.mjs` creates them through real flows with
separate synthetic accounts and keeps its audit history.

## Honest limits

- Verified 25 Oct 2026 on the real local stack (local Supabase, real registration, local
  mail confirmation): the seed registered the demo worker and saved 3 employment entries
  and 2 offer drafts; a second run replayed the same receipts (all revision 1, no
  duplicates); signing in through the browser and opening the work-record screen showed
  the 3 entries labeled self-reported. The browser check covered employment history only;
  the draft screen was not re-inspected after seeding.
- `scripts/prepare-local-development.mjs` pins every migration by hash. The three sprint
  migrations (offer lifecycle, offer drafts, employment history) were added to that pin
  list so the local stack could start; hosted systems were not touched.
- Live Gemini analysis stays off (see `docs/GEMINI_PROCESSING_GATE.md`); the demo uses
  the rule-based baseline.
