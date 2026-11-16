# ORYQEN security remediation plan (Phase 0 audit, 17 Nov 2026)

**This is an internal audit by the release lead agent, not an independent security assessment.** No independent reviewer has tested ORYQEN. Nothing here may be quoted as "penetration tested" or "independently assessed". Where I could not test something I say so under "Not exercised today".

**Method.** Read-only checks on 17 Nov 2026: read-only catalog queries against the linked staging database (no table data read), anonymous HTTP requests (one per path), GitHub settings through `gh`, `npm audit`, the repository secret scanner, and reading code and configuration. No secret is quoted, no data was changed, no load or fuzzing was run, and no signed-in session was used for this document.

**Severity scale.** **Critical**: could expose or destroy real users' data, or breaks a launch gate; must be closed or proven before any real user data. **High**: serious weakness or missing control that should close before public launch. **Medium**: real weakness with limited reach or compensating controls. **Low**: hygiene. **Info**: observation. Evidence tags: **[V]** verified 17 Nov (reproducible command given), **[V13]** verified 13 Nov and not re-run, **[D]** documented, not re-verified, **[U]** unknown.

## 1. What is verified to be strong (do not regress)
| Control | Result | Reproduce |
|---|---|---|
| Row-level security | 100 of 100 tables in `private`/`public` have RLS enabled **and forced**; 0 without | catalog query: tables where `not (relrowsecurity and relforcerowsecurity)` is empty [V] |
| Direct table access | 0 INSERT/UPDATE/DELETE/TRUNCATE grants to `anon` or `authenticated` on `private`/`public` | `information_schema.role_table_grants` [V] |
| Function exposure | 143 `api` functions; all `SECURITY DEFINER` functions pin `search_path`; only `credential_status` and `developer_key_check` are executable by `anon` (both intended public checks); 0 executable by `PUBLIC`; 0 of the `private` functions executable by `anon` or `authenticated` | `pg_proc` with `has_function_privilege` [V] |
| Storage | One bucket `evidence-vault`, **not public**, 5 MiB limit; zero storage policies so no direct client path; access only through server-issued signed URLs | `storage.buckets`, `pg_policies` [V] |
| Anonymous API | Vault, passport, offers, developer keys, records, me, admin audit-chain, operator reports and privacy requests all return **401** without a session; a cross-origin POST returns **403** | `curl -s -o /dev/null -w '%{http_code}'` per path [V] |
| Admin surfaces | `/admin` and `/operator/authority` serve only a sign-in gate to an anonymous visitor (no data); the admin gate says an active assignment and verified authenticator are required | `curl` and read body [V] |
| Hardening headers | HSTS (1 year, includeSubDomains), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` camera/microphone/geolocation off | `curl -I` [V] |
| Exposed files | `/.env` and `/.git/config` return 404 | `curl` [V] |
| Secrets in repository | Scanner: 1,262 tracked files, 11 rules, **0 unexplained findings** | `node scripts/scan-secrets.mjs` [V] |
| Route-level policy | A static test fails the build if a mutating route lacks the same-origin check, bypasses the response envelope, reads a raw body, or trusts a client-supplied identity, role or capability | `tests/unit/api-route-audit.test.ts` passes in the 179-file suite [V 16 Nov] |
| Bypass flags | No test-mode or smoke flag in application source; data mode and origin validated at startup; AI fail-closed unless explicitly enabled and approved | code read [V13] |
| Error shape | Anonymous errors are structured, carry a request id, and leak no internals | `curl /api/v1/me` [V] |

## 2. Findings and remediation

### Critical (launch gates)
| ID | Finding | Evidence | Remediation | Owner | Acceptance |
|---|---|---|---|---|---|
| SEC-C1 | **No production environment.** No production Supabase project, no Vercel production environment, no domain. Staging is a Vercel Preview with registration off and AI off. | [V13]; hosted config [U] | Create production and a pre-production mirror (Phase 1): separate projects, separate secrets, network restrictions, least-privilege roles, protected previews | Integrations and Infrastructure | Catalog check on production identical to this document's section 1; no secret shared with staging; preview builds cannot read production secrets |
| SEC-C2 | **Cross-user and cross-tenant isolation never tested on hosted infrastructure with independent accounts.** It is proven only on local PostgreSQL. A one-account hosted probe returns 404 for a foreign id but is not independent. | hosted scripts report "cross-user isolation proven by local harness" [R] | Create synthetic accounts W1, W2, E1-E3, R1, A1, A2 in the pre-production environment; write an API authorization suite that attacks every route and every `api` RPC horizontally and vertically | Security and QA | Suite passes; every cross-tenant read or write is denied; transcript stored as release evidence |
| SEC-C3 | **No independent security test.** | [D] | Book an external team (scope in section 4); give it a frozen release candidate in pre-production | Security and QA, owner | No open critical or high finding; retest recorded |
| SEC-C4 | **Account deletion and erasure not executed.** A deletion path must exist before real personal data is collected. | [D] | Implement end-to-end erasure (profile, vault objects, records, audit pseudonymization policy, backups retention statement) with legal sign-off | Backend and Database | Erasure of a test account removes every row and object it owns, proven by catalog diff; retention for audit chain documented |
| SEC-C5 | **No rehearsed backup and restore.** PITR off, no restore drill, storage objects not covered. | [V13] | Enable PITR on production and pre-production; run a restore drill with recorded RTO and RPO; back up the storage bucket | Integrations and Infrastructure | Restored copy passes the section 1 catalog check and a data spot-check; RTO and RPO written down |

### High
| ID | Finding | Evidence | Remediation | Acceptance |
|---|---|---|---|---|
| SEC-H1 | **Repository governance.** Required check `verify` exists on `main`, `release/oryqen-oct27` and `exhibition/dev-nov10`, but **no required pull-request review, administrators are not enforced, strict up-to-date branches off, and no pull request has ever been opened.** | `gh api repos/anu123bnada/fairwork/branches/<b>/protection` [V] | Require one independent review, enforce for administrators or adopt a documented break-glass, require signed tags for releases | A merge to a release branch is impossible without a review and green `verify` |
| SEC-H2 | **The repository is public.** Source, migrations, threat models and security reviews are world-readable. Secret scanning and push protection are on; Dependabot security updates are **off**. | `gh api repos/anu123bnada/fairwork` [V] | Owner decision: make private (see `ORYQEN_REPOSITORY_PRIVACY_REMEDIATION_PLAN_20261113.md`) or accept openly; enable Dependabot security updates; review history for personal data | Decision recorded; Dependabot enabled |
| SEC-H3 | **No malware scanning for uploaded evidence.** | code, no scanner [D] | Scan every upload before it becomes available; quarantine and notify on a hit | EICAR test file is quarantined, clean file passes, both audited |
| SEC-H4 | **No monitoring, alerting, error tracking or incident process on hosted systems.** | [D] | Error tracking, uptime and latency checks, RLS-error and 5xx alerts, on-call, status page, incident runbook, one drill | Alert fires in a drill within the agreed time |
| SEC-H5 | **Email uses Supabase's default sender**: no SPF/DKIM/DMARC control, low send limits, spoofing and deliverability risk; registration is therefore off. | [D] | Authenticated production sender domain and provider; bounce and complaint handling; rate and abuse limits | Headers show SPF, DKIM, DMARC pass; bounce handled in a test |
| SEC-H6 | **Registration abuse protection is unverified** (bot challenge, per-IP and per-email limits, disposable-address policy) before registration is enabled. | [U] | Define and test limits at the edge and in Auth settings; Supabase Auth dashboard settings were not inspected | Scripted abuse test is throttled; limits documented |
| SEC-H7 | **Credential signing key custody.** Staging reports a configured signing key [R]; production key generation, custody, rotation and revocation are undefined. | [D] | Key ceremony, managed secret storage, rotation and revocation runbook, published public key set | Independent verifier validates a production-issued credential; rotation drill passes |
| SEC-H8 | **AI risk is untested.** No red-team of prompt injection, instruction leakage through pasted offer text, or exfiltration; no evaluation set; no cost abuse test on a real provider. The design (consent receipts, redaction, strict output schema, per-person budgets, breaker) is sound but unproven. | [D]; AI off on staging [R] | Build an adversarial evaluation set (injection inside contracts, links, hidden text); test budget caps and kill switch; treat all external text as untrusted data | Evaluation report with injection cases passing; kill switch tested |
| SEC-H9 | **Employer verification is a demonstration authority**, so any organization approved today is "approved by a simulation". Listings carry `demo_provisioned` assurance. Real users could be misled by "verified" employers. | `/operator/authority` page text, `src/features/authority` [V] | Choose and implement a real verification method (registry match, document check, manual operator review with evidence); keep the labels until then | No user-facing "verified" without a real method; verification evidence stored and auditable |

### Medium
| ID | Finding | Evidence | Remediation | Acceptance |
|---|---|---|---|---|
| SEC-M1 | **Dependency advisory:** `next` 16.4.1 (affects 16.3.0 to 16.4.4), moderate: information disclosure across root params when a `use cache` function is called through `unstable_cache()`. The code uses neither (`grep` finds no `use cache`, `unstable_cache` or `cacheComponents`), so it is probably not reachable. 9 more moderate advisories are in dev-only linting packages (`eslint`, `typescript-eslint`, `minimatch`). | `npm audit --omit=dev` and `npm audit` [V] | Upgrade `next` to 16.4.6 or later behind the full CI run; update lint tooling | `npm audit --omit=dev` clean |
| SEC-M2 | **CSP has no `script-src` or `default-src`**, so it blocks framing, plugins and base-tag changes but does nothing against injected script. | `curl -I` [V] | Introduce a nonce-based CSP in report-only mode, fix violations, then enforce | Enforced CSP with no inline-script allowance; no violations in the e2e suite |
| SEC-M3 | **CORS preflight from a foreign origin returns 204** with no `Access-Control-Allow-*` headers, so browsers refuse the cross-origin request; the cross-origin POST itself returns 403 from the same-origin check. This is safe but worth pinning with a test. | `curl -X OPTIONS` [V] | Add a test asserting no CORS allow headers and the 403 on foreign origin | Test in CI |
| SEC-M4 | **Edge protections unverified** (WAF, bot rules, rate limits at the edge, DDoS posture). Application quotas exist. | [U] | Verify Vercel and Supabase edge settings; add rate limits for auth, upload and AI routes | Documented limits and a throttling test |
| SEC-M5 | **Webhook delivery has no persistent queue** and outbound webhooks and domain proofs are an SSRF surface (guarded fetch exists). | [D] | Queue with retries and dead-letter; re-test SSRF guard against internal ranges and redirects | SSRF suite passes; ordered retried delivery proven |
| SEC-M6 | **Two Vercel projects (`fairwork`, `oryqen`) and a second Supabase project (`Fairwork`) of unknown purpose** build or exist alongside staging; risk of confusion or an unmanaged copy holding data. | GitHub status contexts [V]; Supabase org [V13] | Document, consolidate or delete (with owner approval) | One inventory of environments, each with an owner |
| SEC-M7 | **Evidence files are bounded to 5 MiB but there is no content sniffing or type allowlist proof on hosted**, and client-side OCR and PDF parsing have no documented memory or time limits on low-end devices. | [D]/[A] | Server-side type verification; limits and a low-end device test | Rejected types and oversize files proven on hosted |
| SEC-M8 | **Recruiter scam module names third parties** (domains, organizations) and lacks a right-of-reply and correction process. Legal exposure, not a technical flaw. | [D] | Right-of-reply workflow; counsel review of wording | Counsel sign-off recorded |
| SEC-M9 | **Android wrapper and Windows installer** are debug-signed or unsigned. Users could be tricked by a tampered artifact. | [D] and `ORYQEN_ANDROID_PLAYSTORE_READINESS.md` | Release signing in managed custody; published checksums | Verified signature and checksum on the release artifact |

### Low and informational
- **SEC-L1** An anonymous `GET /api/v1/admin` returns **422** (input validation) rather than 401. It reveals nothing but the route's existence, and the order of validation and authentication should be consistent. Add a test. [V]
- **SEC-L2** The static route audit proves policy by pattern. It cannot prove business-logic authorization, which is why SEC-C2 is required. [Info]
- **SEC-L3** CI runs on Windows with Chromium only; no WebKit, Firefox, device or load tests. [V workflow]
- **SEC-L4** Admin integration tests assume the machine time zone equals UTC; they fail on non-UTC machines in the hours after local midnight. Test-portability only; production is `UTC` [V13, catalog `TimeZone` = UTC re-verified 17 Nov].
- **SEC-L5** Documentation sprawl: 157 documents in `docs/` with overlapping, partly stale statements; this plan and the master matrix supersede earlier readiness claims. [V]

## 3. Not exercised today (requested by the directive, still open)
These were **not** tested in this audit. Each needs a signed-in or load-capable test and is scheduled in the roadmap:
1. **Authentication and session handling** at runtime (cookie flags, session fixation, refresh and revocation, recovery and MFA enrolment flows, token lifetime). Code design is documented [D]; behavior was not re-tested.
2. **Rate limiting and abuse protection** behavior under load.
3. **File upload and download** fuzzing (type confusion, path tricks, zip bombs, content sniffing), signed-URL replay.
4. **Privilege escalation** via capability grants, operator and admin separation of duties on hosted (SEC-C2).
5. **Audit logs** completeness for every admin and operator action on hosted; chain verification on a restored copy.
6. **Data export and deletion** end to end (SEC-C4).
7. **AI prompt injection** red team (SEC-H8).
8. **Vercel and Supabase dashboard configuration**: environment-variable scopes, Auth settings, network restrictions, log retention (dashboard access was not part of this audit).

## 4. Independent security test: scope for the vendor
In scope: authentication, authorization, tenant isolation, business-logic abuse of agreements, disputes, shares and credentials, file handling, AI prompt injection and cost abuse, SSRF in research, webhooks and domain proof, web (CSP, XSS, CSRF), Android wrapper navigation and deep links, infrastructure configuration. Inputs ready for the testers: this document, the route-audit suite, the catalog queries, the ledger threat model, and the hosted scripts. Rules: a dedicated pre-production environment with synthetic data only; written rules of engagement; no testing against production or live user data. Exit criteria: zero critical or high open, mediums with accepted written risk, retest by the testers, report kept as a release artifact. Repeat after any change to authorization, migrations or signing.

## 5. Remediation order (what to do first)
1. **This week (no external dependency):** SEC-M1 (upgrade `next`), SEC-H1 (require review, enable Dependabot), SEC-M3 and SEC-L1 (pin tests), start SEC-H2 decision, inventory environments (SEC-M6).
2. **With pre-production (Phase 1):** SEC-C1, SEC-C5, SEC-H4, SEC-H6, SEC-M4.
3. **With synthetic accounts (Phase 2):** SEC-C2 isolation suite; fix whatever it finds before any feature work that touches authorization.
4. **Capability work with a security dependency (Phase 3):** SEC-C4, SEC-H3, SEC-H5, SEC-H7, SEC-H8, SEC-H9, SEC-M2, SEC-M5.
5. **Pentest (Phase 6)** on a frozen candidate; release only on exit criteria.

Rollback for every security change: configuration changes are recorded before and after; migrations are forward-only with a written reverse script and a restore point (see roadmap section on rollback).
