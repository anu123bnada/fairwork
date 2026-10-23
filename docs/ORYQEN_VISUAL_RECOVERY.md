# ORYQEN — original-design recovery

October 16, 2026, Asia/Colombo. Deadline: October 23, 2026, 19:00.

This recovery supersedes the rejected evergreen/paper visual direction in
ORYQEN_VISUAL_REVIEW.md. It keeps ORYQEN as the public name and the working trust
engine. It is not a new design or a full rollback. Historical Day 3–7 visual gates
are not automatically passed by restoring the pre-rebrand styling.

## Audit, preservation and selective plan

Git history contains documentation commits, not a committed implementation to
restore. README is modified and application files are predominantly untracked.
The complete `git status --short --untracked-files=all` inventory was inspected.
Neither tracked nor untracked source was discarded. The 301-file pre-brand
snapshot `test-results/oryqen-rollback-1792075356417/files/` supplied the comparison
baseline; it was not copied over the application.

Before recovery, `node scripts/snapshot-oryqen.mjs` saved 322 current source files
and the existing APK in `test-results/oryqen-rollback-1792098967410/`. Its
`visual-evidence/` also preserves existing visual directories, root screenshot
files and browser logs before tests could refresh their historical filenames.
Credentials and generated dependency/build trees were excluded. The original
pre-ORYQEN snapshot and rejected green assets remain intact.

The file-level plan was explained before application edits:

| Area | Finding and selective recovery |
|---|---|
| `src/components/oryqen/brand.css` | Broad root overrides removed blue tokens, gradients, glass and shadows; widened 390px layouts to 680px; hid status bars and changed card geometry. File is preserved but no longer imported. |
| `src/app/layout.tsx` | Load the small new `recovery.css`; stop loading the rejected theme script. Keep ORYQEN metadata and no-index policy; use restored icon exports. |
| `auth-shell.tsx` | Restore the original 113px glass logo and 34.86×43.26 shield slot. Retain real credentials, build notice and privacy link. |
| `product-app.tsx` | Restore splash artwork, entry shield and original Welcome mark proportions; remove the duplicated Notifications Back header found in comparison. Keep ORYQEN text, typed profile context, persistent editor, truthful unavailable controls and all secure navigation/commands. |
| `src/app/manifest.ts` | Original navy/blue launch colors and new raster exports of unchanged original artwork; keep ORYQEN name. |
| Android main manifest, launch styles, `www/offline.html` | Restore existing shield drawable and blue launch/offline styling; retain ORYQEN label, package, transport, release guard and back handler. Copy web assets into the existing project only. |
| `src/app/about/page.tsx` | Remove the obsolete appearance-preference claim; keep the truthful synthetic-only build/privacy notice. |
| `tests/e2e/oryqen.spec.ts` | Keep profile persistence/error tests and metadata/security/accessibility checks; replace rejected-theme acceptance with original-design checks and add artwork/glass/motion/navigation regression coverage. |

New files: `src/components/oryqen/recovery.css`,
`public/oryqen/restored-icon-{180,192,512}.png`,
`scripts/render-recovery-icons.mjs`, `scripts/capture-visual-recovery.mjs`,
`scripts/report-visual-recovery.mjs`, this report. CONTINUE_HERE.md is updated.
The copied Android `app/src/main/assets/public/offline.html` is also changed.
The preservation report records exact paths and before/after SHA-256 values.

No migration, server command, API route, feature schema, authentication/session
implementation, security header, profile persistence implementation, CI workflow
or original Figma asset is changed. Protected-source hashes are verified in
`test-results/visual-recovery-20261016/preservation.json`.

## Original evidence and comparison method

- Original Figma: https://www.figma.com/design/5mFuLmt00uZP7Osp3ezM0z/Untitled?node-id=0-1.
  Recovery uses the locally supplied exports; no new connector render is claimed.
- Nineteen original PNGs: `C:/Users/vehiv/Downloads/Untitled/`, 390×844.
- Original SVG pack and `FIGMA-GUIDE.md`:
  `C:/Users/vehiv/Downloads/fairwork-figma-pack-v4/fairwork-figma-pack-v4/`.
- Original recording:
  `C:/Users/vehiv/Videos/Screen Recordings/Screen Recording 2026-10-11 014452.mp4`.
  It is 378×744, 46.466633 seconds. Existing extracted frames were inspected.
  Four-second sampling shows navigation, not exact interpolation of short motion.
- Onboarding 1 has no supplied PNG. Its existing, explicitly labelled
  `00-Onboarding-1-derived.png` is a rendering of the original SVG, not an invented
  reference or a newly approved Figma export.

`node scripts/capture-visual-recovery.mjs before` captured the rejected UI before
recovery from the existing isolated production build. The same script's `after`
phase uses the rebuilt application. It refuses to overwrite an existing phase.
Each phase covers 25 states × four widths (360,390,768,1440) × two OS preferences,
with height 844: 200 viewport captures and 192 additional full-page captures.
Fixtures use the same identity/offer responses in both phases. Live and explicitly
labelled Figma-sample Home/Work Record/Passport states are captured separately.
No static sample replaces real functionality or proves a verification claim.

