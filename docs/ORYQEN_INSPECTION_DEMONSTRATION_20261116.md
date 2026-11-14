# ORYQEN inspection demonstration (Monday 16 Nov 2026)

One coherent walk-through, about ten minutes. It builds on `ORYQEN_DEMO_GUIDE.md` and `ORYQEN_EXHIBITION.md` and does not replace them. All records are synthetic and labelled; nothing here is a real employer, person or external verification.

## Label key (say it out loud when it applies)
| Label | Meaning |
|---|---|
| **LIVE** | Runs against the hosted staging backend (Supabase, real API, real sign-in). |
| **RULES** | Deterministic, published rule-based analysis. Not AI, not legal advice, does not verify a company. |
| **AI** | Model-powered. **Off on staging**; the screens say so. Never demonstrated as working. |
| **FIXTURE** | Test data supplied by a stand-in, used for layout checks. Never shown as proof the backend works. |
| **NOT AVAILABLE** | Not built, not connected, or not approved. Say so plainly. |

## Before the day (owner actions; none done by the assistant)
1. **Test accounts.** Create two staging users (one worker, one employer) as described in `ORYQEN_TEST_ACCOUNT_WORKFLOW.md` (Supabase dashboard, Auto Confirm). Passwords stay on the owner's machine.
2. **Signed-in rehearsal.** Run `node scripts/test-hosted-worker-journeys.mjs https://oryqen-staging.vercel.app --email <worker test email>`; type the password at the hidden prompt. Keep the PASS/FAIL lines in the report.
3. **Employer two-account journeys** (agreement, verified work, Passport entry from an employer-confirmed record) need the second account and an approved organization membership. These are not seeded or faked. If they are not rehearsed, present them as *not shown*.
4. **Fallbacks:** local stack on a laptop (`ORYQEN_EXHIBITION.md`), phone hotspot, printed QR code to `https://oryqen-staging.vercel.app`.

## The walk-through

### 1. The problem (60 s) , no sign-in
Open `/`. Say: people receive job offers whose key terms are missing or unclear (pay, hours, notice, trial terms), have no record of the work they actually did, and have no way to carry confirmed work between employers. ORYQEN checks offers against published rules, keeps private evidence, and presents only **employer-confirmed** work in a Passport the person controls.
- Label: public page, **LIVE** (served from staging).

### 2. Submit an offer (90 s) , worker account
Sign in as the worker test account, open **Add offer**, paste the synthetic offer text (`Workshop Assistant`, LKR 80,000 monthly, 60 hours a week, unpaid trial, no notice, overtime not paid) and save.
- Labels: sign-in and saving are **LIVE**; on-device text reading is local to the browser. Camera/screenshot import reads text on the device.

### 3. The assessment (150 s)
Open **Check**. The page is now one reading order, numbered 1 to 7:
1. **Summary**: how many required terms were stated and how many need clarification.
2. **Fairness score**: the offer-indicators score with its category breakdown and evidence. Say: points are given for clarity and protections stated; it is not a rating of the employer or a market-wage claim.
3. **Main risks**: wording that deserves a closer look (here: unpaid trial wording).
4. **Missing information**: each term, stated or still unclear.
5. **Questions to ask**: what to put to the employer.
6. **Clause analysis**: the wording behind each flag.
7. **Supporting tools and limits**: downloadable summary, notes, recruiter check, country references.
- Labels: score, risks and clauses are **RULES**. The AI section says AI is off: **AI is not demonstrated**. The recruiter check reads public/own-entered information and says what it cannot verify.

### 4. Private evidence (60 s)
Open **Work record**. In **Evidence Vault**, save a synthetic PDF (a certificate), show the card (title, type, size, checksum), download it, then delete it.
- Labels: storage, signed download and delete are **LIVE** when storage is configured; otherwise the screen says uploads are unavailable (an honest state, not an error). Files are not scanned for malware (the page says so).

### 5. Work records and the Passport (90 s)
In **Work record** show the hours summary and per-record status (verified, waiting, draft). Open **Passport**.
- A Passport entry exists **only** for work an employer representative confirmed against an agreement. A worker-only account will see an empty Passport with the reason; that is correct behaviour.
- With an employer-confirmed record (needs the two-account setup above): show the stats, the verified-hours-by-year chart, the timeline with employer name, evidence statement count and verification reference, then the export options (private JSON, signed file, print/PDF) and **Share** (preview first; raw evidence stays private).
- Labels: **LIVE** when the two-account setup was rehearsed; otherwise **not shown** (do not substitute fixtures as proof).

### 6. Employer workspace (90 s) , employer account
Sign in as the employer test account. **Employer** shows three figures (organizations you are authorized for, offers you manage, applications received), organization membership requests, company information, recruiter confirmations, and your offers. **Applicants** lists the listings you published with application counts and a review status per applicant.
- Labels: **LIVE**. Organization approval uses a demonstration authority (`demo-authority.v1`), **not** a real employer or identity check. Say so.

### 7. Trust, privacy and verification (60 s)
Say, and show where visible: every record is private to its owner; sign-in is enforced on every API (anonymous `/api/v1/me` returns 401; a cross-origin write returns 403); Passport shows only independently confirmed work; self-reported material is always labelled unverified; no AI analysis runs without consent and it is off here.

## What is NOT available or NOT shown (say it before being asked)
- AI analysis and AI-written content: **off** on staging. A rules-based version is shown.
- Real employer or identity verification: **not connected**. Organization approval is a demonstration authority.
- Payments, paid plans, signed Android release (the Android and Windows builds are previews).
- Admin governance: needs an authorized admin account with a second factor; not demonstrated unless the owner provides one.
- All 22 modules are not production-ready. This is a competition inspection build, not an international production release.

## If something fails on the day
Say what failed and continue. Do not retry on stage. Fall back in this order: refresh once; local stack on the laptop; phone hotspot; the public `/try` hub (no account) for the Career explorer, Salary comparison and Sample employers.
