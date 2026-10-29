# Parallel feature-UX branch: integration handoff (29 Oct 2026)

Worktree `C:\Users\vehiv\Desktop\fairwork-ui`, branch `feature/oryqen-ui-parallel`. Not merged, not deployed, not hosted-verified. No migrations, RLS, global CSS, navigation or deployment files were touched.

## Commits (oldest first, on top of 8057010)
| Commit | Change |
|---|---|
| 9b24c20 | Work Passport: verified-work summary, year timeline, verified/self-reported boundary |
| 2b7ff80 | Agreements: pick a known agreement instead of typing a UUID; party labels |
| 5b6f733 | Disputes: choose the work record from your own submitted records; dates instead of ids |
| e96db1c | Agreements: no representative-id field when the offer designates one; credential cards |
| 9156bae | Work records: choose the agreement from your own, status summary, date-range rows |
| 7582380 | Agreements: progress path and plain-language stopped states |
| f80fa29 | Cases: plain-language activity labels, status badges |
| 2d4d0ac | Notifications: unread count, unread-only filter, Today/Earlier grouping |

## Brand
Every new stylesheet uses only the shared `--oq-*` tokens (`passport-experience.css`, `agreement-picker.css`, `credentials-experience.css`), with no hex values, so they adopt whatever palette the shared brand file defines. The committed `brand.css` is still green; the owner decided the intended identity is blue/cyan/violet. That change belongs to the global CSS owner.

## Genuine blockers and dependencies
- **No "list my agreements" API.** The picker merges what exists: open proposals with an expiry (`/api/v1/agreement-expiries`), agreements behind verified Passport entries, and agreements opened on this device (localStorage, ids only; access is still checked by the server). A draft agreement with no expiry and no work record is reachable only by its link. Needed: a read RPC and route (migration, integration owner).
- **Assigning a reviewer** still needs the reviewer's account id; there is no reviewer directory API (deliberately, for conflict-of-interest reasons). Not changed.
- **A worker cannot discover an employer representative** when an offer has none; the id field remains only in that case.
- **Recruiter / hiring-manager / viewer roles** are not built; see the design in `ORYQEN_IMPLEMENTATION_QUEUE.md`. No permissions were invented.
- **Names for participants**: the agreement API returns only ids, so parties are labelled "you / worker / employer" rather than by name.
- Passport skills/achievements in shared views and confidential dispute attachments remain open queue items needing migrations.

## Navigation manifest
No new routes. Existing routes improved: `/app/passport`, `/app/agreement-workflow`, `/app/cases`, `/app/credentials` surfaces (Trust Chain). No navigation edits required.

## Tests
- Unit: full `tests/unit` 112 files / 644 tests passed. New: `passport-summary`, `agreement-choices`.
- Browser (mocked API, production build): `day6-passport` 8/8, `day4-workflow` 10/10 (spec updated for the collapsed reference field), `day7-cases` 12/12 (one new test for the record selector), `credentials` 7/7, `accessibility` 30/30 (axe, light and dark, including passport, agreement lookup, cases).
- `tsc --noEmit` and `eslint src --max-warnings=0` clean.
- Not tested: the agreement picker in a browser with real lists (unit-tested merge only), mobile screenshots of the new layouts beyond the existing width checks in `day6-passport`, anything against a hosted backend.

## Merge notes
Changed shared files: `src/i18n/messages.ts` (English keys appended after `pp.print`; other locales fall back to English), `src/components/fairwork/{work-passport,agreement-workflow,case-review,credentials-panel}.tsx`, `tests/e2e/{day4-workflow,day7-cases}.spec.ts`. Likeliest conflict: `messages.ts` if the other branch adds keys at the same spot; resolve by keeping both. Merge order: independent of the dashboard/shell work; after it is fine. Suggested: `git cherry-pick 9b24c20 2b7ff80 5b6f733 e96db1c 9156bae 7582380 f80fa29 2d4d0ac` (the docs commits 952bcda and caf6603 are optional) onto the integration branch.

## Update (second pass)
Tests after the second pass: full unit suite 114 files / 647 tests pass; eslint . and tsc clean; browser specs day4 (10), day5 (7), day7 (12), notification-preferences/localization (8), accessibility (30) pass, all against mocked APIs. Specs `day4-workflow` and `day5-work` were edited because the raw reference field is now behind a disclosure. Not done: organizations/research screens (English-only, tied to the representative-only model), a glass/blur visual treatment (left to the global design system owner), hosted verification.

