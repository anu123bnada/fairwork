# ORYQEN inspection UI/UX transformation: audit and design plan (13 Nov 2026)

Inspection: Monday 16 Nov 2026. This document is the Stage 1 deliverable (reference inspection, product audit, design plan). It is updated as stages land; the final report records what is verified.

**Evidence legend.** **[V]** verified by me on 13 Nov 2026 (method named). **[D]** documented in repository material. **[U]** not verified.

## 1. Pre-flight [V]
- `exhibition/dev-nov10` = `75cc6c5` (CI green on re-run); staging branch `release/oryqen-oct27` = `0c2db48` (CI green, Vercel complete). Cleanup commit `0c2db48` confirmed.
- Uncommitted work preserved and backed up (bundle of all refs verified, plus copies of the untracked documents) in `ORYQEN-EXHIBITION-DELIVERABLES\REPO-BACKUP-20261113\pre-ui-redesign`.
- **Environment risk:** the build machine's C: drive was at 100% (1 MB free at one point). I cleared only regenerable caches I or the test runner produced (test build outputs, a rebuilt installer, the npm package cache). A disk-full event truncated one file mid-edit, which I detected and repaired. Free space must be watched; it is the main schedule risk after the inspection date.

## 2. The nine references, inspected
All nine images were opened and inspected (from `UI concepts.zip`, 9 files, extracted and also attached inline).

| # | Reference | What it contributes | How ORYQEN translates it (not copies it) |
|---|---|---|---|
| 1 | Finology (finance mobile set) | Bold tabular numbers, hero card with area chart, donut with legend chips, horizontally swipeable cards, list rows with colored icon chips, bottom bar with a raised centre action | Phone home: greeting row, swipe rows for summary and insight cards, donut by decision and by record status, raised centre **Add offer** action |
| 2 | Finora (green finance mobile) | Quick-action circles, category progress bars, a tip card, profile score ring | Quick actions map to real ORYQEN actions (Add offer, Scan, Log work, Share Passport); ring only for ratios that exist in the person's records |
| 3 | Core Medicine (soft glass wellness) | Light lavender canvas, floating translucent cards, small sparkline stat tiles | Soft canvas and restrained glass already in the token layer; **no 3D object** (the brief excludes decorative 3D) |
| 4 | 3D glass dashboard | Icon sidebar in a glass pill, coloured KPI cards, analytics line chart with tooltip, completion ring | Active-state sidebar, KPI cards with brand-colour icon chips, hours chart with per-bar titles |
| 5 | Company cards (glass) | Filter chip row, three-number KPI strip, action list with icons, status table | Employer workspace: chip filters, KPI strip (organizations, open offers, recruiter confirmations), icon action list |
| 6 | Finnova (invoices, desktop) | Dark navy panel with a master list and a detail card, KPI cards with mini charts, pill navigation | Already present as the dark **offer workbench** (list left, detail right); restyled and aligned with the new tokens |
| 7 | Trantor (crypto wallet mobile) | High-contrast pill buttons, large numerals, centre circular action | Centre action button and pill chips on phones |
| 8 | Neumorphism smart home | Large soft rounded controls, ring gauge | Ring component and soft controls, used sparingly |
| 9 | LingGuang (glass mobile, dark) | Dark translucent screens, minimal text | Dark theme polish (separate designed palette, not an inversion) |

**Direction.** A refined, blue-led system: ORYQEN blue, cyan and violet accents on soft neutral surfaces, with deep navy panels for focus areas. Not a generic purple fintech look: the existing Q-mark, cyan tail and brand gradient are preserved.

**Avoided on purpose:** 3D decoration, heavy glass or gradients, empty cards, fake charts or statistics, controls that do nothing.

## 3. Product audit (the 20 experiences)
Existing routes were enumerated from `src/app` and `src/features/navigation/destinations.ts` [V]. "State" is the honest visual and functional condition seen on 13 Nov; visuals come from this week's fixture-backed local build because the signed-in staging screens could not be reviewed live (no test credentials) [U].

