# ORYQEN — OCTOBER 27 FUNCTIONAL PRODUCT EXECUTION DIRECTIVE

**Target:** October 27, 2026, evening, Asia/Colombo. **Intent:** the entire 14-module product vision, cinematic landing page, functional installable Windows desktop app and Android APK, actual shared backend, and verified genuine AI. **Engineering integrity:** do not claim any feature or deployment works without empirical evidence. This deadline is a target, not authorization to bypass security or fabricate status.

## 0. OPERATING INSTRUCTIONS — EXECUTE, DON'T REPLAN

You are continuing the actual local Windows repository `C:\Users\vehiv\Desktop\fairwork`. Work as a senior engineer, not as a planning chatbot. First ensure no other coding agent is editing this directory. Preserve all local tracked/untracked changes and built binaries. Do not recreate, delete, reset, clean, rewrite, or overwrite this project. Never modify production, push, deploy, upload sensitive data, activate paid resources, or distribute binaries without explicit human approval. Never print secret values. Use one controlled development environment, small verified increments, and real browser/service tests.

**First commands (safe, non-destructive):**

```powershell
Set-Location 'C:\Users\vehiv\Desktop\fairwork'
Get-Location
git rev-parse --show-toplevel
git status --short
git diff --check
git diff --stat
Get-Content .\package.json -TotalCount 100
```

Read `CONTINUE_HERE.md`, `AGENTS.md`, and the newest copies of all relevant `docs/*PROGRESS*`, `docs/*RELEASE*`, `docs/*TEST*`, and `docs/GEMINI_PROCESSING_GATE.md`. Inspect local code/version, current build logs and untracked files. If a command fails, report the exact error and fix it; do not restart the whole repository.

### Evidence from an OLDER submitted source snapshot (verify against CURRENT local state)
- Next.js 16.x, TypeScript, Tailwind, Supabase, Vitest/Playwright.
- AI guard in `src/server/ai/config.ts` requires `ORYQEN_AI_ENABLED=true`, `ORYQEN_AI_POLICY_APPROVED=true`, approval reference, key, model, region, data-use notice. It only supported `gemini` or `openai` in that snapshot; other providers REQUIRE new adapter, not merely swapping a URL.
- Saved Gemini diagnostic: generation HTTP 400 `INVALID_ARGUMENT`; prior HTTP 401 and 404. Model listing HTTP 200 did NOT prove generation worked.
- Older release gate documented `FAIRWORK_DATA_MODE=synthetic` and unverified hosted migration/auth/email/real-data activation. Do NOT claim production is approved without fresh read-only verification.
- More recent agent reported 157/157 browser checks, Electron installer and Capacitor APK; confirm artifacts and whether tests used browser fixtures/mocks.
- Electron and Capacitor load an ONLINE application; old hosted deployment could cause all installed apps to show broken older functionality.

## 1. IMMEDIATE TEST — THE USER'S REPORTED BREAKAGE

**Within first working batch**, open and exercise the real running application as a user, not just `npm test`:
1. Register with a controlled consenting test account (or use authorized existing synthetic test account).
2. Verify email by the actual configured method.
3. Log in; confirm session and user profile.
4. Create a job offer from concrete sample terms.
5. Request analysis; identify exact AI provider status, validity and source type.
6. Save offer and analysis to the right user's account.
7. Reload; log out; log in; check persistence and row ownership.
8. Inspect Windows shell and Android app on the intended hosted version, not a different stale deployment.

Inspect DevTools Network, browser console, server logs, API status, Supabase SQL/RLS and auth redirect/cookie configuration. Sanitize output. Identify failure ROOT CAUSE, repair it, rerun the SAME journey. Generate `docs/REAL_RUNTIME_FAILURES.md` listing route/action, expected, actual, root cause, code fix and reproducible verification. Never call fixture tests 'real end-to-end'.

## 2. INTEGRATION REPAIR PRIORITIES

### Authentication and database
- Hosted Auth site URL, callback URLs, HTTPS origins, recovery/confirmation flows, session cookies and refresh, profile creation, authorized roles and proper RLS; fix the actual backend errors. Do not disable RLS or fake authenticated responses.
- Compare the **actual hosted migration history read-only** with local migration hashes and use documented backup/approval gate before any hosted change. Do not trust a historical '30 migrations deployed' report without reconciling it against current local schema.
- Verify email sender/SMTP deliverability to test inbox and real login flow; if blocked, state exact owner action.
- Show actual database rows/counts in dashboards, truthful empty states otherwise.

