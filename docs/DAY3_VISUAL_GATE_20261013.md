# DEVELOPMENT DAY 3 — original-export visual gate

## October 14 verified follow-up

The coordinated Day 4 run rebuilt the application and passed **36/36 browser
tests**, including new populated captures at 390×844 and 378×744. Fresh Home
`test-results/day3-visual/after/390-home-populated.png` was directly reviewed against
`C:/Users/vehiv/Downloads/Untitled/02-Home.png`: the original vertical bell/avatar
and greeting geometry are restored. A navigation regression exposed overlapping
greeting hit area; the avatar stacking fix is now verified by the original
settings-navigation test. Real offer/profile text retains different card density
from the static sample; no fabricated location, notification or profile score was
added. Questions and Agreement captures were refreshed as well.

Day 4 adds a separate secure workflow screen using the existing visual tokens.
Its captures in `test-results/day4-visual/` show functional acknowledgement and
receipt states, **not** approved new Figma frames. The source-level follow-up
section below is historical; its requested capture/testing has now occurred.
Exact Questions/Agreement density and motion choreography still lack sufficient
comparison evidence. **D3-13 remains OPEN; Day 3 remains 12/13 locally.**

No original asset, earlier migration or Android file changed: 641 protected
files match the prior preservation manifest. See `DAY4_COMPLETION.md` for the
additive backend work separately authorized by the user.

Date: October 13, 2026, Asia/Colombo. Deadline: October 23, 2026, 19:00 Sri Lanka time.

**Decision: D3-13 remains open. Day 3 remains 12/13 = 92.3% locally complete;
do not label it LOCALLY COMPLETE.** The subsequent explicit Day 4 request permits
Day 4 implementation and this remaining visual comparison to proceed in parallel;
it does not waive or pass this criterion. Original
references are accessible; the Figma connector quota is no longer the blocker.
The remaining issue is visual/motion fidelity, described below. Passing browser
tests is not proof of original-design parity.

## Reference provenance

All supplied source files were read without changing them.

| Source | Exact local location | Evidence |
|---|---|---|
| Original PNG exports | `C:/Users/vehiv/Downloads/Untitled/` | 19 full-resolution 390×844 PNGs; includes every requested family except onboarding 1 |
| Original v4 vector source | `C:/Users/vehiv/Downloads/fairwork-figma-pack-v4/fairwork-figma-pack-v4/svg/` | 20 original SVGs; onboarding 1 available here |
| Motion/navigation source | Sibling `FIGMA-GUIDE.md` and `preview.html` | Original glass, shadow, font, timing and navigation recipes |
| Supplied prototype recording | `C:/Users/vehiv/Videos/Screen Recordings/Screen Recording 2026-10-11 014452.mp4` | 5,105,979 bytes; 378×744; 46.466633 seconds; 12 extracted frames at 0,4,…44 seconds |

`test-results/day3-visual/reference-inventory.json` records absolute source paths,
sizes and SHA-256 hashes for the 40 PNG/SVG/video files. The recording includes
phone bezel/notch and a scaled app canvas. A 378×744 browser viewport is a
responsive check, **not** a pixel-aligned equivalent of that video frame.

Onboarding 1's reference PNG is explicitly named `00-Onboarding-1-derived.png`:
it is a Chromium rendering of the original SVG with installed Manrope fonts,
not an invented or supplied Figma PNG. Original PNGs take precedence for the
other static comparisons. The v4 SVG and PNG collection have differences, e.g.
Sinhala text is present in the vector source but absent/substituted in PNG text.

## Reproducible evidence

Open [the comparison gallery](../test-results/day3-visual/index.html).
It contains **14 original/current pairs**: Splash, three onboarding slides,
Language, Sign-in, OTP, Welcome, Home, Add Offer, Analyzing, Check, Questions and
Agreement. Each has a full-resolution 800×874 labelled pair and a 390×844 50%
overlay. No image-difference percentage is presented as an acceptance score.

- `reference/`: copies of supplied exports and the labelled derived onboarding 1.
- `before/`: baseline screenshots from the preceding Day 3 browser run, copied
  before visual edits. These are not fresh captures of this turn's code.
- `after/`: fresh current browser screenshots. The general sweep covers all 19
  routes plus onboarding 2/3 at 390×844 and 378×744. Full-page captures preserve
  scrollable content; paired images crop only the initial 390×844 viewport.
- Populated Home/Analyzing/Check/Questions/Agreement are separately captured at
  both sizes. Fixtures contain a real-schema employer-originated offer with one
  required missing field, then a saved attributed answer. Confirmation stays
  disabled until the saved-answer response permits it.
