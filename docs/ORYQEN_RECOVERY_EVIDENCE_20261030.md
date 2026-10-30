# ORYQEN recovery evidence — 30 October 2026

Scope: original requirements in ORYQEN_V1_MASTER_SPECIFICATION.md, existing ORYQEN_22_MODULE_ACCEPTANCE.md, source inspection, recovery tests and observed staging behavior. PARTIAL means real implementation exists but the complete original module is not established as working. Earlier test claims are not fresh hosted proof.

Release: latest confirmed successful GitHub CI is 134406834688fe493c65875f6fd0a7c99268733d. Vercel success checks exist for it, but the staging alias has not been independently resolved to that SHA. No recovery changes deployed.

Recovered commits: 627a5fd, e05eaed, ed5012c. Fix commits: 87fb141 (downloads), 9c70818 (bare deposit scoring), 6fe1a29 (saved private draft review), 10b81d9 (hosted test security/assertions and optional local compiler selection).

Fresh verification: typecheck/lint passed; 49 focused tests passed; 3 live GLEIF tests passed; public staging smoke 24 pass / 5 shell warnings; manual dedicated-account login, dashboard work tab, extraction and local findings observed. Both download binaries returned 200 and exact owner-supplied SHA-256. Full offer persistence was not freshly verified. Prior handoff records a successful private draft save/reload, distinct from the full organization-backed offer journey.

| # | Original module | Status | Evidence and remaining gap |
|---|---|---|---|
| 01 | Employment intelligence | PARTIAL | Real local OCR/PDF/DOCX and deterministic extraction/findings; parser tests passed. Bare deposit scoring corrected locally. AI private processing disabled; full hosted saved analysis journey incomplete. |
| 02 | Employer intelligence | PARTIAL | Real GLEIF provider, source URLs, persisted research implementation; three live provider tests passed. Broader registries and claim comparison incomplete. |
| 03 | Career discovery | PARTIAL | Authorized listings, preferences, matching, saved listings and comparison; recommendation history/skills-gap functionality incomplete. No fresh hosted creation proof. |
| 04 | Offer workspace | PARTIAL | Versioned offers, drafts, history, decisions, archive, notes. Current test account has no discoverable company. Private saved-draft review added locally; browser verification blocked. |
| 05 | Agreements | PARTIAL | Participant-scoped proposals, immutable versions, acknowledgments, expiry and comparison. Clause editing/documents/dispute linkage incomplete; two-account hosted acceptance outstanding. |
| 06 | Evidence vault | PARTIAL | Private bucket confirmed, 5 MB allowlist, forced RLS and revocation code. No fresh upload/download/delete roundtrip; malware scanning and independent evidence verification incomplete. |
| 07 | Work Passport | PARTIAL | Eligible records, recipient grants, expiry/revoke, QR and export implementation. Complete skills sharing/signed PDF and fresh recipient isolation journey outstanding. |
| 08 | Organization portal | PARTIAL | Independent approval and representative authority, team roster and recruiter queue. Wider team roles and hosted organization acceptance incomplete. |
| 09 | Disputes | PARTIAL | Cases, scoped reviewers, appeals, evidence references. Confidential file sharing and organization response flow incomplete; hosted reviewer journey outstanding. |
| 10 | Trust ledger | PARTIAL | Append-only histories and audit chain. Migration 27 timezone fix remains unapplied; user export and scalability gaps. |
| 11 | Career copilot | PARTIAL | Persisted rules-based guidance, interview/negotiation assistance. No authorized model-backed private processing. |
| 12 | Security/privacy | PARTIAL | Manual auth works; anonymous API denial observed; forced RLS and non-bypass executor roles confirmed. Passkeys, deletion executor and complete hosted adversarial verification outstanding. Leaked-password protection advisor warning. |
| 13 | Administration | PARTIAL | Capability/MFA-gated queues, audit and exports implemented. Operational moderation/monitoring and fresh privileged hosted acceptance incomplete. |
| 14 | Multiplatform UX | PARTIAL | Premium responsive UI preserved; missing UI commits recovered. Preview binaries hash-verified. Recovery browser suite cannot run until build succeeds; native production signing/device acceptance incomplete. |
| 15 | Localization | PARTIAL | Four-language catalogs and formatting; incomplete English-only surfaces and native-language review. New draft-review copy is English. |
| 16 | Country guidance | PARTIAL | Sourced German rules and unsupported-country handling. Other jurisdictions and qualified legal review incomplete. |
| 17 | Scam protection | PARTIAL | Local phrase/domain warnings, recruiter evidence and report workflows. Correction procedure and hosted DNS/HTTP verification incomplete. |
| 18 | Credentials | PARTIAL | Signed issuance/status/revocation/QR implementation with prior test-key evidence. Public key endpoint responds, but production key custody and real issuer acceptance not verified here. |
| 19 | Salary benchmarks | BLOCKED | Normalization/comparison implemented; licensed source-backed benchmark dataset absent. No invented salaries. |
| 20 | Alerts/timeline | PARTIAL | In-app feed, preferences, expiry reminders and employment timeline. Email/push and complete hosted delivery proof missing. |
| 21 | Developer API | PARTIAL | Scoped hashed keys, contracts and webhook signing implemented. Persistent retries/delivery worker, broader scopes and hosted integration acceptance outstanding. |
| 22 | Business platform | PARTIAL | Worker/org entitlements and operator assignment implemented. Wider metering/enterprise controls incomplete; billing intentionally inactive. |

No entire original module is classified WORKING based only on rendering or fixture tests. No module is wholly UI ONLY or MISSING, although individual requirements remain missing. Classification: 21 PARTIAL, 1 BLOCKED.

Staging catalog: 58 migrations, migration 27 absent. Private drafts, vault and work-record tables force RLS; fw_user_exec and fw_schema_owner have no LOGIN/SUPERUSER/BYPASSRLS. Draft RPC has empty search_path, no anonymous execution, no direct authenticated table SELECT. Bucket is private. Catalog inspection does not replace real cross-account API tests. Security-definer advisor findings require contextual review, not blanket privilege changes.

Build blocker: Turbopack junction creation denied. Webpack subsequently fails mkdir in original worktree and isolated detached worktree at 10b81d9, including .next/types/app/api/v1/vault/delete. Parent ACL grants Modify; manual directory creation works. No unrelated processes killed or outputs deleted. Exact underlying sandbox/Windows mechanism remains unresolved.

Authorization: Vercel CLI device authorization did not produce a saved session; AppData auth.json write explicitly denied. Workspace-config login remains unresolved. Do not repeat deployment attempts or claim a deployed SHA until authenticated alias inspection succeeds.

Organization investigation: worker-side SQL authorizes the active signed-in worker against an existing active company; it does not require employer representative membership. UI discovery lists only accessible organizations. Legitimate options are an approved test employer issuing a participant-linked offer or a corrected private-worker flow using existing actor-scoped drafts. Do not manufacture membership, bypass RLS, or claim self-reported drafts are verified agreements.
