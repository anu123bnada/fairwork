# ORYQEN feature sprint — 25 October 2026

## Preservation and scope

Repository: `C:/Users/vehiv/Desktop/fairwork`; branch `release/oryqen-oct27`;
starting HEAD `d780bea`. No commits, pushes, deployments or hosted mutations authorized.
Preserve pre-existing modifications to the auth release document, confirmation/sign-in
routes, identity/recovery/registration services, four auth test files, and untracked
`src/lib/auth-errors.ts`, `src/server/identity.ts.bak`, `landing/v6/next-env.d.ts`.
The current request supersedes historical feature exclusions, but does not waive
authorization, consent, privacy or release verification requirements.

## Initial source audit

All fourteen vision areas inventoried below. COMPLETE is not claimed from source
presence. Existing tests are inventory evidence until rerun in this sprint.

| Capability | Existing UI / API / database / security / tests | Initial status and missing proof |
|---|---|---|
| AI employment intelligence | Manual/paste/OCR correction, structured assessment, server Gemini adapter, consent/budget RPC, authorized offer reads, provider safety tests | PARTIAL: generated results not durably retained; provider activation and hosted flow unverified |
| Company research | Company profiles/search, companies RPC, stored organization claims/reviews, authority checks, claim tests | PARTIAL: stored-record coverage only; no external registry; hosted verification absent |
| Offer management | Saved revision editor, list/history/comparison, participant RPC/RLS, unit/SQL/browser tests | PARTIAL: no archive or personal decision lifecycle; unfinished draft behavior needs review |
| Digital agreements | Versioned creation/proposal/acknowledgment/decisions/history, RPC and immutable SQL, participant/authority tests | PARTIAL: manually opened agreement loses URL on refresh; fresh hosted acceptance absent |
| Work records/evidence | Agreement-backed work drafts/submissions/revisions/timeline, text evidence import, RPC/RLS tests | PARTIAL: requires confirmed agreement; standalone self-reported employment absent; private file storage unavailable |
| Work Passport | Eligible evidence profile, named-recipient grants/revocation, export, projection/isolation tests | PARTIAL: self-reported history/profile coverage incomplete; hosted share acceptance absent |
| AI assistant | Private persistent questions/history, topic guidance, authorized optional offer context, SQL/API/browser tests | PARTIAL: explicitly rules-based only; Gemini conversational integration absent |
| Security/identity/accountability | Auth/confirmation/recovery/profile/MFA, protected routes, RPC grants/FORCE RLS, audit/quota tests | PARTIAL: preserve ongoing transport fixes; staging email/session/RPC configuration unverified |
| Opportunities/recommendations | Persistent listings/preferences/choices, rules matching, publisher authorization, SQL/browser tests | PARTIAL: actual hosted schema/workflow unverified; no external feed |
| Employer portal | Organization requests/membership/claims, representative work/case flows | PARTIAL: genuine employer assurance and hosted operation unverified |
| Disputes/appeals | Cases, assignments, followups and appeal RPC/UI, reviewer conflict checks | PARTIAL: hosted independent-review acceptance absent |
| Audit trails | Append-only workflow history, receipts, admin audit and database integrity tests | PARTIAL: hosted catalog/recovery proof absent |
| Admin control center | Scoped queues/settings/review UI/API, MFA/capability guards, tests | PARTIAL: authorized hosted operators and operating procedures unverified |
| Notifications/settings/search | Recipient-scoped notifications, profile/privacy settings and scoped search | PARTIAL: operational delivery and hosted acceptance unverified |

Shared foundation: branded authenticated dashboard exists, but needs richer persisted
activity/navigation. Android Capacitor architecture is preserved; no native acceptance
or production signing has been established in this sprint. Tailwind is not installed;
reuse the existing authored CSS instead of replacing the styling system.

## Read-only environment inspection

