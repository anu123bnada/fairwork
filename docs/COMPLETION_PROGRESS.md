# ORYQEN completion ledger — October 23, 2026

## Current verified result — October 23 (target October 26)

**Release NO-GO; local application restored.** This summary supersedes the
in-progress dependency/startup notes below.

- Organization membership/request and independent approval forms now validate
  IDs, whitespace, expiry, evidence and revisions with actionable focused errors;
  lost-response retries preserve idempotency. Existing API/RLS/MFA unchanged.
- Fixed the newly detected Next.js vulnerability by installing exact **16.4.1**
  (3 packages changed, scripts disabled). Both manifests and installed package
  use that version. Framework advisory assessment returned **affected:false**
  for 16.4.1. This is scoped dependency evidence, not a full security certification.
- Restored the existing Docker Desktop engine and local app without recreating
  containers, deleting volumes or modifying existing records. Local stack
  isolation/health passed; app3100 runs Next16.4.1, sign-in200 / anonymous me401.
  Founder freed memory; the original npm install completed without restarting.
- **49 focused unit/API/PGlite checks PASS; Next16.4.1 production build and
  TypeScript PASS; changed-file lint PASS; 13 browser tests PASS (34.7 s,
  one Chromium worker).**
  Browser evidence uses intercepted API fixtures; the previous 139 real local
  Auth/PostgreSQL checks remain baseline, not a newly executed database suite.
  Existing production data and services were preserved. No new live AI test.
- Gemini's only newly authorized fictional generation: listed gemini-3.8-flash,
  HTTP400 INVALID_ARGUMENT, 11,032 ms, valid error JSON, no quota error or
  generated analysis. Approval exhausted. No confirmed URL/header construction
  defect; exact rejected argument remains unknown. App-wide AI stays disabled.
- Android release preflight still NO-GO; existing debug guard and signing/HTTPS
  preparation preserved. No new APK/install/physical acceptance claimed.

Changed files this continuation: package.json/package-lock.json;
src/features/authority/organization-form.ts;
src/components/fairwork/organization-requests.tsx;
tests/unit/organization-form.test.ts;
tests/e2e/organization-validation.spec.ts; this ledger, CONTINUE_HERE.md,
GEMINI_PROCESSING_GATE.md and ORYQEN_RELEASE_GATES.md. No .env.local, hosted,
billing, owner-grant, commit or push changes.

Post-patch commands:
```powershell
node node_modules/vitest/vitest.mjs run tests/unit/organization-form.test.ts tests/unit/organization-requests.test.ts tests/unit/organization-appeal-api.test.ts tests/unit/ai-provider-safety.test.ts tests/unit/ai-analysis-auth.test.ts tests/integration/day3-security-regression.test.ts
node scripts/test-browser.mjs tests/e2e/organization-validation.spec.ts tests/e2e/authority.spec.ts tests/e2e/product-app.spec.ts --grep-invert 'captures all prototype|supplied intro|isolated Figma demo preview'
```
Evidence: test-results/day2-browser-build.log, day2-browser.log,
next-patch-assessment.json, next-patch-metadata.json and
gemini-listed-generation-result.json. The one-shot provider diagnostic must not
be rerun. Start command if the app later stops: node scripts/run-local-development.mjs.

Remaining external gates: successful separately authorized provider diagnosis;
approved production AI terms/region/retention; real organization evidence and
reviewer policy; encrypted backup/isolated restore approval; hosted reconciliation,
migrations, HTTPS/Auth and deployment approval; founder MFA and exact owner grant;
final brand/Android identity, signing custody and physical-device acceptance.

## Continuation: organization validation and bounded Gemini verification

Release remains **NO-GO**, target October 26. Accepted earlier database/workflow
results below remain baseline evidence; they have not been rerun or relabeled.

- Exactly one authorized fictional Gemini generation using saved-listed
  `gemini-3.8-flash`: **400 INVALID_ARGUMENT, 11,032 ms**, valid error JSON,
  no quota error, no analysis. No retries, fallback or metadata calls. Approval
  exhausted. Endpoint/header/current schema API match the official reference;
  no confirmed construction defect. The rejected argument remains unknown from
  sanitized evidence. No model/configuration/AI-policy/billing changes.
  Evidence: `test-results/gemini-listed-generation-result.json`.
- Fixed organization review's `Invalid time value` failure before submission.
  Missing/invalid/expired/>30-day expiry, invalid revisions, invalid or absent
  approval evidence, malformed organization IDs and whitespace-only requests
  receive actionable validation with focus on the relevant control. Valid
  commands still go through unchanged API/RLS/MFA/independent-review checks.
  No database migration or existing-record mutation. No real-company assurance
  is inferred from the existing synthetic authority policy.
- **32 focused unit/API tests PASS**; changed-file lint PASS. The initial sandbox
  attempt could not access Vitest temporary files; the unsandboxed rerun passed.
  Tests: organization-form, organization-requests, organization-appeal-api and
  ai-provider-safety. No external calls in these regression suites.
- New P0 dependency finding: the production build emitted `SecurityFatalError`
  for installed Next.js **16.4.0** after compilation/typechecking. A normal retry
  completed the build; that does **not** clear the vulnerability. The framework's
  own read-only `getUpgradeAssessment('16.4.0','security')` confirmed
  `affected: true` but could not fetch patched-version metadata. Evidence:
  `test-results/next-security-assessment.json`. A separate npm audit stalled and
  only that audit was canceled; no dependency or live-service changes. Resolve
  the registry metadata/download blocker, identify the supported patch, then
  upgrade and rerun targeted acceptance before release. Do not disable checks.
- Verification also caught and fixed a missing-header type check in the new
  browser test, followed by a select-label locator mismatch. These were test
  defects; neither justified weakening application behavior or assertions.
- Final organization/authority browser rerun: **7 PASS**, one Chromium worker,
  14.4 seconds, against the same built artifact after a test-only locator fix.
  API-intercepted UI journeys are fixture evidence, not new PostgreSQL results.
  Production build/typecheck passed on normal retry, changed-file lint passed.
  Logs: `test-results/day2-browser-build.log`, `test-results/day2-browser.log`.
- October 23 continuation: registry lookup recovered. Exact 16.4.1 package
  metadata was retrieved, and the framework assessment returned affected:false,
  no security update needed for 16.4.1. Evidence: `next-patch-metadata.json` and
  `next-patch-assessment.json` under test-results. Patch installation/acceptance
  is in progress; no patched runtime success is claimed yet. Current app3100
  was no longer listening; safe launcher refused because Docker's Linux engine
  pipe was absent. Existing engine startup is being attempted without recreation.
