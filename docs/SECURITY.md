# FAIRWORK 2.0 — Security and privacy contract

Revision: FAIRWORK-ARCH-1.0.0, 2026-10-07. [Approved baseline](ARCHITECTURE_BASELINE.md); [Stage 1 approval](STAGE1_APPROVAL.md). This defines controls to implement, not tested security. P0A is a synthetic-data competition trust flow; real employment data and future AI/Prove have separate gates; both optional modules are excluded from this competition baseline. [Database §6](DATABASE.md) is the exact table/grant/RLS model; [API](API.md) is the function allowlist. No application or SQL is created in this pass.

## 1. Threat model

Protect identity/session secrets, offer/pay terms, work history, authority decisions, exact participant confirmations, evidence/skill mappings, verification, passport scopes, AI-processing consent and audit. Attackers include worker B, unrelated/former employers, self-appointed operators, colluding reviewers, injected text, stolen service credentials and infrastructure administrators.

Boundaries: browser→Next.js→user-JWT RPC; function executor→RLS-protected private tables; operator capability→specific privileged RPC; optional worker→leased consented input→external provider; owner→named recipient projection. Reject data as instructions at every boundary. Private employment facts never become public intelligence implicitly.

## 2. Authentication and SQL privilege model

Use provider-managed Supabase Auth and supported server token verification. The competition authentication choice and its Figma exception are recorded in MVP_PLAN D-02/D-07. No custom four-digit OTP or bypass token is permitted. Use pre-provisioned demo identities, unique strong credentials held outside the repository, disabled public signup, and no email/SMS delivery dependency in the live script. Account creation/reset is an offline owner operation using the documented bootstrap boundary; it cannot become a web service-role shortcut. Restrict redirects, HTTPS/cookies, CSRF/Origin checks, destination/IP throttles and no account enumeration. Reauthenticate for deletion/export/contact change.

All privileged human capability commands and reviewer decisions require server-verified **aal2 MFA**, including a hosted synthetic demo; if that cannot be provisioned, use controlled offline fixture provisioning and do not claim a live operator workflow. Role names in profile metadata grant nothing. Capability bootstrap is out-of-band, named, audited and reviewed; self-granting admin is prohibited.

Only api RPCs are exposed. Browser roles have no private table/schema/sequence DML/read grants. Functions have explicit EXECUTE allowlists; PUBLIC defaults revoked. NOLOGIN/NOBYPASSRLS executor owners are distinct from table owners and not assumable by runtime logins; private tables use ENABLE+FORCE RLS. Policy helper ownership/read limits avoid recursive policies. All legitimate user reads are fixed DTO RPCs; no default owner-privileged views. Raw direct API access is denied, and direct RPC calls still enforce quotas and transitions. Future migrations must enumerate new tables/functions/views/buckets in the policy contract before use.

