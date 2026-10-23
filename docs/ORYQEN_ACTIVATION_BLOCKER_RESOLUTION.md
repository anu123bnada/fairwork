# ORYQEN — hosted activation blocker resolution

October 16, 2026. Deadline: **October 23, 2026, 19:00 Asia/Colombo**.

**Hosted activation remains NO-GO.** Local preparation and authorized read-only
inspection are complete for this task. No database export, restore, hosted write,
migration, account creation, Auth change, deployment, commit or push was performed.
Commands marked approval-gated below are instructions, not execution evidence.

This supplements [the activation plan](ORYQEN_HOSTED_ACTIVATION_PLAN.md) and
[authentication readiness](ORYQEN_HOSTED_AUTH_READINESS.md). The former retains the
complete per-migration object inventory, risk analysis and stage assertions. Its
previously unverified Auth fields are superseded by the dated observations below.

## 1. Evidence and remaining owners

Fresh sanitized report: `test-results/activation-blockers-1792156055428/report.json`,
**2026-10-16 13:07:38 UTC**. It matches the already-linked project fingerprint.
Only CLI metadata/configuration reads and a read-only SQL transaction were used.
Project names, URLs, credentials, email addresses and individual user rows were not
printed or exported. The isolated comparison configuration under that report's
`probe/` directory contains deliberately invalid destinations. **Never push it.**

| Blocker | Evidence / local resolution | Owner / external dependency / approval |
| --- | --- | --- |
| Current Supabase subscription | CLI matched the organization but returned no plan field. **UNVERIFIED**, not assumed Free. | Owner confirms Billing plan and available Backups/Restore features. Do not upgrade without approval. |
| Recoverable backup | Earlier read-only backup inventory: zero listed backups, PITR off. No export or restore rehearsal. Procedures below prepared. | Existing DB credential, encrypted destination, retention/RPO/RTO, backup operator and isolated restore target; approval to export sensitive data and provision target. |
| Backup tools | Supabase CLI 2.120.0 present. Docker, `pg_dump`, `pg_restore`, `psql` not found on PATH/checked standard locations. Embedded PostgreSQL package has server tools, not these clients. | Approve client installation; Docker/local Supabase if chosen. No installation performed. |
| HTTPS application | No verified staging origin. Local source package prepared and hash-checked. | Hosting account, eligible plan, approved dedicated staging project/origin and deployment approval. |
| Email delivery | Custom SMTP disabled; actual delivery untested. | SMTP provider/account, verified sender/DNS, inbox access and approved configuration/testing. Provider/domain costs depend on existing services and quota. |
| Auth alignment | Exact mismatches in section 5. | Owner approves only specified Auth changes. Signup stays off until the controlled window. |
| Schema | Four foundation versions applied; six pending; six pinned hashes verified locally again. | Tested recovery and separately approved staged migration window. |
| Independent authority | TOTP configuration enabled, but hosted MFA factor count is zero. Capability ownership was not expanded or inferred. | Authorized independent operator, actual MFA enrollment/challenge, existing scoped capability and reviewed representative evidence. Any missing capability/bootstrap is a separate approval gate. |
| Hosted two-account evidence | Executable plan mode passes; no hosted journey executed. | Two controlled inboxes, approved synthetic identities, live email confirmation, separate browser sessions and explicit write/retention approval. |

PostgreSQL reports **17.11**. Aggregate counts: 3 Auth users, 3 identities, 0 MFA
factors, 0 Storage buckets, 0 Storage objects and 0 Vault secrets. These are dated
counts, not a backup and not proof of continuing emptiness. Seven non-internal
triggers and zero policies were found in Auth/Storage schemas; trigger ownership
and definitions still need protected backup inventory, not an assumption that all
seven are application customizations. Eight foundation private tables retain FORCE
RLS and `fw_schema_owner` ownership. The inspection role bypasses RLS; the future
backup connection's effective privileges still require verification.

Earlier evidence retained: `test-results/hosted-activation-inspection-1792153982129.json`
(12:32:49 UTC), **24/24 baseline assertions PASS**. Historical tests from that
preflight: 33 native PostgreSQL tests, 220 regression passes / 14 native-only skips,
typecheck and lint passed. They were not rerun or relabelled as fresh hosted tests.

