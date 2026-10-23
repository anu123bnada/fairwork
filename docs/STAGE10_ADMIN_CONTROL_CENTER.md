# Stage 10 — Admin Control Center

## October 22 continuation — implemented and verified locally; owner acceptance blocked

This section supersedes the historical status below. Stage 10 acceptance remains
**BLOCKED**, and production release remains **NO-GO**. No Platform Owner grant.

| Feature | Status | Evidence and limits |
|---|---|---|
| Database dashboard counts, UTC trends, recent activity and queue alerts | IMPLEMENTED / TESTED | Native PostgreSQL verifies real source counts, ordering, bounded metadata and queues; browser verifies accessible daily tables. External identity verification and total completed analyses are not inferred. |
| Organization independent approval/rejection and evidence review | IMPLEMENTED / TESTED | Existing scoped authority retained; real local independently authenticated accounts exercise the workflow. Synthetic authority does not verify a legal employer. |
| Organization suspension/release | IMPLEMENTED / TESTED | Fresh MFA, owner/admin role, historical-membership conflict denial, revision/idempotency checks and audit receipt. Native waiting-read race denies representative access after suspension commits. Historical verification is retained. |
| Organization appeals and history | IMPLEMENTED / TESTED | One linked appeal of a rejected request, original decision retained, applicant isolation and previous-reviewer denial; real local API and component-browser evidence. |
| User directory, restrictions and observed security history | IMPLEMENTED / TESTED | UUID-filtered runtime links, verified sign-in/MFA/sign-out/password-change events, immutable administrative audit. Failed login identities remain anonymous; not a complete Supabase Auth audit export. |
| Moderation, disputes, privacy review and sensitive confirmations | IMPLEMENTED / TESTED | Existing role/domain boundaries retained; real case responses, independent decisions, appeals, private evidence, privacy tracking and withdrawal pass. Irreversible privacy fulfillment/retention requires policy approval. |
| Provider configuration, request/error/token telemetry and consent association | IMPLEMENTED / TESTED | Narrow server-only writer, immutable events, DB-derived AI actor/provider/model from consent receipt, bounded token counts. Provider calls are mocked in unit tests; real login/MFA events verified through actual Auth. |
| Provider live availability and cost estimates | BLOCKED | No approved provider processing/account pricing; availability remains not_probed and costs unavailable. No live AI calls made, no personal employment data transmitted. |
| Notification templates and support categories | IMPLEMENTED / TESTED | Plain-text in-app message template must contain {title}; original title retained. Allowed incident categories are a validated subset of security,support,moderation. Existing incidents remain updatable and retries idempotent. No email/push delivery claim. |
| Admin navigation, filters, pagination, loading/error states, dialogs and responsive themes | IMPLEMENTED / TESTED | 13 component-browser tests; desktop/mobile screenshots inspected. Runtime refresh and stale organization-response handling fixed. Approved master logo still missing; no replacement invented. |
| RLS/role escalation, revocation, concurrency, MFA and audit integrity | IMPLEMENTED / TESTED | 21 native PostgreSQL tests; all 30 migrations; 10 local postflight checks true, including zero role grants and writer isolation. |
| Founder privileged end-to-end acceptance | BLOCKED | Selected account email confirmed and active, verified TOTP false. Founder must enroll personally, then separately approve exact grant. No synthetic owner granted in persistent local Supabase. |
| Hosted and Android/Windows release | BLOCKED / NOT RETESTED | No hosted changes. Existing Android and Windows PWA evidence is historical, not a new admin/native release validation. |

### Current evidence

- Regression: **323 PASS / 17 conditional skips**, 48 files;
  `test-results/stage10-operations-regression-final.log`.
- Native PostgreSQL: **21 PASS**, including conflicting decisions, revoked authority,
  organization suspension race, telemetry permissions and settings consumers;
  `test-results/admin-postgres-1792591674015/tests.log`.
  Native cluster uses explicit synthetic fixture claims/roles, not real Auth.
- Admin component browser: **13 PASS**;
  `test-results/stage10-operations-browser-final.log`. HTTP fixtures and Next adapters
  outside application routes; does not prove founder privileged authentication.
- Production build + application browser: **79 PASS**;
  `test-results/stage10-operations-full-browser.log`. Includes real server denial
  routes plus fixture-driven workflows, not 79 real Supabase workflows.
- Real local Supabase/Auth/PostgreSQL/application: **141 PASS / 0 FAIL**;
  `test-results/local-real-1792592325546/results.json` and
  `test-results/stage10-operations-real.log`. Synthetic accounts use real email,
  TOTP, sessions, persisted offers/agreements/work/Passport, case/privacy/sharing,
  organization appeal, revocation/deactivation and actual app restart.