- Subsequent local recovery: `docker desktop start` succeeded; Linux engine
  reports 29.8.2. Installed Next package reports 16.4.1 while npm is still
  completing its update. Only 375 MB RAM was available; founder asked to close
  unused applications. No new browser/build launch until memory recovers.
  Final package/lockfile completion and post-patch acceptance remain pending.
- Installation subsequently completed successfully: **3 packages changed**,
  package.json and package-lock.json pinned to Next.js **16.4.1**; no lifecycle
  scripts executed. Local containers passed network/isolation/health checks.
  RAM recovered to 2,448 MB after the founder freed memory. The original install
  was not restarted. Post-patch local startup and verification are underway.
- Fresh Android release preflight remains **NO-GO** with debug release guard
  preserved: approved HTTPS transport/origin, final identity/assets, protected
  signing key and physical signed-candidate acceptance are absent. Existing
  signing and hosted backup/recovery procedures remain available in Stage 9;
  no key generation, build, device installation, export, restore or hosted action
  was performed in this continuation.

Changed implementation: `src/features/authority/organization-form.ts`,
`src/components/fairwork/organization-requests.tsx`; focused unit and browser
coverage in `tests/unit/organization-form.test.ts` and
`tests/e2e/organization-validation.spec.ts`. Diagnostic files are ignored and
protected by an exclusive consumed-authorization marker. Never rerun them.

Required owner actions remain: separately approve any additional provider test;
approve actual AI processing/retention and real organization evidence policy;
approve encrypted backup scope and isolated restore, then hosted reconciliation,
migration window and HTTPS/Auth setup; supply final brand/Android identity and
signing custody plus a physical test device. Founder MFA and the separately
authorized exact owner grant remain pending. No release approval is inferred.

## Ultimate production mission — current October 22 results (target October 26)

**Release: NO-GO.** This section supersedes older missing-key/model statements
and migration counts. Existing working functionality, data, RLS, original assets
and Android project are preserved. No hosted mutation, .env.local edit, owner
grant, deployment, billing change, commit or push.

Implemented this pass:
- Versioned deterministic `offer-indicators.v1`: 20 explicit equal-weight checks,
  five categories, 0–100 result, per-field evidence, missing/uncertain/concern
  separation and actionable questions. This is a transparent product checklist,
  **not an empirically calibrated fairness rating** or legal/wage/safety verdict.
  Employer verification and AI observations are excluded. Full rule contract:
  [OFFER_INDICATORS_V1.md](OFFER_INDICATORS_V1.md).
- Authenticated assessment API reads the existing authorized PostgreSQL snapshot
  and binds output to offer ID/revision/hash. Foreign identities, forged inputs
  and revoked representatives cannot read it. No score/identity accepted from a
  client, no migration needed, private/no-store responses.
- Saved Check screen shows categories, evidence and disclosures, rejects stale
  revisions and offers retry. Local unsaved draft review works before organization
  linking; it does not save, transmit data or bypass membership requirements.
- Extraction preserves pay period, gross/net basis, schedule, leave, duration,
  employer name claims, document requirements and fees/deposits in editable fields.
  Conflicting weekly hours and repeated contradictory clauses stay unresolved.
  Corrections are preserved; invisible persisted extension fields survive edits.
- Corrected misleading 404 wording: missing model/resource does not establish
  invalid credentials or account exclusion. Regression rejects legacy-prefix
  assumptions and verifies opaque synthetic credentials without network calls.

Fresh evidence:
- **139 real local Auth/API/PostgreSQL PASS / 0 FAIL**:
  `test-results/local-real-1792682389742/results.json`. Real local mail, TOTP,
  sessions and persistence; no forged JWTs or intercepted APIs. New synthetic
  test accounts and their immutable audit records retained; no existing record
  modified/deleted. Only scoped time-limited synthetic reviewer/operator grants,
  no Platform Owner. Existing app/Docker/Supabase were not stopped. Includes
  persisted assessment/hash, cross-account denial and immediate revocation.
- **68 unit/API/PGlite PASS** across seven focused files. Subsequent isolated
  provider-only rerun **20 PASS** after adding the 404-message regression.
  PGlite is isolated embedded PostgreSQL, separate from the real suite above.
- First production build exposed read-only NODE_ENV assignments in earlier
  ignored one-shot test harnesses. Corrected with Vitest environment helpers;
  neither harness was executed again. Next build/typecheck then PASS and
  **14 fixture browser tests PASS**, one Chromium worker, including local OCR,
  AI consent/unavailable states, assessment retry/staleness and preserved fields.
  Final rerun after the unsaved draft preview and corrected 404 message:
  **production build PASS, TypeScript PASS, all 14 browser tests PASS** (30.9 s,
  one Chromium worker). Logs: `test-results/day2-browser-build.log` and
  `test-results/day2-browser.log`. The earlier failed attempt is disclosed above.
- Targeted lint PASS for changed application/API/engine/tests; draft component
  and final changed-file lint rerun PASS (zero warnings). Screenshots under
  `test-results/day2-e2e/offer-assessment-saved-ind-d1c61-e-a-direct-reload-on-mobile-chromium/`.
  Mobile screenshot inspected; no new original-Figma/final-logo parity claim.
- 30 pinned migration hashes verified; fresh offline manifest and SQL assertions:
  `test-results/stage9-release-1792681998022/`. No hosted history refreshed/applied.
- Android doctor: Java21, SDK36, BuildTools35, ADB and AVD available; **zero
  authorized connected devices**. Release guard preserved; no physical acceptance.
- Final Android offline debug build **PASS**, 93 tasks up-to-date, 2m34s;
  `test-results/ultimate-android-build.log`. Existing APK reused, not a new release:
  `mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk`, 4,411,431 bytes,
  SHA-256 `9da7afe8b17aa856432652842aeabd7d16f2c917fc071db5a8311ba8c0fd13fb`.
  Fresh apksigner verification PASS (v2). No install/emulator/physical runtime
  test performed this pass. Native wrapper is unchanged and requires local
  server3102/adb reverse; active desktop server remains3100. No final signing,
  production URL or release variant was introduced.

