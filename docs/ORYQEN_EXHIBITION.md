# ORYQEN exhibition plan (IIT, 10 November 2026)

See also `ORYQEN_DEMO_GUIDE.md`, `DEMO_SCRIPT_14_FEATURES.md`, `scripts/demo-seed.mjs` (synthetic data only).

## Principles
- Use a dedicated demo environment (staging or local), synthetic data, labelled as a demonstration. No production records on exhibition devices.
- Visitors get the demo worker account only; never admin or reviewer credentials. Passwords stay in git-ignored files.
- Every feature shown must be one that works today. Say plainly: AI is guidance not legal advice; deterministic analysis is shown if Gemini is off; Android is a preview build.

## Timeline
- 5 Nov: staging redeployed from the release branch; hosted smoke test run.
- 8 Nov: E2E and real-stack harness run, results recorded in `ORYQEN_TESTING.md`.
- 9 Nov: freeze. Backup staging DB. Rehearse. No code changes after.
- 10 Nov: public run.

## Demo flow (about 8 minutes)
1. Landing and sign-in as demo worker. 2. Paste a synthetic offer, review text, analyze, save. 3. Reopen it after refresh. 4. Company research (GLEIF, with source and timestamp). 5. Agreement versions and comparison. 6. Work record and evidence vault. 7. Work Passport share with QR. 8. Dispute case view. 9. Admin console only as a presenter-run screen.

## Reliability
- Fallback 1: local stack (`node scripts/run-local-development.mjs`, Docker needed) on a laptop; rehearse it.
- Fallback 2: phone hotspot; keep a second device logged in.
- Printed QR code to the staging URL (generate with the `qrcode` dependency).
- If Gemini fails, continue with the deterministic analysis; do not retry on stage.

## Demo account seeding (5 Nov 2026)
`DEMO_PASSWORD` is mandatory and is never stored. If the default demo account (`oryqen-demo-worker@example.test`) already exists with a password nobody remembers, registration returns 200 but no email arrives and sign-in fails with 401. Set `DEMO_EMAIL=oryqen-demo-2@example.test` (any `@example.test` address) to create a fresh account. Local origins only; the script refuses anything else.

## Release freeze (prepared 7 Nov 2026; freeze day 9 Nov)
Freeze candidate: branch `integration/final-release`, commit recorded in `ORYQEN_SESSION_HANDOFF.md` at freeze time. Nothing new is added after the freeze except a fix for a defect found in rehearsal, and every such fix is re-run through the gates below.

### What visitors may be shown (each has evidence in `ORYQEN_TESTING.md`; all local or fixture-based unless stated)
Registration and sign-in with email confirmation; offer paste, review and rules-based analysis (labelled; AI off unless approved); saved offers and revision history; company research (GLEIF, cited); agreements, work records and evidence vault; Work Passport with sharing, revocation, signed JSON and print-to-PDF; verifiable credential check page; disputes; opportunities with saved-listing history; Smart CV Builder (self-reported, verified work read live from the Passport, print to PDF); account security activity; Settings language switch (English, Sinhala, Tamil, German; some screens English only).

### What must NOT be shown or promised
AI Challenge Arena, AI career analysis, AI-written CVs or cover letters, LinkedIn connection, interview simulator, payments or paid plans, organization analytics, a signed Android release, any claim of "verified" for self-reported data, any claim that ORYQEN replaces a lawyer or labour authority. Say "planned" for these, never "available".

### Owner decisions and actions needed before the freeze (none done by the assistant)
1. ~~Apply the three pending migrations to staging~~ **done 8 Nov** (see `ORYQEN_TESTING.md`).
2. ~~Deploy to staging~~ **done 8 Nov**. Still open: the signed-in hosted smoke test (tier 2, `ORYQEN_HOSTED_APPROVAL_REQUEST.md`).
3. Decide AI: off (recommended; the labelled rules-based analysis is shown) or approved for the demo account only.
4. Confirm auth email capacity (see below) and create demo accounts with passwords kept off paper and out of git.
5. Choose who holds the accounts (adult account holder) for hosting, domain and email services.

### Capacity and email: not verified
No load test was run. 10,000 students over two days is not 10,000 simultaneous users, but nothing here proves any concurrency number. Two known limits to check **before** inviting self-registration: (a) the hosted auth service's built-in email sending is heavily rate-limited, so many visitors registering at once may not receive confirmation emails unless a custom SMTP provider is configured; (b) the free tiers of the hosting and database plans have request and storage ceilings. Recommended: visitors use presenter-run devices and a small set of shared synthetic demo accounts; do not collect visitors' real personal data on the day.

