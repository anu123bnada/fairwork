# Agent 1 to Agent 6: Phase 0 integration findings (17 Nov 2026)

Branch `integration/phase-0` = `agent/ui-replication` (2 commits, merged cleanly) plus three Agent 1 commits (`be62a0e` time-zone test pin, `e45ff6b` `next` 16.4.6, `cdf72b9` contrast and scoping fixes). **Do not promote this branch.** CI run 44057572121 on `cdf72b9`: **806 passed, 23 failed** (all in `npm run test:e2e:isolated`, the full browser suite). The dev branch with the same dependency and test fixes is green (run 44057586424), so these 23 come from the replication layer. Please continue on this branch (worktree `fairwork-ui-replication`: merge `integration/phase-0` into `agent/ui-replication`, no force) and hand back when the full suite is green.

Already fixed by Agent 1 so you do not repeat it (28 failures down to 0 locally): axe contrast in light mode (secondary text on the lavender canvas, 4.14:1) and dark mode (white on `#7a6ff6`, 3.87:1; violet text on the card, 4.41:1; split into `--rp-btn` fill and `--rp-violet-text` text tokens), the global dark body colour leaking onto public pages (now `body:has(.fw-product)`), add-offer method chips, the demo chip, and `first-steps.spec.ts:113` (opens the collapsed More menu).

## Group A: owner decision needed (the shell contradicts a recorded requirement) - 8 tests
- `desktop-layout.spec.ts:2:64` at 768, 1024, 1280, 1440, 1920 px: expects a side navigation wider than 800 in the measured axis, received 64.
- `report-design.spec.ts:114:3` at 768, 1280, 1920 px: "on wide screens the side navigation keeps one width, under 200 px", received 1216 (and 704 at 768).
These tests encode the earlier requirement "keep the side navigation under 200 px" (commit `d1c9bde`). The replication's desktop **top-pill shell** replaces the side navigation, so the requirement and the design disagree. **Agent 1 will not edit or relax these tests.** The owner decides: keep the sidebar (adapt the replication), or retire the requirement deliberately and have the tests rewritten to the new shell with the reason in the commit.

## Group B: real defects, Agent 6 to fix - 5 tests
- `design-system.spec.ts:230:1` "the end of ... is not covered by the fixed action or navigation": add offer (375 and 1440), questions (375), passport (375 and 1440). The last content ends 4 to 120 px below the top of the fixed bar, so users cannot reach the end of the page. Example: add offer 375, content ends at 667.7, bar starts at 608. Likely a missing bottom padding or safe-area offset in the new shell (`.fw-product-body`) now that the bar is taller.

## Group C: phone home regressions from `MobileHome` - 10 tests
- **Duplicate region.** `design-system.spec.ts:100:1` (mobile light and dark): two regions are both named "Recent offers": `section.mh-list` (MobileHome) and `section.fw-recent.oq-wb` (the original, still rendered). Landmark names must be unique and the content is duplicated on a phone.
- **Untranslated phone home.** `localization.spec.ts:65:1`: in Sinhala the home heading "ඔබේ පෞද්ගලික වැඩපොළ" is missing. `MobileHome` uses English literals; use the `t()` catalog so si, ta and de render.
- **Touch targets.** `route-sweep.spec.ts:19:59` `/app/home` at 320, 375, 430: targets smaller than 24 CSS px (WCAG 2.5.8).
- **Duplicate navigation links.** `android-browser.spec.ts:27:1`: the "Passport" link resolves to 2 elements inside the navigation landmark.
- **Menu sheet cannot be opened.** `ui-redesign.spec.ts:91:3` at 390, 375, 360: `locator.click` times out at the step that opens the phone menu sheet (centre action, sheet and swipe rows). Check that the sheet trigger still exists and is not covered.

## How to reproduce locally
```
npx next build   # with NEXT_PUBLIC_SUPABASE_URL="" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="" APP_ORIGIN=http://localhost:3111 FAIRWORK_DATA_MODE=synthetic AUTH_REGISTRATION_ENABLED=true
npx next start -p 3111
npx playwright test -c playwright.qa.config.ts tests/e2e/design-system.spec.ts tests/e2e/route-sweep.spec.ts tests/e2e/ui-redesign.spec.ts tests/e2e/localization.spec.ts tests/e2e/android-browser.spec.ts
```
Use a production build, not `next dev` (dev-server timing causes false failures). **Run the entire `npm run test:e2e:isolated` suite before handing back**: on 17 Nov a subset of 140 specs passed locally while the full suite found 23 more failures.

## Acceptance for hand-back
Full browser suite green, `npm run typecheck`, `npm run lint` and the full `npx vitest run` green, the contrast fixes above preserved, screenshots at 1440, 1280, 390, 375 and 360 in light and dark, and the owner's decision on Group A recorded.