- Lint passed: `test-results/stage10-operations-lint-final-confirmed.log`.
- Final standalone typecheck **PASS, exit 0**: `test-results/stage10-operations-typecheck-final-confirmed.log`;
  earlier concurrent generated-file failure is retained in `stage10-operations-typecheck-final.log`.
- Local catalog/privilege evidence: `test-results/stage10-operations-postflight.log`.
- Inspected screenshots: [desktop](../test-results/admin-operations-desktop.png),
  [mobile confirmation](../test-results/admin-organization-mobile.png).
  Full-page sticky screenshots were replaced with viewport captures; a validation
  tooltip in the mobile capture reflects the preceding required-confirmation test.

### Local migrations and configuration

All four additive migrations below are now **applied locally only and hash-pinned**.
Do not edit their applied bytes. Inventory is 30; no hosted comparison refreshed.

| File | SHA-256 |
|---|---|
| 202610200003_admin_operations.sql | 84c0ceb81101b21ec94f5b1686858c264e317e07e2136416620696a185d5eb33 |
| 202610200004_organization_appeals.sql | f625aaabbebaff7566c1a3898962bc2d3dded8f4a2e58d5fcfebc990c0408ce1 |
| 202610210001_runtime_telemetry.sql | cd3f6ce5888eca6672ded7bd70808d31d34cc865fc9c5f730617cebb3dc17381 |
| 202610210002_admin_setting_consumers.sql | 482f018b6e19ddf776a5093283a7d4922ecab9e47c0c63e8389c690ae062eb81 |

Offline manifest/assertions: `test-results/stage9-release-1792629510081/` (legacy prefix).
Local launcher injects `ORYQEN_TELEMETRY_DB_URL` using an ignored random credential
with owner/SYSTEM-only Windows ACLs; .env.local was not replaced. Writer can execute
only the ingestion function, cannot read private/API schemas or mutate business
records. Bounded pool/timeouts and best-effort delivery cannot fail an already
committed business command. Events contain identifiers/outcome codes only, no raw
employment text, passwords, IPs, emails, Auth secrets or provider error bodies.
Observed-event coverage is explicitly partial; no zero-failure/uptime inference.
No automatic retention deletion is enabled before policy approval.

Startup on Windows, from the repository:

```powershell
node scripts/start-local-development.mjs
node scripts/prepare-local-telemetry.mjs
node scripts/run-local-development.mjs
```

Use http://127.0.0.1:3100/sign-in; local mail http://127.0.0.1:55424.
Docker Desktop is installed per-user at
`C:\Users\vehiv\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`.
Startup preserves all volumes. Credential provisioning uses PowerShell 7 + icacls;
initial PowerShell module/privilege and SQL delimiter failures were fixed before
LOGIN provisioning succeeded. No credential values were printed.

### Remaining checkpoint

Founder: personally sign in as the selected account and enroll/verify the
Authenticator at /operator/authority. Then recheck with
`node scripts/admin-owner-bootstrap.mjs --check --subject 0e699f45-09c8-4c13-9941-35cb50c6aa2c`.
Only after that check passes, request final explicit approval for this exact local
owner grant. Run real privileged read/write/revocation acceptance after approval.
Do not treat this report or “continue” as grant authorization. Production also
requires approved provider policy/pricing, brand masters, legal/commercial rules,
HTTPS/Auth/backup/restore/migration approvals and platform release verification.

No hosted modification, deployment, purchase, owner grant, commit/push, destructive
Git operation, data deletion or redesign was performed.

---


Local runtime handoff (October 22): guarded services are healthy; app launcher PID
7424, recorded in test-results/stage10-final-app.pid. Final /sign-in probe: HTTP 200. Logs: stage10-final-app.stdout.log
and stage10-final-app.stderr.log. Recheck identity before stopping a stale PID.
Founder read-only check refreshed: confirmed email/active profile, no verified TOTP;
see test-results/stage10-final-founder-check.log. No role grant performed.

## Historical October 20 evidence


October 20, 2026. **Local vertical slice implemented; full Stage 10 IN PROGRESS.
Release NO-GO.** No founder administrative role has been granted.

## October 20 follow-up: account verification and audit navigation

Read-only founder verification was rerun for the selected UUID. Email confirmation
and active profile pass; verified TOTP remains absent. No prepare/execute command
or role grant occurred. Personal MFA enrollment and final explicit authorization
remain prerequisites; the agent did not enroll or read an authenticator secret.

Fixed a real navigation defect: record details linked to `/admin/audit?target=UUID`
but the server ignored the target. The page now accepts one valid UUID, uses it in
the existing authorized database query, passes the initial search to the client,
and resets the workspace when the target changes. Duplicate/malformed targets
render the unavailable page. Refresh/pagination preserve the target. The default
30-day UTC window still applies; widen dates when reviewing older events.

- `npx vitest run tests/unit/admin-page.test.ts tests/unit/admin-api.test.ts`:
  **6 PASS**, `test-results/stage10-audit-navigation-unit.log`.