`node scripts/hosted-auth-readiness.mjs --network --migration-list` completed on
25 October. It inventoried 32 local migrations. The configured Supabase public
settings have a valid shape, but the linked-project check failed and APP_ORIGIN
is not a canonical HTTPS hosted origin. The script correctly did not contact the
unmatched project. Remote migration inventory remains unknown; do not infer parity
or change the link/configuration automatically. Sanitized report:
`test-results/hosted-auth-readiness-1792894155956.json`.

## Implementation in progress

- Offer lifecycle: actor-private archive/restore and decision tracking, with SQL isolation tests.
- AI: reject numeric extraction not supported by the quoted source.
- Agreements/records: refresh-safe agreement retrieval, then standalone self-reported history.
- Dashboard: persisted work/history activity and direct workflow navigation.

## Release decision

NO-GO pending hosted authentication, migration parity, actual persistence/isolation
acceptance, AI provider proof and operational/security gates. No hosted feature is VERIFIED.

## Continuation checkpoint — 25 October

Current branch remains `release/oryqen-oct27`. External work advanced HEAD to
`a25663a` (after `158fdd6` integrated the prior sprint). This session did not commit,
push, deploy, change hosted configuration or apply hosted migrations.

Completed local slices:

- Connected private offer decisions/archive/restore to the existing lifecycle RPC.
  Retries reuse keys; archive never changes agreement acceptance.
- Restored sign-in account-access enforcement removed by the newer commit:
  disabled accounts fail closed, missing profiles return the onboarding signal,
  and rejected post-password access clears the local session.
- Shared API client now handles network failure, timeout, gateway HTML and malformed
  success envelopes with safe errors. It does not automatically retry writes.
- AI numeric extraction must match a complete numeric token in its exact quotation;
  fabricated salary/hour values fail closed. Comma-grouped amounts are supported.
- Added private PostgreSQL offer draft revisions independent of company membership,
  revision/idempotency guards, FORCE RLS, immutable history, bounded listing,
  strict API validation and editor UI for save/reload/edit/use-as-new-offer.
  Drafts are explicitly self-reported and cannot create company verification.
- Earlier dashboard work-record navigation and refresh-safe agreement lookup are
  present and covered by this continuation's browser checks.

Validation at this checkpoint:

- Full suite before draft addition: 65 files, 462 passed, 17 skipped.
- AI grounding/API reliability/lifecycle focused suite: 45 passed.
- Draft SQL/API suite after fixing a SQL name ambiguity: 6 passed.
- Typecheck and lint passed with draft code. `git diff --check` passed.
- Isolated production build passed; initial browser suite 19 passed, 1 skipped
  (registration was disabled in that build). Follow-up enabled-registration and
  draft browser run is in progress; do not count it as passed yet.
- Initial sandbox tests failed with missing Vitest temp modules; sandbox build
  failed creating a Windows junction. Approved runs outside sandbox passed.
  These failures were environmental, not waived application checks.

### Actual staging read-only findings

The temporarily available Supabase connector identified `oryqen-staging`
(`jpvgsmzomlmowarlfkdl`). Its migration history contains the 32 repository versions
through `20261024053156_private_guidance_history`; lifecycle and new drafts are not
deployed. This supersedes the earlier unknown remote inventory, but does not prove
body-hash parity, API schema exposure or the deployed application's environment.
Catalog inspection found zero private tables missing enabled/forced RLS.
`fw_user_exec` and `fw_policy_exec` have no LOGIN, SUPERUSER or BYPASSRLS.
Inspected identity/list RPCs deny anon EXECUTE and have fixed empty search paths.
`account_access` exists; `offer_lifecycle` does not yet exist on staging.

