# Stage 9 release candidate — October 19, 2026

Baseline: Stage 8 evidence is historical until specifically rerun. Release is
**NO-GO**. Local test success does not authorize hosted or commercial activation.

| Explicit gap | Severity / dependency | Release impact and action |
|---|---|---|
| Historical offer revision browsing | P1, local database/API/UI | Implement authorized immutable history without restoring old terms into active confirmation |
| Passport first-page sharing/export limit | P1, local UI/API | Add bounded pagination; fresh eligibility remains authoritative; no stale export |
| Activity excludes agreement/work/integrity events | P1, local RLS projections | Extend participant activity without exposing reviewer evidence or unrelated events |
| Email/push notifications | P2, delivery provider, consent/credentials | In-app feed usable; outbound delivery remains explicitly unavailable until approved |
| OCR/upload | P1, untrusted-file processing and language/model support | Existing input disconnected; evaluate local-only extraction, never silently send documents to AI |
| Skills/matching | P2, no approved verification/matching contract | Cannot turn work statements into certified skills or invent job listings |
| Salary benchmarks, legal/fraud verdicts | P1, legitimate data sources/jurisdictions | Deterministic explanation works; no unsupported market/legal/fraud claims |
| External company verification/commercial authority | P0, owner/provider operating policy | Synthetic bootstrap cannot establish commercial legitimacy |
| Privacy export/deletion fulfillment and retention | P0, owner/legal decisions | Request tracking and deactivation exist; irreversible deletion remains prohibited |
| Gemini live processing | P0, account/product/region/retention and credentials | Keep personal-data transmission disabled; validate fail-closed configuration and consent |
| Production abuse monitoring/support | P0, operator responsibilities/deployment | Existing SQL quotas and safe logs retained; prepare operational gates |
| Approved logo and native visual review | P0, owner-supplied masters | Infrastructure retained; no invented identity or visual-parity claim |
| Android production transport/signing/physical device | P0, HTTPS origin/identity/key/device | Debug emulator evidence is historical; prepare gated pipeline, no release claim |
| Windows distribution | P1, HTTPS and official icons | Installed local PWA exists; finalize instructions; no EXE/MSIX |
| Hosted migrations/backup/restore/SMTP | P0, owner approval and destination | Prepare exact current package; no hosted execution |
| Offline editing/private cache | P2, conflict/privacy contract | Keep truthful errors and no cached private records; not an offline application |

## Implemented in this stage

- Immutable, authorized offer-history API and read-only revision panel. Cursor
  paging, refresh recovery, field allowlist and immediate representative-revocation
  denial. Historical terms cannot be confirmed as the active agreement revision.
- Passport sharing can select subsequent eligible pages. Failed reads clear stale
  selections. Private JSON downloads read all pages up to 1,000 records, authorize
  every page, reject duplicate/cyclic/changing identities and abort entirely on a
  denied page. It is explicitly a non-atomic personal copy, not a signed certificate.
- Agreement decisions, work verification/dispute/rejection and integrity events
  join the in-app activity feed through existing participant RLS. No private reason,
  evidence or new reviewer privileges are exposed. Email/push remain unavailable.
- Actual on-device English screenshot OCR, with bundled Tesseract 7.0.0/model,
  same-origin worker CSP, bounded PNG/JPEG input/dimensions/output, cancellation,
  timeout and editable review. No image upload, persistence, provider transmission
  or automatic save. Unsupported languages/PDF/handwriting remain explicit.
- Offline migration-manifest/preflight/postflight generator and fail-closed Android
  release preflight. Existing approved-asset gate remains pending; no logo invented.

New migrations (existing files were not rewritten):

1. `202610190001_offer_history.sql` — immutable history projection, executor ownership
   and authenticated RPC grant; existing participant authorization retained.
2. `202610190002_workflow_notifications.sql` — replaces only the invoker activity
   projection; no table/grant/policy expansion or destructive data operations.

Both are applied **only to isolated local Supabase**. There are 24 pinned local
migrations, thus 20 pending relative to the historical four-version hosted baseline.
Hosted history has not been refreshed in Stage 9. Fresh comparison is mandatory.

## Release procedure and approval boundary