- `node scripts/test-admin-browser.mjs`: **7 PASS**, including target pagination;
  `test-results/stage10-admin-browser.log`. These use explicit HTTP fixtures.
- `npm run typecheck`, `npm run lint`: **PASS**;
  `test-results/stage10-audit-typecheck.log`, `test-results/stage10-audit-lint.log`.
- `node scripts/test-browser.mjs tests/e2e/admin-access.spec.ts`: **production
  build PASS; 2 direct-route checks PASS**. This isolated build has no Auth
  configuration: it verifies the real server access gate and malformed-target
  rendering, not privileged founder access. Logs:
  `test-results/stage10-audit-build.log`, `test-results/stage10-audit-routes.log`.
- Initial sandbox execution could not access the Vitest temporary cache / installed
  Chromium. Both checks passed outside the sandbox; no test assertion was weakened.
  Browser launch failure log: `test-results/stage10-admin-browser-sandbox-failure.log`.

No schema, database data, environment settings, owner privileges, branding or
platform packaging changed in this follow-up. Both applied migration hashes match
the pinned values below. The engineering gaps below remain.

Local runtime recovery: Docker Desktop and the app were stopped. Started the
installed engine, ran `node scripts/start-local-development.mjs` (network,
loopback and persistent-volume checks passed), then launched
`node scripts/run-local-development.mjs` hidden. Final sign-in probe **HTTP 200**.
Launcher PID **25208** replaces the historical PID below; current logs
`test-results/stage10-founder-ready.stdout.log` / `.stderr.log`.
No volumes were removed and no new migration was introduced.

## Current acceptance evidence

| Requirement | Result | Evidence / boundary |
|---|---|---|
| Separate responsive `/admin`, search/filter/page, themes, accessible dialogs | Implemented | Six component-browser checks; real privileged login still gated. |
| Four database-derived roles, MFA, fresh reauthentication, RLS | Implemented | 15 native PostgreSQL tests, all 26 migrations; no Auth-secret grants. |
| Revocation, restrictions, idempotency, conflicts and immutable audit | Implemented | Native conflicting-write test, stale/forged commands, replay and account-denial tests. |
| Operational metrics and charts | Partial | Real counts and trends; unavailable external verification, completed analyses, failure telemetry and costs remain null. |
| User directory, membership metadata and account restrictions | Implemented slice | Search/pagination/state/revision/privacy counts. No impersonation; detailed Auth-event summary incomplete. |
| Organization verification and membership review | Existing workflow integrated | Separate authority and independence required. Whole-organization status and linked organization appeals incomplete. |
| Disputes, responses, notes, priorities, decisions, appeals and notifications | Implemented | Persistent linked appeal, prior reviewer denial, original decision and independent Passport exclusions retained. |
| Confidential evidence access | Implemented | Admin sees metadata only; append-only evidence-read log, participant/accepted-reviewer permission still required. |
| AI operations | Partial | Config/consent/fallback status, pause and bounded quotas. Provider completion/failure/cost/availability telemetry uninstrumented. |
| Privacy, audit, incidents and access review | Implemented slice | Existing scoped privacy workflow; incident lifecycle and immutable audit. No approved legal retention/purge activation. |
| Platform settings | Partial | Live notices and AI pause/quotas. Template/category drafts persist but do not activate delivery or support workflows. |
| Founder admin acceptance | BLOCKED | Selected account confirmed/active, verified TOTP absent at inspection; final role grant not authorized. |
| Existing product and platforms | Web regression passed | Android/Windows evidence remains historical Stage 8, not new native verification. |

## Executed verification

- `npm test -- --reporter=default`: **305 passed / 15 conditional skips**;
  `test-results/stage10-regression.log`. Admin concurrency skip executed separately
  natively; 14 older native-only scenarios retain Stage 9 evidence.
- `node scripts/test-admin-postgres.mjs --extended-setup`: **15 passed**;
  `test-results/admin-postgres-1792459857227/tests.log`. Fresh isolated PostgreSQL,
  all 26 migrations, real transactions and concurrency; synthetic fixture claims.
- `node scripts/test-admin-browser.mjs`: **6 passed**;
  `test-results/stage10-admin-browser.log`. Explicit component/HTTP fixtures and
  Next adapters; not evidence of real admin authentication.
- `$env:AUTH_REGISTRATION_ENABLED='true'; node scripts/test-browser.mjs`:
  **production build passed and 77 browser regressions passed**;
  `test-results/stage10-build.log`, `test-results/stage10-browser-full.log`.
- Standalone `npm run typecheck`, `npm run lint`, bootstrap-script syntax and
  local setup/hash checks passed. Bootstrap prepare/execute was not run.