### Genuine AI (not mock content)
- Inspect `src/server/ai/config.ts`, `src/server/ai/provider.ts`, schema and endpoint validation and current settings without printing key values.
- Diagnose the 400 response using a strictly limited, explicitly approved fictional request with sanitized diagnostics; approval for new live calls is REQUIRED. Do not retry indefinitely.
- Preferred: repair the Gemini integration if one real generation works; optionally add a PROPER provider abstraction for **Groq or another consented provider**, with separate server-side credentials, strict JSON/schema output validation, timeouts, safe logs, privacy notice, budget/rate safeguards and tests. New provider must actually pass live generation before UI calls it AI.
- Never submit real personal employment agreements to free provider tiers until provider terms, retention, consent, transfer region and data protections are reviewed. Redact sensitive identifiers when appropriate; respect refusals.
- Visibly distinguish AI inference, policy/rules-based analysis, unverified company claims, platform attestations and verified source-backed facts. AI output must never automatically certify employer legitimacy or give definitive legal conclusions.

### Employer intelligence and third-party data
- Real research must display provider/source URL, retrieved date, evidence provenance, confidence/limitations, and source access permissions. Do not scrape restricted LinkedIn content or invent employer verification. No external record = 'not verified', not a made-up trust score.

## 3. THE COMPLETE 14-MODULE ACCEPTANCE MATRIX

A module is **COMPLETE** only if navigation/UI, validation, authorized API, real DB persistence, error states, fresh reload, audit/privacy checks and meaningful user-level test evidence ALL pass.

| # | Module | Required observable real user acceptance |
|---|---|---|
| 1 | AI Employment Intelligence | Enter/import fictional offer; genuine AI explains risks/missing clauses with evidence/uncertainty; result stored/reloaded; failure handled |
| 2 | Company Research/Verification | Search selected entity; show authenticated platform evidence and permitted public citations, unknown source as unverified; ownership/review workflow |
| 3 | Transparent Opportunity Matching | Authorized organization posts real platform listing; worker discovers, filters, matches against optional private preferences; no invented jobs |
| 4 | Offer Management | Create/edit/save/compare two offers; reload; decision history accessible only to owner |
| 5 | Digital Agreements | Authorized parties create/review/version/approve/reject terms, preserve decision receipts; no fabricated legal e-signature claim |
| 6 | Work Records/Evidence | Create records, attach/review evidence, list and reload privately; access isolation and permitted deletion/retention |
| 7 | Work Passport | Build truthful portable profile with attributed verified/unverified employment entries; export/view; revoke shared access |
| 8 | Employer Portal | Authorized org representative onboarding and permissions; correct scoped profiles/listings/agreement and worker interactions |
| 9 | Disputes/Appeals | Submit evidence-backed case; authorized respondent and reviewer act; status, timeline, appeal, notifications/ownership |
|10 | Immutable/Auditable Decisions | Append-only revision/audit records and authorization; effective revocation; tampering test; not 'blockchain' unless true |
|11 | AI Assistant | Context-grounded real provider response with honest limitations and privacy; guidance persisted as permitted; fallback labeled |
|12 | Security/Privacy | Auth/email/RLS, abuse controls, CSRF/origin, retention/deletion, privacy policy/consent, no shared data cross-tenant |
|13 | Admin Center | Authenticated privileged staff workflow, MFA where required, approvals, case review, audit and least-privilege access |
|14 | Cross-platform UX | Functional responsive browser experience, installable Windows Electron shell and Capacitor Android app operating the SAME backend version |

All 14 remain in scope. **Never mark a module complete based on its route existing or simulated data**. If incomplete at deadline, record it accurately instead of shipping deceptively.

## 4. DELIVERY ARCHITECTURE

