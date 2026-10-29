# Integration checkpoint (29 Oct 2026)

Local, **unpushed, not deployed**, kept only as a test checkpoint. Do not push or deploy it; integrate again, controlled, when Agent 2 and Agent 3 each declare their branch ready.

| Item | Value |
|---|---|
| Branch | `integration/oryqen-final`, head `0667a69` |
| Base | `6df4790` (the commit deployed to staging; CI run 35 passed) |
| Merge 1 (no fast-forward) | `ab8a127`: Agent 3 `feature/oryqen-qa-parallel` (`d324f38` QA tests and migration 27 file, authored and NOT applied; `52c32bd` QA handoff) |
| Merge 2 (no fast-forward) | `0667a69`: Agent 2 `feature/oryqen-ui-parallel` (`9b24c20` Work Passport summary and timeline; `2b7ff80` agreement picker instead of raw IDs) |
| Conflicts | none |
| Result on this branch | typecheck clean, lint clean, `npm test` 139 files, **913 passed, 17 skipped**; browser suites NOT run |
| Excluded | Agent 2's uncommitted work in its worktree (`case-review.tsx`, `messages.ts`, `day7-cases.spec.ts`, `case-work-select.tsx`), which was not touched or read for integration |
| Migration 27 | `20261029170000_audit_chain_timezone_pin.sql`: pending owner approval; review and rollback in `ORYQEN_MIGRATION_BATCH_6.md`; checked read-only against staging (UTC, 2-link chain verifies ok) but not yet checked against a restored backup |

## Hosted authenticated worker journeys (owner's run, before commit `6df4790`)
Reported by the owner: PASS 13, FAIL 0, NOT RUN 8, run against staging before the latest UI deployment, so this is **not** verification of `6df4790`. Passed: email/password sign-in; session profile access; free plan entitlements; AI reported as not configured; Evidence Vault upload, download and deletion; evidence correction, revocation and reinstatement; private company research history; job discovery and preference persistence; notification feed; credential signing-key configuration; Developer API key creation and revocation; sign-out invalidating the session. Not run: organization-dependent offers, agreements and renewal, evidence attachment revocation, employer verification, dispute reviewer actions, organization approval, recruiter protection. The assistant has not seen the script's raw output.
