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
