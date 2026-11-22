# Agent 6 to Agent 1: hand-back for the Phase 0 integration findings (22 Nov 2026)

Branch `agent/ui-replication` (merged with `origin/integration/phase-0`, so Agent 1's contrast fixes, `next` 16.4.6 and the time-zone test fix are kept). Not deployed, no pull request, nothing merged into a release branch.

## What changed
- **Group A, sidebar kept (owner decision).** `replica.css`: the desktop top-pill shell is replaced by the left side navigation (184 px, 176 px on tablets) in the replication look (navy surface, pill links, violet active state, lavender canvas and cards unchanged). The replica token `--ui-side: 0px` was removed (it collapsed the sidebar to 29 px). Link colours use `.fw-bottom-nav .fw-nav-*` selectors so axe contrast passes in light and dark. `desktop-layout.spec.ts` and `report-design.spec.ts` are unchanged.
- **More menu** (`product-app.tsx`, shell change only): restored `open` when the current route is in a More group; this reverts Agent 1's extra `summary` click in `first-steps.spec.ts` (restored to its original text), because the sidebar shows the groups again. "Find work" has 10 links (career-intelligence and opportunity-intelligence included).
- **Group B.** Screens with a fixed action get `padding-bottom: calc(240px + safe-area)` (`replica-screens.css`), at every width.
- **Group C.** `MobileHome`: removed the duplicate "Recent offers" section (the original `fw-recent oq-wb` stays); added the translated workspace line (`home.workspace`), a "Menu" button that opens the phone menu sheet, and turned the quick actions into a labelled region ("Welcome and next step") instead of a second navigation landmark (fixes the duplicate Passport link). `.fw-header-search` is again hidden on phones (the replica rule had forced `display: grid`).
- Screenshots: `docs/design-replication/sidebar/dashboard-{1440,1280,390,375,360}-{light,dark}.png`.

## Results
- `npm run test:e2e:isolated` (production build): **815 passed, 14 skipped, 0 failed** (39.7 min), run on the final commit.
- Earlier isolated runs on intermediate commits found two defects that are now fixed (collapsed sidebar width; header search visible on phones). One run also showed `localized-panels.spec.ts:64` timing out at 30 s; it passed 3 of 3 alone and in the final full run.
- `npm run typecheck`, `npm run lint` and full `npx vitest run` (179 files, 1154 passed, 17 skipped): green on the commit before the last two CSS-only edits (`--ui-side` removal, header search); not re-run after them.
- Touch targets on `/app/home` at 320, 375, 430 px pass in `route-sweep.spec.ts` with no further change.

## Not done / notes
- Sidebar link rows are tall (inherited grid row heights); cosmetic, could be tightened.
- Dark-mode screenshots were captured through the `prefers-color-scheme` emulation.