## 2. Backup choice and coverage

The account plan is an owner-confirmation blocker. Logical exports are an option
without assuming a paid upgrade. Supabase documents daily backups for Pro/Team/
Enterprise, with 7/14/30-day availability respectively, and a paid PITR option;
Free projects should maintain their own exports. Neither `walg_enabled=true` nor
an empty backup list establishes a recovery point.
[Supabase database backups](https://supabase.com/docs/guides/platform/backups).

**Preferred first preparation:** install matching PostgreSQL 17 client tools and
use existing credentials for a full logical archive plus role definitions. This
avoids relying on filtered CLI defaults for ORYQEN's custom ownership/ACL boundary.
It remains conditional on source permissions and a successful compatible restore.
Do not change source privileges to make an incomplete export appear successful.

**Alternative requiring owner cost approval:** supported physical restore to a
new Supabase project, if the plan and an actual backup permit it. This copies DB
roles/permissions/Auth data and the encryption root key, but not Storage file bytes,
Auth configuration/API keys or all service settings. A new project incurs compute
costs. Inventory outbound jobs/webhooks before cloning: extensions can initiate
external activity as soon as a clone starts. New-project creation is a hosted
mutation and has not been authorized.
[Supabase restore to a new project](https://supabase.com/docs/guides/platform/clone-project).

The Supabase CLI alternative uses separate role/schema/data exports. Its default
schema dump filters managed Auth/Storage schemas; migration history and customized
managed-schema objects need explicit preservation. Docker is required for this
workflow. Do not substitute three default CLI files for a verified complete recovery
package. A manual logical restore also needs separate handling of encryption keys
when encrypted data exists.
[Supabase CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

### Approval-gated native export procedure — NOT RUN

1. Owner records project fingerprint, export operator, encrypted backup destination
   outside the repository/cloud-synced working folder, authorized readers, retention,
   acceptable RPO/RTO and recovery approver. Export includes sensitive Auth data.
2. Install official PostgreSQL 17 clients; verify versions. Use the existing direct
   DB connection or **session** pooler connection from Dashboard; no transaction
   pooler, credential reset, new login role or source grant. Confirm connectivity,
   database identity and TLS certificate before export.
3. Store connection details in an ACL-restricted `PGSERVICEFILE`, password in an
   ACL-restricted `PGPASSFILE`, both outside the repository. Define service
   `oryqen_backup_source` with the approved host/port/user/database, `sslmode=verify-full`,
   trusted CA and bounded `connect_timeout`. Never paste passwords/URLs on the
   command line, print those files, enable shell tracing or save unredacted errors
   into this repository. [Service files](https://www.postgresql.org/docs/17/libpq-pgservice.html),
   [password files](https://www.postgresql.org/docs/17/libpq-pgpass.html).
4. Freeze schema/role changes during the export window; record application writes
   and choose the maintenance snapshot for migrations. The database dump is
   snapshot-consistent, but the separate role/configuration exports are not the
   same transaction. Capture before/after inventories and reject unexplained drift.
5. In a clean terminal, set the two file-path variables from the protected store.
   The directory below must be a **new** folder on the approved encrypted volume.
   The commands contain no credential values:

```powershell
# APPROVAL-GATED: install clients and configure protected service/password files first.
$backupDir = Read-Host 'New absolute directory on the approved encrypted backup volume'
if (-not [IO.Path]::IsPathFullyQualified($backupDir)) { throw 'STOP: absolute path required' }
if (Test-Path -LiteralPath $backupDir) { throw 'STOP: choose a new backup directory' }
if (-not $env:PGSERVICEFILE -or -not $env:PGPASSFILE) { throw 'STOP: protected connection files required' }
New-Item -ItemType Directory -Path $backupDir -ErrorAction Stop | Out-Null
$env:PGOPTIONS = '-c default_transaction_read_only=on -c lock_timeout=5000'
pg_dump --dbname='service=oryqen_backup_source' --format=custom --no-password --lock-wait-timeout=5s --file="$backupDir/database.dump"
if ($LASTEXITCODE -ne 0) { throw 'STOP: incomplete archive; retain restricted diagnostics, do not migrate' }
pg_dumpall --dbname='service=oryqen_backup_source' --roles-only --no-role-passwords --no-password --file="$backupDir/roles.sql"
if ($LASTEXITCODE -ne 0) { throw 'STOP: role coverage incomplete' }
pg_restore --list --file="$backupDir/archive.toc" "$backupDir/database.dump"
if ($LASTEXITCODE -ne 0) { throw 'STOP: archive cannot be read' }
pg_restore --schema-only --file="$backupDir/schema-review.sql" "$backupDir/database.dump"
if ($LASTEXITCODE -ne 0) { throw 'STOP: schema review extraction failed' }
Get-FileHash -Algorithm SHA256 -LiteralPath "$backupDir/database.dump","$backupDir/roles.sql","$backupDir/archive.toc","$backupDir/schema-review.sql" |
  Select-Object Path,Hash | Export-Csv -NoTypeInformation -LiteralPath "$backupDir/SHA256.csv"
```

This full, unfiltered archive is intended to include schema definitions, data,
functions, triggers, policies, owners, grants/default grants and
`supabase_migrations.schema_migrations`, including Auth and Storage metadata.
Confirm actual TOC coverage before accepting it. Do not add `--no-owner`,
`--no-acl`, managed-schema exclusions or `--enable-row-security`: incomplete
permissions/filtered rows invalidate recovery. PostgreSQL's default dump fails
if the connection cannot bypass applicable row security; that failure is a gate,
not permission to grant BYPASSRLS. [PostgreSQL 17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).

The role export preserves attributes/memberships without role passwords; capture
needed login credentials separately in the existing secret store. Custom application
executor roles must remain NOLOGIN/NOBYPASSRLS. Do not replay managed roles blindly.
[PostgreSQL 17 pg_dumpall](https://www.postgresql.org/docs/17/app-pg-dumpall.html).

The export directory also needs a protected manifest: source fingerprint, UTC
snapshot/window, tool/server versions, extension versions, expected four migration
versions, schema/role inventories, per-table counts/checksums taken in the approved
quiescent window, config export references, approved key recovery references,
operator and intended restore destination. Store a second encrypted copy with
independent access; verify hashes after copying. No backup contents go into Git.

### Auth, Storage and managed-service limitations

- Auth account/password-hash data is sensitive. Database rows do not reproduce
  SMTP, templates, redirect/site URL, external provider secrets, signing configuration
  or prove session/MFA portability. Securely inventory configuration and required
  secret references separately; use approved fresh login/MFA after recovery.
- Storage database rows are metadata, **not object bytes**. If refreshed inventory
  finds objects, preserve their contents separately using the provider's supported
  export, with bucket/object inventory, sizes/checksums and access policy mapping;
  verify bytes and authorized/unauthorized access after restore. Today's zero
  metadata counts do not prove absence of orphaned file data.
  [Storage backup limitation](https://supabase.com/docs/guides/platform/backups).
- Vault is empty in this snapshot; do not infer all encrypted fields are absent.
  If encrypted content appears, prove recovery of its required keys first. Raw
  database exports do not supply a platform encryption root key.
- A full native archive contains managed internals. **It is not a directly portable
  import into a fresh hosted Supabase project.** Managed ownership/extension conflicts
  must be resolved in an isolated rehearsal while retaining application security.
  [Supabase platform restore constraints](https://supabase.com/docs/guides/self-hosting/restore-from-platform).

### Isolated restore verification — prepared, NOT RUN

Owner chooses an empty, disposable, network-isolated PostgreSQL 17 environment with
compatible Supabase extensions/platform bootstrap, or approves the supported new-
project clone route. Current extensions: `pg_stat_statements` 1.11, `pgcrypto` 1.3,
`plpgsql` 1.0, `supabase_vault` 0.3.1, `uuid-ossp` 1.1. A plain PostgreSQL container
without compatible extensions is insufficient. Do not reuse/reset any existing DB.
Disable outbound connectivity at the isolated environment boundary before restore;
never disable source audit guards or RLS. No test emails/webhooks may reach users.

For a logical rehearsal, an authorized operator must first prepare the empty target,
matching platform roles/extensions, restricted source-archive access, and a protected
service `oryqen_restore_check`. Use an independently verified loopback service endpoint,
unique DB name `oryqen_restore_check` and cluster label `oryqen-isolated-restore`.
Review `roles.sql` and schema SQL offline. Prepare `roles.reviewed.sql` and
`restore-reviewed.toc`, recording each pre-existing platform-object exclusion and
equivalent target definition; keep the originals immutable. Missing Auth data,
migration history, application objects, owner/grant/RLS/trigger semantics is a STOP.
Do not treat ignored errors as acceptable target reconciliation.

```powershell
# APPROVAL-GATED, EMPTY ISOLATED TARGET ONLY. No hosted source writes.
# Set the protected service/password file paths for the isolated target first.
$env:PGOPTIONS = '-c default_transaction_read_only=off -c lock_timeout=5000'
$restoreIdentity = & psql -X --no-password --dbname='service=oryqen_restore_check' -At --command="select current_database() || '|' || current_setting('cluster_name');"
if ($LASTEXITCODE -ne 0 -or $restoreIdentity -ne 'oryqen_restore_check|oryqen-isolated-restore') { throw 'STOP: wrong isolated target' }
# Independently verify service host/port and target emptiness before these writes.
psql -X --no-password --dbname='service=oryqen_restore_check' --set=ON_ERROR_STOP=1 --single-transaction --file="$backupDir/roles.reviewed.sql"
if ($LASTEXITCODE -ne 0) { throw 'STOP: role restore failed' }
pg_restore --no-password --dbname='service=oryqen_restore_check' --exit-on-error --single-transaction --use-list="$backupDir/restore-reviewed.toc" "$backupDir/database.dump"
if ($LASTEXITCODE -ne 0) { throw 'STOP: restore failed; preserve failed target for diagnosis' }
psql -X --no-password --dbname='service=oryqen_restore_check' --set=ON_ERROR_STOP=1 --file='test-results/activation-plan/stage-0.sql'
if ($LASTEXITCODE -ne 0) { throw 'STOP: baseline SQL failed' }
psql -X --no-password --dbname='service=oryqen_restore_check' --set=ON_ERROR_STOP=1 --file='test-results/activation-plan/constraints-stage-0.sql'
if ($LASTEXITCODE -ne 0) { throw 'STOP: constraint SQL failed' }
# Inspect assertion rows: successful psql exit alone does NOT mean every row says PASS.
```

No `--clean`, `--create`, DROP, reset, trigger disabling or automatic retry is in
this procedure. Restore executes code from the archive, so offline review and
target isolation precede it. [PostgreSQL pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).

Recovery passes only when all of these are recorded:

1. Every restore command succeeds; approved TOC omissions have equivalent target
   objects. Counts and protected deterministic checksums match the frozen source.
2. Exact four-version history, stage-0 and constraint-stage-0 assertion rows all
   PASS; eight private foundation tables have correct owner/FORCE RLS; constraints,
   FKs/indexes/triggers enabled/valid; security-definer owners/search paths, role
   memberships and client ACLs match. Also compare managed triggers and policy definitions.
3. Auth identity/profile/membership/audit/receipt relationships and immutable history
   survive. Test actual restricted roles, not only the restore administrator.
4. Rehearse six unchanged migrations against this restored data, stage by stage;
   compare foundation data before/after, denial behavior, locks, duration and space.
   Local fixture tests remain a separate evidence category.
5. Record actual restore duration, accepted RPO/RTO, hashes, operator and any service
   recovery gaps. Never mark the backup restorable on export/TOC success alone.

If the target cannot preserve required roles/extensions/security, stop and choose
the provider-supported clone route with separate approval. A failed rehearsal
does not justify any change to the hosted source. Actual source recovery would
require its own approval and retention of intervening audit data; no production
restore command is authorized by this document.

## 3. HTTPS staging with the smallest application change

Recommendation: **a dedicated Vercel staging project running the existing Next.js
server application**, using the provider-assigned stable HTTPS project domain.
This is an architectural recommendation, not an executed deployment. Next route
handlers, SSR cookies and authenticated RPCs require server execution; no static
export. Native Next.js support avoids a framework migration.
[Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

Focused boundary check: `src/app/api/v1/offers/route.ts` calls
`src/server/offer.ts`, which authenticates with `getUser` then uses Supabase RPC.
The legacy `src/server/offer-store.ts` file has no source callers/imports; no current
production offer route relies on its local JSON persistence. It was preserved.
UI, Figma, Android, migrations, production auth and server features were not edited.

Vercel Hobby is restricted to personal/non-commercial use. ORYQEN's commercial
intent means the owner must choose an eligible account/plan rather than assume
Hobby applies. Existing paid capacity may avoid additional purchase; no plan was
selected or paid for. A custom domain is unnecessary for this first test.
[Vercel Hobby terms](https://vercel.com/docs/plans/hobby).

### Local package and future deployment procedure

`node scripts/prepare-staging-package.mjs` builds an allowlisted local source copy:
six configuration/package files plus `src/` and `public/`. It rejects symlinks and
common secret/backup filenames, copies no environment files, and writes a SHA-256
manifest outside the deployment directory. This is a packaging safeguard, not a
general secret-scanner certification; owner review still precedes upload.

Prepared package: `test-results/staging-package-1792155935755/`.
Manifest: `test-results/staging-package-1792155935755.manifest.json`.
**117 source hashes match both original and packaged files; zero `.env*` files.**
No Vercel CLI was found; no linking/upload/build/deploy was attempted.

After explicit hosting/deployment approval:

1. Owner creates/selects the dedicated staging project and confirms team, eligible
   plan, stable assigned HTTPS origin and access policy. Record the actual origin;
   never invent it or use a transient preview URL as the canonical value.
2. Set Next.js preset, Node **24.x**, install `npm ci`, build `npm run build`, default
   Next output; no export/output-directory override. Node 24 matches package engines
   and is supported by Vercel. [Node runtime](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
3. Enter these environment variables through the host's protected configuration.
   Target the **Production environment of this dedicated staging project**, not an
   existing customer production project:

| Environment variable | Required configuration |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Intended linked project's URL; value redacted here; available at build/runtime. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Matching publishable key; value redacted; never service-role credentials. |
| `APP_ORIGIN` | Actual canonical HTTPS origin, no trailing slash/path; identical for build/runtime and Auth redirect configuration. |
| `FAIRWORK_DATA_MODE` | Keep existing synthetic-only restriction. |
| `AUTH_REGISTRATION_ENABLED` | Keep disabled for initial deployment; separate approval for the test window. |

Do not upload `.env.local`, DB/CLI credentials, SMTP credentials, test fixtures,
reports, Android signing files or backup data. Do not set browser-smoke/Android-POC
flags. SMTP credentials belong to the approved Auth provider configuration, not the
Next.js application. Avoid automatic integrations that create/reconfigure Supabase.

4. Install an owner-reviewed Vercel CLI version outside application dependencies.
   Regenerate/review the package if source changes. From that package directory,
   after selecting the approved project/team interactively:

```powershell
# APPROVAL-GATED: uploads and deploys. Do not run in this preparation task.
vercel link
if ($LASTEXITCODE -ne 0) { throw 'STOP: staging project link failed' }
# Verify .vercel/project.json identifies the approved dedicated staging project/team.
vercel deploy --prod
if ($LASTEXITCODE -ne 0) { throw 'STOP: staging deployment failed' }
```

Here `--prod` selects the stable domain/environment **within the dedicated staging
project**. It is not permission to deploy a customer production project. CLI local
source deployment does not require committing or pushing this worktree.
[Vercel deploy CLI](https://vercel.com/docs/cli/deploy).

5. Before signup, verify real TLS, stable origin, server routes, registration denial,
   sign-in rendering, unauthenticated API denial and security/cache headers. Then
   verify provider/client configuration corresponds to that exact origin. Initial
   deployment may proceed independently of migrations with signup off, but no
   agreement/work journey is permitted before schema gates pass.
6. Preserve deployment protection if enabled. The existing test runner has **no
   protection-bypass header support**. Before running it, choose approved test access
   or implement/test an origin-scoped integration for a protected automation token;
   do not disable protections to get a green test or put bypass tokens in URLs/logs.
   This is an additional conditional blocker, not a claim the existing runner can
   pass a protected Vercel login. [Automation access](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

## 4. Exact migration approval package

All six existing hashes were reverified; no migration was edited. Order:

| Stage | Filename | SHA-256 |
| --- | --- | --- |
| 1 | `202610100001_day3_offer_agreement.sql` | `effcd3fe1aabca632f86f383c972a3d44efa4459a6de8c41ed6dafda365b62d6` |
| 2 | `202610120001_agreement_participant_read.sql` | `482e92b957020a87ef65b41574f5be8279e710a0b82f7edb5acd102b2f1d1c2b` |
| 3 | `202610140001_versioned_agreements.sql` | `c8833649e89c7b15e4073404fb71226b7e0b123f7679d94a6b8ffd7d047527ce` |
| 4 | `202610140002_work_records.sql` | `75e2dc2b1cb84068c9525bcb27f267ce253fe88fa0d321b12160d2389843b10d` |
| 5 | `202610140003_work_integrity_passport.sql` | `f24bae17ea2dc1a1308f4aa3d15125f41bab5afe21b5fafeedbf1a805f71ad6b` |
| 6 | `202610150001_work_case_review.sql` | `84051535c9108b9fb388e6b6190ef73181e484a5030ebb897186eaa8e9be2629` |

Required foundation history remains exactly `202610070001`, `202610080002`,
`202610090001`, `202610090002`. The package generator pins all ten files and creates
45 unchanged cumulative copies in six stage directories. Local-only command:

```powershell
node scripts/prepare-activation.mjs
if ($LASTEXITCODE -ne 0) { throw 'STOP: reviewed inventory/hash mismatch' }
```

Use **section 5 of [the activation plan](ORYQEN_HOSTED_ACTIVATION_PLAN.md#5-executable-preflight-and-staged-application-procedure)**
for the exact separate dry-run and application blocks. They select a single approved
next stage via its cumulative package and require **`--skip-vault`**. No automatic
six-stage loop, `--yes`, seed, include-all, history repair or config push.

Before stage N: successful restored-data rehearsal, verified recovery point, owner
approval for that filename/hash/window/target, fresh exact history at N-1, all
stage-N-1 and constraint-N-1 PASS rows, no collisions or drift, bounded lock/statement
limits and sufficient disk. Review dry-run privately: exactly one next migration.
After each stage: exact history at N, stage-N and constraint-N PASS rows plus the
detailed catalog below. Reconcile and approve continuation before stage N+1.

| Stage | Read-only additional catalog / evidence |
| --- | --- |
| 0 | Foundation preflight, `scripts/day1-hosted-catalog.sql`, `scripts/day2-hosted-catalog.sql`; exact four-version history. |
| 1 | `scripts/day3-hosted-catalog.sql` |
| 2 | `scripts/agreement-read-catalog.sql` |
| 3 | `scripts/day4-catalog.sql` |
| 4 | `scripts/day5-catalog.sql` |
| 5 | `scripts/day6-catalog.sql` |
| 6 | Generated stage-6 and constraint-stage-6 assertions; scoped review/suppression/immutable history checks; account-level behavior remains a separate live gate. |

Each migration has its own transaction. A failure can leave earlier stages committed.
STOP on lock timeout, permission/constraint failure, unexpected history, missing
assertions, altered hashes, changed target, untested backup or ambiguous commit.
Retain sanitized diagnostics; re-read history and previous/next catalog before any
retry. For an uncommitted stage, confirm rollback. For a committed bad stage,
freeze writes and seek reviewed forward repair or separately approved recovery.
Never delete audit receipts, edit applied migrations, remove RLS or restore blindly.

## 5. Auth requirements versus actual hosted settings

| Setting | Fresh observed state | Required owner-approved action / gate |
| --- | --- | --- |
| Site URL | Local loopback HTTP; matches current local `APP_ORIGIN`. | Set to selected canonical HTTPS staging origin after host selection. |
| Redirect URLs | Empty; current app confirmation path not allowed. | Add exact `<APP_ORIGIN>/auth/confirm`; no wildcard/random preview redirect. |
| Custom SMTP | Disabled; SMTP host and real delivery not verified. | Choose approved SMTP account/sender, DNS and delivery quota; configure only after approval. |
| Signup confirmation template | Not retrieved; **UNVERIFIED**. | Inspect actual template and approve the explicit token-hash fragment link below if different. Do not claim a confirmed mismatch without reading it. |
| Password minimum | Provider 6; app 12–128. | Set provider minimum to at least 12, aligning direct Auth signup with app policy. |
| Secure password change | Disabled. | Enable approved reauthentication policy; verify behavior before claiming password recovery/change readiness. No new password-reset UI is implied. |
| Email confirmation | Required. | Preserve; prove actual receipt, explicit confirmation, expiry and replay handling. |
| Global signup | Disabled. | Keep disabled now. Later approve a bounded controlled registration window, including direct Auth endpoint exposure. |
| App registration flag | Absent/disabled. | Keep disabled now; enable only for approved synthetic test and close afterward. |
| Anonymous signup | Disabled. | Preserve. |
| TOTP enrollment / verification | Both enabled. Hosted factor count zero. | Do not toggle off. Independently authorized operator must enroll/challenge/verify and obtain real AAL2 before privileged commands. |

Supabase's default mail service sends only to organization team addresses, is
best-effort and currently limited to two messages/hour. Do not grant test users
organization privileges merely to receive email. Prefer the owner's existing
SMTP service with verified sender, SPF/DKIM/DMARC and adequate quota for two
confirmations plus retries. External SMTP may fit a free quota but requires an
account and delivery/DNS verification; no specific provider purchase is authorized.
[SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp).

Prepared signup template link, to be applied only after review/approval:

```html
<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Confirm your ORYQEN email</a>
```

The app's `/auth/confirm` requires explicit same-origin POST and
`verifyOtp(type: email)`. A default access-token fragment is not interchangeable.
Keep confirmation tokens out of screenshots, traces and logs; validate email
tracking/scanner behavior against this actual flow. No phone/SMS OTP is introduced.
If existing CAPTCHA/hook/abuse policy requires an unsupported client token, stop
and integrate it; do not disable protections. Inspect these owner-controlled
settings before approving signup. [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

Session code still uses Secure production cookies, SameSite=Lax, path `/`, no-store
responses and server `getUser` followed by user-scoped RPCs. There is no HttpOnly
override; do not claim otherwise. Real session refresh/expiry/logout, cross-origin
denial, MFA challenge and revoked authority are live gates, not inferred from
provider toggles. The existing AAL2 requirement must not be bypassed.
[Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp).

## 6. Controlled two-account test and audit retention

Use two **new, distinct, owner-controlled inboxes and Auth subjects**, labelled
Synthetic worker and Synthetic employer. Do not impersonate actual people or use
real employment/evidence. A third existing authorized operator independently
reviews the employer's synthetic representative authority. The worker/employer
accounts cannot grant their own membership/capability or be treated as verified
commercial representatives. Retain `demo_provisioned` / `demo-authority.v1` and
`FAIRWORK_DATA_MODE=synthetic` restrictions.

1. Complete recovery, HTTPS, six schema stages and Auth gates; verify operator
   scoped capability and actual AAL2. Missing operator authority needs a separately
   reviewed bootstrap procedure, not a new global administrator.
2. Approve two accounts, controlled signup duration, mail quota, test writes,
   independent company/membership decisions, evidence retention and closure.
   **Provider signup is project-wide, not a two-email allowlist**. App deployment
   protection alone does not restrict direct Supabase signup. If that exposure is
   unacceptable, stop for a reviewed provider allowlist/hook design; do not imply
   the existing flag enforces it.
3. Enable only approved settings/flag for the window. Use actual HTTPS origin in
   the test process; environment variables override local values without writing
   credentials into tracked files. Obtain a fresh matching readiness report and
   stage-6 assertions, inspect all relevant results, then run the existing runner:

```powershell
# Safe local plan mode, executed successfully in this task:
node scripts/test-hosted-two-accounts.mjs --plan

# Future explicit hosted-write approval ONLY:
# node scripts/hosted-auth-readiness.mjs --network --migration-list
# node scripts/inspect-hosted-activation.mjs --network --stage=6
# node scripts/test-hosted-two-accounts.mjs --execute-approved-hosted-writes --readiness=<fresh-readiness-report-path>
```

4. The interactive runner requires a fresh (<1 hour), matching report, exact local
   migration hashes and typed approval. Each inbox supplies its real confirmation
   link privately. It creates separate profiles, logs out/in, reloads pages and
   checks sessions. It pauses for independently approved operator company/membership
   decisions; it cannot grant authority. The operator's MFA enrollment is a separate
   prerequisite; the runner only verifies already-enrolled actor factors.
5. Execute employer offer → worker agreement participation → independent
   acknowledgements/confirmations → work record submission → denied self-verification
   → employer verification of exact revision → private eligible Passport → denied
   owner injection → both sessions logged out and private access denied.
6. Record source package/migration hashes, UTC window, project/origin fingerprints,
   pass/fail assertions and restricted record/receipt identifiers. No passwords,
   session cookies, email tokens, TOTP secrets or unredacted browser traces in Git.
   Verify confirmation expiry/replay, real MFA/AAL2 and revocation separately if
   not covered by the runner; do not extend its PASS claim to those tests.
7. On failure, stop creating data and preserve partial records/evidence. On completion,
   close signup/app flag under the same explicit closure approval, sign out test
   sessions and review representative access expiry/revocation with audited commands.
   Retain agreements, work versions, confirmations, decisions and audit receipts;
   no hard-deletion cleanup or reset. Owner chooses restricted retention and any
   later supported withdrawal/closure commands. Retained synthetic data is not a
   commercial verification claim.

## 7. Local verification and approval checkpoint

Fresh checks for this task:

| Command / check | Result |
| --- | --- |
| `node --check scripts/inspect-activation-blockers.mjs` | PASS |
| `node --check scripts/prepare-staging-package.mjs` | PASS |
| `npm exec --offline eslint -- scripts/inspect-activation-blockers.mjs scripts/prepare-staging-package.mjs --max-warnings=0` | PASS, exit 0 |
| `node scripts/inspect-activation-blockers.mjs --network` | Read-only report captured; plan/template/delivery remain explicitly unverified. |
| `node scripts/prepare-activation.mjs` | PASS, exact ten-file inventory/six pending hashes; 45 unchanged staged copies. |
| `node scripts/prepare-staging-package.mjs` and source/package hash comparison | PASS, 117 matching files, zero environment files; not built/deployed. |
| `node scripts/test-hosted-two-accounts.mjs --plan` | PASS, no network or writes. |
| Backup/export / isolated restore / hosted journey | **NOT RUN**. |

No application code changed. Browser, typecheck, production build and broad
regression suites were not rerun for this scripts/documentation-only preparation.
Historical results remain labelled in the previous handoff. Android debug APK and
signature results are historical; physical-device testing remains postponed.

**Shortest safe path:** owner confirms plan, backup credentials/destination and
restore target while selecting staging hosting and SMTP → approved export and
isolated restore rehearsal → approve/apply six hashes with stage checks → approved
HTTPS staging deployment with registration off (can be prepared in parallel) →
specific Auth configuration and independent operator MFA/authority → approved
bounded signup/test window → real two-account journey → audited closure/retention.

**Next explicit approval checkpoint:** authorize the backup export and isolated
restore rehearsal, naming the intended source, encrypted destination, permitted
operator/readers, tool installation, target and any cost ceiling. Owner must also
confirm the Supabase plan. This approval does **not** authorize hosted migrations,
Auth changes, deployment, signup, data tests, recovery over the source, commit or
push. Those later actions require the separate scoped approvals listed above.

Local preparation blockers resolved: exact redacted Auth findings, immutable
migration package, deployment source isolation, executable plan-only journey and
backup/restore instructions. Owner/external blockers remain: verified recovery,
hosting origin/account/eligible plan, SMTP/sender/inboxes, operator authority/MFA,
configuration approvals and actual hosted execution. Nothing is reported activated.
