# ORYQEN — backup and isolated restore execution checkpoint

October 16, 2026. **STOP: no hosted export or restore approved or executed.**
The owner has now prioritized a usable local development environment; see
[local development](ORYQEN_LOCAL_DEVELOPMENT.md). A local development database
must be separate from a future restore containing hosted data.

## Exact approval package

| Item | Proposed execution / current evidence |
| --- | --- |
| Subscription | **Free, owner-confirmed this turn**; not independently verified through Billing API. |
| Backup tool/version | Native PostgreSQL **17.11** `pg_dump`, `pg_dumpall`, `pg_restore`, `psql` proposed to match hosted 17.11. Not installed/found. Supabase CLI **2.120.0** installed; not upgraded. |
| Destination | Owner-proposed **`C:\Users\vehiv\ORYQEN-Secure-Backups`**. Does not exist. Not created or approved for export; its ACL/encryption cannot yet be certified. |
| Encryption | Require a verified protected BitLocker volume for dump, review files, credentials and restored DB storage. Also package the export using installed **7-Zip 26.03**, AES-256, encrypted headers and a separate password-manager secret. Windows BitLocker status query failed; encryption remains **UNVERIFIED**. No encryption setting changed. |
| Restore target | New local, isolated PostgreSQL 17/Supabase-compatible instance; separate persistent volume, loopback-only **55432** proposed, unique DB `oryqen_restore_check`, cluster label `oryqen-isolated-restore`, no external egress. Not provisioned; no listener/process found. Docker absent, WSL reports not installed. Must not use the development DB on 55422. |
| Cost | No purchase or billable target created. Native local export requires no Supabase plan upgrade. Local storage/runtime installation and any Docker licensing eligibility remain owner choices. Provider clone/PITR would require separate paid-feature approval and is not the selected local route. |
| Scope | Full database archive, roles without passwords, schema/functions/policies/grants/owners, application and Auth rows, Storage metadata, migration history. Protected configuration/key references separately. |
| Exclusions | Storage file bytes, external provider data, SMTP/signing/provider secrets, project Auth settings/templates, platform encryption root key, role passwords, external backups, service logs. Existing Auth sessions/MFA portability are not guaranteed by copied rows. |
| Risks | Sensitive Auth data at rest; plaintext staging on an unverified volume; missing managed extensions/roles; permission-incomplete dumps; wrong target/port; live-data drift; executable functions/triggers in an archive; lost encryption key; accidental outgoing email/webhooks. All are stop gates below. |