Gallery: [original / rejected / restored comparisons](../test-results/visual-recovery-20261016/index.html).
`comparisons.json` records exact original/capture paths and SHA-256 provenance.
Originals remain unchanged; comparison strips are separate artifacts. No golden
assertion was updated to conceal a failing comparison. Historical screenshot
filenames refreshed by the existing suite are preserved in the new backup.

The 20 comparison strips and four contact sheets were visually inspected, along
with full-size sign-in, Home, Case Review and final Notifications captures.
Measurements report zero horizontal overflows, zero unloaded images and zero
rendered controls smaller than 24px across the 200 captured states. This measures
bounding boxes, not a full assistive-technology or overlap audit.

Comparison caught a pre-existing duplicated Notifications header. After its fix,
`node scripts/capture-visual-recovery.mjs after-notifications` saved eight new
viewport and eight full-page captures without overwriting the earlier ones.
The gallery and `notifications-final.png` use this final evidence. The unchanged
192 other viewport states retain their earlier verified captures. Live Work Record
and Case Review captures include empty states; live Passport includes unavailable
service state. Populated persistence/review journeys are separately exercised by
the Day 5–7 browser suites, not implied by these empty-state screenshots.

## Screen audit and limits

| Screens | Recovery and remaining distinction |
|---|---|
| Splash | Original dark blue vector background, glass circle, white shield, text/dot geometry, 1800ms pulse and onward navigation; ORYQEN text. |
| Onboarding 1–3 | Original illustration assets, 330px glass art card, blue circle, typography, spacing, dots, fixed action and 300ms entrance; original Next/Back sequence. |
| Language | Original background, choices, radio treatment, spacing and navigation. Unsupported languages remain honestly unavailable; supplied Noto fonts fix missing glyphs in the PNG. |
| Sign-in / entry Welcome / OTP | Original blue/glass design and shield. Approved security exception retained: email/password and six-digit authenticator, not phone/SMS or fake four-digit verification. Disclosures and extra secure fields change height. |
| Authenticated Welcome | Original hierarchy, before/during/after card and actions; ORYQEN and shield replace the old initial/name. |
| Home | Original palette, card surfaces, navy action, navigation and 390px geometry. Live profile/offer facts are not fabricated to match the sample's location, score or employment claims. Separate labelled sample comparison provided. |
| Add Offer / Analyzing / Check | Original backgrounds, tabs, cards, gradients and analysis motion; original secure manual input and factual completeness states retained. OCR remains unavailable. |
| Questions / Agreement | Original glass cards, blue actions and navigation restored. Real generated questions, version/hash/consent/independent-confirmation content still has different density from the static example. |
| Work Record / Passport | Original glass rows, navy summaries, typography and navigation; both sample and live states captured. Persistent receipts, corrections, withdrawal, retraction and suppression remain real and private. |
| Settings | Original background/profile/list styling; the persistent editor is a **design extension**. Unsupported delivery controls remain unavailable instead of becoming fake toggles. |
| Employer / Share / Notifications | Original visual language and interaction shell; no fabricated employer access, working public sharing or notification delivery. Share remains dismissible and honest about availability. |
| Case Review / revised agreement workflow / integrity controls / About / native offline | **Design extensions** using original tokens. There is no original Case Review Figma frame or approved full set of newer functional states. Existing browser tests exercise populated case/decision/error and integrity states. |

The supplied design has no approved alternate dark theme. Both OS preferences now
render the approved light design; the rejected theme selector/script are not
mounted. Old device preferences and source assets are preserved. Reintroducing
dark mode requires an approved reference, not another inferred palette.

Accessibility adjustments are explicitly distinguished from exact pixel matching:
the original blue button gradient's top stop changes from `#4a78ff` to `#3d67eb`
to maintain 4.5:1 white-text contrast; security disclosure retains 12px readable
copy with darker blue-grey text; supplementary link/drag-handle targets have a
24px minimum. Original focus indicators and global reduced-motion support remain.
This is targeted automated coverage, not a complete accessibility certification.

Original CSS motion was preserved: 300ms entrance, 1800ms splash pulse, analysis
pulse/dots, pressed-button scale and sheet transitions. The guide says 1800ms for
splash; the supplied HTML preview uses 2000ms. Exact recording timing, full card
stagger and ring interpolation remain unproven. Do not claim pixel-perfect or
frame-perfect parity, or close the historical visual gate on test counts alone.

## Verification results

Browser fixtures are distinct from real local PostgreSQL RLS/transaction tests;
neither proves hosted Supabase Auth/PostgREST or independent human verification.