- Local postflight: exact migration history, private forced RLS, denied private
  schema access, no API relations, restricted execution roles and effective RPC
  grants all **true**. Admin-role assignments: **zero**.
- `node scripts/test-local-real-workflows.mjs --manage-app`: **138 PASS / 0 FAIL**,
  `test-results/local-real-1792459504957/results.json`. Real local Auth/email/TOTP,
  independent organization decisions, agreements/work/Passport, app restart,
  sharing/privacy/revocation/deactivation, Worker/Employer admin read and
  self-promotion denial, private responses, linked appeal, previous-reviewer
  denial and retained original decision. No synthetic account received an admin
  role. Authorized founder admin actions remain NOT TESTED.

After the full regression run, one additional native-only role-revocation race
test was added and passed in the final 15-test PostgreSQL run. The regression log
above retains its actual 305/15 counts rather than inventing a rerun result.
Final typecheck/lint logs: `test-results/stage10-typecheck.log` and
`test-results/stage10-lint.log`. Local catalog evidence:
`test-results/stage10-local-postflight.log`.

Local app left running on port 3100; launcher PID file
`test-results/stage10-founder-local.pid` (33356 at handoff), logs
`test-results/stage10-founder.stdout.log` / `.stderr.log`. Do not kill an unknown
process or start a competing 3102 dev server. Supabase volume and test audit
records retained.

Repaired failures: settings-query ambiguity, null/type validation, narrow reviewer
metadata permission, quota-expression syntax, branding coverage, isolated Next
image adapter, font fallback and accessible-name selectors. No security test was
weakened; earlier failures and artifacts remain available.

Visually inspected fixture screenshots after correction:
[desktop light](../test-results/admin-desktop-light.png),
[mobile dark confirmation](../test-results/admin-mobile-confirmation.png).
No master logo invented; new routes use the shared pending-asset infrastructure.

## Applied local migrations

| File | SHA-256 |
|---|---|
| `202610200001_admin_control_center.sql` | `c984d1b20f03daafc63091d921949bf2e6b5a430025abe757820823003f6af31` |
| `202610200002_case_followups.sql` | `c394b9f7e34d130d7e30bdda296313d1f83ecfc506f7c801abbc7860df064bd5` |

Applied only to isolated local Supabase, in listed order. Previous migration bytes
remain pinned. **Do not rewrite these now-applied files**; future fixes need a new
migration. Updated offline 26-file package:
`test-results/stage9-release-1792459379122/` (historical generator prefix).
Hosted history was not refreshed. The old four-version baseline would imply 22
pending versions; this is not a fresh hosted comparison or application approval.

## Founder actions and remaining engineering

See [ADMIN_OPERATIONS.md](ADMIN_OPERATIONS.md) for the exact local startup,
verification and bootstrap commands; [ADMIN_PERMISSIONS.md](ADMIN_PERMISSIONS.md)
for the role matrix. Founder selected the personally controlled local account for
verification only; confirmed email and active profile passed, verified TOTP did
not. Personally enroll/verify TOTP, recheck status, then request final explicit
grant approval. One-use bootstrap authorization expires in ten minutes; owner
assignment survives it with a 90-day review expiry. No synthetic owner permitted.

After approval, execute real privileged acceptance. Remaining local engineering:
durable failure/provider telemetry, dedicated organization appeals/status,
template/category consumers and complete user security activity. These remain
explicitly incomplete, not hidden behind dashboard placeholders.

Hosted backup/restore/migrations/deployment, Gemini product/region/retention,
commercial authority and legal policies need separate approval. Android signing
and physical device; Windows updated-PWA verification remain release gates.
No hosted change, paid service, deployment, owner grant, commit/push, reset,
volume deletion or deletion of user/audit history occurred.

## Pre-change inventory and implementation boundary

Read Stage 8/9 handoffs and completion ledger. Existing 24 migrations implement
private profiles, scoped capabilities, independent organization approvals,
versioned agreements/work, confidential case review, privacy requests, immutable
receipts and activity feeds. Auth verifies real users; privileged domains require
aal2. No platform administrator, user directory, aggregate operations dashboard,
admin settings, incident tracking or owner bootstrap currently exists.

Reuse those domain commands and RLS. Add a separate admin control plane with four
expiring roles, metadata-only visibility, recent MFA for sensitive commands,
immutable audit/receipts, validated settings and suspension enforcement. Domain
evidence/review remains separately scoped and independent. No universal evidence
grant or impersonation endpoint. Bootstrap must target a verified existing local
account after explicit founder approval; tests use isolated synthetic identities.

Work sequence: denial-first tests → additive database/API foundation → responsive
admin area and domain integration → real PostgreSQL/Auth/browser verification →
evidence and permission/operations handoff. Missing provider telemetry is reported
as unavailable, never as zero successful calls or invented costs. Retention and
irreversible fulfillment remain policy/approval-gated. Existing logos are retained.