Security advisor flags 47 authenticated SECURITY DEFINER RPCs: these are intentional
entrypoints owned by scoped executors and need review, not blanket privilege removal.
It also flags disabled leaked-password protection; see
[Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
No hosted setting was changed.

### Remaining release work

Self-reported employment history/private Passport integration, durable generated-AI
analysis history, conversational Gemini guidance, end-to-end staging email/session/
cross-user acceptance, native Android acceptance and policy/operational gates remain.
Do not claim all eight target features complete. Existing rule guidance remains labeled
as rules. Original-file uploads remain disabled. Hosted provider success is unverified.

Proposed future staging change (requires separate explicit approval): review/apply
only the additive lifecycle and draft migrations after backup and migration hash
review, then deploy matching code and test two controlled users. Rollback is application
reversion with additive private tables retained; never delete user revision history.
Enabling leaked-password protection is a separate Auth setting change; record its old
value and restore it only if the owner approves rollback.

Safe next commands: `git status --short`, `npm run typecheck`, `npm run lint`,
`npm test -- tests/integration/offer-drafts-db.test.ts tests/unit/offer-drafts-api.test.ts`.
Use the existing isolated browser runner for subsequent UI changes. Keep
`landing/v6/next-env.d.ts` and `src/server/identity.ts.bak` untouched.

## Latest browser verification and completion matrix

The enabled-registration rerun passed all 4 tests after fixing the saved draft
textarea's explicit label association. Its optimized production build passed.
The prior run's draft test failure is resolved, and the previously skipped missing-
profile flow now passed with registration enabled. Browser fixtures prove UI behavior;
the independent SQL suites prove local persistence/authorization. Neither is hosted
acceptance. The full suite is being rerun after the added draft migration.

| Feature | UI | API | Database | Security | Tests | Hosted Verification | Status |
|---|---|---|---|---|---|---|---|
| AI employment intelligence | Structured rules and optional provider | Server provider, numeric grounding | Offers durable; generated result history missing | Consent, redaction, quotas | Provider safety tested | BLOCKED: live provider acceptance absent | PARTIAL |
| Company research/trust | Stored authorized records | Search/profile RPC | Claims/review history | Representative scope | Existing tests passing in baseline | Stored catalog inspected, journey unverified | PARTIAL |
| Offer management | Drafts, edit, compare, archive/restore, decisions | Draft/lifecycle routes connected | Immutable drafts and lifecycle added | Actor-scoped FORCE RLS, retry/revision guards | SQL/API/browser passed | Two additive migrations pending | IMPLEMENTED BUT UNVERIFIED |
| Digital agreements | Exact revisions and refresh-safe retrieval | Existing workflow | Immutable history | Participant/authority guards | SQL baseline and browser passed | Real staging journey unverified | IMPLEMENTED BUT UNVERIFIED |
| Work records/evidence | Agreement-backed work and evidence | Existing RPC | Persistent versioned records | Scoped participant access | Existing SQL tests | Unverified | PARTIAL |
| Work Passport | Verified projection/export/sharing | Existing RPC | Eligibility and grant history | Private by default, recipient grants | Existing SQL tests | Share acceptance unverified | PARTIAL |
| AI assistant/guidance | Private questions/history | Rules guidance | Persistent private turns | Authorized optional context | Existing tests | Gemini conversational integration absent | PARTIAL |
| Security/identity | Registration/profile/recovery/sign-in | Restored access check | Existing identity/account RPC | Local guards plus inspected hosted RLS | Auth tests and enabled-profile browser passed | Email/session/deployment parity incomplete | PARTIAL |

Confirmed local journeys: save a private draft without an organization, reload/edit
and populate a new offer; compare two saved offers; archive/restore and record private
intent; reopen an agreement after refresh and reject lost access; navigate saved work
from the dashboard; recover from API network/gateway failures; complete a missing
profile after sign-in. Actual staging counterparts remain unverified.

The attempted standalone self-reported history slice produced no saved implementation
after tool stalls/worker limits and is explicitly pending. No native Android build or
device acceptance was attempted. No generated-AI history or conversational Gemini
success is claimed. Release decision remains NO-GO for unrestricted production use.

Final local verification: full suite **67 files passed, 471 tests passed, 17 skipped**
(208.03 seconds). Final lint passed. Optimized production build and the enabled-
registration/draft browser run passed (4/4); the earlier broader browser run passed
19 with 1 then-disabled-registration skip, subsequently covered successfully.
No unresolved failing local test remains in these runs. Skipped native/concurrency
checks are not counted as passed. All code changes remain uncommitted.
