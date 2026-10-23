# Local administrative operations

October 20, 2026. No hosted operation is authorized. Stage 10 remains in verification.

## Founder access checkpoint

Founder selected the existing local account `vehiview@gmail.com`, UUID
`0e699f45-09c8-4c13-9941-35cb50c6aa2c`, for verification only. Read-only inspection
confirmed its email and active profile; **verified TOTP was absent**. Selection is
not authorization to grant a role. No synthetic account may become the founder.

1. Start local services with `node scripts/start-local-development.mjs`, then
   `node scripts/run-local-development.mjs`. Open `http://127.0.0.1:3100/sign-in`.
2. Sign in personally. Open `/app/settings` → Account security → Set up account
   authenticator, or use `/operator/authority`. Add the private key to your own
   authenticator and verify a current code. Never paste the key/code into chat.
3. Run the read-only check:
   `node scripts/admin-owner-bootstrap.mjs --check --subject 0e699f45-09c8-4c13-9941-35cb50c6aa2c`.
   All three booleans must be true. These checks prove database enrollment status,
   not personal ownership by themselves; founder selection and personal sign-in
   are also required.
4. Request final explicit founder approval naming this UUID and the local-only
   role. **Do not perform the following commands before that approval.**
5. After approval, prepare a ten-minute, one-use authorization with a real approval
   reference (letters/digits/dot/dash/underscore, 10–100 characters):

   ```powershell
   node scripts/admin-owner-bootstrap.mjs --prepare --subject 0e699f45-09c8-4c13-9941-35cb50c6aa2c --approval-ref ACTUAL_FOUNDER_APPROVAL_REFERENCE
   node scripts/admin-owner-bootstrap.mjs --execute --authorization EXACT_PATH_PRINTED_BY_PREPARE
   ```

The script checks the fixed local container, unlinked project and isolated Docker
network. It rechecks account/MFA inside the grant transaction, serializes with
administrative writes, refuses any existing first-owner history, and records an
immutable audit receipt. Authorization expires after ten minutes and cannot be
replayed after a successful grant. The role survives authorization expiry, with
a **90-day access-review expiry**. This is not an indefinite owner assignment;
renewal needs another authorized owner or a separately reviewed offline recovery
procedure. No default password, public bootstrap endpoint or hosted grant exists.
The JSON approval record contains no credential and remains in ignored `.tmp`.
Offline machine/database administrators are trusted operators; the record is not
cryptographic proof of human approval. Do not invent an approval reference.

## Using the control center

Open `/admin`; log in and verify MFA. Sensitive actions require a TOTP-authenticated
session within ten minutes. Navigation, directory/global search, exact status,
UTC date windows and cursor pagination are available. Directory records are not
hidden merely because they predate the event date range. Totals are all-time;
charts use the selected range. No estimated cost or completed call count is
invented from AI consent receipts.

Owner: grant/revoke expiring admin roles and narrowly scoped domain capabilities.
Administrator: manage ordinary account suspension, notices, AI pause/quotas and
incidents. Support: incident workflow and independent case notes/priority.
Auditor: read-only. Database checks apply independently of the UI.

Every write needs an exact revision, reason, confirmation and idempotency key.
On conflict reload; never retry by changing the version blindly. On an uncertain
network result the unchanged form retains its key. Audit rows cannot be edited.
Account suspension keeps records; release cannot reactivate self-deactivated
accounts. Privileged accounts must first undergo explicit authority review.

Organization evidence, membership decisions, privacy fulfillment and case
decisions reuse their existing authorized workflows. Admin role alone grants no
document access. Local organization approvals remain `demo-authority.v1`, not
external business/legal identity verification.

Cases support append-only participant/reviewer responses, independent review,
internal administrative notes, priorities and linked appeals. A resolved case can
receive one linked appeal; current work must still be submitted and eligible for
case creation. Previous reviewer cannot be assigned to that linked appeal.
Original decisions and existing suppression remain unchanged; correcting an
upheld work version still requires the normal correction/verification workflow.
Case evidence reads record actor, case, time and participant/accepted-assignment
basis; no evidence text is copied into operational logs. Response notifications
contain no correspondence text.

`analysis_paused` blocks database admission. AI quota settings may only lower the
existing ceilings (100/day platform, 10/day/account, 3/minute/account). None enable
Gemini, change policy approval or bypass consent. `announcement` and
`maintenance_notice` appear in authenticated application screens. Notification
templates must include {title} and produce optional plain-text in-app messages,
retaining the original event title. Support categories are a comma-separated
subset of security,support,moderation for new incidents. Blank values restore
defaults; existing incidents can still be updated. No outbound delivery is enabled.

## Verification and recovery

Run `node scripts/test-admin-postgres.mjs --extended-setup` for an isolated native
PostgreSQL fixture cluster. It retains the cluster files and stops only its own
server. Fixture owner assignments are not grants to real local or hosted users.
`node scripts/test-admin-browser.mjs` tests actual components with explicit HTTP
fixtures and Next adapters outside application routes; it does not prove Auth.

Never roll back by deleting audit history, removing volumes, or applying invented
down migrations. Each new migration is transactional; after a failure stop,
inspect the error and exact applied history, and prepare a reviewed forward fix.
Hosted backup/restore, migration application, provider activation, deployment and
production authority remain separate approval gates.

## Remaining operational gaps

- Real founder admin login and privileged end-to-end actions await MFA and final
  owner approval. Enrollment is deliberately not completed by the agent.
- Durable sanitized server events are implemented. Login/MFA/sign-out/password
  events, anonymous failures and consent-linked provider outcomes are bounded and
  immutable. Coverage is partial; external availability and account-specific costs
  remain unverified/unavailable pending approved provider configuration.
- Legal retention/purge configuration and external organization verification
  cannot be activated without approved policies. Privacy review records do not
  execute deletion or claim an export occurred.
- Organization suspension and one linked appeal of a rejection are implemented.
  Suspension affects current representative access, not historical verification.
  Previous reviewers cannot decide linked organization appeals.
- Native Android/Windows release evidence is historical Stage 8; new admin UI
  has local desktop/mobile browser scope only.

## Local telemetry setup

After guarded local migration startup run `node scripts/prepare-local-telemetry.mjs`.
It checks isolated Docker, secures the ignored credential with owner/SYSTEM-only
Windows ACLs and enables only the append-only writer. The guarded app launcher
injects ORYQEN_TELEMETRY_DB_URL; never place a database-owner credential there.
Do not enable a hosted writer or retention deletion without separate approval.
See the latest Stage 10 report for exact migration hashes and evidence.