- **Public landing page:** preserve ORIGINAL V6 cinematic implementation; integrate login/register/download links with real routes; test mobile and desktop; no generic replacement.
- **Functional web app:** existing Next.js server/API + Supabase service, responsive full-width desktop UX (no 390px phone frame), mobile UX and genuine data.
- **Windows:** preserve Electron source and existing unsigned installer; app loads the APPROVED, VERIFIED HTTPS origin. Sandbox, contextIsolation, no nodeIntegration, strict trusted URLs; actual auth and persistence tested; version/hash recorded.
- **Android:** preserve Capacitor source; build ONLINE non-localhost APK; verify intent/deep-link/email flow/back button/network recovery; Android signing uses secure persistent release keystore when approved. Device/emulator testing required, not merely Gradle success.
- **Backend:** single authorized Supabase project with deployment/migration backup plan and zero credential leaks.
- **Release files:** original executable installer and APK stored as checked binaries, SHA-256 checksums, version, installation docs. Publish via explicitly approved hosting, e.g. GitHub Release assets; do not place binary downloads at fabricated addresses or publicize stale builds.

## 5. REQUIRED TEST LEVELS

1. Typecheck, lint, unit, integration and SQL RLS checks.
2. Real hosted staging auth+database+AI smoke with user approval and authorized test data; DO NOT use mocks for release go/no-go.
3. Independent worker, employer and administrator accounts and cross-role isolation/denial.
4. 3–5 consenting external testers if possible, using non-sensitive scenarios; record actual device/OS, script, pass/fail and reported errors. No fake endorsements or invented testing.
5. Electron installed application login/persistence and Android installed APK login/persistence; cross-device saved record visible. Screenshots + sanitized HAR/logs.
6. Security checks: no service-role keys in client packages, RLS deny others' rows, allowed origin, auth/session, rate limits, document upload protections, audit integrity, deletion/retention, basic threat testing.
7. Explicit statuses: working local / working staging / working hosted production / blocked; never conflate them.

## 6. DELIVERY CLOCK — 24 TO 27 OCTOBER

- **Oct 24:** save working tree; reproduce real user login/offer/AI errors; fix root causes and gate conflicts; audit exactly which 14 have real backend flow. Verify provider model and schema before spending quota.
- **Oct 25:** user journeys on staging, enabled consent-safe AI, persistent worker workflows; test employer/admin/dispute/agreement flows and correct gaps. Desktop/mobile smoke and browser regressions.
- **Oct 26:** security, roles, RLS, hosted configuration reconciliation; controlled approved deployment with rollback where appropriate; mobile real-device and Windows actual-login testing; multi-user acceptance and bug fixes.
- **Oct 27:** no new speculative features; critical incident fixes, real-user testing, downloadable artifacts, landing downloads with verified URLs, staged rehearsals, final go/no-go evidence. Keep emergency rollback and offline backup video of A REAL successful test, not fake output.

## 7. RESOURCE / COST REQUIREMENTS

Prioritize existing installed Codex/local repo, Node.js, Android Studio/Gradle, Supabase, Playwright, Electron and Capacitor. Do not rewrite framework. Gemini free tier or Groq can serve bounded *test* calls only if supported model, quota, user approval and data policy allow. ChatGPT Plus subscription does NOT grant arbitrary API credit. OpenRouter free is capped and not dependable for unrestricted real users. Supabase Free may pause, has capacity limits and no automatic backups. Vercel Hobby is personal/non-commercial; do not assume it's compliant for a commercial public launch. Windows Authenticode code signing usually needs an external certificate/service; unsigned installers must be labeled. Self-sign Android APK using local Android signing tools and safeguard the keystore if approved.

## 8. AGENT REPORT FORMAT — AFTER EVERY MEANINGFUL BATCH

Only report actual changes with file paths and concrete proof:
- `BUILD`: exact command, exit status, dated artifact paths, file sizes/checksums.
- `REAL AUTH`: registered, verified, login, logout, refresh, source/backend and pass/fail.
- `REAL AI`: provider name/model, HTTP success, validated useful structured output, approvals and privacy status; never include user documents, API keys or transcripts.
- `EACH OF 14`: UI-only / local full / staging verified / production verified / blocked.
- `CROSS-DEVICE`: actual Windows+Android same account + persisted item, yes/no, devices and environment.
- `SECURITY`: denied-unauthorized cases, RLS and role separation, backups and release blockers.
- `NEXT`: exact file(s) to edit and reason. Execute the next safe fix instead of only generating a plan.

**STOP CONDITIONS:** secrets leaked, uncontrolled hosted writes, no recoverable data, real private documents sent without approved consent/policy, role privilege escalation, serious authentication/RLS failures. Fix or block release, never bypass.

**EXECUTE NOW:** confirm local working tree, reproduce real login failure, root-cause and fix, then verify real offer → AI → save → reload. Continue modules and artifacts from there.
