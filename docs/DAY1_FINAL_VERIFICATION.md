# Day 1 final verification — 2026-10-09

The reviewed RPC repair is now applied to the linked hosted project. The user's instruction to finish Day 1 authorized this bounded repair. No commit, push, database reset, manual migration-history repair or Day 2 work was performed.

## Confirmed results

| Check | Result |
|---|---|
| Hosted migration history | PASS: 202610070001, 202610080002, 202610090001 recorded |
| Failed original grant proposal | Preserved in docs/superseded; 202610080001 remains unrecorded |
| All three hosted RPC privilege checks | PASS: authenticated/internal access retained; anon/service_role/PUBLIC denied; no indirect role paths |
| Hosted catalog | PASS: all 16 checks |
| Hosted security boundary before/after repair | PASS: structurally identical, excluding only the three intended RPC ACL changes |
| Local unit/integration tests | PASS: 51 tests |
| Typecheck and lint | PASS |
| Production build | PASS |
| Chromium production smoke | PASS: 2 tests on isolated port 3101 |
| Configured hosted anonymous/public probes | PASS: no failed verdicts; account-only coverage remains UNVERIFIED |
| Authenticated CRUD/create/replay/isolation/metadata/sign-out | PASS in the preserved earlier interactive report |
| Updated authenticated surface check and natural expiry | Pending the final interactive run; not claimed PASS |

The configured server already running on port 3000 was preserved. The unconfigured production smoke used a separate server on port 3101 and stopped only that owned server afterward.

The security comparison includes schema owners/grants, private table and column grants, FORCE RLS, function ownership/security/body hashes, private helper ACLs, policies, triggers, and stable role properties/memberships. It excludes only the exact RPC ACLs verified separately. Saved evidence is under ignored `test-results/day1-hosted-*` files.

## Authenticated API-surface test correction

A newer owner-run report was found after the paused session: `test-results/day1-hosted-interactive-before-final.json` preserves its results. Both accounts passed profile creation, reads, revisioned updates, replay, cross-account denial, metadata escalation checks, cleanup and sign-out. Its only FAIL was the test demanding authenticated access to the OpenAPI document; catalog and natural expiry were UNVERIFIED.

The current gateway returns HTTP 401 with `Secret API key required` when the publishable key requests `/rest/v1/`. Supabase documents that publishable keys cannot enumerate OpenAPI even though normal Data API calls work: [Supabase security retrospective](https://supabase.com/blog/supabase-security-2025-retro) and [2026 change announcement](https://github.com/orgs/supabase/discussions/42949). No secret key is introduced and no gateway setting or RPC permission is broadened.

The corrected verifier accepts either a 200 OpenAPI document with exactly the three approved paths, or the exact known gateway restriction combined with fresh matching-project catalog evidence and passing direct authenticated probes for all three RPCs. Missing evidence remains UNVERIFIED; extra/missing paths, unrelated 401/403, disabled-OpenAPI 404, server failures and failed direct probes fail. Four added regression tests enforce these distinctions. The new verdict is named for the evidence it actually establishes, rather than claiming successful enumeration. The final authenticated run must still confirm this corrected check and actual expiry/refresh.

## File preservation

A recovery copy of 75 tracked/untracked project files exists at `test-results/day1-recovery-20261009-022907`, with a SHA256 manifest. Previous hosted reports were copied into its `verification-before` directory. Dependency/build folders and credential files were not duplicated into this source recovery copy.

The original foundation and already-applied Auth-context migration are unchanged. The retired grant proposal is unchanged. Existing UI files, approved architecture, dependency manifests and `.env.local` were preserved. This pass added read-only evidence tooling and improved the local verifier; it changed no application/UI source.

## Complete the remaining hosted verification

Keep the configured app running at `http://localhost:3000`. If it is not already running, use a separate terminal for `npm run dev -- --port 3000` from the project directory. Do not use the unconfigured smoke build as the configured hosted app.

Run in an interactive local PowerShell terminal:

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
node .\scripts\verify-day1.mjs
```

The launcher first refreshes read-only migration-history, RPC-privilege and catalog evidence for the same project as `.env.local`; it refuses unexpected history, stale/malformed catalog reports, incomplete checks or prohibited effective privileges. It applies no migrations or grants.

Enter two distinct ordinary synthetic accounts in the hidden prompts. Fresh profiles exercise creation again. Reusing the earlier accounts leaves creation UNVERIFIED in the new run; retain the preserved earlier creation/replay PASS evidence instead of deleting profiles or pretending creation was rerun. Do not paste credentials into chat. The runner tests profile creation/read/update, replay/revision checks, cross-account denial, metadata escalation resistance, refreshed cookies, cleanup and sign-out. Synthetic revisions advance and newly created synthetic profiles remain; original display fields and metadata values are restored where applicable.

The final expiry check waits for the provider-issued access token's real expiration, plus a 35-second observation margin. PostgREST documents a 30-second clock-skew allowance; the runner waits beyond it and requires an expired-JWT rejection before checking application-driven refresh. It neither changes the hosted token lifetime nor fabricates JWTs. See [PostgREST authentication](https://docs.postgrest.org/en/stable/references/auth.html).

Session observations cannot call the provider or change cookies. After the application refreshes, the runner captures the current tokens in memory for cleanup and tests sign-out revocation against the current refresh token. Cancellation during the expiry wait enters normal cleanup and does not count as success.

Results are saved to `test-results/day1-hosted-interactive.json` without credentials, account IDs or provider payloads. Exit 0 means every reported check passed. Exit 1 means failure; exit 2 means incomplete coverage in that run. Existing-profile creation remains UNVERIFIED; either use fresh accounts or explicitly pair it with preserved prior creation evidence. Inspect every verdict; do not declare unobserved behavior passed.

For read-only catalog verification without account probes:

```powershell
node .\scripts\verify-day1.mjs --check-only
```

For configured anonymous checks, with authenticated coverage explicitly left UNVERIFIED:

```powershell
node .\scripts\verify-day1.mjs --public
```

If any check fails, retain its sanitized result and stop. Read current history/privileges before considering another fix. Do not broaden grants, disable RLS, reset data, change managed Auth ownership, repair history manually or edit an applied migration.

## Files changed in this completion pass

- Added `scripts/day1-security-boundary.sql` for read-only preservation evidence.
- Added `scripts/verify-day1.mjs` for fresh evidence and one-command local verification.
- Updated `scripts/verify-day1-hosted.mjs` to validate cookie encoding, consume complete catalog evidence, observe actual expiry and keep cleanup sessions current.
- Added `scripts/day1-verification-inputs.mjs`, its declaration file and `tests/unit/day1-verification-inputs.test.ts` (14 tests).
- Added this report and current-status links in the earlier handoff/repair reports and README.
- Refreshed ignored verification artifacts and created an isolated smoke harness; existing hosted reports were preserved in the recovery copy.

The known hosted database blockers are resolved, and the outdated OpenAPI expectation is corrected locally. Full Day 1 completion remains pending the final authenticated report, including actual expiry/refresh. Day 2 has not started.
