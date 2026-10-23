# ORYQEN authentication correction — October 16, 2026

## Result and limits

The authentication composition is corrected locally, retaining real email/password
sign-in and six-digit authenticator MFA. **Phone-number sign-in and SMS OTP are not
implemented or verified in this application. This is not phone-flow Figma parity.**
No backend, schema, security policy, provider configuration or migration changed.
No hosted work, deployment, commit or push was performed.

Both `/sign-in` and the onboarding entry `/welcome` now render the same composition.
Lengthy development, privacy and authentication explanations are on the accessible
`/sign-in/information` page. The primary screen still states **“Email/password
sign-in. SMS unavailable.”** and **“Test accounts only · Synthetic data only.”**
The information link preserves a validated participant record destination and has
a public normal-link fallback. Return routes are allowlisted; credentials and
arbitrary redirect URLs are never forwarded. The existing secure form and all
authentication request handlers are unchanged.

## Reference and capture evidence

Original full-resolution PNGs: `C:/Users/vehiv/Downloads/Untitled/00-Sign-in.png`,
`00-OTP.png`, `00-Onboarding-2.png`, `00-Onboarding-3.png`, all **390×844**.
Original geometry/motion instructions:
`C:/Users/vehiv/Downloads/fairwork-figma-pack-v4/fairwork-figma-pack-v4/`
(`svg/` and `FIGMA-GUIDE.md`). Onboarding 1 uses the explicitly labelled derived
render of its supplied SVG, since an original full-resolution PNG was not found.
The earlier recording at
`C:/Users/vehiv/Videos/Screen Recordings/Screen Recording 2026-10-11 014452.mp4`
is 378×744 and is not an exact viewport or frame-timing parity reference for these
390px captures. Static captures cannot certify motion choreography.

[Open the original / before / corrected gallery](../test-results/auth-correction-20261016/index.html).
Six full-size comparison strips show sign-in, welcome entry, OTP and all three
onboarding slides. Left is original, middle is the preceding recovery, right is
this correction. Original copies and SHA-256 manifest are included.

There are **16 before + 18 after viewport screenshots**, each with a full-page
counterpart, at **360×844 and 390×844**. The secondary information screen adds the
two after states. All captured pages have zero measured horizontal overflow and
zero uncaught browser page errors. Fonts were awaited and reduced motion enabled
for repeatable screenshots. OTP captures use an explicitly synthetic verified
factor response and test digits; they are not evidence of successful real MFA.

Before/after PNG hashes are identical for all **10 control states**: three
onboarding slides, Home and operator authentication at both widths. These checks
establish no visual change in those states, not parity with every original frame.
See `unchanged-screen-checks.json` and each phase's `measurements.json` in the gallery
directory. Sign-in, OTP, all onboarding comparison strips, narrow sign-in and the
full secondary information screen were visually inspected.

## Precise comparison

All y positions below refer to the 390×844 viewport. Original SVG text coordinates
are baselines; browser text measurements are bounding boxes, so they must not be
subtracted as if they were the same measurement.