| Feature/workstream | Current status | Evidence or remaining dependency |
| --- | --- | --- |
| Registration, confirmation, profile, sign-in/out, MFA | WORKING locally | Fresh real-suite account journeys; production HTTPS/SMTP pending |
| Paste/manual/screenshot extraction and corrections | WORKING within supported formats | Unit/browser coverage; bundled English OCR; PDF/Word and other OCR languages unsupported |
| Offer saving, revision history and participant isolation | WORKING locally | Real database reads/writes/denials and immutable history |
| Versioned scoring, evidence and recommendations | WORKING checklist / PARTIAL broader fairness intelligence | New engine/API/UI; no market/legal calibration, arbitrary-prose contradiction detection or employer trust score |
| Genuine AI generation | BLOCKED | Latest listed-model generation 400; metadata 200 is not analysis success |
| Consent, redaction, quotas, safe provider errors | WORKING locally / production approval BLOCKED | Mocked boundary tests and real disabled-provider gate; actual retention/region/tier unapproved |
| Employer organization requests, approvals, memberships, claims | WORKING locally | Real independent-account approval/revocation; synthetic policy does not verify commercial legitimacy |
| External company intelligence/reputation | BLOCKED | No approved provider, evidence policy or verified external data |
| Agreements, revisions, independent confirmation | WORKING locally | Real two-account workflow; no self-confirmation shortcut |
| Work Record and private employment history | WORKING locally | Persistent independently confirmed revisions and authorization |
| Passport selection, named-recipient sharing, expiry/revocation | WORKING locally | Real eligibility/suppression, narrowed fields and revoked grants |
| Disputes, appeals, evidence access, audit timeline | WORKING locally | Real reviewer acceptance/revocation/concurrency and Passport suppression |
| Notifications | WORKING in-app / PARTIAL external delivery | Real scoped activity; email/push not configured |
| Privacy and account management | WORKING requests/deactivation / PARTIAL fulfillment | Real request isolation/review/withdrawal/deactivation; legal retention and irreversible fulfillment approval pending |
| Admin control center | Prior local acceptance preserved / founder access BLOCKED | Stage10 evidence historical; founder MFA and exact owner-grant authorization pending |
| Hosted persistence, recovery and production data mode | BLOCKED | Real local backend; approved backup/restore rehearsal, hosted history, migration window, HTTPS/Auth settings and real-data operating policy required |
| Android | Debug build/signature WORKING / release BLOCKED | Fresh offline build; current loopback transport, no signed release or fresh installation/physical acceptance |
| Windows | PWA only | Historical install evidence; no native EXE/MSIX |
| Approved brand assets, privacy/terms/commercial policies | BLOCKED | Owner-supplied final assets and decisions absent |

Gemini: the legacy `AIza` regex was a diagnostic mistake, not an application
validator. Current credentials load without parser alterations. One separately
approved generation returned **404 NOT_FOUND / 1,080 ms**, no analysis. Then the
separately approved model-list request returned **200 / 1,005 ms**, including
`gemini-2.5-flash` with `generateContent`; no pagination follow-up. Thus listing
authentication works, while the generation failure remains unresolved. Evidence:
`test-results/gemini-single-generation-result.json` and
`test-results/gemini-approved-model-list-result.json`. All approvals exhausted;
no automatic retry, fallback, model replacement or production activation.
See [GEMINI_PROCESSING_GATE.md](GEMINI_PROCESSING_GATE.md) for current primary
sources and the distinction between possible access restrictions and proven cause.

Next owner-dependent actions: authorize a further narrowly scoped generation
diagnostic if desired; approve actual processing terms separately; establish
real employer evidence policy; approve encrypted backup scope/restore rehearsal,
hosted reconciliation/migration window and HTTPS/Auth setup; supply signing,
identity/assets and physical Android device. None is implied by local test success.

Changed product files: `src/features/offer/assessment.ts`,
`src/features/offer/deterministic-extractor.ts`,
`src/app/api/v1/offers/assessment/route.ts`,
`src/components/fairwork/offer-assessment.tsx`,
`src/components/fairwork/product-app.tsx`, `src/server/ai/provider.ts`.
Coverage: new assessment unit/API/browser files, existing rule/provider/Add Offer
tests, and `scripts/test-local-real-workflows.mjs`. Updated this ledger, handoff,
Gemini gate and scoring contract. Ignored one-shot diagnostic files retain their
consumed-approval markers and sanitized evidence; they must not be rerun.

Final verification commands (repository root unless stated):
```powershell
node node_modules/vitest/vitest.mjs run tests/unit/offer-assessment.test.ts tests/unit/offer-assessment-api.test.ts tests/unit/rule-analysis.test.ts tests/unit/ai-provider-safety.test.ts tests/unit/ai-analysis-auth.test.ts tests/integration/day3-security-regression.test.ts tests/integration/day3-offer-db.test.ts
node node_modules/vitest/vitest.mjs run tests/unit/ai-provider-safety.test.ts
node scripts/test-local-real-workflows.mjs
node scripts/test-browser.mjs tests/e2e/offer-assessment.spec.ts tests/e2e/add-offer-validation.spec.ts tests/e2e/ai-consent.spec.ts tests/e2e/offer-screenshot.spec.ts
node scripts/prepare-release-candidate.mjs
node mobile/poc/scripts/doctor.mjs
node mobile/poc/scripts/release-preflight.mjs
# From mobile/poc/android with the documented local Java21/SDK/cached Gradle:
.\gradlew.bat assembleDebug --offline --no-daemon --no-watch-fs --max-workers=1 --console=plain '-Dorg.gradle.jvmargs=-Xmx768m'
```
The real suite was executed without `--manage-app`; no existing server stopped.
Final loopback health: sign-in200, anonymous me401. No pending test process left.

## Gemini bounded live diagnostic — October 22, 2026

Founder explicitly approved exactly one model-metadata request and one fixed,
fully fictional offer generation request. Used the existing native-fetch Gemini
provider and actual configured `gemini-2.5-flash` model in an isolated diagnostic
process. No application flags, .env.local, billing, hosted data or services changed.

| Request | HTTP | Latency | Validity |
| --- | --- | --- | --- |
| Model metadata | 401 UNAUTHENTICATED | 792 ms | JSON error only; model access not verified |
| Offer generation | 401 UNAUTHENTICATED | 106 ms | JSON error only; no generated analysis |

