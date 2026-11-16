# ORYQEN design replication: first deliverable (Worker Dashboard)

Branch `agent/ui-replication` (worktree `fairwork-ui-replication`), based on `exhibition/dev-nov10` at `7877ff3`. Not pushed, not deployed. Agent 1 decides on integration.

## 1. Reference analysis (`references/`)

| Ref | What it is | Structural features to reproduce |
|---|---|---|
| 1 `ref1-finnova-desktop.jpg` | Invoice SaaS, indigo/violet | Logo left, **dark navy pill nav** centred with a violet active segment, round icon buttons and avatar right. Big page title + subtitle left, one violet pill CTA right. Row of four white KPI cards (label top-left, round icon chip top-right, large tabular numeral, mini chart). Segmented pill control. **Dark navy rounded panel**: master list of dark rows (selected = violet gradient) beside a **violet detail card** with translucent tiles and a white pill action. |
| 2 `ref2-finova-desktop.jpg` | Finance dashboard, mint/green glass | Same top pill nav idea inside a big rounded frame; 3-column card grid; area chart with tooltip; donut with legend; icon-chip list rows with green/red amounts; dark quick-action tile. |
| 3 `ref3-finology-mobile.jpg` | Mobile set, blue | Blue gradient hero card with wave chart and three small chips; white list rows with coloured icon chips; donut with chips; **bottom bar with four tabs and a raised mint centre action**. |
| 4 `ref4-finora-mobile.jpg` | Mobile set, deep green | Greeting row with avatar, hero card, **four quick-action circles**, "recent" list rows, pill tabs, goal/progress rows. |