| Aspect | Original FAIRWORK | Previous recovery | Current ORYQEN and remaining difference |
| --- | --- | --- | --- |
| Sign-in structure | Centered shield, heading, SMS subtitle, one phone row, Send code, terms line, employer link | Inline Back and several notices displaced form; `/welcome` had separate markup | Shared shield/title/subtitle composition; Back is a top-left circle, an explicit extra navigation affordance. One short restriction plus secondary information link replaces long inline notices. Two credential rows remain necessary. |
| Inputs | Country prefix 84×56 and phone 256×56 at y=332; 16px corners | Email and password 350×54, 12px corners, at y=369.83/464.83 | Email and password 350×56, 16px corners, at y=332/422. No fake prefix or phone input. Existing autocomplete, required and length attributes retained. |
| Sign-in action | Send code, x=20/y=412, 350×54, 16px corners | Continue securely, y=534.83, 12px corners | Continue securely, y=502, 350×54, 16px corners. The extra real password row adds 90px relative to the original phone action. Loading and server-denial states retained. |
| Typography | Manrope heading 26/800, subtitle 13/500, labels 12/700; phone value 17/800 | Heading 26/700; credential values 14/700 | Heading 26/800; subtitle 13/500; labels 12/700. Credential values remain an intentional 16/600 adaptation for email/password, rather than the phone example's 17/800. Heading box y=210; subtitle y=250. ORYQEN text has different width. |
| Spacing | Original phone label baseline 320; terms baseline 496; employer baseline 560 | Extra Back paragraph and notices pushed content down/off the viewport | First field matches y=332. Short notice and information link follow the action; employer link is lower because of the additional credential row and truthful disclosure. Entire ordinary sign-in composition fits both captured heights. |
| Backgrounds/glass/shadows | Blue/cyan background, translucent rounded surfaces, blurred glass, soft shadows | Original background and assets had already been restored | Existing original background/glass/shield assets retained byte-for-byte; 24px input backdrop blur retained. Button top stop remains the prior contrast-adjusted #3d67eb rather than original #4a78ff, ending at #1e4fff. This is an explicit color difference, not exact pixel parity. |
| Iconography | Original glass shield on sign-in; arrow on OTP; original onboarding illustrations | Original assets present | Original assets unchanged. Added sign-in Back uses the existing arrow path; no new branding symbol or replacement illustration. Native browser/focus rendering and status-bar drawings are not certified pixel-identical. |
| OTP structure | “Verify your number”, phone destination, four 80×72 boxes at y=220, action y=330, resend countdown | Authenticator heading, six ~51.67×62 boxes at y=240.97, action y=336.97; lengthy disclaimer | Truthful authenticator heading, concise app-code subtitle, six ~51.67×72 boxes at y=220 with 18px corners and 28/800 digits; action y=330, 350×54. No SMS destination, send operation or resend countdown. Strong visible keyboard focus retained. |
| Motion | Guide specifies 300ms ease-out Smart Animate, 96% press; broader stagger guidance exists | Existing 300ms onboarding animation and reduced-motion handling | Motion code unchanged. Browser test confirms 0.3s onboarding animation and navigation; existing 96% press and reduced-motion rules retained. Exact source-recording timing, stagger and auth entry choreography are not certified by these static captures. |
| Onboarding | Three illustration/copy/progress/action screens | Same content/assets and route flow | All three are byte-identical to before at both captured widths. At 390, art is 330×330/y=120; copy box y=493; action y=690. Original/current strips still show small copy/dot vertical offsets, text-weight/rendering and contrast-adjusted button differences; this task does not claim to close those residual parity gaps. |
| Supported authentication | Prototype depicts phone → four-digit SMS → Home | Application implements email/password and separate authenticator MFA | Real methods preserved. Success goes to the authenticated introduction or validated participant destination; `/otp` is a separate MFA check, not a newly inserted SMS login step. No public registration, phone OTP or resend is presented as available. |

The new information page has no original Figma frame and is a small accessible
design extension. It has semantic headings, readable text, standard links and
44px link targets. The sign-in screen has a keyboard skip link. Original
“By continuing you agree…” copy was not used to imply acceptance of unpublished
production terms. Development restrictions remain visible before submitting.
At 360px the truthful authenticator heading wraps to two lines, moving its boxes
and action down by 38px. All remain visible without horizontal overflow; the
390px alignment figures above must not be claimed for the narrower viewport.

## Authentication audit

- `src/app/api/v1/auth/sign-in/route.ts`: same-origin check, strict email/password
  validation, `supabase.auth.signInWithPassword`, safe errors and existing SSR cookie
  handling. No change.
- `src/app/api/v1/auth/mfa/route.ts`: authenticated/non-anonymous user, enrolled
  TOTP factors, six-digit validation, challenge/verify and existing cookie/session
  behavior. No change. Client input cannot invent a verified factor.
- `src/features/identity/schema.ts`: strict email/password object. No change.
- `supabase/config.toml`: public/anonymous signup disabled; SMS signup/confirmation
  disabled; TOTP enrollment and verification enabled. No change. Local config is
  not proof of the hosted provider's configuration.
