# ORYQEN competition readiness report (inspection Monday 16 Nov 2026)

Prepared 14 Nov 2026 by the release lead agent. **This is a competition-inspection readiness statement, not a production-readiness claim.** All 22 modules are not production-ready (section 10).

**Evidence legend.** **[V]** verified by me on the date shown (method named). **[F]** verified only against fixture data (a stand-in for the API; proves layout and rendering of real fields, never that the hosted service works). **[U]** not verified.

## Verdict
**Ready to show, with named conditions.** The public site, the redesigned screens and the rules-based analysis are verified as far as evidence allows. **Single-account worker API journeys now pass on hosted staging (17 PASS, 0 FAIL, 8 NOT RUN; section 7)**, run by the owner and reported to me. **Nothing signed-in has been seen in a browser on staging, and every journey that needs a second account, an organization or an employer is still not run [U].** Those must be presented from a local stack or labelled "not shown live".

## 1. Completed work
| Area | What changed | Evidence |
|---|---|---|
| Design system v2 | Tokens (chart palette, spacing, type, elevation), cards, charts, skeletons, sheet, active sidebar state (`ui-v2.css`, loaded last) | CI green [V] |
| Worker dashboard | Insights band built only from the person's own offers and work records (hours per month confirmed vs not yet, offers by decision, records by status); every chart has a hidden text table; honest empty and failed states; saved offers as cards | 6 spec tests [F], CI [V] |
| Phone navigation | Header menu button opens a full-screen grouped sheet (the "More" group was unreachable on phones before); floating Add offer action; swipe rows | Spec at 390/375/360 px [F], CI [V] |
| FAIRWORK Check | One reading order in seven numbered groups with a jump bar: summary, fairness score, main risks, missing information, questions to ask, clause analysis, supporting tools and limits. Real assessment engine and all existing components unchanged | Capture and matrix [F], accessibility light and dark [F], CI [V] |
| Employer overview | Three figures read from existing endpoints (organizations you are authorized for, offers you manage, applications received) with loading, empty and failed states; saved-offer rows as cards | Matrix [F], CI [V] |
| Evidence Vault | Documents as cards (icon, title, type, size, checksum, Download and Delete); two-column forms on wide screens | 8 specs incl. existing vault spec [F], CI [V] |
| Work Passport | Verified-hours-by-year chart; readable dates; entries remain "independently verified" only. Export and sharing code **not changed** | Matrix [F], CI [V] |
| Validation and errors | `userMessage()` turns a raw schema error into one plain sentence and logs the technical detail to the console; applied in about 60 places; real failures are still shown, never swallowed | 3 unit tests [V], CI [V] |
| Accessibility fixes found by tests | Contrast on the Check summary card and on dark-mode assessment chips | Accessibility spec, light and dark [F] |

Not done in this sprint: Applicant management and Case screens were not redesigned (only the Employer overview figures were added); the Check score group is still long because country references and saved-analysis history live inside the existing assessment component.

## 2. Git commits
| Commit | Subject | Branch |
|---|---|---|
| `1791774` | Design system v2: insights, phone navigation sheet, floating Add offer | `exhibition/dev-nov10` |
| `3eb8ca4` | Evidence Vault cards; two-column forms; capture spec | `exhibition/dev-nov10` |
| `757ecff` | Check capture spec with real assessment engine output | `exhibition/dev-nov10` |
| `316945c` | Check reading order, Employer figures, Passport chart, friendly errors | `exhibition/dev-nov10` |

Uncommitted local items, deliberately left alone: `next-env.d.ts` (tooling), `.claude/`, two untracked audit/remediation documents, `landing/v6/next-env.d.ts`. No work was reset, discarded or force-pushed. Nine worktrees are registered (agent worktrees untouched). A pre-sprint backup bundle exists in `ORYQEN-EXHIBITION-DELIVERABLES\REPO-BACKUP-20261113`.

## 3. CI results [V]
Windows runner, full browser suite, build and staging package.
| Commit | CI | 
|---|---|
| `1791774` | success |
| `757ecff` | success (carried `3eb8ca4`) |
| `316945c` | success |
Local gates before each push: type check, lint, 1137 unit tests (17 skipped by design), secret scan (0 unexplained findings). One regression was caught and fixed during the sprint: an existing test required Search in the phone bottom bar, so the Add action became a floating button instead of replacing Search.