Free projects can use logical exports; managed backup/PITR availability is plan-dependent.
The earlier read-only inventory listed zero backups with PITR disabled. This is not
a recovery point. [Supabase backup mechanisms](https://supabase.com/docs/guides/platform/backups).

## Measured prerequisites

Read-only aggregate evidence `test-results/backup-sizing-1792157580733.json`,
**2026-10-16 13:33:00 UTC**: database **11,835,059 bytes (~11.3 MiB)**;
non-system relations **2,097,152 bytes (2 MiB)**; 3 Auth users, 0 MFA factors,
0 Storage buckets/objects and 0 Vault secrets. No individual data exported.
SQL: `scripts/backup-preflight.sql`, bounded read-only transaction ending in rollback.

Planning reserve, not a measured dump size: **1 GiB** for two logical copies,
encrypted archive, manifests and reviews; **5 GiB** for restore data/WAL/scratch,
plus container image/runtime storage (reserve a further **10 GiB**, confirm actual
image sizes before installation). Local C: reported about **37 GiB free**; this
does not establish encryption or guarantee sufficient space after downloads.
Refresh sizes/free space immediately before the approved window. Do not rely on
compression ratios or today's small row counts as hard limits.

Checked: clients absent on PATH/standard PostgreSQL path; Docker absent on PATH/
standard installation path; no PostgreSQL/Docker processes; no listeners at
5432/54322/54323/55432 in the successful read-only check. This establishes no
available verified restore instance, not that arbitrary ports are safe forever.
BitLocker read failed even outside the sandbox; an owner/admin must supply the
actual protection state. Destination permissions cannot be tested until it exists.

## Minimal execution sequence — future approval only

Run each block separately after its prerequisites. Commands are prepared and
PowerShell-parsed, **not executed**. No password, token or credential URL belongs
in command arguments, reports or shell history. Do not enable transcript/debug
logging. Errors may contain row fragments: retain them only on protected storage.

### A. Owner provisions encrypted storage and restricted directory

Owner verifies C: is fully encrypted with protection on and a recoverable key held
separately. If that is unavailable, approve an encrypted mounted volume and revise
the path before export; encrypting a later ZIP does not protect earlier plaintext.
No blanket disk encryption/recovery-key change is authorized by this document.
[Read-only BitLocker status](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/manage-bde-status).

```powershell
# Owner/admin READ ONLY. Do not print recovery protectors/keys.
Get-BitLockerVolume -MountPoint 'C:' |
  Select-Object MountPoint,VolumeStatus,ProtectionStatus,EncryptionMethod,EncryptionPercentage

# Only after local directory provisioning and encryption are approved:
$backupRoot = 'C:\Users\vehiv\ORYQEN-Secure-Backups'
if (Test-Path -LiteralPath $backupRoot) { throw 'STOP: inspect existing folder; do not overwrite its ACL' }
New-Item -ItemType Directory -Path $backupRoot -ErrorAction Stop | Out-Null
$backupSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$backupAcl = [Security.AccessControl.DirectorySecurity]::new()
$backupAcl.SetAccessRuleProtection($true,$false)
foreach ($sid in @($backupSid,'S-1-5-18','S-1-5-32-544')) {
  $rule = [Security.AccessControl.FileSystemAccessRule]::new(
    [Security.Principal.SecurityIdentifier]::new($sid), 'FullControl',
    'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $backupAcl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $backupRoot -AclObject $backupAcl -ErrorAction Stop
(Get-Acl -LiteralPath $backupRoot).Access | Format-Table IdentityReference,FileSystemRights,IsInherited
# Owner verifies only the approved account, SYSTEM and Administrators; no reparse points.
```

Create a fresh dated child for each export. Permission review must precede any
hosted data or connection-secret file. No folder was provisioned this turn because
the candidate is outside the writable workspace and its encryption is unverified.

### B. Install clients and prepare protected connection services

After installation approval, use official PostgreSQL 17.11 client binaries and
record all four `--version` results. Do not install/upgrade a hosted server.
Configure external restricted `PGSERVICEFILE` and `PGPASSFILE` files through a
private editor/secret manager, never in this repository or command transcript.
Service `oryqen_backup_source` must use existing credentials, the approved hosted
database, direct/session connection, TLS `verify-full`, trusted CA, bounded connect
timeout. Do not reset a password, create a source role or use transaction pooling.
Review source identity privately; the restore service must be a separate file and
local endpoint. [Connection services](https://www.postgresql.org/docs/17/libpq-pgservice.html).

### C. Consistent export, protected files and integrity

Only after owner approves **destination AND complete scope**. Coordinate an approved
quiet window for application/Auth/role/configuration changes; `pg_dump` is consistent
within its own snapshot, but the separate role/configuration reads are not the same
snapshot. If writes cannot be paused, use a reviewed shared-snapshot procedure for
verification instead of comparing changing counts.

```powershell
$ErrorActionPreference = 'Stop'
$backupRoot = 'C:\Users\vehiv\ORYQEN-Secure-Backups'
$backupDir = Join-Path $backupRoot ('export-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (!(Test-Path -LiteralPath $backupRoot) -or (Test-Path -LiteralPath $backupDir)) { throw 'STOP: approved protected parent/new directory required' }
New-Item -ItemType Directory -Path $backupDir | Out-Null
if (!$env:PGSERVICEFILE -or !$env:PGPASSFILE) { throw 'STOP: protected connection files required' }
$env:PGOPTIONS = '-c default_transaction_read_only=on -c lock_timeout=5000'
pg_dump --dbname='service=oryqen_backup_source' --format=custom --no-password --lock-wait-timeout=5s --file="$backupDir/database.dump"
if ($LASTEXITCODE) { throw 'STOP: export failed' }
pg_dumpall --dbname='service=oryqen_backup_source' --roles-only --no-role-passwords --no-password --file="$backupDir/roles.sql"
if ($LASTEXITCODE) { throw 'STOP: role export failed' }
pg_restore --list --file="$backupDir/archive.toc" "$backupDir/database.dump"
if ($LASTEXITCODE) { throw 'STOP: unreadable archive' }
pg_restore --schema-only --file="$backupDir/schema-review.sql" "$backupDir/database.dump"
if ($LASTEXITCODE) { throw 'STOP: schema extraction failed' }
$backupFiles = @('database.dump','roles.sql','archive.toc','schema-review.sql')
$backupFiles | ForEach-Object {
  [pscustomobject]@{Name=$_;SHA256=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $backupDir $_)).Hash}
} | Export-Csv -NoTypeInformation -LiteralPath "$backupDir/SHA256.csv"
```

Require every exit code zero, nonempty archive and complete TOC including `private`,
`api`, `auth`, Storage metadata and `supabase_migrations.schema_migrations`. Preserve
owners, grants, RLS, triggers and restricted role attributes. Permission failures
stop the run; no row-security filtering, owner/ACL stripping or privilege escalation.
[pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html),
[role export](https://www.postgresql.org/docs/17/app-pg-dumpall.html).

Record UTC source window, fingerprint, versions, per-table/sequence counts and
protected checksums, extension/role/configuration inventories and retention owner
alongside the archive. These content checks await export approval; the existing
aggregate sizing report is not their substitute.

```powershell
# Interactive password prompts only; store a new strong password separately.
$archive = "$backupDir.7z"
if (Test-Path -LiteralPath $archive) { throw 'STOP: never update an old archive' }
& 'C:\Program Files\7-Zip\7z.exe' a -t7z -mhe=on -p $archive "$backupDir\*"
if ($LASTEXITCODE) { throw 'STOP: encryption failed; plaintext stays only on protected volume' }
& 'C:\Program Files\7-Zip\7z.exe' t -p $archive
if ($LASTEXITCODE) { throw 'STOP: encrypted archive integrity test failed' }
Get-FileHash -Algorithm SHA256 -LiteralPath $archive |
  Select-Object Hash | Export-Csv -NoTypeInformation -LiteralPath "$archive.sha256.csv"
```

7z supports AES-256. `-mhe=on` protects filenames; `-p` supplies a prompt, not a
password in the command. Copy the encrypted archive and manifest only to a separately
approved off-device destination, compare SHA-256 there, and test recovery with the
independently stored password. **No external upload is authorized now.**
[7z encryption](https://7-zip.org/7z.html).

### D. Isolated restore and verification

Before connecting: provision compatible PostgreSQL 17 with required Supabase
extensions/managed roles, a unique persistent volume on verified encrypted storage,
loopback-only 55432 and an internal network with no egress. Inspect actual Docker
port bindings, network membership and mounts. A plain PostgreSQL image lacks
`supabase_vault`; do not ignore missing-extension/ownership errors. Supabase-managed
object reconciliation requires a reviewed TOC and role script, retaining equivalent
security semantics. No verified image/bootstrap recipe exists on this machine yet.

Review archive SQL and write `roles.reviewed.sql` / `restore-reviewed.toc` in protected
storage, recording every platform-object omission/equivalent. No application/Auth
data, history or authorization guards may be omitted merely to obtain success.
This review is a required dependency, not a claim that the full archive imports
unchanged into any managed project.

Extract to a **new** protected folder, then verify each manifest entry before restore:

```powershell
$restoreFiles = Join-Path $backupRoot ('rehearsal-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $restoreFiles) { throw 'STOP: new extraction directory required' }
& 'C:\Program Files\7-Zip\7z.exe' x -p "-o$restoreFiles" $archive
if ($LASTEXITCODE) { throw 'STOP: extraction failed' }
foreach ($entry in (Import-Csv -LiteralPath "$restoreFiles/SHA256.csv")) {
  if ($entry.Name -notin @('database.dump','roles.sql','archive.toc','schema-review.sql')) { throw 'STOP: unexpected manifest path' }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $restoreFiles $entry.Name)).Hash -ne $entry.SHA256) { throw 'STOP: hash mismatch' }
}
# Switch protected service/password file paths to the isolated target; recheck host/port.
$env:PGOPTIONS = '-c default_transaction_read_only=off -c lock_timeout=5000'
$target = & psql -X --no-password --dbname='service=oryqen_restore_check' -At --command="select current_database() || '|' || current_setting('cluster_name');"
if ($LASTEXITCODE -or $target -ne 'oryqen_restore_check|oryqen-isolated-restore') { throw 'STOP: wrong target' }
# Target emptiness/isolation and reviewed files must be approved before these writes.
psql -X --no-password --dbname='service=oryqen_restore_check' --set=ON_ERROR_STOP=1 --single-transaction --file="$backupDir/roles.reviewed.sql"
if ($LASTEXITCODE) { throw 'STOP: role restore failed' }
pg_restore --no-password --dbname='service=oryqen_restore_check' --exit-on-error --single-transaction --use-list="$backupDir/restore-reviewed.toc" "$restoreFiles/database.dump"
if ($LASTEXITCODE) { throw 'STOP: restore failed' }
psql -X --no-password --dbname='service=oryqen_restore_check' --set=ON_ERROR_STOP=1 --file='test-results/activation-plan/stage-0.sql'
if ($LASTEXITCODE) { throw 'STOP: baseline query failed' }
psql -X --no-password --dbname='service=oryqen_restore_check' --set=ON_ERROR_STOP=1 --file='test-results/activation-plan/constraints-stage-0.sql'
if ($LASTEXITCODE) { throw 'STOP: constraint query failed' }
```

Inspect every assertion row; SQL exit success alone is insufficient. Require exact
four-version history, matching counts/checksums/sequences, owner/grant/RLS/function/
trigger definitions, valid constraints/indexes and preserved profile/authority/audit
relationships. Compare under real restricted roles. No hosted account login, SMTP
test or pending migration application is included in this restore scope. Capture
actual duration/RPO/RTO; label **RESTORE VERIFIED** only after every check passes.
[pg_restore behavior](https://www.postgresql.org/docs/17/app-pgrestore.html).

### E. Retention and cleanup

Default: retain restricted originals, encrypted copy, manifests and failed/successful
rehearsal evidence pending owner decision. Stop the **specific** restore container
after recording its reviewed ID; preserve its volume. Do not run prune, reset,
`down -v`, recursive deletion or storage-key removal. Owner later approves a dated
retention schedule and exact target IDs/paths. Only then prepare narrowly scoped
disposal commands after resolved-path/volume verification. Ordinary file deletion
does not prove SSD erasure; do not claim secure cleanup. No automatic cleanup is
part of this execution package.

## Current stop and next action

No export/restore. No destination ACL/encryption certification. No restore isolation
certification. The owner-supplied Free plan and proposed path/target resolve selection
questions, **not permission to export**. Next priority is local development runtime
installation and real login/persistence testing, without hosted data. Return to
this package only after destination protection, tools, compatible target and the
specific export/restore scope receive separate approval.
