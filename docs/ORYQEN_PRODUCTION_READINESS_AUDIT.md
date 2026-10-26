# ORYQEN production readiness audit (28 October 2026)

Question answered: **is the application finished, what is incomplete, what must be connected, and when can genuine end-to-end testing begin?**

**Short answer.** The application is *not* finished and *not* production-ready. All 22 modules have working local code, but only 4 reach
"implemented locally"; the other 18 are partial against `ORYQEN_V1_MASTER_SPECIFICATION.md`. Every local engineering gate passes. Everything that
touches a hosted service is unverified because it needs owner decisions or credentials. Genuine hosted end-to-end testing can start as soon as
the owner completes items 1–6 of the checklist in section 3 (about half a day of owner work); real-user AI additionally needs items 7–8.

Evidence base: `docs/ORYQEN_MASTER_DELIVERY_TRACKER.md`, `ORYQEN_TEST_REPORT.md`, `ORYQEN_FAILURE_REGISTER.md` (26 entries, none open),
`ORYQEN_PRODUCTION_RUNBOOK.md`, and `release-results/release-verify.md`. Passing tests are evidence for what they cover, not proof of completeness.

## 1. Release gate (local)

See the latest entry in `ORYQEN_TEST_REPORT.md`. The gate has never produced a FAIL that was not either fixed (F-01…F-26) or classified as an
expected negative test or an external blocker. The six standing BLOCKED gates are owner inputs, not defects.

## 2. The 22 modules

Verdicts: **IMPLEMENTED (local)** = complete against the spec for what can be built without owner input; **PARTIAL** = real working slices, spec items missing.
No module is "COMPLETE" because none has run against hosted Supabase, Storage, a signed Android/Windows build, or a real provider key.