No HTTP 429/quota errors, retries or fallback provider requests. The two-request
authorization is exhausted. An earlier harness startup failed before networking
because Next excludes .env.local in test mode; zero requests on that attempt.
The diagnostic runner completing successfully does **not** mean Gemini passed.
Evidence: `test-results/gemini-approved-once-result.json`; exclusive invocation
guard: `test-results/gemini-approved-once.started`. No raw provider bodies or keys
are persisted in the report. Latency includes response-body receipt.

18 offline provider safety tests pass. Completed interrupted provider hardening:
bounded Gemini response parsing, complete-candidate checks, multipart text with
thought exclusion, safe HTTP error classification, no retry/fallback. No fresh
full application/build acceptance claimed for this narrow provider change.

Next: owner privately verify the Gemini Developer API credential/project access
and restrictions, correct local configuration if needed, then explicitly approve
another bounded test. Credential presence is confirmed; its validity is not.
App-wide AI and production personal-data processing remain unapproved/disabled.
Release remains NO-GO.

## Production critical repair — October 22 (current deadline: October 26)

**Release assessment: NO-GO.** This section supersedes earlier deadline and
runtime assumptions, not the historical test evidence below.

Implemented:
- Pasted offers: broader explicit labels and hiring wording; salary selection
  distinguishes deposits/fees, preserves ambiguous currency/ranges as unknown,
  extracts stated conditions, retains deposit labels. Suggestions populate blank
  controls only; feedback counts filled/preserved fields and reports no match.
- Confirmed agreement → Work Record carries its UUID through sign-in and opens
  the draft form. The effective agreement still requires an authorized API read
  before saving. Empty Work Records link back to the agreement/offer workflow.
- Passport sharing no longer displays the obsolete “not connected” placeholder.
  Settings exposes the signed-in participant's own ID for legitimate invitations.
- AI UI displays structured pay/hours/contract details and missing information;
  unconfigured AI explains that nothing was sent and local rules remain available.
  `node scripts/ai-readiness.mjs` reports names/presence only; no provider call.
- Recovered existing local Docker services after disk exhaustion stopped the
  engine. The stopped credential-free loopback gateway was started; its verified
  restart policy is now `unless-stopped`, also used for newly prepared gateways.
  No volume deletion, schema migration, .env.local edit or hosted action occurred.

Fresh evidence:
- **Real local end-to-end: 135 PASS / 0 FAIL**, using actual local Supabase Auth,
  mail, TOTP MFA, application APIs and PostgreSQL (no intercepted routes/forged
  sessions). Evidence: `test-results/local-real-1792677194906/results.json`, SQL
  assertions and screenshots alongside. Covers separate worker/employer accounts,
  registration/confirmation/profile/sign-in, independent organization decisions,
  company/offer history, pasted extraction and save, agreement confirmation, Work
  Record verification, Passport, scoped notifications, sharing/expiry/revocation,
  privacy requests, disputes/appeals, suppression and account deactivation.
  All 30 local migration versions and restricted trigger contexts verified read-only.
  New synthetic test records/audit history retained; no pre-existing record changed.
  This run uses distinct accounts, not proof of distinct human identities or real
  company assurance. It did NOT restart the existing application, test hosted
  services, invoke Gemini, or install an Android APK.
- 53 affected unit/API/PGlite tests PASS; final extractor-only rerun 7 PASS.
- Native PostgreSQL Work Record tests 20 PASS and integrity/Passport tests 18
  PASS, each on a new isolated cluster; existing databases untouched. Evidence:
  `test-results/day5-postgres-1792672520249/tests.log` and
  `test-results/day6-postgres-1792672769989/tests.log`.
- Final production build PASS after all code changes; TypeScript and targeted
  ESLint PASS. Build evidence: `test-results/day2-browser-build.log`.
- **Final browser suite: 35 PASS / zero FAIL, one Chromium worker**, including
  desktop/mobile screenshots, 320px layouts, extraction, real OCR, AI consent and
  unavailable states, independent confirmations, Work Record deep links/errors,
  Passport sharing, account controls, offer selection/history and API denials.
  Evidence: `test-results/day2-browser.log`, `test-results/day2-e2e/`,
  `test-results/fairwork-figma-*.png` and `test-results/fairwork-recording-*.png`.
  Extracted-form screenshots are under the add-offer-validation case directory
  in `day2-e2e` (`extracted-desktop.png`, `extracted-mobile.png`). These checks
  verify current layout, not final-logo approval or a new Figma parity claim.
- Browser fixture tests exercise actual components; they do not prove hosted
  operation. The new real OCR test runs bundled English WASM recognition on a
  generated synthetic PNG and asserts no external network requests.
- Docker engine 29.8.2, existing local services healthy, local isolation guard
  PASS. Android doctor: build prerequisites available, debug APK exists, zero
  authorized devices. Release preflight NO-GO; no new APK/install claimed here.

Verification interruptions retained: first build ENOSPC; one new browser selector
corrected after confirming populated text in the accessibility tree; later broad
screen captures failed with Chromium insufficient resources at ~580 MiB free RAM.
Founder closed unused applications. Real backend and final production/browser
reruns now pass as above. No tests or security checks were disabled to pass.

Remaining release gates, in dependency order:
1. Local repair and affected acceptance are complete. Preserve memory/disk
   headroom and running local services; no further repeat suites are needed
   without new changes. Public release still requires the gates below.
2. Gemini key/model missing, and processing/retention approval remains absent.
   Required names: GEMINI_API_KEY (or GOOGLE_API_KEY), GEMINI_MODEL,
   ORYQEN_AI_ENABLED, ORYQEN_AI_POLICY_APPROVED, ORYQEN_AI_POLICY_APPROVAL_REF,
   ORYQEN_AI_PROCESSING_REGION, ORYQEN_AI_DATA_USE. Approval flags are not proof
   of provider guarantees. No live personal data transmission or billing enabled.
3. Genuine employer assurance still requires an approved evidence/authority
   policy; local synthetic `demo-authority.v1` checks do not verify real companies.
4. Hosted backup/restore rehearsal, pending migrations, HTTPS origin/Auth/email
   configuration and real hosted two-account acceptance require owner approval.
   Existing activation plans are reference material only: their original six-file
   inventory is stale against 30 local migrations. Reconcile live hosted history
   read-only and regenerate the ordered hash/assertion approval package before
   applying anything. No hosted history was newly verified or migration applied.