Generate the exact full order, filenames, hashes, dependency order, SQL review flags
and read-only assertions with `node scripts/prepare-release-candidate.mjs`. It has
no connection or execution mode. Its `test-results/stage9-release-*/` output is the
current package; old six-migration activation plans are historical, not executable
inventory for this build. The legacy `authorize_ai_transmission_v1(jsonb)` must
remain inaccessible to clients; its guarded replacement is the public entry point.

Before any hosted mutation:

1. Owner confirms the intended project and approves read-only history/config review.
   Compare exact applied versions and stored migration statements where available;
   do not infer hosted file hashes from version numbers. Abort on drift/unknown files.
2. Approve backup destination, full scope, operator, encryption, retention and restore
   target. Owner-proposed `C:\Users\vehiv\ORYQEN-Secure-Backups` is still **not approved
   or verified encrypted**. Development DB on 55422 is never a restore target.
3. Execute the separately approved export/rehearsal procedure in
   [ORYQEN_BACKUP_RESTORE_EXECUTION.md](ORYQEN_BACKUP_RESTORE_EXECUTION.md), including
   full database archive, role definitions without passwords, policies/grants/owners,
   Auth rows and migration history. Docker and PostgreSQL 17.11 clients are now
   available locally, superseding that document's old tool-absence observation.
   Use protected service/password files, not credentials in command arguments.
4. Restore only to a new isolated, no-egress, Supabase-compatible PostgreSQL 17 target
   with separate volume and loopback 55432, after checking that port is free. Neither
   provisioning nor restore of hosted data has been executed. Vanilla PostgreSQL
   alone does not prove compatibility with managed roles/extensions/encryption.
5. Verify archive hashes, TOC, schema/roles/ACL/RLS, counts, sequences, receipts,
   authority, revoked shares, disabled accounts, case/withdrawal suppression and
   two-account denials. Measure RPO/RTO against owner-approved targets. A successful
   dump or archive listing is not restore evidence. Fail on missing privileges.
6. Rehearse the exact missing migration sequence against the restored baseline,
   one transaction/history receipt at a time using the reviewed migration runner.
   Review all SQL, not just keyword flags. Then separately approve the real change
   window, maintenance controls, application artifact, environment and Auth settings.
7. Postflight requires every catalog assertion true plus real HTTPS two-account/MFA
   tests. Stop on errors; do not skip versions or manually fabricate history rows.
   Prefer a reviewed forward fix. A backup restore requires separate approval and
   reconciliation of post-snapshot revocations, withdrawals, disabled accounts and
   audit events. Application rollback must be schema/security compatible.