| # | Module | Implemented and verified | Missing | Security | External dependency | Verdict |
|---|---|---|---|---|---|---|
| 01 | AI Employment Intelligence | Paste/OCR/PDF/manual intake, 20-criterion deterministic assessment, saved analysis history, consent+redaction+grounding, multi-provider gateway (Gemini, OpenAI, self-hosted) with quota-safe fallback, circuit breaker, budgets. Unit, DB, browser tests. Gemini contract proven live earlier with synthetic text | Live generation currently unverified: configured model is quota-exhausted. No DOCX. AI not used in agreements/copilot | AI off by default; per-provider approval, consent, hash-pinned policy, no content in audit logs | Gemini key + quota + written policy approval | PARTIAL |
| 02 | Global Employer Intelligence | GLEIF provider with real data (LK, DE live), citations, timestamps, freshness, contradictions, per-user limits | No persisted research history, no other registries (need keys), no claim-vs-registry comparison | Server-side fetch through public-address-only module | GLEIF (public, no key); other registries need keys | PARTIAL |
| 03 | Career Discovery | Listings, preferences, saved/hidden, explainable matching | Comparison, skills gap, recommendation history | RLS, owner scoped | none | PARTIAL |
| 04 | Offer Intelligence Workspace | Create/draft/edit/compare/decide/archive/history; real-stack harness | Search, supporting documents, notes, export | RLS, idempotency | none | IMPLEMENTED (local) |
| 05 | Digital Agreement Center | Versioned proposals, independent acknowledgements, decisions; translated; no legal-signature claim | Clause editor, diff, amendments, expiry reminders, documents | Immutable versions, hashes | none | PARTIAL |
| 06 | Employment Evidence Vault | Content-sniffed private uploads, signed 60 s links, owner-only RLS, deletion, **private links to work records (new)**; real-stack journey runs | **Hosted Supabase Storage unverified**, no malware scanning, not attachable to disputes/shares | Forced RLS, no shared links | Supabase Storage bucket + server key | PARTIAL |
| 07 | Work Passport | Verified Passport, named-recipient sharing, revocation, Trust Chain | QR proof/PDF export/skills in shared Passport | Recipient-scoped | none | PARTIAL |
| 08 | Organization & Recruiter Portal | Org requests, operator approval, roster, **recruiter confirmation queue and domain-control proof (new)** | Recruiter accounts, roles, team changes | Approved-representative RLS, requester hidden | DNS reachability from host | PARTIAL |
| 09 | Dispute & Appeals Center | Cases, reviewer assignment with conflict checks, follow-ups, appeals; translated | Categories, confidential attachments | Independent reviewer, MFA | none | IMPLEMENTED (local) |
| 10 | Trust Ledger & Audit Engine | Append-only triggers, hashed snapshots, admin audit, Trust Chain read model | Cross-record hash chain, audit export | Immutability tests on real PostgreSQL | none | PARTIAL |
| 11 | AI Career Copilot | Rules-based guidance, deletion | Model-backed copilot, interview/negotiation prep | Private, deletable | Gemini approval | PARTIAL |
| 12 | Security & Privacy Command | Auth, MFA, RLS, quotas, origin checks, data export, secrets scan, route audit, HSTS | Passkeys, retention controls, account-deletion workflow (requests only) | 0 production vulnerabilities; static route audit | none | PARTIAL |
| 13 | Administration & Trust Operations | Capability+MFA queues, settings, audit, gateway runtime panel | Abuse reports, hosted operator procedures | Capability gated | none | IMPLEMENTED (local) |
| 14 | Premium Multiplatform UX | 13 screens at 3 widths, consistent panels | Dark theme, WCAG audit, device visual review | n/a | Physical devices | PARTIAL |
| 15 | Global Localization | en/si/ta/de catalogs (~600 strings each), formatters; translated: home, saved offers, research, work record, add-offer/check/questions, agreements, drafts, cases, recruiter panels | **Still English:** sign-in/registration, import tools, rule-analysis panels, admin console; all drafts need native review; no server-side locale | n/a | Native reviewers | PARTIAL |
| 16 | Country-Aware Intelligence | Germany rules with quotes, sources, dates; other countries show an explicit limitation | Only Germany; no Sri Lanka primary text; counsel review | n/a | Legal sources | PARTIAL |
| 17 | Recruiter Scam Protection | Text indicators, look-alike domains, **Recruiter Identity & Affiliation Verification (new)**: live dated evidence, deterministic status | Hosted DNS egress unverified; no reporting flow; org approval is a demo policy | Never reads professional-network pages | DNS/HTTP egress | PARTIAL |
| 18 | Verifiable Credentials | Ed25519 core, register, issue/revoke/status, QR, browser verification; real-stack journey now runs with a throwaway key | **No production key** | Key never in repo | Owner key ceremony | IMPLEMENTED (local, test key) |
| 19 | Fairness & Salary Benchmarking | Pay normalisation, dated user-supplied rate comparison | No benchmark datasets | No invented data | Licensed dataset | PARTIAL |
| 20 | Smart Alerts & Timeline | Notification center; reminders for credentials, **recruiter-check retention, pending recruiter decisions (new)** | Email/push channels, more reminders, timeline | In-app only | Email/push provider | PARTIAL |
| 21 | Developer API | Scoped keys, verify endpoint, limits, metering, signed webhooks, **OpenAPI document (new)** | Persistent delivery queue, more scopes/events, org keys, portal | Hash-only keys, SSRF-guarded webhooks | none | PARTIAL |
| 22 | Sustainable Business Platform | Entitlement catalog, operator assignment, limits | Billing (none by design), org plans, admin UI | Essentials never gated | Payment provider (not chosen) | PARTIAL |

Counts: IMPLEMENTED (local) 4 (modules 04, 09, 13 and 18 with a test key); PARTIAL 18. COMPLETE 0.

## 3. External connection audit (no secret values shown)

| # | Integration | Status | Evidence / gap |
|---|---|---|---|
| 1 | Supabase production DB, Auth, RLS, migrations | **CONFIGURED BUT UNVERIFIED** | `.env.local` holds a hosted project URL and publishable key. Fifteen migrations are pending and unapplied. Two project refs exist in the repo; the owner must confirm which is production |
| 2 | Supabase private Storage | **MISSING** | `ORYQEN_VAULT_STORAGE_URL`, `ORYQEN_VAULT_STORAGE_SERVICE_KEY` unset; bucket SQL ready in `scripts/hosted/vault-storage-setup.sql` |
| 3 | Vercel production project | **MISSING/UNVERIFIED** | No `.vercel` link in the repo; `APP_ORIGIN` is localhost and `FAIRWORK_DATA_MODE=synthetic`; config validator FAILs on both |
| 4 | Gemini | **CONFIGURED BUT UNVERIFIED** | Key and model set; metadata check says available; generation quota exhausted; policy approval false, AI disabled by design |
| 5 | GLEIF | **CONNECTED AND VERIFIED** | Live checks passed (3/3); other providers MISSING (need keys/licences) |
| 6 | Email / notifications | **MISSING** | No provider; Supabase default sender only; in-app notifications only |
| 7 | Android | **CONFIGURED BUT UNVERIFIED** | SDK/Java 21 found, debug APK builds and installs; no release application ID, keystore or device acceptance |
| 8 | Electron/Windows | **CONFIGURED BUT UNVERIFIED** | Unsigned installer builds and installs/uninstalls; no code-signing certificate |
| 9 | HTTPS domain and downloads | **MISSING** | `NEXT_PUBLIC_WINDOWS_URL`, `NEXT_PUBLIC_APK_URL` unset; no production domain |
| 10 | Monitoring, backup, rollback | **CONFIGURED BUT UNVERIFIED** | Runbook, backup and restore commands documented; no telemetry role in production; a restore has never been rehearsed |
| 11 | Credential signing authority | **MISSING** | Owner key ceremony pending (`scripts/generate-credential-key.mjs`) |
| 12 | Other providers in the spec | **MISSING** | Payment (no billing by design), push, benchmark datasets, malware scanning |