| Exact command | Actual result | Evidence under `test-results/` |
|---|---|---|
| `npm test -- --reporter=default --reporter=json --outputFile=test-results/recovery-regression-results.json` | 199 PASS, 14 native-only skips, 0 failures; 24 files | `recovery-regression-results.json`, `recovery-regression.log` |
| `node scripts/test-day4-postgres.mjs` | 13 PASS, disposable real PostgreSQL | `recovery-native-day4.log`; `day4-postgres-1792115167499/tests.log` |
| `node scripts/test-day5-postgres.mjs` | 20 PASS, disposable real PostgreSQL | `recovery-native-day5.log`; `day5-postgres-1792115192679/tests.log` |
| `node scripts/test-day6-postgres.mjs` | 18 PASS, disposable real PostgreSQL | `recovery-native-day6.log`; `day6-postgres-1792115211134/tests.log` |
| `node scripts/test-day7-postgres.mjs` | 24 PASS, disposable real PostgreSQL | `recovery-native-day7.log`; `day7-postgres-1792115232381/tests.log` |
| `npm run test:e2e:isolated` | Final 57 PASS, including Notifications Back fix, original assets/motion, profile save/reload, API denials, agreement independence/recovery, work/integrity/Passport/cases and mobile offline/history | `recovery-browser-notifications-final.log` |
| `npm run typecheck` | PASS | `recovery-typecheck.log` |
| `npm run lint` | PASS, zero warnings | `recovery-lint.log` |
| `npm run build` | PASS; normal `.next` production build, dynamic server API routes retained | `recovery-production-build.log` |
| `node scripts/verify-android-poc.mjs` | PASS source invariants | `recovery-android-guards.log` |

75 native PostgreSQL executions overlap the embedded suite: do not sum these as
unique tests. All 14 native-only skips have passing native coverage. Native runners
verified real RLS, locked transitions, concurrency and authority revocation using
synthetic Auth adapters; all four disposable servers stopped. No hosted migration
was run. There are no schema changes in this recovery.

Retained unsuccessful infrastructure runs: the sandboxed regression run passed 95
tests but 14 files failed to load Vitest temporary modules (`ENOENT`), saved in
`recovery-regression-sandbox.log` and `recovery-regression-sandbox-results.json`.
The same suite passed outside the sandbox with no application/test changes.
Sandboxed Next type generation failed with Windows canonicalization access denied,
saved in `recovery-typecheck-sandbox.log`; the same typecheck passed outside it.
Earlier successful browser passes (56 before the new motion test; 57 before the
Notifications fix) are retained as `recovery-browser-run1.log` and
`recovery-browser-final.log`, but the table names the final 57-test run.

## Android artifact and installation boundary

`npx cap copy android` succeeded from `mobile/poc`; the project was not regenerated.
The original shield drawable and blue launch/offline surfaces are restored, while
the label remains ORYQEN Local POC and package remains `org.fairwork.localpoc`.

An updated **debug APK was generated and its v2 signature verified**:
`mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk`, 4,411,431 bytes,
SHA-256 `1EBF12E0B7BA0F6478221077B0A5A32F173225E8257FB24416E06426A8E9DDCA`.
It is **NOT INSTALLED and NOT DEVICE-TESTED**. No AAB/release build is claimed.
The previous green-brand APK remains in the pre-recovery backup.

Exact commands, from `mobile/poc/android`:

```powershell
$env:JAVA_HOME='C:\Users\vehiv\Desktop\fairwork\.tmp\android-toolchain\jdk-21.0.12.1+1'
$env:ANDROID_HOME='C:\Users\vehiv\AppData\Local\Android\Sdk'
$env:GRADLE_USER_HOME='C:\Users\vehiv\Desktop\fairwork\.tmp\android-gradle'
.\gradlew.bat assembleDebug --offline --no-daemon --no-watch-fs --max-workers=1 --console=plain
& "$env:ANDROID_HOME\build-tools\35.0.0\apksigner.bat" verify --verbose --print-certs app/build/outputs/apk/debug/app-debug.apk
```

`recovery-android-build.log`: BUILD SUCCESSFUL, 93 tasks (13 executed, 80 up-to-date).
`recovery-android-signature.log`: Verifies, v2 true. Debug signing only.
`npm --prefix mobile/poc run doctor` exits 1 for the device blocker:
Studio/SDK 36/build tools 35/JDK 21/ADB are available, zero authorized devices,
`Medium_Phone_API_37.0` exists but the Android Emulator hypervisor driver is absent.
Evidence: `recovery-android-doctor.log`. No device, firmware or driver changes made.
Hardware Back, native Auth/MFA/session persistence, lifecycle and native offline
recovery remain untested. Chromium mobile tests are explicitly separate.

## Release and next action

No hosted Supabase modifications, hosted migrations, deployment, commit or push.
No new schema or backend architecture. Hosted HTTPS/Auth/MFA and other release
gates in ORYQEN_RELEASE_GATES.md remain open. Device testing must be reported
separately from an APK build and Chromium mobile coverage.

Review the restored comparison gallery and the listed security/accessibility
exceptions. Remaining design decisions concern exact motion and new functional
screens, not permission to reintroduce green/mint or replace working features.
Day 8 functionality was not started by this visual recovery.