Database export does not preserve Storage object bytes, external providers,
SMTP/API/signing secrets or all hosted Auth configuration/encryption material.
Copied Auth rows do not guarantee usable MFA/sessions after restore. Free plan is
owner-confirmed; no upgrade, purchase, backup or restore was performed. Storage
capacity must be measured again; historical 11.3 MiB is not a current estimate.
See [Supabase backups](https://supabase.com/docs/guides/platform/backups) and
[restore guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## HTTPS, Auth and Gemini configuration

Use a full Next.js server deployment, not static export. Owner selects a stable
HTTPS staging origin and account/plan; ordinary Next-compatible managed hosting is
the smallest migration. No origin or deployment is invented or created.

Environment names: `APP_ORIGIN`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `FAIRWORK_DATA_MODE`,
`AUTH_REGISTRATION_ENABLED`. Keep data mode `synthetic`, registration false outside
the separately approved controlled window, and no service-role key in the app.
Production cookies require HTTPS. Match Supabase site URL and explicit confirmation
and recovery redirects to the approved origin; configure verified SMTP sender/DNS,
email confirmations, password policy and TOTP. Never add wildcard/HTTP production
redirects or enable public registration to work around a failed test.

Gemini names: `ORYQEN_AI_PROVIDER`, `GEMINI_MODEL`, `GEMINI_API_KEY`,
`ORYQEN_AI_ENABLED`, `ORYQEN_AI_POLICY_APPROVED`, `ORYQEN_AI_POLICY_APPROVAL_REF`,
`ORYQEN_AI_PROCESSING_REGION`, `ORYQEN_AI_DATA_USE`. Approval and enablement remain
false/unset. Keys are server-only; no `NEXT_PUBLIC_` key. Adapter, explicit consent
bound to the exact redacted preview, quotas, timeout, output validation and rule-based
fallback exist. Tests simulate provider responses; they do not validate live access.

The implemented product is Gemini Developer API, not Vertex AI. Region disclosure
does not route processing. The founder must review the actual account/product/tier,
no-training terms, retention/abuse exceptions, logging/caching, regional guarantees
and age eligibility. If incompatible, a separately approved product/adapter is
required. No zero-retention or legal approval is claimed. After approval/key setup,
run synthetic-only live smoke tests before authorizing personal information.
Sources: [Gemini terms](https://ai.google.dev/gemini-api/terms),
[retention guidance](https://ai.google.dev/gemini-api/docs/zdr), and the detailed
[processing gate](GEMINI_PROCESSING_GATE.md).

## Android release pipeline — prepared, blocked

`node mobile/poc/scripts/release-preflight.mjs --require-ready` deliberately exits
1 while prerequisites are missing. Existing Gradle release disabling, debug-only
loopback HTTP exception and local app ID are preserved. Stage 8 actually built and
installed a **debug APK** on an emulator; this is not a signed production candidate.

Required order:

1. Approve final application ID, distribution route/version, official icons and
   HTTPS backend/transport. Capacitor's existing `server.url` is debug live reload;
   simply swapping in HTTPS is not a completed production architecture. Preserve
   hosted SSR/API/auth. Review a maintained production WebView/TWA approach or a
   packaged client separately; do not static-export server-dependent routes.
2. Integrate approved production transport in the existing project, with HTTPS-only
   navigation allowlist, external-link handling, no debug overrides/WebView debugging
   and verified callback/session behavior. Only then enable a guarded release variant.
3. Owner creates/holds the upload/release keystore outside the repository on protected
   storage, records alias/certificate fingerprint, backup/recovery and custodian. Use
   Android Studio's signing UI or secret-store-backed Gradle properties; passwords
   never appear in command arguments/logs. Play upload and app-signing keys are
   distinct responsibilities. [Android signing](https://developer.android.com/studio/publish/app-signing).
4. Build `bundleRelease` for Play or `assembleRelease` for approved APK distribution
   only after the guard passes. Verify signature, certificate, package/version,
   merged manifest (no cleartext/debuggable), permissions, embedded hosts/assets and
   artifact SHA-256. No release artifact was generated in this stage.
5. Install on an owner-authorized physical device using normal HTTPS, **without adb
   reverse**. Test clean install and signed upgrade preserving data; Splash/onboarding;
   confirmation/recovery links; independent worker/employer sessions; MFA; all offer,
   agreement, work, Passport/share/case flows; revocation; Back/keyboard/root exit;
   rotation, process death, slow/offline/reconnected API, downloads/OCR, accessibility
   and safe areas. Record OS/WebView, device, exact artifact hash and failures.

## Windows PWA distribution

Stage 8 installed and tested the local Chrome PWA (nine checks). No native EXE/MSIX
exists. For release, keep a stable HTTPS origin and manifest identity/scope/start URL,
install owner-approved icons and inspect 192/512/maskable assets. Serve manifest and
assets without mixed content; keep private routes/APIs no-store. This product does
not promise offline editing or cache private employment records.

After approved deployment: open the origin in supported Edge/Chrome, use Install
app, launch from Windows Start, verify standalone window and real Auth/MFA; close
and reopen, test update/session/recovery links and offline recovery. Test uninstall
and reinstall only in a dedicated synthetic browser/Windows test profile, retaining
database audit history. Record exact browser/Windows/build; do not delete the
founder's profile. Staging-origin install is not evidence for a different final origin.

## Policy and commercial decisions — owner/counsel required

These are decision checklists, **not approved policies**:

- Privacy: controller/legal entity, contact, jurisdictions, user age eligibility,
  categories/purposes/legal bases, processors/transfers/regions, rights/complaints
  and incident notification ownership. Confirm whether employment data includes
  special categories and prohibit unnecessary collection.
- Retention: periods per offers, evidence, decisions, receipts, auth/mail/logs,
  shares and backups; purpose and legal holds; irreversible erasure/export fulfillment
  procedure; handling immutable audit obligations and downstream copies. Deactivation
  is access suspension, not deletion. Do not perform unapproved erasure.
- Consent: AI preview/provider/model/data use/region notice, voluntary purpose,
  withdrawal for future processing, named-recipient field preview/expiry/copy limits,
  versioned consent and demonstrable independent confirmation.
- Terms/commercial: service scope and limitations, no legal/fraud/skill certification,
  employer representative verification/evidence policy, independent reviewer staffing,
  conflicts/appeals, dispute handling, support/SLA, prohibited conduct and liability.
  Approve pricing/refunds/tax/payment processors separately; no billing activation.
- Operations: distributed abuse limits at the real deployed edge/Auth provider,
  redacted monitoring/alerts, incident response/operator access review, restore drills,
  dependency/model-license review and security-update ownership.

Account/profile/MFA, scoped organizations/representatives, cases, privacy requests,
sharing and deactivation are implemented. External company verification, production
authority bootstrap, actual deletion fulfillment, email/push, certified skills/job
matching and market/legal/fraud sources still require real contracts/providers and
operating decisions; do not substitute invented services or broaden privileges.
Case/work detail-history paging and query/load limits, a full nonce/script CSP,
screen-reader/device accessibility and production abuse telemetry remain release
hardening gates beyond the current fixture/functional evidence.

## Exact founder actions and GO / NO-GO

1. Supply approved logo master/wordmark and mark, theme variants, provenance and
   clear-space rules at the documented `public/oryqen/approved/` locations.
2. Approve or reject the concrete Gemini product/account policy; provide a local
   server-side key only after approval. Do not paste credentials into chat.
3. Select stable HTTPS staging origin/hosting and SMTP sender/account; approve the
   synthetic-only staging scope and operational/legal decisions above.
4. Verify encrypted backup storage/ACLs, isolated restore target and retention;
   separately authorize export/rehearsal. Then approve the reviewed 24-file migration
   package, exact missing versions, Auth changes and deployment window.
5. Assign independent authorized employer/operator test accounts. Run the existing
   controlled two-account procedure with real confirmation/MFA, offer → independent
   agreement → verified Work Record → private/shared Passport, then revocation and
   suppression. Retain immutable evidence; no deletion to make a test pass.
6. Approve Android distribution/signing/production transport and provide an authorized
   physical device. Verify final HTTPS Android and Windows builds before promotion.

**Final release assessment: NO-GO.** Safe local implementation can be verified;
hosted/commercial activation, production Android and live personal-data AI are not
approved or proven. No hosted operation, deployment, purchase, commit or push occurred.

## Verification evidence

All results below were executed locally in Stage 9, except platform results marked
historical. No hosted account or provider request is included.

| Command/check | Actual result / evidence |
|---|---|
| `node scripts/test-local-real-workflows.mjs --manage-app` | **131 PASS**, real Supabase Auth/API/PostgreSQL, independent synthetic accounts, local email/TOTP, app restart, durable data and denials. `test-results/local-real-1792367296707/results.json` |
| Earlier real history-focused integration | 119 PASS, no managed app restart in that run. `test-results/local-real-1792353531633/results.json`; superseded by the 131-check run |
| `node node_modules/vitest/vitest.mjs run` | **288 PASS / 14 conditional skips**, 42 files. The 14 require native PostgreSQL and were separately exercised below |
| `node scripts/test-day4-postgres.mjs` | **13 PASS**, `test-results/day4-postgres-1792368438872/tests.log` |
| `node scripts/test-day5-postgres.mjs` | **20 PASS**, `test-results/day5-postgres-1792368483018/tests.log` |
| `node scripts/test-day6-postgres.mjs` | **18 PASS**, `test-results/day6-postgres-1792368519555/tests.log` |
| `node scripts/test-day7-postgres.mjs` | **33 PASS**, `test-results/day7-postgres-1792368545693/tests.log` |
| `$env:AUTH_REGISTRATION_ENABLED='true'; node scripts/test-browser.mjs` | **77 PASS**, isolated production build, API fixture journeys. `test-results/stage9-browser-full.log`. OCR executes real WASM on synthetic image, not a mocked OCR result |
| Same browser command with `tests/e2e/stage9-local-completion.spec.ts` | Final **4 PASS** after overlap fix/screenshot improvements; `test-results/day2-browser.log`. Multi-page sharing/export, denied partial download, real OCR/no auto-submit, disguised-file rejection/cancel |
| `node node_modules/typescript/bin/tsc --noEmit` | Final standalone PASS after generated files stabilized |
| `node node_modules/eslint/bin/eslint.js . --max-warnings=0` | Final PASS, no warnings |
| Production build via `scripts/test-browser.mjs` | Final Next compilation/type generation PASS; `test-results/day2-browser-build.log`. Full Next server routes retained |
| `node scripts/prepare-local-ocr.mjs` | PASS, 14,852,724 bytes of pinned self-hosted vendor/model/notices; SHA-256 inventory `public/ocr/vendor/manifest.json` |
| `node scripts/prepare-release-candidate.mjs` | PASS, 24 pinned files; final package `test-results/stage9-release-1792368411033/` |
| Generated postflight SQL, local `docker exec -i supabase_db_oryqen-local-dev psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At` | Six true assertions, read-only transaction rolled back; `local-postflight.txt` in the package. No hosted preflight executed |
| `node scripts/verify-android-poc.mjs` | PASS source invariants: exact debug loopback exception, release guard, permissions/backup/Back handler. Not runtime testing |
| `node mobile/poc/scripts/release-preflight.mjs --require-ready` | Expected exit **1 / NO-GO** for production prerequisites; debug guard preserved |
| `node scripts/check-brand-assets.mjs` | PENDING, no approved masters; no substitution |

Native fixture suites total **84 executions**, separate from the real-account
journey. They retain local data directories and stop only their own clusters.
CI now checks OCR artifact preparation, release manifest and pending brand status;
GitHub CI itself has not run because no push was authorized.

Screenshots opened and inspected: `test-results/stage9-ocr-mobile.png` (390×844),
`stage9-ocr-desktop.png` (1280×900), and real
`local-real-1792367296707/offer-history.png`. Original centered layout, blue/cyan
surface and navigation remain. OCR action is visibly reachable above navigation;
browser hit-testing verifies its center is unobscured. These are implementation
evidence, not parity against an absent approved ORYQEN master logo.

Failed attempts retained/disclosed: initial npm metadata request hit sandbox DNS;
rerun with approved network access succeeded. Package license filename was corrected
before artifact generation; worker-global lint reference corrected. Initial
focused browser run was 7 PASS / 2 failed because the test's generic alert selector
also matched Next's route announcer (`stage9-browser-initial.log`); scoped selectors
then passed. A standalone typecheck raced dev-generated files during app restart;
sequential final check passed. Initial release assertion incorrectly expected every
API function to be client-executable; the explicitly revoked legacy AI RPC is now
required to remain denied. No database grants were weakened to satisfy the check.

Security observations: no new RLS/authority bypass was found in these tests.
History/feed denial, private field allowlists, exact-revision work decisions and
suppression remain enforced. Image signature and declared dimensions are checked
before decoding; decoded bounds, timeout and termination provide additional limits.
Browser decoder vulnerabilities/resource exhaustion are not ruled out by input bounds.
OCR is English-only, fallible and not native-device-tested in Stage 9. Export is
bounded/non-atomic and shared/downloaded copies cannot be recalled. Provider region,
commercial authority, production abuse monitoring and legal compliance are unverified.

Historical platform evidence remains Stage 8: installed/signature-verified debug APK
11 emulator checks (`test-results/android-real-1792352583553/results.json`) and
installed local Windows PWA 9 checks (`test-results/windows-pwa-1792351939823/results.json`).
Stage 9 does not claim a new native install, physical-device pass or signed release.

Manual local testing: start Docker Desktop, run `node scripts/start-local-development.mjs`
then `node scripts/run-local-development.mjs`. Open `http://127.0.0.1:3100/register`,
confirm via `http://127.0.0.1:55424`, create a profile, sign in and test saved offers
or Screenshot extraction. Representative authority still requires a distinct scoped
operator; registration never grants employer/admin privileges. Retain audit records.
The founder app is restored on 3100 after verification; its launcher PID and logs are
in `test-results/founder-local-app.pid` and `stage9-founder.*.log`.