- Additional images: `agreement-rejected-edit.png`, `agreement-revision-2.png`,
  `agreement-confirmed.png`, `378-agreement-answered.png`, and `mobile-offline.png`.
  The first three use the suite's desktop viewport; they are state evidence,
  not 390×844 pixel comparisons. Browser fixtures are not hosted verification.
- `after/measurements.json`: computed background, font, glass blur/shadow and card
  geometry. `comparison-manifest.json`: source/capture hashes and full dimensions.
- `recording/`: extracted source video frames and metadata. Four-second frame
  sampling establishes screen sequence but cannot validate 300ms interpolation.

## Changes made, with actual comparison outcomes

| Screen | Restored / verified locally | Residual difference or limit |
|---|---|---|
| Splash | Original dark vector background/shield; central 128px glass circle; original text/dots positions; white status icons; 1800ms pulse/navigation | Guide specifies 1800ms; supplied HTML preview uses 2000ms. Exact recording timing has not been resolved |
| Onboarding 1–3 | Original 330px glass illustration and 160px blue circle, original shield/help/check vectors, line breaks, CTA location; 300ms entrance | Full stagger/transition choreography has not been compared frame by frame |
| Language | Status/back positioning, selection circles, spacing, native subtitle with supplied Noto fonts; Back returns to slide 3 | Non-English screens remain unavailable and explicitly labelled; native subtitle differs from PNG's missing glyphs |
| Sign-in | Original background, glass logo/inputs, button gradient/shadow, status row, installed font weights | Approved email/password replaces phone/SMS; additional real fields and security copy necessarily change height |
| OTP | Original background, back/title hierarchy, glass controls, blue action | Approved six-digit authenticator remains; no fake SMS/resend or four-digit code |
| Welcome | Original three-line heading, description, before/during/after glass card, both actions and muted copy | Browser font rendering and card/header detail spacing are not pixel-identical; no iOS home-indicator simulation |
| Home | Original background/glass/shadows; real saved offer fixture and navigation checked | Current header includes workspace/demo controls and places avatar/bell differently. Exact original header composition remains incomplete |
| Add Offer | Original glass source panel proportions, gradient action/placement and tab treatment | Manual-details disclosure and memory-only paste explanation remain. Original populated screenshot/paste parsing is not implemented or simulated |
| Analyzing | Original ring size, stronger row typography, green/amber markers; actual missing fields shown amber | Remains explicit Continue; supplied preview auto-advances after 2600ms. Original staggered list motion is not proven |
| FAIRWORK Check | Glass summary, green completeness ring, amber missing-field cards, restored card links to Questions | Honest five-field count replaces unsupported sample scores; dynamic field rows change density |
| Questions | Original category/card treatment, styled live answer field, restored working Copy questions and bottom actions | Persistent answer editor increases card height compared with the original compact copy-only cards. No approved expanded-answer frame exists in supplied exports |
| Agreement | Saved terms precede participant tools; original glass term/signature treatment with role avatars; fixed action stays in viewport | Required answer/authority/revision context increases density and pushes signature details down; no supplied reference for these real states |

Original SVGs are not installed as whole-screen image UI. Only their decorative
background/icon groups are extracted into `public/figma/product/`, with provenance
in `asset-provenance.json`. The supplied help icon contains a malformed arc token
(`a2.5 2.500 1 1`); the generated copy repairs the missing separator to
`a2.5 2.5 0 1 1`, restoring the stroke seen in the original PNG/video. Source is
unchanged. Supplied Sinhala/Tamil fonts and their OFL files are retained locally.

Shared restoration: 24px glass blur (30px nav), original blue/green backgrounds,
card and button shadows, Manrope 400/500/600/700/800, 96% button press state and
reduced-motion handling. Removed the browser's default 8px intro margin. Removed
the transition's retained transform so viewport-fixed actions do not become
positioned relative to tall page content; populated-state tests check this.
Fixed-action backgrounds keep scrolled text from showing through disabled buttons.

## Verification and failures encountered

- `npm test`: **108/108 PASS, 15 files** outside the Windows sandbox. Covers local
  unit/API and PGlite database/integration regressions; no hosted database used.
- `npm run test:e2e:isolated`: **32/32 PASS**, 1.4 minutes, after the final
  Analyzing/CTA spacing and disabled-action readability adjustments; `test-results/day3-visual/browser-final.log`
  and `production-build-final.log` preserve the successful run. Three new tests cover populated visual evidence,
  language return/reduced-motion handling and clipboard success/failure.
- `npm run typecheck`: **PASS** outside the sandbox; final production compilation
  also performs TypeScript checking.
- `npm run lint`: **PASS, zero warnings**.
- Isolated production compilation uses normal Next.js Turbopack `next build`,
  with hosted Supabase settings cleared, then a localhost-only test server.
  It is neither static export nor deployment.