- No implemented phone-send/verify path was found. Hosted credentials/provider
  behavior were not exercised. Supabase's potential support for phone OTP does not
  establish that this application implements it.

Implementing phone OTP would require a separately scoped, approved real provider
integration, abuse/rate controls, recovery and hosted verification. It was not
attempted inside this visual task. Email/password remains a real backend flow;
this turn's successful browser journeys use fixtures, not a hosted login claim.

## Verification and reproducible commands

Run from the repository root. Logs remain under `test-results/`.

```powershell
node scripts/snapshot-oryqen.mjs
node scripts/capture-auth-comparison.mjs before
npm run test:e2e:isolated
npm test -- --reporter=default --reporter=json --outputFile=test-results/auth-correction-regression.json
node scripts/capture-auth-comparison.mjs after
npm run lint
npm run typecheck
npm run build
node scripts/report-auth-comparison.mjs
```

The before capture ran against the preceding isolated build before source edits;
the after capture ran against the newly built isolated application. Capture folders
are deliberately not overwritten. To reproduce later, archive/select a new evidence
directory rather than replacing these historical captures.

| Check | Result / evidence |
| --- | --- |
| Regression/API/unit/embedded database | **199 passed, 14 native-only skipped**, 24 files. `auth-correction-regression.log` and `.json`. |
| Isolated production browser suite | **59 passed**. `auth-correction-browser.log`. Includes two new auth tests and all previous 57 browser tests. |
| New auth behavior coverage | Compact truthful notices; no phone/send UI; secondary disclosure navigation; validated record return; hostile return rejection; strict email/password payload; rejected sign-in stays put; six-digit TOTP payload; incomplete code disabled; rejected/no-factor MFA fails closed; no fake resend. |
| Existing browser coverage retained | Successful fixture login routing, onboarding navigation, participant journeys, operator MFA, offline/error behavior, responsive layouts, contrast, profile and trust workflows. |
| Lint | **PASS, zero warnings**, `auth-correction-lint.log`. |
| Typecheck | **PASS**, `auth-correction-typecheck.log`. |
| Normal production build | **PASS**, `auth-correction-build.log`; includes the dynamic secondary information route. |
| Visual controls | **10/10 identical before/after control PNGs**; no overflow/page errors in captured states. |
| Native PostgreSQL | Not rerun for this UI-only change. Prior 75 local executions are historical; 14 native-only skips are not counted as fresh passes. |
| Hosted authentication/SMS | Not verified; no hosted changes. |
| Android | Project and previous APK preserved; no new APK built or installed for this task. Browser checks do not establish native compatibility. |

The two new browser tests use HTTP fixtures and are labelled as such here. The
embedded database suite and historical native database suite must not be confused
with real hosted Supabase Auth/PostgREST verification. Windows sandbox restrictions
required approved unrestricted local execution for the browser/build/type tools.

## Preservation and handoff

Pre-edit source backup: `test-results/oryqen-rollback-1792117199643/`, containing
330 source-file hashes/copies, prior debug APK and copied visual evidence. Secrets,
dependencies and generated build trees are excluded. Earlier backups remain.
`test-results/auth-correction-20261016/preservation.json` checks every original
source against this baseline and rejects changes outside the explicit auth/test/
handoff allowlist. New files are the shared auth composition/information components,
their scoped stylesheet/route, two browser tests, capture/report scripts and this
report. No baseline source is removed.

Original assets, old global styles, all ten migrations, server/API/schema code,
secure form, Android project and existing backend security fixes retain their
pre-task hashes. No unrelated screen implementation changed. The shared AuthShell
uses an opt-in sign-in variant; its operator control screenshots remain identical.

The next decision is whether the truthful email/password adaptation is acceptable
for the local visual gate or whether the product requires a separately authorized
real phone-OTP project. Exact original phone-flow parity is still blocked by the
unimplemented method; no Day 3–7 visual gate or hosted release is declared complete.