5. Android release requires approved HTTPS transport, final ID/version/icon,
   owner-controlled signing and physical-device acceptance. Current APK is debug
   only and depends on the local server plus adb reverse. Windows remains PWA.
   Existing artifact rehashed unchanged: `mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk`,
   SHA-256 `9DA7AFE8B17AA856432652842AEABD7D16F2C917FC071DB5A8311BA8C0FD13FB`.
6. Founder MFA/explicit owner-grant approval, approved brand assets and privacy,
   terms/retention/commercial decisions remain external gates. No privileges granted.

Changed implementation: `deterministic-extractor.ts`, `participant-path.ts`,
`product-app.tsx`, `agreement-workflow.tsx`, `work-record.tsx`, `ai-analysis.tsx`,
`sign-in/information/page.tsx`, new `scripts/ai-readiness.mjs`,
`scripts/local-development-gateway.mjs`; focused tests in rule-analysis,
participant-path, add-offer-validation, ai-consent, day4-workflow, day5-work and
new offer-screenshot. Original assets, Android project and security controls retained.

Useful exact verification commands (PowerShell, repository root):
```powershell
node scripts/ai-readiness.mjs
node scripts/test-local-real-workflows.mjs
node scripts/test-day5-postgres.mjs
node scripts/test-day6-postgres.mjs
node mobile/poc/scripts/doctor.mjs
node mobile/poc/scripts/release-preflight.mjs
```
Final production/browser command actually executed:
```powershell
node scripts/test-browser.mjs tests/e2e/add-offer-validation.spec.ts tests/e2e/ai-consent.spec.ts tests/e2e/day4-workflow.spec.ts tests/e2e/day5-work.spec.ts tests/e2e/passport-sharing.spec.ts tests/e2e/offer-screenshot.spec.ts tests/e2e/product-app.spec.ts tests/e2e/account-security.spec.ts tests/e2e/offer-selection.spec.ts
```
The real-workflow command creates NEW synthetic accounts/records, retains their
audit history, and deactivates only its own test worker at the end. It grants
time-limited, scoped synthetic reviewer/operator capabilities, never Platform
Owner. Run only against the guarded local environment. Do not repeatedly rerun
it merely to obtain another passing count. No `--manage-app` was used, so the
existing dev server was not stopped. Browser/component tests and native isolated
database tests are separate evidence classes.

Manual check on the preserved app at http://127.0.0.1:3100: sign in, open Add
Offer, paste clearly labeled fictional terms, choose Suggest terms with local
rules, inspect the populated fields, then choose an organization you legitimately
access. A new worker without a linked organization needs an authorized employer
participant offer first; organization approval is never granted by selection.
Analyze offer saves the reviewed typed terms under server authorization. The
optional external-AI control remains unavailable until separately configured and
approved. Do not share private employment data to test it.

Real local acceptance correction: `scripts/test-local-real-workflows.mjs` still
used the removed raw Company ID field. It now first runs the independently
authorized employer offer workflow, then selects that legitimately linked
organization for the worker's pasted-text review. The test asserts extraction,
read-only worker identity and real API persistence; no company IDs are invented
or permissions granted by the UI. Early aborted runs are retained, not successes.
Fresh local health is restored; founder requested no further service stops or
infrastructure changes. Only test-owned isolated servers may be stopped by their
normal test cleanup; the existing development app and Docker remain running.

## Stage 11 and Add Offer repair — October 22 (latest)

Deadline: October 25. Add Offer required fields are visible in paste mode;
submission shows validation errors and focuses the relevant control. Existing
authorized company discovery supplies a searchable selector. New workers with
no linked company are directed to an authorized employer participant link;
representatives can use the existing independent organization-request workflow.
Worker identity comes from the signed-in profile, saved participants are locked,
and server authorization/RLS/version/idempotency checks remain unchanged.
No schema, .env.local, existing records or Docker volumes changed for this repair.

Fresh repair checks: **18 browser PASS** (5 new + 13 related), **26 API/unit/PGlite
PASS**, **typecheck PASS**, **targeted lint PASS / zero warnings**. Browser checks
use fixture APIs, not real account/database writes; PGlite uses an isolated
in-memory database. Logs: `test-results/add-offer-validation-final.log`,
`add-offer-related-final.log`, `add-offer-regression.log`,
`add-offer-typecheck-final.log`, `add-offer-lint-final.log`.
Full Next production build/broad suite not rerun for this focused repair.
Changes: `product-app.tsx`, new `offer-company-selector.tsx`, new
`tests/e2e/add-offer-validation.spec.ts`, updated `product-app.spec.ts`,
`day3-revision-regression.spec.ts`, `offer-selection.spec.ts`; Android test stage
labels in `scripts/test-android-real.mjs`, corrected `mobile/poc/README.md`, and
this ledger/handoff. All original assets, native code and server contracts retained.

Android **BUILD/INSTALL PASS, RUNTIME PARTIAL, RELEASE NO-GO**. Existing debug APK
build succeeded (93 tasks up-to-date), 4,411,431 bytes, V2 signature verified:
`mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk`.
SHA-256 `9DA7AFE8B17AA856432652842AEABD7D16F2C917FC071DB5A8311BA8C0FD13FB`.
Release task absence and loopback-only debug source invariants verified. No native
project regeneration. Java21/SDK36/BuildTools35/cached Gradle are available.

API37 emulator installation, onboarding/language/sign-in and real local
registration/email confirmation/profile PASS. Native Back BLOCKED by Android
launcher ANR; later session/offline checks and keyboard/full Worker-Employer
workflows NOT reverified. No physical-device test. Evidence:
`test-results/android-real-1792630797669/results.json` (three passes, one blocked
runtime step recorded as FAIL). Initial duplicate pending installation resolved
after a data-preserving emulator reboot. Historical Stage8 is separate evidence.
APK requires local server3102, local Supabase and explicit adb reverse. Current
desktop app is on3100; Android server3102 must be started separately as documented
in `mobile/poc/README.md`. Hosted HTTPS/backend and production signing remain gates.


## Stage 10 — October 22 continuation (latest)

Implemented the remaining local dashboard/activity/alerts, organization suspension
and independent appeals, sanitized runtime/auth/AI telemetry, notification template
and incident-category consumers. Current detailed status matrix and evidence:
[Stage 10](STAGE10_ADMIN_CONTROL_CENTER.md).

