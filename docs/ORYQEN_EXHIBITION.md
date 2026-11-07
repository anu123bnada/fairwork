# ORYQEN exhibition plan (IIT, 10 November 2026)

See also `ORYQEN_DEMO_GUIDE.md`, `DEMO_SCRIPT_14_FEATURES.md`, `scripts/demo-seed.mjs` (synthetic data only).

## Principles
- Use a dedicated demo environment (staging or local), synthetic data, labelled as a demonstration. No production records on exhibition devices.
- Visitors get the demo worker account only; never admin or reviewer credentials. Passwords stay in git-ignored files.
- Every feature shown must be one that works today. Say plainly: AI is guidance not legal advice; deterministic analysis is shown if Gemini is off; Android is a preview build.

## Timeline
- 5 Nov: staging redeployed from the release branch; hosted smoke test run.
- 8 Nov: E2E and real-stack harness run, results recorded in `ORYQEN_TESTING.md`.
- 9 Nov: freeze. Backup staging DB. Rehearse. No code changes after.
- 10 Nov: public run.

## Demo flow (about 8 minutes)
1. Landing and sign-in as demo worker. 2. Paste a synthetic offer, review text, analyze, save. 3. Reopen it after refresh. 4. Company research (GLEIF, with source and timestamp). 5. Agreement versions and comparison. 6. Work record and evidence vault. 7. Work Passport share with QR. 8. Dispute case view. 9. Admin console only as a presenter-run screen.

## Reliability
- Fallback 1: local stack (`node scripts/run-local-development.mjs`, Docker needed) on a laptop; rehearse it.
- Fallback 2: phone hotspot; keep a second device logged in.
- Printed QR code to the staging URL (generate with the `qrcode` dependency).
- If Gemini fails, continue with the deterministic analysis; do not retry on stage.

## Demo account seeding (5 Nov 2026)
`DEMO_PASSWORD` is mandatory and is never stored. If the default demo account (`oryqen-demo-worker@example.test`) already exists with a password nobody remembers, registration returns 200 but no email arrives and sign-in fails with 401. Set `DEMO_EMAIL=oryqen-demo-2@example.test` (any `@example.test` address) to create a fresh account. Local origins only; the script refuses anything else.

## Release freeze (prepared 7 Nov 2026; freeze day 9 Nov)
Freeze candidate: branch `integration/final-release`, commit recorded in `ORYQEN_SESSION_HANDOFF.md` at freeze time. Nothing new is added after the freeze except a fix for a defect found in rehearsal, and every such fix is re-run through the gates below.

### What visitors may be shown (each has evidence in `ORYQEN_TESTING.md`; all local or fixture-based unless stated)
Registration and sign-in with email confirmation; offer paste, review and rules-based analysis (labelled; AI off unless approved); saved offers and revision history; company research (GLEIF, cited); agreements, work records and evidence vault; Work Passport with sharing, revocation, signed JSON and print-to-PDF; verifiable credential check page; disputes; opportunities with saved-listing history; Smart CV Builder (self-reported, verified work read live from the Passport, print to PDF); account security activity; Settings language switch (English, Sinhala, Tamil, German; some screens English only).

### What must NOT be shown or promised
AI Challenge Arena, AI career analysis, AI-written CVs or cover letters, LinkedIn connection, interview simulator, payments or paid plans, organization analytics, a signed Android release, any claim of "verified" for self-reported data, any claim that ORYQEN replaces a lawyer or labour authority. Say "planned" for these, never "available".

### Owner decisions and actions needed before the freeze (none done by the assistant)
1. Approve and apply to **staging** the three pending migrations (security event log, recommendation history, CV documents) after a staging backup (`node scripts/backup-staging-logical.mjs`). Until then staging does not match the code.
2. Approve deploying the freeze commit to staging (Vercel) and running the hosted smoke test tier 2 (`ORYQEN_HOSTED_APPROVAL_REQUEST.md`).
3. Decide AI: off (recommended; the labelled rules-based analysis is shown) or approved for the demo account only.
4. Confirm auth email capacity (see below) and create demo accounts with passwords kept off paper and out of git.
5. Choose who holds the accounts (adult account holder) for hosting, domain and email services.

### Capacity and email: not verified
No load test was run. 10,000 students over two days is not 10,000 simultaneous users, but nothing here proves any concurrency number. Two known limits to check **before** inviting self-registration: (a) the hosted auth service's built-in email sending is heavily rate-limited, so many visitors registering at once may not receive confirmation emails unless a custom SMTP provider is configured; (b) the free tiers of the hosting and database plans have request and storage ceilings. Recommended: visitors use presenter-run devices and a small set of shared synthetic demo accounts; do not collect visitors' real personal data on the day.

### Visitor data statement (to display at the stand)
"This is a demonstration. Please do not enter real personal details. Demo accounts hold synthetic data and are reset after the event. ORYQEN does not use anything you enter to train AI."

### Rollback
- Web: in the hosting dashboard, promote the previous known-good deployment (do not rebuild on the day). Keep its URL written down before the freeze.
- Database: the new migrations are additive (new tables and functions); do not try to undo them on the day. If a migration misbehaves, take the feature offline by rolling the web deployment back; the old code ignores the new tables.
- Data: backup taken on 9 Nov before the freeze; restore only with the owner present.

### Network failure plan
Local-stack fallback on a laptop (Docker, `node scripts/run-local-development.mjs`, port 3100 must be free) with the demo account seeded (`DEMO_EMAIL` and `DEMO_PASSWORD`); phone hotspot; printed QR code to the staging URL; if a page will not load, say so and move to the next prepared screen. Do not retry AI on stage.

### Machine hygiene (learned 5-7 Nov)
Keep several GB of disk and RAM free before any gate run: a full disk stopped work on 6 Nov, and the full E2E failed three times with one different intermittent error each (last: `ERR_INSUFFICIENT_RESOURCES`). Playwright leaves `HeadlessChrome*` folders in the temp directory; clear them between runs. Check what owns a port before stopping it (another project's server uses port 3100 on this machine, which the real-stack harness also needs).

### Freeze checklist (state on 7 Nov)
| Gate | State |
|---|---|
| `tsc`, ESLint, full vitest, `next build` | PASS on the latest code commit (see `ORYQEN_TESTING.md`) |
| Real-stack harness (local Docker, synthetic accounts) | PASS 263/263 |
| Full E2E (isolated, fixture-based) | **NOT PASSING locally**: five runs, none clean (1, 1, 1, 3 and 2 failures, different tests each time; only `android-browser:27` reproduces and it also fails on the pre-CV baseline). Next: run the repo's CI workflow on a clean GitHub runner (needs approval to push), F-47 |
| Hosted smoke tier 1 (anonymous) | PASS 24/0/5 (1 Nov) |
| Hosted smoke tier 2 (signed in) | NOT RUN, needs owner approval |
| Android device run | NOT RUN (emulator did not boot on this RAM) |
| Staging migrations and deployment match the code | NOT DONE, needs owner approval |
| Demo accounts and rehearsal | NOT DONE |
