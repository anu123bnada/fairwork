# ORYQEN Career Gap Analyzer and Opportunity Intelligence: acceptance report (16 Nov 2026)

Prepared by the release lead agent on inspection day. **Evidence legend.** **[V]** verified by me on this date (method named). **[F]** verified only against a stand-in for the API (proves screens and rules, not that the hosted service stores anything). **[U]** not verified.

## Verdict
**Features 23 and 24 are implemented as working rule-based screens and are verified locally; they are not yet usable end to end on hosted staging, because saving needs one database migration that only the owner may apply.** Nothing in either feature uses AI (AI is off on staging and no model is called). Opportunity Intelligence has **one genuine live source (ORYQEN's own employer listings) and no outside platform connected**. Staging currently has 0 published listings, so the live recommendations list is empty there until a listing is published.

## 1. Career goal profile
- Screen `/app/career-intelligence` ("Career gap analyzer", Find work menu). Fields: primary goal (9 reference roles or "my own goal" with the person's own requirement list), up to 3 alternative goals, education level, qualifications (academic, professional, certification), technical and soft skills each with an evidence level, work experience, projects, preferred language, format and weekly hours. All editable, deletable.
- Persistence uses the **existing personal-records service** (owner-only, row-level security, optimistic revisions), not a new profile system: one new record kind `career_profile`. [V] on PGlite (`tests/integration/career-records-db.test.ts`); [U] on hosted (migration not applied).

## 2. Gap analysis
Pure rules (`src/features/careers/analyzer.ts`), 14 unit tests [V]. For each required skill the person sees one of: gap, learning started, course finished (not shown in practice), self-reported, demonstrated by you (unverified), proof described by you (not checked by ORYQEN). **Nothing is ever shown as verified**, because nothing in ORYQEN verifies skills. Gaps are split essential and helpful with a reason per skill; qualifications are listed separately and a regulated one (electrician licence, driving licence) **stays a gap whatever courses are finished** [V, unit and browser]. There is **no readiness percentage**: the headline is a plain count ("covers 2 of 4 essential skills in what you have told us") with the limits stated.
Requirements come from the **ORYQEN reference framework**: an editorial list written for this build, labelled on screen as not labour-market data, not an official standard and not verified by any employer or regulator. 9 roles: the 8 sample roles plus junior data analyst. A goal outside them uses only the requirements the person types, labelled as such.

## 3. Free courses and link verification
17 courses in `src/features/careers/courses.ts`, from freeCodeCamp, web.dev (Google), MDN, Microsoft Learn, GitHub Docs, Kaggle Learn and Google for Developers. **Every URL was requested on 16 Nov 2026 and answered HTTP 200**; for 15 of them the page title was read and matched the title shown. **For the 2 freeCodeCamp pages only the address resolving was confirmed** (their titles load in the browser), and the screen says so. Candidates that answered 404 or could not be opened were **dropped, not listed** (including several Microsoft Learn paths and a Coursera course, and a Khan Academy page that blocked the check). Coursera and edX are **not offered**, because free audit access could not be verified. Each card shows exact title, provider, direct link, "free to access", certificate wording (we never assert a free certificate: "none offered" or "not confirmed by ORYQEN"), skills covered, the gap it addresses, duration ("not stated by the provider" because none was confirmed), and why it was recommended. Coverage is deliberately thin: **web development and data analysis have courses; the trades, retail, driving, accounts and supervision roles have none**, and the screen says "no verified free course for this skill is in ORYQEN's catalog yet" instead of padding. Courses are English only; a person who prefers another language is told so. Links will go stale: re-verify before each demonstration.

## 4. Learning progress
Mark each resource started, completed or reset, with an optional https link to a certificate or work. Progress is stored in the same profile record and the gaps are recalculated immediately ("Course finished, not yet shown in practice"), plus a reminder that a finished course is not a qualification [V browser, F]. Changing goal at any time keeps the profile. Not built: reminders, time estimates from weekly hours, adding skills automatically from completed courses.

## 5. Opportunity Intelligence
Screen `/app/opportunity-intelligence`: connection center, recommendation preferences (inspect, reset), ranked listings. Matching (`src/features/opportunities/intelligence.ts`, unit-tested [V]) compares each real listing with the career goal, skills the listing mentions (found as whole words), and the existing job preferences (role, location, work arrangement, pay). It shows each criterion, matching skills, missing requirements, an eligibility note when a licence or degree is mentioned and no qualification is listed, and "n of m checkable criteria are met", each counting equally and labelled "not a prediction". Feedback (like, dislike, save, hide, not relevant, already applied) is stored as the new record kind `opportunity_feedback`; disliked, hidden and not-relevant listings move to a "hidden by your feedback" list with Show again; **Reset my feedback deletes the record** [V browser, F]. Listings carry their real source label and the fact that the organization's identity is demonstration-provisioned.

## 6. Actual integrations
**One: ORYQEN employer listings (built in).** The page states count loaded and last refreshed. No outside account is involved.

## 7. Unsupported integrations and reasons
All four buttons say "Connect (not available)" and are disabled; no connected state exists anywhere.
- **LinkedIn:** its documentation (checked 16 Nov) says its Job Posting API is restricted to approved partners and **was not accepting new partners**; it is an employer posting API, not a seeker search. Most LinkedIn permissions need explicit approval. ORYQEN has no approval.
- **Facebook and Instagram:** ORYQEN has no approved Meta app; the official documentation reviewed covers the Graph API and Instagram business content and **we did not find a documented, permitted job-listing read**. This is a statement about what we found, not proof that none exists.
- **Fiverr:** the official developer site could not be opened on 16 Nov; nothing can be claimed.
We do not scrape, ask for passwords or bypass access. The screen describes what a future integration would do (official OAuth, visible permissions, disconnect, deletion of imported data) as **future**, not as available.

## 8. Database and API changes
- One migration, `supabase/migrations/20261116090000_career_profile_and_feedback_kinds.sql`: adds kinds `career_profile` (status active or archived, 10 allowed keys) and `opportunity_feedback` (status active, key `entries`) to `private.personal_records` and re-creates the save and list functions with the extended lists. Existing rows, constraints for the five older kinds and all security properties are unchanged [V: the existing 9 personal-records DB tests plus 3 new ones pass on the full migration chain]. Hash registered in `scripts/prepare-local-development.mjs`.
- **No new API route.** The existing `/api/v1/records` routes accept the new kinds through the extended strict schema.
- **Not applied to staging** (see section 12).

## 9. Security and consent
Owner-only rows under forced RLS; strict schemas reject unknown keys and non-https links; the profile cannot carry a "verified" flag; stored for one stated purpose; deletable by the person (profile and feedback); no social data read, no tokens stored (no integration exists, so no token store was built); same-origin write checks and server-side identity come from the existing records route. Not built: a separate consent record, since no outside data is imported.

## 10. Screenshots
`ORYQEN-EXHIBITION-DELIVERABLES\CAREER-OPPORTUNITY-QA-20261116\` (6 images: both screens at 1440, 390 and 360 px). **[F]** fixture-backed, not hosted. The phone career page is long (about 9,300 px) because a course covering several skills is repeated under each; no horizontal overflow at any width.

## 11. Test results
Type check clean; lint clean; 143 unit and integration files, 789 tests pass (14 new unit, 3 new database, 2 existing tests updated: command-palette ranking now has three "career" matches, and the two new English-only screens are listed with a reason in the localization coverage test). Browser spec `tests/e2e/career-intelligence.spec.ts`: 11 of 11 pass against a local server with a stand-in API (goal, evidence levels, course card content and link, progress recalculation, save, reload and delete, regulated profession, degraded server, listings explanation, feedback and reset, no-listings state, overflow and script errors at three widths). The full existing browser suite was **not** re-run locally; CI runs it.

## 12. Staging commit and deployment verification
_Filled in below after CI._

## 13. Live demonstration (about 4 minutes)
1. Sign in, open **Find work, Career gap analyzer**. Choose Junior web developer. Say: requirements are an editorial reference, not employer data.
2. Add HTML as a skill, set "I have used it in a project" and describe it. Show the label "Demonstrated by you, unverified" and that no skill is ever "verified".
3. Show the gap list and the free path: open one course link; point out certificate wording and "duration not stated". Mark a course complete; show the gap change to "Course finished, not yet shown in practice" and the not-a-qualification note.
4. Change the goal to Electrician: the licence stays a gap and the screen says no verified free trade course exists.
5. Open **Opportunity intelligence**: show the connection center (four platforms honestly "Not connected"), then listings if any exist, the per-criterion explanation, feedback and Reset.
**Until the owner applies the migration to staging, steps 2 to 3 progress and all feedback will show "could not be stored".** Everything else works. Publish at least one listing from an organization account first if you want real recommendations.

## 14. Remaining work
Apply the migration to staging (owner approval) and re-run the hosted checks; courses and requirements for the trades and retail roles; Coursera and edX once free access can be verified; scheduled refresh (needs a job runner; nothing is scheduled); any outside platform (needs the platform's approval); native-speaker review and translation (English only); duplicate course cards on long roadmaps; AI-written explanations (AI is off, needs a provider contract and evaluation); account deletion of imported data once an integration exists.