30 migrations are applied ONLY to isolated local Supabase and hash-pinned; never
rewrite their bytes. Ten postflight checks pass, including zero admin roles.
Regression 323 PASS / 17 conditional skips; native PostgreSQL 21 PASS; admin
component-browser 13 PASS; production build + application browser 79 PASS; real
local Supabase/Auth/API/persistence 141 PASS / 0 FAIL. Lint passed. Standalone
typecheck PASS (exit 0): test-results/stage10-operations-typecheck-final-confirmed.log.
Real service results: test-results/local-real-1792592325546/results.json.
Fixtures, real PostgreSQL and real Auth evidence are separate in the report.

Owner acceptance BLOCKED: selected founder account email/profile pass, verified
TOTP remains false. No Platform Owner privileges granted. Founder must personally
enroll/verify MFA, then separately approve the exact local grant; “continue” is
not grant authorization. Stage 10 acceptance remains blocked; release NO-GO.
Gemini live calls/costs, legal retention, external employer verification, hosted
activation and updated Android/Windows release testing remain approval/external gates.

Local startup: node scripts/start-local-development.mjs; optional repeatable
node scripts/prepare-local-telemetry.mjs; node scripts/run-local-development.mjs.
Telemetry uses a restricted append-only credential in ignored local configuration,
owner/SYSTEM ACLs; no .env.local replacement. No hosted changes or data deletion.


Local runtime handoff (October 22): guarded services are healthy; app launcher PID
7424, recorded in test-results/stage10-final-app.pid. Final /sign-in probe: HTTP 200. Logs: stage10-final-app.stdout.log
and stage10-final-app.stderr.log. Recheck identity before stopping a stale PID.
Founder read-only check refreshed: confirmed email/active profile, no verified TOTP;
see test-results/stage10-final-founder-check.log. No role grant performed.

## Historical October 20 status (superseded)


## Stage 10 — implemented admin slice; completion and release still NO-GO

- Follow-up: selected founder account rechecked (email/profile pass, verified
  TOTP absent; no role granted). Fixed audit deep links silently ignoring their
  selected target; server validation, access denial, refresh and pagination
  verified by **6 focused unit/API PASS and 7 admin component-browser PASS**.
  Typecheck/lint, production build and **2 direct-route access checks PASS**.
  Older full-suite evidence below was not relabeled.
- Separate responsive `/admin`, four server/database-derived roles, MFA and fresh
  verification, metadata directories/global search, restrictions, immutable audit,
  incident workflow, scoped domain review integration and evidence-access logs.
- Live notices, AI pause and quota reductions preserve consent/policy gates;
  templates/categories remain saved drafts. Unmeasured metrics are unavailable.
- Append-only case responses, linked appeals, previous-reviewer denial, retained
  original decisions/Passport exclusions and private notifications implemented.
- Local migrations now **26**, new versions `202610200001`, `202610200002` applied
  locally only and pinned. All six catalog postflight checks true; zero admin roles.
- Evidence: **305 regression PASS / 15 conditional skips; 15 native PostgreSQL
  PASS; 6 component-browser PASS; 77 application-browser PASS; production build,
  typecheck and lint PASS**. See [Stage 10](STAGE10_ADMIN_CONTROL_CENTER.md) for
  logs, distinctions, screenshots, hashes and real-service run status.
- **138 real local Supabase/Auth/API/PostgreSQL checks PASS / 0 FAIL**, including
  actual app restart, worker/employer admin denial and persistent responses/appeal.
  Evidence: `test-results/local-real-1792459504957/results.json`. Founder owner
  actions remain untested because no admin assignment was granted.
- Founder account selected for verification only. Email/profile valid, verified
  TOTP absent; owner grant still requires personal MFA and final explicit approval.
- Incomplete: durable failure/provider telemetry, dedicated organization
  appeal/status controls, active template/category consumers, complete user
  security activity and real privileged admin acceptance. Do not mark Stage 10
  complete or promote this to hosted/Android/Windows release verification.

Operating procedure: [ADMIN_OPERATIONS.md](ADMIN_OPERATIONS.md).
Permission matrix: [ADMIN_PERMISSIONS.md](ADMIN_PERMISSIONS.md).

Deadline: October 23, 19:00 Asia/Colombo. The latest full-application directive
extends the earlier competition scope. Local completion is not hosted completion.

## Stage 9 — local functionality completed in this pass; release NO-GO

Current classification, platform instructions, approval checklist and release
assessment: [STAGE9_RELEASE_CANDIDATE.md](STAGE9_RELEASE_CANDIDATE.md). This section
supersedes older first-page-only, disconnected-OCR and missing-history statements.

- Authorized immutable offer-history browsing implemented and verified with real
  accounts, cursor reads, refresh and immediate representative revocation.
- Passport selection reaches later pages; complete bounded private downloads
  reauthorize each page and reject partial failures. Copies are non-atomic and
  cannot be revoked remotely. No public/bearer access introduced.
- Activity includes agreement/work/integrity events through existing participant
  RLS. Real withdrawal and revoked-employer denial pass; no reason/evidence leak.
- Local-only English screenshot OCR works with bundled WASM/model. PNG/JPEG,
  size/dimension bounds, timeout/cancel and explicit editable review; no upload,
  automatic save or live AI. Original card/navigation design preserved.
- New migrations `202610190001_offer_history.sql` and
  `202610190002_workflow_notifications.sql` applied only locally: **24 total**.
  All pinned hashes verified. Current ordered release package and local read-only
  SQL results: `test-results/stage9-release-1792368411033/`.
- **131 real local-service checks passed**, including actual app restart, independent
  Auth/MFA accounts, persistent offers/agreements/work/Passport/shares, privacy,
  case review, revocation and deactivation:
  `test-results/local-real-1792367296707/results.json`.
- **288 regression tests passed / 14 conditional skips**. Browser full suite:
  **77 passed**, plus **4 focused passes** after removing an overlapping OCR action.
  Backend browser fixtures remain distinct from real local-service evidence; the
  OCR test executes the actual local model on a synthetic screenshot.
- All 14 conditional cases exercised in native PostgreSQL suites: **84 executions
  passed** (13 + 20 + 18 + 33). Final standalone typecheck, full lint and production
  build passed. Exact evidence directories/commands and failed attempts are recorded
  in the Stage 9 report. Mobile/desktop OCR and real-history screenshots inspected.
- Original approved-logo infrastructure remains inactive; masters not supplied.
  Gemini personal-data processing is disabled. No external provider was called.

