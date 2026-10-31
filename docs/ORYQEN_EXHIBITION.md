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