- `preservation-check.json`: **641 existing protected files unchanged** against
  the prior manifest, including existing migrations, original assets and Android
  project/build files. New visual assets are additive.

Failed attempts were not counted as passes: sandbox Next canonicalization failed
with Access denied; Vitest's sandbox temporary SSR imports failed in five suites
(82 tests passed, not a full pass); Playwright's sandbox browser cache was empty.
Approved unsandboxed reruns used installed local tools. Bundled ffmpeg could not
decode this MP4; Chromium's local video decoder produced the reference frames.

Visual-test iterations exposed an incorrect six-field fixture assertion (actual
fixture has five), an explicit line-break text-spacing issue, and Splash's real
timer racing the keyboard-focus assertion under load. The fixture now asserts
five; text retains whitespace across the original line break; Playwright's clock
holds Splash while checking keyboard focus and advances exactly 1800ms afterward.
Assertions were retained, not skipped. Screenshots found additional icon/font/
fixed-action issues described above.

## Commands used (PowerShell from repository root)

```powershell
$visualPython = 'C:/Users/vehiv/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$originalVectors = 'C:/Users/vehiv/Downloads/fairwork-figma-pack-v4/fairwork-figma-pack-v4/svg'
& $visualPython scripts/prepare-visual-assets.py $originalVectors
node scripts/inspect-visual-reference.mjs 'C:/Users/vehiv/Videos/Screen Recordings/Screen Recording 2026-10-11 014452.mp4'
node scripts/render-local-figma-reference.mjs $originalVectors
npm test
npm run typecheck
npm run lint
npm run test:e2e:isolated
& $visualPython scripts/compare-day3-visual.py
```

## Exact remaining gate and next actions

1. Reconcile Home header/avatar/bell geometry with `02-Home.png`, retaining live
   data and a clearly labelled demo entry. Do not invent employer/location data.
2. Match the compact question-card and agreement/signature hierarchy while keeping
   real answer entry, attribution, revision context, warnings and independent
   confirmation accessible. The supplied files do not define their expanded/error
   states; document the adaptation explicitly rather than calling it exact parity.
3. Resolve the guide/preview Splash timing discrepancy and compare actual app
   motion against the recording at sub-second intervals. Restore the safe
   Analyzing→Check transition only after a real saved offer has loaded; never use
   animation completion as proof of an API save or authorization.
4. Capture those final states again, rerun affected browser/type/lint/build checks,
   and then assess D3-13. The current evidence supports substantial restoration,
   not a blanket original-design equivalence claim.

### Parallel Day 4 visual follow-up (October 13)

Read the same full-resolution original Home, Questions and Agreement PNGs against
the existing populated 390×844 captures. The original Home puts the notification
circle at approximately x318/y54 and the avatar at x316/y110, alongside the
greeting. The previous capture instead put both controls on one row above it.
`visual.css` now restores that vertical arrangement for the **live** Home only,
with the workspace description and clearly labelled sample link retained. No
employer, location, online status or notification indicator is invented.

Question editor margins and the Save answer button are compacted while retaining
a 44px button target and the existing readable/resizable answer field. Agreement
context cards use smaller internal spacing and wrap long content; signature cards
retain the original 70px minimum height and glass treatment. No necessary answer,
authority, revision or confirmation text is hidden or truncated. `auth.css`,
original assets, Android files and security implementations are unchanged by this
CSS follow-up.

These are source-level adjustments awaiting a coordinated fresh browser capture
and verification run with the Day 4 changes. The existing gallery and passing
test totals above are historical evidence from the preceding visual pass, not
verification of these new rules. Re-capture populated Home, Questions and
Agreement at 390×844 and 378×744, checking keyboard focus, long names/answers,
scrolling, independent statuses and fixed-action visibility. A compact original
question card cannot also contain the current permanently expanded answer
editor at the same height. Any disclosed editor or changed agreement hierarchy
must keep required acknowledgements and review text accessible and be documented
as a functional adaptation; CSS alone cannot establish parity for those states.

The 46-second recording starts partway through the opening interaction. Four-second
frame sampling does not establish the exact entrance sequence or timing. The
source guide's 1800ms Splash delay and preview's 2000ms delay remain conflicting
references. No automatic Analyzing completion, timer change or claim of verified
motion parity was introduced by this follow-up. **D3-13 stays open.**

No permission to modify hosted Supabase, apply migrations, deploy, commit or push
was used. Android project/APK preserved; no new APK build or device installation
was attempted in this visual task. Hosted completion and Android compatibility
remain unverified. The subsequent Day 4 implementation authorization does not
change this visual gate's status.