Release remains **NO-GO**: approved assets, real Gemini account/policy, HTTPS/SMTP,
encrypted backup/restore, current hosted history and migration approval, commercial
authority/privacy/retention decisions, production Android signing/transport and
physical hardware are unresolved. Android emulator debug (11 checks) and Windows
installed PWA (9 checks) remain Stage 8 evidence, not newly tested Stage 9 releases.
No production APK/AAB or Windows EXE/MSIX was created. In-app notifications work;
email/push, external verification and certified skills/matching are not fabricated.
Detail-history scale/load testing, complete CSP and assistive-technology acceptance
remain explicit hardening gaps. See the Stage 9 report for exact next owner actions.

## Stage 8 integration — verified local improvements, release still incomplete

Authoritative current feature matrix, command log, failed-attempt history and
remaining gaps: [STAGE8_INTEGRATION.md](STAGE8_INTEGRATION.md).

- Fixed selecting a second saved offer showing the first offer's terms. Explicit
  record links now isolate provider state; denied/invalid selections fail closed.
  Added a separate-offer action that preserves existing records and audit history.
- Prevented competing local Next dev servers from repeatedly refreshing forms.
  Normal local app restored on port 3100; Auth, mail and PostgreSQL remain running.
- Real local workflow: **121 passed**; password recovery/MFA: **6 passed**.
- Regression: **277 passed**, 14 conditional skips separately exercised against
  PostgreSQL. Real database suites: **84 passed** (13 + 20 + 18 + 33).
- Browser fixtures: **73 passed**; production build, typecheck and lint passed.
- Android: **real debug APK built, signature verified, installed; 11 real local
  emulator checks passed**. Native Back, process restart/session, real registration,
  API failure/recovery and sign-in passed. Physical device and release untested.
- Windows: **9 real installed-PWA checks passed**, including fresh install and
  isolated uninstall/reinstall. No EXE/MSIX generated; founder installation retained.

No official logo substituted. Original design and migrations preserved. Brand
coverage remains prepared but inactive until approved assets arrive. Gemini live
processing remains disabled pending credentials and explicit regional/retention
approval. No personal data sent, paid billing activated or hosted services changed.
Overall status **IN PROGRESS**: the matrix still lists partial/missing product
features and approval-dependent release work. Local test totals are not evidence
of commercial readiness, hosted activation or full native visual parity.

## Brand infrastructure — implemented, official identity activation pending

Owner clarified the blue/cyan/violet direction and cyan Q-tail, but **no approved
master files exist yet**. The green Q is rejected. The existing FAIRWORK shield is
not an approved ORYQEN master. No logo was created, recolored, substituted or copied.
Current UI, original assets, metadata icons and Android resources remain intact.

Implemented `src/components/brand/brand.tsx`: `BrandLogo`, `BrandMark`,
`AppBrandHeader`, and a narrowly used existing-artwork wrapper. Configuration is
`src/lib/brand/assets.json`, explicitly `awaiting-approved-assets` / null. Pending
components render no wrapper, empty landmark, navigation or spacing; existing
artwork is returned unchanged only at its original placements. The reusable header
supports full-logo/prominent, responsive desktop-logo/mobile-mark and collapsed-mark
modes. It uses intrinsic image proportions, ORYQEN alt text, explicit light/dark
asset variants and safe-area padding. No new sidebar, theme or navigation is added.

| Surface | Prepared shared slot / remaining gate |
|---|---|
| Sign-in, welcome, registration/profile, confirmation/recovery, operator authority | `AuthShell` uses BrandLogo with its exact existing glass/shield as the pending fallback |
| 15 product destinations: worker/employer, offers/analysis/questions, agreements, work, Passport, cases, settings and notifications | `FairworkScreen` anchors outside the session gate, including loading/unauthorized/error states; shared content also covers empty states |
| Sharing | Header slot inside the visible share dialog; parent slot only during session/record loading, avoiding two anchors |
| Splash, onboarding, language, OTP | Shared logo/header slots; splash retains existing artwork + heading until approved. Authenticated welcome retains its old mark/text until shared header activates |
| About, information, Day 3 technical route, not-found, root loading/error | PageShell and explicit fallback slots; all 18 page/fallback entry files reach shared infrastructure |
| Favicon, PWA, Windows PWA | Existing icons preserved; derivative installation points documented below. Windows uses the PWA manifest; no native EXE/MSIX is present |
| Android launcher/splash/offline | Unmodified pending master + approved exports. No new APK build/install or native visual parity claim |
| Dark/light | Component supports owner-supplied variants; existing UI stays light under either OS preference. Do not infer a dark theme or recolor artwork |

**Missing assets and installation:** see `public/oryqen/approved/README.md`.
Reserve `logo-light.svg`, `logo-dark.svg`, `mark-light.svg`, `mark-dark.svg` there;
the owner may approve one unchanged master for both surfaces. Need approval
provenance, intrinsic dimensions, clear space/minimum-size rules and reviewed SVGs.
Record dimensions/SHA-256/approval reference in the manifest only after receipt.
The typed contract rejects legacy paths, external URLs, traversal, missing theme
variants and incomplete approval. `node scripts/check-brand-assets.mjs` currently
reports PENDING; `--require-approved` intentionally exits 1. Once configured it
verifies all master hashes. On Node 22.13 use `node --experimental-strip-types`.
This validator verifies configuration/integrity, not human approval or visual parity.

After master approval, derive/review favicon, 192/512 PWA and 180 Apple icons,
maskable safe zone/background, Android foreground/background/round/splash assets.
Exact integration points: `src/app/layout.tsx`, `src/app/manifest.ts`, Android
`app/src/main/res/`, manifest/styles, and `mobile/poc/www/offline.html`. A master
manifest switch does not regenerate native/PWA icons. Reinspect every enabled
anchor, accessibility, clear space, responsive layout, dark surface and installed
native icon before calling the original application-wide branding request complete.

New verification (October 18):

- `node node_modules/vitest/vitest.mjs run tests/unit/brand.test.ts`: 5 passed.
  Covers inactive zero-DOM behavior, exact legacy fallback, explicit approval/path
  rejection, fixture-only approved rendering/accessibility/dimensions, original
  asset hashes, and import-graph coverage for all 18 route/fallback entry files.