## 4. Staging deployment evidence [V]
Staging branch `release/oryqen-oct27`; every deployed commit is a fast-forward cherry-pick of a CI-passed commit, with the source tree compared before pushing (zero differences in `src`, `tests`, `scripts`, `package.json`; the only difference was one audit document staging does not carry). Production was not touched.
| Staging commit | Source of | Vercel (oryqen / fairwork) |
|---|---|---|
| `b8411aa` | `1791774` | success / success |
| `520bc47` | `3eb8ca4`, `757ecff` | success / success |
| **`62c75d2`** (current) | `316945c` | success / success |

Live checks on `https://oryqen-staging.vercel.app` at `62c75d2` (14 Nov): new Check and Employer styles present in the served CSS; `/`, `/try`, `/sign-in`, `/downloads`, `/verify` return 200; anonymous `/api/v1/me` returns 401; a cross-origin POST returns 403; HSTS, `X-Frame-Options: DENY` and `nosniff` present; the Android preview APK still hashes to `8d4a1e1b…`; the Windows installer link serves the same 121,261,243 bytes.

## 5. Before and after
**True "before" screenshots were not captured.** The build machine's C: drive was at 100% during this sprint (down to 1 MB free at one point), which left no room for a second dependency tree to rebuild the old commit. In place of images, the changes are described: the Check page was a single long stack with no grouping; the dashboard had text-only cards and no charts; phones had no route to most screens; Vault documents were a bulleted list with two full-width buttons each; the Employer page had no overview figures. The "after" images are in section 6.

## 6. Five-screen visual QA [F]
Fixture-backed run at 1440, 1280, 390, 375 and 360 px: **25 of 25 cells pass** on the committed tree. Each cell asserts no horizontal overflow, no page or script errors, and a visible main landmark, and saves a full-page screenshot. Images: `ORYQEN-EXHIBITION-DELIVERABLES\UI-QA-SCREENSHOTS-20261114\{dashboard,check,vault,passport,employer}-{1440,1280,390,375,360}.png`.

Caveats a reviewer should know:
- The console check ignores "failed to load resource" messages, because deliberately unmocked fixture endpoints return 503. It therefore proves no script or page errors in fixture mode, not a clean console against the hosted service.
- Full-page captures make fixed bars static so they do not overlay content; real use has the floating bar.
- The Passport capture shows "Trust Chain could not be loaded", a result of the unmocked endpoint in the fixture, not a defect.
- The small "Figma sample" link in the dashboard capture is guarded by `!REAL_BACKEND` in code and does not render in a real-backend build.
- Visual benchmark: the nine supplied references. What was adopted: bold tabular numbers, donut and bar charts with legends, swipe cards, raised centre action, navy focus panels, soft neutral canvas. What was deliberately not: 3D decoration and heavy glass.
- Known visual roughness: the registry search row on the Employer page is cramped at 1440 px ("Any country" truncates); the Check score group is long.

| Screen | Result at 5 widths | Notes |
|---|---|---|
| Worker dashboard | pass | Insights band, hero, journey strip |
| FAIRWORK Check | pass | Seven groups; long by nature |
| Evidence Vault (in Work record) | pass | Cards stack on phones |
| Work Passport | pass | Chart and timeline; verified entries only |
| Employer dashboard | pass | Figures, grid collapses to one column |

## 7. Signed-in test results
**Hosted worker API run, 15 Nov 2026: PASS 17 | FAIL 0 | NOT RUN 8** against `https://oryqen-staging.vercel.app`, command `node scripts/test-hosted-worker-journeys.mjs https://oryqen-staging.vercel.app --email <worker account>`. **[V-reported]**: the owner ran it locally and pasted the printed lines; I did not run it, never saw the password, and the output does not print the deployed commit, so I have not tied it to `62c75d2`. It is API-level (real sign-in, real endpoints) with one account. It is **not** a browser run.