### Visitor data statement (to display at the stand)
"This is a demonstration. Please do not enter real personal details. Demo accounts hold synthetic data and are reset after the event. ORYQEN does not use anything you enter to train AI."

### Rollback
- Web: in the hosting dashboard, promote the previous known-good deployment (do not rebuild on the day). Keep its URL written down before the freeze.
- Database: the new migrations are additive (new tables and functions); do not try to undo them on the day. If a migration misbehaves, take the feature offline by rolling the web deployment back; the old code ignores the new tables.
- Data: backup taken on 9 Nov before the freeze; restore only with the owner present.

### Network failure plan
Local-stack fallback on a laptop (Docker, `node scripts/run-local-development.mjs`, port 3100 must be free) with the demo account seeded (`DEMO_EMAIL` and `DEMO_PASSWORD`); phone hotspot; printed QR code to the staging URL; if a page will not load, say so and move to the next prepared screen. Do not retry AI on stage.

### Machine hygiene (learned 5-7 Nov)
Keep several GB of disk and RAM free before any gate run: a full disk stopped work on 6 Nov, and the full E2E failed three times with one different intermittent error each (last: `ERR_INSUFFICIENT_RESOURCES`). Playwright leaves `HeadlessChrome*` folders in the temp directory; clear them between runs. Check what owns a port before stopping it (another project's server uses port 3100 on this machine, which the real-stack harness also needs).

### Freeze checklist (state on 7 Nov)
| Gate | State |
|---|---|
| `tsc`, ESLint, full vitest, `next build` | PASS on the latest code commit (see `ORYQEN_TESTING.md`) |
| Real-stack harness (local Docker, synthetic accounts) | PASS 263/263 |
| Full E2E (isolated, fixture-based) | **PASS on CI** (GitHub `windows-latest`, commit `4ce1e1e`, run 42433081034: 648 passed, 0 failed; typecheck, lint, 1055 unit/integration tests, PostgreSQL suites and the build all passed too). Local laptop runs were unreliable (F-47); use CI for the freeze check. Any later commit needs its own CI run. |
| Hosted smoke tier 1 (anonymous) | PASS 24/0/5 (1 Nov) |
| Hosted smoke tier 2 (signed in) | NOT RUN: needs staging accounts the owner creates; the new CV, security-activity and saved-listing screens have not been exercised signed in on staging |
| Android device run | NOT RUN (emulator did not boot on this RAM) |
| Staging migrations and deployment match the code | **DONE 8 Nov** (62 migrations; `release/oryqen-oct27` at `b4d69a2` serves staging; anonymous smoke 24/0/5 and rendering 10/10 on the new build) |
| Demo accounts and rehearsal | NOT DONE |

## 9 Nov additions to what visitors may be shown
- **Scan an offer** (menu, more): a screenshot is read on the device, a popup shows the real steps, and a report opens with findings that quote the exact words. Works with no AI.
- **Analyze offer** on Add offer: a popup with real stages, then a clean report screen. **Without the Google key set in Vercel the report says "AI analysis is not configured" and uses on-device rules only. Do not tell visitors it is AI-powered unless the owner has completed `ORYQEN_AI_SETUP_STEPS.md` and a real analysis has been run on the staging site.** Visitors without an organization can still analyze (the report says it was not saved).
- **Help** (menu, more): a rules-based help assistant that labels itself "not AI".
- Full status of every module and tool, with evidence: `ORYQEN_IMPLEMENTATION_REGISTER.md`. Anything marked NOT BUILT there must be described as "planned".

## Demo reset (9 Nov)
`scripts/demo-reset.mjs` returns a DEMO account to its baseline using the account's own permissions, so it cannot touch anyone else's data. It refuses any origin except a loopback address or `https://oryqen-staging.vercel.app`, any email not ending in `@example.test`, and any profile whose display name does not contain `DEMO`. It removes the account's CVs, saved-listing history and research history, then recreates a labelled DEMO CV, three employment entries and two offer drafts (fixed ids, so re-running never duplicates). Rehearsed on the real local stack: extras removed, baseline restored, second run clean, a non-DEMO account refused.
```bash
node scripts/demo-reset.mjs https://oryqen-staging.vercel.app --email demo-worker@example.test
```
It asks for the password at a hidden prompt (or reads `DEMO_PASSWORD`). The account must already exist: the owner creates and confirms it (in the Supabase dashboard, Authentication, Users, "Add user" with auto-confirm, then sign in once and set the display name to start with `[DEMO]`). Seeding a fresh **local** account is `scripts/demo-seed.mjs` (set `DEMO_EMAIL` and `DEMO_PASSWORD`). Staging demo accounts for the employer, recruiter and administrator roles need the owner's authority grants and are NOT created.

## 10 Nov additions: Career, Opportunity and Organization studios

Migrations `20261109100000`, `20261110100000` and `20261110110000` are applied to staging (owner approved; backup first; ownership, forced RLS and execute rights checked). Nothing here is production verified and none of it has been used signed in on staging yet.

### Suggested demonstration sequence (about 6 minutes, with a signed-in demo account)
1. **Career explorer** (More menu): point out the SAMPLE DATA banner. Tick a few skills, pick Welder, read the coverage and the missing skills, press "Save a roadmap", tick a milestone, save, reload.
2. **CV Builder, then CV Analyzer**: the score is explained by rules, not AI.
3. **Cover letter**: fill the boxes, edit the text, save, reopen. It says it is a template, not AI.
4. **Portfolio**: add a certificate entry with an https link. It says entries are self-reported.
5. **Job opportunities**: open a published listing and press Apply. Show the line that says only the display name and message are shared.
6. **Application tracker**: the sent application shows its status. Add a manual application with an interview and tick the preparation checklist.
7. **Workroom**: a project with tasks; progress is counted from ticked tasks.
8. **Applicants** (second device or account that published the listing): see the count, open the listing, mark the applicant shortlisted; the first account sees the status change.

### What is simulated or not built (say so if asked)
- Career roles and skills are a synthetic sample written for the exhibition, not labour-market data; the person's skills for the explorer are kept in the browser on that device.
- Cover letters are templates, not AI. No AI is configured on staging.
- No separate Interview Tracker screen: interviews and preparation live inside the Application tracker.
- Applicants are never verified and are not messaged by ORYQEN; employee records, organization analytics and applicant messaging are not built.
- Applicant review needs an approved organization representative who published the listing; those demo accounts are not created yet.

### 10 Nov (later): demo screens added
- **Demo center** (More menu): says what is real and what is sample, loads 7 clearly marked (DEMO) sample records into the signed-in person's own account (3 applications with 2 interviews, a project, a cover letter, a portfolio entry, a roadmap) and removes only records marked (DEMO). Press Load first; then every screen has something to show.
- **Interviews**: list or by-day view of the interviews inside the sample applications; edit stage, status, outcome, questions, notes and feedback.
- **Career assistant**: DEMO, fixed rules, no AI model; uses the skills ticked in Career explorer on the same device.
- **Sample employers**: four invented companies with SAMPLE information, user-submitted information (none) and verified facts (none) in separate panels.
- **Add a job offer**: the "Fill in a sample offer (DEMO)" button pastes a synthetic offer with an unpaid-overtime clause, a no-notice probation, a vague contract and a deposit, so the rule-based report has findings to explain.
- Real AI: none on staging. Real data: records, applications and applicants are real database rows typed by people and never verified.

### 10 Nov (evening): public visitor hub, QA findings, downloads
- **Public hub at `/try` (no account):** Worker tab (Career explorer in an anonymous mode without roadmap saving or CV import, Career assistant DEMO, Salary comparison, Sample employers), Employer tab (the two-sided Organization sandbox with fictional applicants, sample employer profiles), Recruiter tab (a rule-based message check that quotes the matched wording and never gives a verdict). Everything runs on the visitor's device, calls no API, reads no account data and grants nothing; the real product stays behind sign-in and permissions. It also carries the guide to all 22 modules (real, try here, needs a counterpart account, or protected). Linked from the landing page nav and download area and from the sign-in page.
- **Independent QA (Agent 4, anonymous, read-only):** home, sign-in validation, register, forgot-password, downloads, 404 and the signed-out gate all pass; phone width 375 has no overflow on the landing page. Signed-in features were NOT tested by that agent (no credentials, correctly no bypass). Not reproduced here: the reported 10-second "Loading your private session" wait (the session check answers in 0.8 to 1.9 s on staging when measured, so it was probably a cold start).
- **Fixed from the QA report:** the landing copy said downloads unlock only when a link is published while both were already live; it now says the builds are previews (unsigned Windows installer, debug-signed Android app) and to check the checksum. A visitor with no account now has the `/try` link on the sign-in page.
- **Downloads, honest state:** the links on the landing page and `/downloads` are unchanged and were already live (Windows installer as a GitHub release asset, Android APK served from the site; both described in `docs/RELEASE_MANIFEST.md` and tested by `tests/unit/release-data.test.ts`). The two files in the shared deliverables folder were NOT published: their checksums and sizes differ from the documented ones; the Android build's installation was not tested (Agent 2 says so) and the Windows installer has no report from its builder. Publishing needs a verified install test, a manifest update and a hosting step.
- **Still true:** no organization, operator or second account exists on staging, so employer, reviewer, agreement and Passport-verification journeys cannot be shown live; the sandbox and sample screens cover them as DEMO.