| # | Experience | Route(s) | Components / APIs (evidence) | Current visual state | Gaps found |
|---|---|---|---|---|---|
| 1 | Public homepage | `/` | `landing.css`, WebGL landing; `/downloads`, `/try` | Strong; cinematic landing, responsive (landing specs) | Keep; no change planned |
| 2 | Authentication | `/sign-in`, `/register`, `/forgot-password`, `/auth/*`, `/otp`, `/verify` | `auth-shell`, `secure-sign-in-form`, `/api/v1/auth/*` | Polished earlier (auth-composition) | Verified by existing auth specs |
| 3 | Worker dashboard | `/app/home` | `dashboard.tsx`, offers, work-records, agreement-expiries | Hero, summary cards and dark workbench present; **no charts**, cards were text-only | **Insights band added (Stage 3)** |
| 4 | Offer submission | `/app/add-offer`, `/app/scan` | `offer-intake`, `scan-offer`, OCR on device | Good (offer-intake specs) | Mobile form review pending |
| 5 | Offer analysis / Check | `/app/analyzing`, `/app/check`, `/app/questions`, `/app/report` | `offer-assessment`, `offer-report`, `/api/v1/offers/assessment` | Score hero and grouped findings exist (10 Nov) | Needs fixture screenshots and mobile pass |
| 6 | AI findings | inside Check | `ai-analysis`, gateway (AI **off** on staging) | Honest "AI off" labelling | None to fake; stays labelled |
| 7 | Employer intelligence | `/app/employer`, `/app/employers-demo` | `company-research`, `company-profiles` | Long form stack, little hierarchy | Needs KPI strip and grouping |
| 8 | Career intelligence | `/app/opportunities`, `/app/cv`, `/app/career-explorer`, `/app/career-assistant`, `/app/guidance`, `/app/salary` | many | Functional; sample framework labelled | Visual consistency pass |
| 9 | Agreements | `/app/agreement`, `/app/agreement-workflow` | `agreement-workflow`, `agreement-compare` | Functional; hosted run needs two accounts | Visual pass |
| 10 | Evidence Vault | inside `/app/work-record` | `evidence-vault`, `/api/v1/vault*` | Form-first | Needs summary and list hierarchy |
| 11 | Work records | `/app/work-record` | `work-record`, `/api/v1/work-records` | Long single column | Needs composition |
| 12 | Work Passport | `/app/passport`, `/app/share` | `work-passport`, `/api/v1/passport*` | Hero with 4 real stats and a timeline exist | Raw validation text can surface on contract mismatch |
| 13 | Employer dashboard | `/app/employer` | `organization-requests`, `team-roster`, plans | Navy hero, long forms | Needs composition |
| 14 | Applicants | `/app/applicants` | `applicant-management` | Functional | Visual pass |
| 15 | Disputes | `/app/cases` | `case-review` | Functional | Visual pass |
| 16 | Notifications / timeline | `/app/notifications` | `notifications`, `employment-timeline` | Functional | Visual pass |
| 17 | Admin and governance | `/admin` | `admin.module.css`, `/api/v1/admin` | Separate styling, MFA-gated | Not in scope this week; unverified signed in |
| 18 | Account and privacy | `/app/settings` | `account-security`, `privacy-requests`, `data-export` | Functional | Visual pass |
| 19 | Developer and integrations | in Settings | `developer-access` | Functional, English only | Visual pass |
| 20 | Mobile navigation | shell | `product-app.tsx` bottom bar | Four items plus search; **the "More" group was hidden on phones**, so 20+ screens were reachable only through search | **Fixed: header menu and full-screen sheet; centre action** |

### Defects confirmed during the audit
1. **Phones had no navigation to most screens** (hidden "More" group). Fixed in Stage 5 work (menu sheet).
2. **Raw validation JSON can appear in cards** when an API reply does not match its contract (seen on Passport, Work record, Employer in the synthetic build). Real contracts match, but a drift during the inspection would show it. Planned: one shared friendly fallback.
3. **Disk space** on the build machine (see section 1).
4. The three data-heavy priority screens (Vault, Passport, Employer) read as stacked forms when empty.

## 4. Design system v2 (implemented as `ui-v2.css`, loaded last)
- **Tokens:** chart palette (5 tones, light and dark), spacing scale s1 to s7, type scale, elevation 1 and 2, navy panel pair, radius xl. Colour, depth and motion tokens from `tokens.css` are reused, not replaced.
- **Components:** insight cards, donut, stacked bars with axis and text alternative, ring, skeleton loader, sheet, centre action, active sidebar state.
- **Rules:** every chart has a visually hidden table; charts draw only saved data; empty and failed reads show honest text; no sample numbers.

## 5. Staged plan and status
| Stage | Scope | Status (13 Nov) |
|---|---|---|
| 1 | Reference inspection, audit, plan | **Done** (this document) |
| 2 | Design system and shell | In progress: tokens, charts, sidebar active state, sheet |
| 3 | Worker experience | Insights band built (real data); further screens pending |
| 4 | Employer, admin, support | Pending |
| 5 | Separate phone experience | Menu sheet, centre action, swipe rows built; verification pending |
| 6 | Regression and visual QA | Pending (spec added for new work) |
| 7 | Demonstration rehearsal | Pending; blocked on test accounts for signed-in staging |