### Owner-action checklist (shortest safe path, in order)

1. Confirm the production Supabase project (name, ref, region) and the Vercel project and production domain.
2. Run `node scripts/generate-credential-key.mjs --kid <id> --out <path outside the repo>`; store the file in a password manager; set `ORYQEN_CREDENTIAL_KEY_ID`, `ORYQEN_CREDENTIAL_SIGNING_KEY`, `ORYQEN_CREDENTIAL_PUBLIC_KEYS` as Vercel secrets.
3. Take and test-restore a logical backup, then approve applying the fifteen migrations in order (`ORYQEN_HOSTED_DEPLOYMENT_APPROVAL.md`).
4. Run `scripts/hosted/vault-storage-setup.sql` in the project, create the private bucket `evidence-vault`, set `ORYQEN_VAULT_STORAGE_URL` and `ORYQEN_VAULT_STORAGE_SERVICE_KEY` (server-only).
5. Set Vercel environment: `APP_ORIGIN=https://<domain>`, `FAIRWORK_DATA_MODE=supabase`, `AUTH_REGISTRATION_ENABLED=true` after the email template/sender is approved, `NEXT_PUBLIC_CONTACT_EMAIL`.
6. Approve a first deployment of this branch to a preview URL; then `node scripts/validate-production-config.mjs` and the hosted two-account test (`scripts/test-hosted-two-accounts.mjs`) and `scripts/verify-vault-storage.mjs` can run.
7. For real AI: choose provider and region, write and approve the retention/processing policy, set `ORYQEN_AI_ENABLED`, `ORYQEN_AI_POLICY_APPROVED`, `ORYQEN_AI_POLICY_APPROVAL_REF`, `ORYQEN_AI_PROCESSING_REGION`, `ORYQEN_AI_DATA_USE`; resolve Gemini quota or choose another model/provider.
8. Android: choose the application ID, create the release keystore, supply a device or emulator for acceptance. Windows: obtain a code-signing certificate. Provide https hosts for the two download links.
9. Optional for launch: email/SMTP sender, telemetry role (`ORYQEN_TELEMETRY_DB_URL`), native-speaker review of si/ta/de.

## 4. When can real end-to-end testing begin?

* **Already running, locally and for real:** 206-check harness against real Supabase Auth, mail, PostgreSQL and a disk vault with a throwaway signing key; 238 browser journeys; real-PostgreSQL SQL suites; GLEIF live; Android and Windows install smoke.
* **Needs checklist 1–6:** hosted two-account test, hosted Auth/email, Storage verification, DNS-based recruiter evidence from the real host, HTTPS/HSTS header check on the real origin.
* **Needs checklist 7:** any real Gemini or other model analysis with synthetic text, then a privacy review before any real user.
* **Needs checklist 8:** signed Windows installer, Android release build, physical-device and multi-OS-version testing.

## 5. Next engineering tasks that need no owner input

1. Translate sign-in/registration, the import tools and rule-analysis panels, then shorten the coverage note accordingly.
2. Agreement expiry reminders and a unified timeline (module 20).
3. Persistent webhook delivery queue and more events/scopes (module 21).
4. Organization plans and an operator UI for entitlements (module 22).
5. Dark theme and an accessibility (WCAG) audit with automated axe checks (module 14).
6. Audit export and cross-record hash chain (module 10).