| Journey | Status | What the output shows |
|---|---|---|
| Sign in, profile, sign out | **PASS** [V-reported] | Sign in works, profile belongs to the session, session ends with 401 after sign-out. No authenticator enrolled on this account, so the second-factor step was not exercised. |
| Plans | **PASS** | Free plan, no billing offered |
| Offer analysis (AI state) | **PASS** | AI is OFF and reported as UNCONFIGURED; no model called, nothing invented |
| Evidence Vault | **PASS** | Upload, list, signed download of the same bytes, delete: storage is configured on staging. Correction note, resolve, revoke, reinstate pass; another account's document answers 404 (a single-account probe, not independent-account isolation) |
| Research history, job preferences, CV Builder, saved-listing history, application tracker and Workroom, notifications, security activity, credentials, developer API | **PASS** | Create, read back, update, stale or invalid input refused, delete, as listed in the printed lines. Credential signing key reports configured. Job discovery showed 0 listings; notifications 0 items; security activity empty. |
| Worker dashboard, FAIRWORK assessment screens | fixture only [F] | Not seen signed in on staging in a browser |
| Offer workspace (saved offers, notes, documents) | NOT RUN | needs an organization the account may use |
| Digital agreements and expiry/renewal | NOT RUN | needs a second account |
| Work Passport (verified work, sharing) | NOT RUN | needs an employer account to verify a record |
| Revocation blocks attaching | NOT RUN | needs a saved work record or offer |
| Dispute and appeals | NOT RUN | needs an independent reviewer capability |
| Organization portal | NOT RUN | needs two independent approvers with the authority capability |
| Recruiter scam protection | NOT RUN | needs an organization representative |
| Employer login, applicants | not verified | needs second account and approved organization |
| Admin governance | not verified | needs an authorized admin account with a second factor |

Caveats: (1) cross-user isolation is still **not** proven on hosted infrastructure; the script itself says it is proven only by the local real-stack harness and database tests. (2) The run used one account and wrote then deleted its own test data on staging. (3) The signed-in browser journeys script (`scripts/run-hosted-browser-journeys.mjs`) has **not** been run. I changed no role, credential or control. The NOT RUN items need an approved organization membership and capabilities for test accounts; the procedure is in `ORYQEN_TEST_ACCOUNT_WORKFLOW.md`, and I will not touch the staging database without the owner's go-ahead.

## 8. Demonstration instructions
See `docs/ORYQEN_INSPECTION_DEMONSTRATION_20261116.md`: a ten-minute walk-through (problem, offer submission, assessment, evidence, Passport, employer workspace, trust and privacy) with every step labelled **LIVE**, **RULES**, **AI**, **FIXTURE** or **NOT AVAILABLE**, plus fallbacks.

## 9. Known limitations
- AI analysis is **off** on staging; the rules-based analysis is shown and labelled. Nothing AI-powered is demonstrated.
- Organization approval uses a demonstration authority (`demo-authority.v1`); there is no real employer or identity verification.
- Rules exist for Germany only; Sri Lanka has none. The career roadmap uses a sample framework; the salary tool has no benchmark data.
- Sinhala and Tamil have not had native-speaker review; new strings in this sprint fall back to English in other languages.
- Uploaded evidence is not scanned for malware (the page says so).
- Android is a debug-signed preview; the Windows installer is unsigned; no iOS.
- Applicant management, Cases, Opportunities and Settings were not redesigned this sprint.
- Admin governance was not exercised.

## 10. Remaining production blockers (from the 13 Nov audit; unchanged by this sprint)
P0: no production environment exists; no rehearsed backup and restore; cross-user isolation never tested on hosted infrastructure with independent accounts; no independent security test; account deletion and erasure not executed. P1: public repository without branch protection or push protection; no Terms or Privacy Policy or support channel; email uses only the default sender; no monitoring, alerting or incident process; hosted verification missing for the independent-account modules; AI has no provider contract or evaluation; credential signing key not generated; single-jurisdiction rules; unsigned release artifacts; no malware scanning; no load testing. Full register: `docs/ORYQEN_PRODUCTION_PROGRAM_AUDIT_20261113.md` section 3.

## 11. Release gate checklist
| Gate | Status |
|---|---|
| Critical navigation works | **Partly verified [F]**: phone menu sheet, bottom bar, jump bar, links; not exercised signed in on staging |
| No broken primary actions | **Not fully verified**: fixture mode only |
| No blocking console errors | **Fixture mode only**, with the caveat in section 6 |
| No horizontal overflow at 390/375/360 | **Verified [F]**, 15 of 15 phone cells |
| Core worker journey tested | **Verified at API level on hosted staging, single account [V-reported]** (17 PASS, 0 FAIL); not yet seen in a browser; offer workspace NOT RUN |
| Employer journey tested | **Explicitly unverified [U]** |
| Authentication and authorization | **Verified for anonymous callers [V]** (401 on `/api/v1/me`, 403 on a cross-origin write) and for one signed-in worker session (sign in, own-data access, sign-out 401) [V-reported]; role checks and cross-user isolation not exercised hosted |
| CI results | **Verified [V]**, three green runs |
| Staging deployment SHA | **`62c75d2` [V]** |
| Screenshots of the five priority screens | **Provided [F]**, 25 images |
| Known limitations | Section 9 |