Mapping to ORYQEN (no fake figures; every number comes from the person's own records through the existing APIs):

| Reference element | ORYQEN element |
|---|---|
| Finnova title row + CTA | "Good morning, name" + status line + Review offer / Discover opportunities |
| Segmented All / Draft / Unpaid | Employment journey (Your offer → Verified work) |
| KPI cards with mini charts | Saved offers, Work records, Verified hours (bar chart), Agreements, Work Passport |
| Overview chart + spending donut | Work hours by month, Offers by decision, Records by status |
| Dark panel, invoice list + violet detail | Recent offers workbench (offer list + selected offer detail, Review / See findings) |
| Finology balance card + wave | Verified hours + wave through per-record hours + offers / records / passport chips |
| Finora quick actions | Add offer, Scan, Record, Passport |
| Finology transactions | Recent offers rows with open-question pill |

## 2. Desktop specification (1440 / 1280 / 1024)

- Canvas `#e9ebf7`; cards white, 24px radius, 1px `#e7e8f3` border, soft violet-tinted shadow; dark panel `#1b1d33`, 32px radius; accent violet `#5b4cf0`; mint `#2fcf9b` for confirmed states. Type: Manrope; title 40/800 (32 below 1100), KPI numerals 32/800 tabular.
- Navigation: **top**, replaces the old left sidebar. Content column 1216px inside a 1280px frame. Pill 56px high, 44px segments. Search and More are round 46px buttons; More opens a popover of the existing grouped links.
- Grid: KPI row 5-up at ≥1200px, 3+2 below; insights 1.7 : 1 : 1 (2-up below 1100); workbench 1:1; right rail 340px (stacked below 1100).

## 3. Phone specification (390 / 375 / 360)

- Separate component `mobile-home.tsx`, rendered only at ≤767px (it reads the same dashboard data object; no extra requests).
- Greeting row, 28px-radius blue gradient hero (`#3a63e8 → #22379f`) with wave and chips, four quick-action circles (56px), journey chips (horizontal scroll inside their own row), list rows 64px, bottom bar 68px with a 58px raised mint action, Search kept as an icon button in the bar (command palette stays reachable on every screen).
- Touch targets ≥44px. No horizontal page overflow at any size (measured).

## 4. Existing frontend architecture (what was kept)

- Routes: `/app/[screen]` → `FairworkScreen` in `product-app.tsx`; auth via `ProductRouteProvider`/`useProduct`; data through `appRequest` against `/api/v1/*` with strict zod schemas. All untouched.
- Styling: layered CSS (`tokens.css`, `design-system.css`, `ui-polish.css`, `ui-v2.css`, per-feature files). The new layer is **additive and loaded last**: `oryqen/replica.css` (tokens + desktop) and `oryqen/replica-phone.css`, nested under one high-specificity root so earlier layers lose regardless of chunk order. No earlier CSS was edited.
- Shell: one `nav.fw-bottom-nav` serves as desktop sidebar and phone bar; it now has a `div.fw-nav-pill` wrapper (`display: contents` on phone).

## 5. Changed files

- `src/components/oryqen/replica.css` (new), `src/components/oryqen/replica-phone.css` (new), `src/app/layout.tsx` (two imports)
- `src/components/fairwork/product-app.tsx`: nav pill wrapper, phone/desktop switch in `HomeScreen`, removed the More menu auto-open (it would cover content in the new popover), removed an unused variable
- `src/components/fairwork/mobile-home.tsx` (new)
- `tests/e2e/replica-capture.spec.ts`, `playwright.replica.config.ts` (screenshot harness; API replies are transport stand-ins shaped like real ones, as in the existing specs)
- `docs/design-replication/*`

## 6. Verification

- `vitest run tests/unit`: 140 files, 768 tests passed. `tsc --noEmit`, eslint on touched files: clean.
- Existing e2e `dashboard-screens` and `command-palette` run against the worktree dev server: pass (a first run caught that the nav Search lost its accessible name and the phone bar lost Search; both fixed).
- Overflow measured at 1440, 1280, 1024, 390, 375, 360: 0px.
- Not run: the full e2e suite, dark-mode visual review, Sinhala/Tamil layouts, real-backend session.

## 7. Known issues

- Only the Worker Dashboard is converted. Lower dashboard sections (saved offers management, drafts, activity) keep their old inner styling inside the new cards.
- Phone bar: the raised action sits ~22px off-centre because Search occupies a sixth slot.
- Screenshots show "Agreements: could not be loaded" because the harness does not stub that endpoint.
- Reference 2 (green glass, big rounded frame, bottom stat pills) is only partly reflected (nav, donut, card grid); the ORYQEN accent stays violet/blue.
- Dev-mode indicator button overlaps the bottom-left in screenshots (dev server only).

## 8. Integration

`git -C <release checkout> cherry-pick agent/ui-replication` (one commit), or merge the branch. Revert = remove the two CSS imports from `layout.tsx` and the `MobileHome` branch in `HomeScreen`. Capture again with: start `npx next dev -p 3107`, then `REPLICA_SET=after npx playwright test -c playwright.replica.config.ts replica-capture`.

---

# Update 2: priority screens (Check, Evidence Vault, Work Passport, Employer, Career, Opportunities)

New layer `src/components/oryqen/replica-screens.css` (same root as `replica.css`, loaded after it). Captures: `after/<screen>-<width>.jpg` (1440, 390 and, for the dashboard, all six sizes) against `before/`. All 36 captures (6 screens x 1440/1280/1024/390/375/360) were taken and measured: horizontal overflow 0px in every one.

| Screen | Route | What changed (visual only) |
|---|---|---|
| Check | `/app/check` | Left-aligned 34px title row, flow steps as a segmented pill, numbered sections as white 24px cards, score hero as the violet gradient card, jump links as pills |
| Evidence Vault / Work record | `/app/work-record` | Hours summary as the violet gradient card, chips and ring restyled, documents as a card grid with violet icon chips |
| Work Passport | `/app/passport` | Profile hero as the violet detail card with translucent stat tiles, mint verified badges, white chart and entry cards |
| Employer workspace | `/app/employer` | Hero in the violet gradient, white pill CTA, KPI tiles as white cards |
| Career Intelligence + Gap Analyzer | `/app/career-explorer` | Skill chips (selected = violet), role cards in a 2-column grid, violet section markers |
| Opportunity Intelligence | `/app/opportunities` | Segmented pill tabs, listing cards in a 2-column grid with inline actions |

Shared: page header is now a title row (back circle, large title, actions). Phone: the header wraps its actions onto a second row so titles never break.

Verification: 51 existing e2e tests in the related specs (dashboard, command palette, career explorer, applicants, passport, work record, localization, sharing, ui-redesign) pass against the worktree dev server when run serially (`--workers=1`); in a parallel run on the dev server 8 failed from load, and one real regression (the header Search button hidden on desktop) was found and fixed. tsc and eslint clean on touched files.

Known issues / not done:
- The Career Intelligence, Career Gap Analyzer and Opportunity Intelligence screens that exist in the uncommitted work of the main checkout (`src/features/careers/*`, `src/features/opportunities/intelligence.ts`) are not in this branch's base commit, so only the committed Career explorer and Opportunities screens were restyled. Re-capture after those land.
- Employer has no top navigation (the app deliberately omits the nav on that screen).
- Deep inner content (long Check sections, forms) keeps its existing structure inside the new cards; the aim was the shell, surfaces, heroes and grids, not a rewrite.
- Dark mode, Sinhala and Tamil layouts were not visually reviewed.
- Full-page captures show the fixed bottom bar and the fixed Share button mid-page; that is a capture artifact.