## Final QA correction (29 Oct)
`src/components/oryqen/brand.css`, which defines `--oq-*`, is not imported by the application, so every screen style written against `--oq-*` rendered without backgrounds, borders or colours in the integrated build. `feature-tokens.css` now defines those tokens scoped to the feature classes only (the shell's own blue/navy and dark-surface values), and fixes the work-record row grid. Delete it once the shared design system defines `--oq-*` globally.

## Design system (30 Oct)
- `src/components/oryqen/tokens.css`: semantic light/dark tokens (owner palette). `design-system.css`: glass cards, gradient CTAs, inputs, focus, nav, badges, skeleton, ring, toast. Both are imported in `layout.tsx`; the component layer applies to `.fw-product` screens only, so sign-in and public pages keep their own design (a saved dark preference must not override the sign-in page; `oryqen.spec.ts` pins this).
- Theme: `public/oryqen-theme.js` (loaded in `<head>`, no inline script, so the source audit still passes) applies the saved choice before paint on every route; `ThemeToggle` (match device / light / dark) is in the app header; key `oryqen.appearance`.
- Primitives in `src/components/ui`: StatusBadge, EmptyState, Skeleton, ProgressRing, toast. Dialogs, drawers and menus are not built (no screen needs one yet; an unused component would be dead code).
- Known shell limits (Agent 1): the dashboard journey strip is clipped at 390px; "Figma sample" and "Demo" links appear only when no Supabase backend is configured (`REAL_BACKEND`), never in a real build.
- Tests: `tests/e2e/design-system.spec.ts` (12 screens x 1440/390 x light/dark: no overflow, no raw ids, no page errors; theme persistence). All browser results are against mocked API replies.

## Dashboard and employer redesign (30 Oct)
- `dashboard.tsx` + `dashboard-overview.css`: hero with layered depth and a journey that wraps (no clipping at 390px); four KPI cards (offers, work records, verified hours, Passport) with a real per-record hours chart (solid = confirmed, dashed = not yet; heights are the record hours, nothing estimated); the recent-offers block is now an offer workbench (selectable list + detail pane with real revision, saved date, open questions, decision, and links to the existing agreement and findings routes); a guided three-step start for accounts with no offers.
- `saved-offers.tsx` (`EmployerWorkspace`) + `employer-overview.css`: hero band with the real actions, the three-step setup path, and two columns (organization / hiring). Every existing panel and its API wiring is unchanged; headings "Your employer workspace" and "Set up your organization" are unchanged.
- Files shared with the dashboard owner: `dashboard.tsx` and `saved-offers.tsx`; `product-app.tsx` is not changed in this pass. Coordination: I could not reach the Agent 1 session through the messaging tool (every address resolved to this session), so these files were changed without a reply.
- Tests: `design-system.spec.ts` adds the new-account guided start (4 viewport/theme combinations) and the workbench selection test.

## Dashboard work area, agreements summary and research results (30 Oct, pass 2)
- `dashboard.tsx`: five summaries from real reads (offers, work records, verified hours, agreements, Passport). The agreements card counts open proposals that carry an expiry date (`/api/v1/agreement-expiries`), the only agreement list the API exposes without a record id; it says so and links to `/app/agreement-workflow`. The workbench has a dashed "add another offer" tile (a real link).
- `dashboard-manage.tsx` (new): saved offers, work records and employer research are one keyboard-operable tab set (arrows, Home, End). All three panels stay mounted, so a typed query or loaded list survives switching tabs. `product-app.tsx` changes only the three mount lines in the home block.
- `company-research.tsx`: search bar layout, facts grid, finding kinds as status badges; all existing text, aria names and the no-score rule are unchanged (the colon after the kind is kept as hidden text so "Supports:" still reads in full).
- New English-only keys (`dash.*`, `theme.*`, `wr.*`, `agp.*`, `cws.*`, and others) fall back to English in Sinhala, Tamil and German until translated.
- Specs updated because the home page now defaults to the Saved offers tab: `dashboard-records.spec.ts`, `localized-panels.spec.ts`. The employer note keeps its original sentence because `product-app.spec.ts` asserts it.