- `node node_modules/vitest/vitest.mjs run`: **277 passed / 14 skipped, 39 files**.
  Skips are the existing separate real-PostgreSQL cases; no new real database run
  was needed for this inactive presentation change. Initial sandbox attempt hit
  ENOENT reading Vitest temporary modules and was stopped, then the suite passed
  outside that Windows sandbox. This is not a hosted-auth test claim.
- Set `$env:AUTH_REGISTRATION_ENABLED='true'`, then
  `node scripts/test-browser.mjs tests/e2e/brand-infrastructure.spec.ts tests/e2e/oryqen.spec.ts tests/e2e/auth-composition.spec.ts tests/e2e/product-app.spec.ts`:
  **18 passed**, using fixture API journeys in isolated port 3101. Includes all
  15 unauthenticated product deep links, unavailable service, real UI navigation,
  offer/agreement commands, stale revisions and permission denials, original
  glass/motion, metadata/icons, mobile/tablet/desktop and OS theme checks.
- That command's **Next production build and TypeScript phase passed**.
  Logs: `test-results/day2-browser-build.log`, `day2-browser.log`.
- Standalone `node node_modules/typescript/bin/tsc --noEmit` and
  `node node_modules/eslint/bin/eslint.js . --max-warnings=0`: passed without diagnostics.
- Asset inventory command: PENDING, exit 0; `--require-approved`: expected exit 1.
  No official identity can be certified while the master manifest is empty.
- 16 new screenshots at 390×844 / 1280×844 under light/dark OS preferences in
  `test-results/brand-infrastructure/`. Manually opened mobile + desktop sign-in
  and desktop onboarding; also inspected the fixture Home screenshot: existing centered composition, old artwork, input/button
  placement and gradients retained; no added header/blank band or new logo.

Screenshots in `test-results/brand-infrastructure/` are preservation evidence,
**not comparison against an absent approved ORYQEN logo**. No backend behavior,
database migration, environment configuration or hosted infrastructure was changed.

| Feature | Implementation / real evidence | Blocker / next action |
|---|---|---|
| Local Auth and persistence | 121 real-service checks pass; actual app restart, new browser session and fresh recipient sign-in | Hosted separate |
| Recovery / privacy | Recovery: 6 real checks; privacy requests, narrow MFA review, immutable timeline and capacity pass. Self-deactivation passes real MFA, stale-JWT denial, revision, immutable retry receipt, sign-in denial and outgoing-sharing suppression | Deletion/full account export still require approved retention procedures |
| Offers / employer | Real scoped lists, organization requests, independent/concurrent approval/revocation pass | Broader employer UX |
| AI | Gemini selected; configurable model, approval gate, redacted preview, grounded structured output; 15 affected mocked tests pass; 4 real budget checks | No live calls; provider account, region/retention approval and key pending; see GEMINI_PROCESSING_GATE.md |
| Company information | Persistent unverified representative claims, immutable corrections; real access/revocation tests pass | External company registry/verification source absent |
| Agreement / work / Passport | Real confirmation/verification; private download; named-recipient exact preview, activation, expiry, revocation, field removal and case suppression tested against persistent PostgreSQL | No public/bearer sharing; first 20 eligible records in selector; downloaded copies cannot be recalled |
| Cases | Real accepted-reviewer evidence access, revocation, conflicting concurrent decisions and suppression pass | Hosted/reviewer operating policy |
| Notifications | Real scoped offer/organization feed and immutable owner read receipts pass | Email/push, broader event types not implemented |
| Android | Gradle success, existing 4,411,431-byte APK signature verified | ADB emulator unauthorized; no installation/runtime pass; no physical device |
| Windows | Installed local Chrome PWA; 7 real tests pass, ready screenshot inspected | Requires running local backend; no EXE/MSIX or hosted distribution |
| Release | Local build passes | Hosted backup/restore, HTTPS/email/owner approval |

Dependency order: account recovery → worker/employer persistence/UI → AI/company
boundaries → recipient disclosure/cases/privacy/notifications → interaction fixes
→ Android → Windows → comprehensive verification → hosted approval package.
Uploads/OCR, matching and skills must follow actual specification boundaries;
there is no existing safe upload pipeline or verified external company dataset.

Latest completed real evidence under test-results: recovery-real-1792273752918 (6),
local-real-1792332005869 (121), ai-budget-real-1792275936570 (4),
windows-pwa-1792302445752 (7), privacy-capacity-1792327454340 (2 rollback-only
PostgreSQL boundary assertions). Latest local migration count: 22; hosted untouched.
Current regression: 271 passed / 14 skipped; 15 final affected unit tests passed
after grant-routing changes (one new test). All 14 skipped concurrent/connection
tests were exercised in separate real PostgreSQL fixture runs: Day 4 13 passed,
Day 6 18 passed, Day 7 33 passed (64 total executions). Evidence directories:
day4-postgres-1792332061446, day6-postgres-1792332068031,
day7-postgres-1792329844636. These use explicit synthetic database fixtures;
the real Supabase Auth/browser journeys above use actual sessions, not forged JWTs.
Full fixture browser suite: 68 passed, no skips, with registration enabled.
Production build/typecheck, full lint and final affected lint passed. Final real
deactivation/grant-login run: local-real-1792332005869, 121 passed / 0 failed.
No full-product completion claim. Failed runs remain visible, not counted as passes.

Privacy scope: received → in review / needs information → declined or manually
fulfilled; owner withdrawal is terminal. No self-review, no arbitrary administrator
role, no employment-record access for the privacy executor. The twentieth/final
audit slot is reserved for a terminal event. A fulfillment receipt attests a manual
procedure; it cannot itself export, deactivate or erase anything. Separate owner
deactivation blocks access and retains records; it is not data deletion or a
retroactive retraction of prior confirmations. Disabled accounts cannot recreate
their profile or sign in to the application. No self-reactivation is offered.

Exact remaining owner gates: approve actual Gemini product/account/processing and
retention terms, provide its local key and authorize a synthetic live test; provide
an authorized Android device or resolve emulator authorization; approve commercial
authority/privacy/retention and legitimate external company sources; approve the
encrypted hosted backup destination/scope and isolated restore, then a refreshed
migration/HTTPS/email/deployment package. No payments or hosted actions performed.

Read-only size evidence: test-results/directory-sizes.json. Approximate decimal GB:
node_modules 0.651; .next 0.667; .git 0.007; Android source/build 0.022;
.tmp 1.541; test-results 2.862; public assets 0.000411. Nothing deleted.