No service-role credential in web, ordinary operators or AI workers. It bypasses RLS and cannot be rescued by a row policy. Migration/infrastructure owners remain inherently privileged; protect them separately and never claim SQL guards resist the project administrator. Mechanism references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase function permissions](https://supabase.com/docs/guides/database/functions).

## 3. Authority and privileged capabilities

Company membership is an immutable approval/revocation history plus a guarded active pointer. Operator decisions store subject/company, requested role, evidence reviewed, assurance/method, reason, approver, effective/expiry dates and policy. Approver cannot be subject. Confirmation snapshots the exact approval ID, representative and content hash; current membership checks cannot substitute a different approval after the fact. Demo authority is explicitly demo_provisioned. It is not a legal corporate identity attestation. The one student operator may simulate separate demo accounts, but this does not establish human independence or real employer assurance. Do not use those accounts to resolve real cases; absent an independent reviewer, leave the case open and verification suppressed. Stored identities, conflict checks, MFA and role separation remain enforced for synthetic tests (MVP_PLAN D-05).

| Identity/capability | Allowed | Prohibited |
|---|---|---|
| Worker | Own versions, questions, submissions, withdrawals, passport scopes | Self-confirm employer work, write trusted mappings/assertions/AI output |
| Frozen representative | Explicit proposed terms/shared questions and submitted work tied to exact active authority | Entire worker profile, raw offer, unrelated records, changing another actor's decision |
| Authority operator | Provision minimal company, append membership decision or authority case with reason | Raw offer/submission browsing, review evidence, self-approval |
| Review operator | Publish optional task and assign independent case/submission reviewer | Automatic authority to evaluate arbitrary content or approve own review |
| Assigned reviewer | Minimal assigned basis; append evaluation/resolution with explicit conflict declaration | Self/employer/conflicted review; unrelated private material |
| Privacy operator | Process registered export/deletion/retention case with MFA | Arbitrary user SQL/browser, grant authority or verification |
| fw_ai_worker (optional) | Claim/dispatch/complete/fail its operation's leased consented runs | Arbitrary inputs, memberships, confirmations, assertions, cases |
| Deployment/DB owner | Migrations, bootstrap, emergency recovery | Runtime credential use or routine support browsing |

Human operators authenticate as their own Supabase users; API checks protected capability and MFA; function ownership limits SQL powers. AI uses separate least-privilege DB login, session_user identity and lease-secret checks, no ability to set a user JWT and impersonate users. Credentials are environment-specific, rotated after compromise/personnel change and on a documented periodic schedule; record last rotation and owner. Revoke login/leases and stop dispatch during an incident. Workers have no arbitrary network, SQL or command execution tool.

Break-glass is offline infrastructure access only: named responder, incident/reason, time-bounded credential, independent approval where available, command/audit export and post-incident review/rotation. There is no break-glass HTTP route. Compromise of infrastructure or privileged function owner remains a material risk requiring monitoring and backups, not an “admin=true” RLS bypass.

## 4. Independent review, disputes and revocation

Assignments store target, assigning operator, policy, reason, reviewer and conflict declaration. Review acceptance is a separate attributed event/guarded acceptance field before content access. Disqualify the subject, designated employer on the related records, approver of that employer's authority, original challenged evaluator/confirmer, assigning operator for their own assignment, or a declared close collaborator/financial interest. Enforce known database relationships; require attestation for relationships the database cannot know. No technical test can guarantee absence of collusion.

Appeals use a different reviewer from the original decision and prior case resolution; if no independent reviewer is available, case remains unresolved and verification remains suppressed. P0A may use the narrow operator review workflow; Prove additionally pre-provisions an independent reviewer and task-specific rubric. Avoid automated plagiarism verdicts or covert monitoring. Prove records authorship/assistance attestations, allowed resources, times, identity assurance and task exposure, labeled “completed under stated conditions,” never proof of unaided mastery.

Typed cases can target agreement/work/authority and optional evaluation. Opening a case immediately suppresses affected verification through live eligibility checks. Resolving it is one immutable independently attributed decision. Dismissal removes that case's block only; another case, expiry, withdrawal or revocation still prevents a badge. Uphold/correction requires revocation/withdrawal and fresh eligible evidence when corrected. Revoked assertion is terminal, never reset to active. Ordinary membership departure blocks future access but preserves history; fraudulent authority is treated as a separate case affecting dependent trust.

Immutable skills/basis mappings prevent relabeling an old evaluation as proof of a new skill. Corrections append replacement evidence and atomically withdraw/revoke old evidence/assertions; sharing never follows a replacement automatically. No application role can UPDATE submitted content, confirmations, approval payloads, original evaluations or audit events.

## 5. Privacy, sharing and consent

PRIVATE is the default. SHARED_WITH_SPECIFIC_EMPLOYER means an exact proposed agreement/shared question or submitted work version with frozen authorized representative. SELECTIVELY_SHARED means named recipient + immutable item/registry field list + expiry/revocation. PUBLIC publication is future and absent from P0. Visibility is a relationship, not a permissive enum or employer role.

Passport masks are relational registry FKs. One database-backed projection handles owner preview and recipient reads; unknown fields/versions fail. It never serializes a raw row. Adding a source column, new evidence item or wider owner selection cannot widen an old grant. Field/item removal, owner disable, grant expiry/revocation and evidence suppression apply at every read. Private global counts, salary/contact/raw attachments/dispute reasons are never included. Free-text disclosure_summary is user-curated and previewed; technical allowlists do not make user-entered text nonsensitive.

Personal and shared responses are private,no-store and never static/CDN cross-user caches. Revocation stops future authorized requests, not copies already made. P0 shares no files/bearer links. Future signed object URLs can outlive revocation until expiry; use an authorized proxy if immediate attachment revocation is required.

**External AI requires explicit separate consent.** Stored consent binds subject, offer-analysis purpose, provider/configuration, region scope, policy/disclosure/UI version and grant/revocation times. User may decline and still use manual workflow. Enqueue/claim/dispatch/completion recheck consent; withdrawal cancels queued/running jobs and rejects late results. In-flight provider transmission cannot be recalled; explain that and provider deletion terms. A new provider/region/purpose needs new consent. Synthetic demos exercise this same path rather than bypassing it. No consent is inferred from account creation, file upload or an employer's confirmation.

## 6. Storage, uploads and AI attack surface

Database §8 specifies P0 Storage denial: no FAIRWORK user buckets, object policies granting access, or signing endpoints. Test anonymous and authenticated list/get/create/overwrite/delete requests deny. Do not claim upload/OCR.

P2 requires exact owner/resource-bound upload reservations, private quarantine, no upsert, MIME/magic-byte/size limits, malware scanning and bounded isolated parsing before private-ready promotion. Browser quarantine only INSERT into exact reserved key; no quarantine reads; private-ready reads owner-only. Scan/retention credentials are separated. Employer/passport file sharing needs a separate policy; user table permission is not storage permission. See [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

Model inputs are data, not instructions. No authority to send messages, mutate terms, fetch arbitrary URLs, read other users or grant verification. Validate schemas and source spans independently; render as plain text, not model HTML. Future retrieval blocks internal/reserved networks and revalidates redirects/DNS; public-source availability is not unlimited redistribution rights. No LinkedIn scraping, code execution or safety-critical certification.

## 7. Logs, retention and deletion

Record DB timestamp, request/run/actor IDs, action, target/version, reason and changed field names. No offer text, salary values, contact information, OTP/token, raw prompt or share secret in operational logs. Append-only audit with compensating events; signed periodic protected export to a separate access boundary is required before real-data release. For the synthetic competition, preserve an access-controlled export at each release/rehearsal checkpoint. Use database timestamps and monitored clock synchronization; client timestamps are not decision authority. Audit is operational evidence, not legal notarization.

Trust-transition audit and immutable authority/consent/basis records must remain as long as their retained assertion/shared record plus the approved dispute period. The old blanket 90-day trust-audit rule is removed. Security-only logs may use provisional 90 days; request logs14 days; receipts24h. For the synthetic competition environment, D-10 fixes a short deletion/reset window for application records, demo accounts and protected exports; this supersedes longer provisional maxima for those fixtures. Minimal real operator/account identifiers and provider logs are disclosed and protected, not described as synthetic. No universal employment retention period is invented. Owner/jurisdiction approval required before real data; exports/backups follow the same classification and deletion lag must be disclosed.

Deletion immediately disables access/shares/processing and records a privacy case. Erasure/redaction respects FK restrictions, other participants' justified retained records and approved retention; withdraw assertions when basis is removed. Pseudonymous IDs are still potentially personal data. Export contains only authorized subject/shared information, not other users or internal operator notes. Manual fulfillment is allowed in the competition only with tracked requests and truthful labeling. Restore applies tombstones/revocations before serving traffic.

## 8. Mandatory threat tests and release gates

Use worker A/B, exact/unrelated/former employer, authority operator, assigned/unassigned/conflicted reviewer, privacy operator, anonymous and optional worker login. Exercise both HTTP and direct Supabase RPC/table APIs. No privileged test client as a substitute for user-role tests.

| Test ID | Required assertion |
|---|---|
| SEC-01 | All raw table verbs/sequence privileges and unlisted EXECUTE denied; RLS+FORCE on every private table; no runtime owner/BYPASSRLS |
| SEC-02 | A/B, unrelated/former employer and child-parent isolation; exact shared version/questions only |
| SEC-03 | Self-approval, self-confirmation, duplicate counterpart decisions, forged metadata/mapping and privileged parameter mass assignment fail |
| SEC-04 | Authority revoke/reapprove, case open and edit/confirm races cannot cross versions or resurrect a badge |
| SEC-05 | Immutable payloads/hashes/skill refs; illegal transitions/pointers fail even via direct SQL test roles |
| SEC-06 | Preview/recipient identical projection; added secret columns/new items not leaked; mask/version mismatch fails; revocation no-cache |
| SEC-07 | Operator/worker capabilities cannot call unrelated functions or read arbitrary content; MFA/conflict checks enforced |
| SEC-08 | Storage P0 deny; no public user-data bucket; CSRF/XSS/redirect/rate-limit tests and secret/client-bundle scans |
| SEC-09 | Optional AI requires consent, rejects stale lease/revoked scope and unsafe output; dispatch withdrawal tested and disclosed |
| SEC-10 | Optional Prove locks submission/rubric/conditions; conflicted reviewer rejected; appeal cannot restore revoked assertion |
| SEC-11 | Export/deletion/retention/recovery scoped; trust audit retained with evidence; restored database cannot reactivate deleted grants |

Zero known critical/high trust or isolation defects is a deployment gate. Day 0 architecture choices are resolved in MVP_PLAN. Account provisioning, catalog/security tests and restore proof are implementation/release gates, not unresolved Stage 1 design choices. Pre-production policy gates still prohibit real employment data; no production security claim is justified.
