# ORYQEN Android and Google Play readiness (Phase 0 audit, 17 Nov 2026)

**Verdict: not ready for Google Play. There is no releasable Android build today.** What exists is a debug-signed preview wrapper that has never completed a journey on a device. Reaching a Play internal-testing release needs owner decisions and accounts (application id, production domain, keystore custody, Play developer account, privacy policy), a production backend to point at, an Android App Bundle build, push and account-deletion work, and device testing. The engineering part is small compared with those dependencies.

**Evidence legend.** **[V]** verified by me on 17 Nov 2026 by reading build files (nothing was built or installed today). **[V-doc]** recorded in a repository document by earlier runs and not re-run today. **[D]** documented. **[U]** unknown. **Play Console requirements below are stated from my knowledge of Google's published policies and change often; each item marked "confirm" must be checked against the live Play Console and policy pages before submission.** I did not consult Google's current pages in this audit.

## 1. Current application architecture [V]
| Aspect | Finding |
|---|---|
| Technology | **Capacitor 8.5.3 wrapper of the hosted website.** `webDir` holds only `index.html` and `offline.html`; there is no static export of Next.js and no native feature code. The "app" is a WebView showing the web product. |
| Project | `mobile/poc/android` (Gradle 8.14.3, Android Gradle Plugin 8.13.0, `compileSdk` 36, **`targetSdk` 36**, `minSdk` 24). |
| Identity | `applicationId` `org.fairwork.localpoc` (development); the preview variant adds `.online`; app name in config "ORYQEN Local POC". **Not a store identity.** |
| Variants | `debug` (loads `http://localhost:3102` through `adb reverse`, local only); `online` (initWith debug, **debug-signed**, `-online-preview`, points at the staging origin); `release` (**disabled** unless `-PoryqenReleaseAppId=<id not starting org.fairwork.>` and `-PoryqenReleaseOrigin=https://<host>` are supplied). |
| Network policy | Main manifest: `allowBackup="false"`, `usesCleartextTraffic="false"`; only permission `INTERNET`; `CapacitorHttp` and `CapacitorCookies` disabled; mixed content off. A debug-only network-security file permits exactly `localhost`. |
| Offline and errors | Navigation failures load a bundled `offline.html` with a retry link and no cached personal data. A lost response may still be a completed server action; the page says to reconnect and reload. |
| Back handling | Delegates to WebView history, then finishes the activity at the root. |
| Secrets | None in the app. No Supabase keys, no service role, no signing material in the repository (`*.jks`, `*.keystore` ignored). Signing is read from `ORYQEN_ANDROID_KEYSTORE_*` environment variables. |

## 2. Requirement-by-requirement status
| Requirement (from the directive) | Status | Notes |
|---|---|---|
| Web and backend integration | **PART** | Works by loading the hosted site; therefore every web fix reaches the app without a store update, but the app is only as available and secure as the web deployment. No production backend exists. |
| Real authentication | **IMP in the web, NOT verified on Android** | Auth is the web's Supabase session in the WebView. Sign-in persistence, MFA entry, password-manager autofill and session loss on cookie clearing have **never been verified on a device**. |
| API configuration | **PART** | Origin is a build parameter (`oryqenReleaseOrigin`), https only. The Windows shell pins `https://oryqen.vercel.app` in `desktop/policy.cjs`, which must also change. Production domain: **BLK** (owner). |
| Push notifications | **NOT implemented** | Gradle applies the Google services plugin only if `google-services.json` exists; none exists, and Gradle logs "Push Notifications won't work". Needs: Firebase project, FCM, notification permission flow (Android 13+ `POST_NOTIFICATIONS`), a server-side sender and device-token storage with consent and deletion, and a notifications backend (module 20 has in-app only). |
| File upload and download | **UNVERIFIED** | Evidence Vault uses a normal file input and signed-URL downloads in the WebView. A `FileProvider` is declared. Behavior of the system file chooser, camera capture and the download manager inside the WebView has **not been tested on a device**. |
| Offline and network error handling | **IMP, partly proven** | Offline page exists; `tests/e2e/android-browser.spec.ts` exercises the web side in a mobile viewport with the API offline (Chromium, not WebView). |
| Signing configuration | **NOT done** | Signing config exists and reads the environment; **no keystore has been created** and none is authorized. With no keystore the release output is an unsigned APK that cannot be installed [V-doc 26 Oct]. |
| Build reproducibility | **PART** | A clean rebuild of the published preview APK was byte-identical on 13 Nov [V13]. Gradle wrapper and AGP versions are pinned. The Capacitor plugin versions are pinned. Release builds are not yet produced. |
| Android target API requirement | **Meets today's project value** | `targetSdk` 36 (Android 16). **Confirm** Google Play's current minimum target level for new apps and updates before submission; the project already targets the newest level it compiled against. |
| Android 16 / API 36 compatibility | **UNVERIFIED** | The project compiles against 36 and sets `SystemBars` insets to native. Android 16 behavior changes that matter for a WebView shell (edge-to-edge enforcement, predictive back, large-screen orientation rules) have **not been exercised on an Android 16 device or emulator**. |
| AAB generation | **NOT done** | `bundleRelease` has never been run; the pipeline was verified only as an unsigned **APK** with a throwaway id on 26 Oct [V-doc]. Play requires an AAB. |
| Device testing | **NOT done** | Emulator attempts on 1 and 3 Nov were blocked by host RAM (350 MB to 1.25 GB free); the one install passed but **no journey check passed**. No physical device was used. Today C: has 6.4 GB free and the AVD wants far more headroom. |
| Play Console requirements | **BLK** | No developer account, no store listing, no privacy policy URL (see section 3). |
| Privacy disclosures and data safety | **NOT done** | See section 3. |

## 3. Google Play checklist (confirm each against the live Console)
Owner and external items first, because they dominate the calendar.
1. **Google Play developer account** (one-time registration fee; identity verification; **confirm** whether the account type requires a closed-testing period with a minimum number of testers before production access, as personal accounts created after 2023 have had).
2. **Application id** (cannot change after the first upload) and **production HTTPS origin**.
3. **Upload key and Play App Signing** (enroll in Play App Signing; keep the upload key offline with a backup). Guide: `docs/ORYQEN_RELEASE_SIGNING.md`.
4. **Approved icon set and name.** The launcher and splash artwork are earlier restored art; `public/oryqen/approved/README.md` says no approved artwork was supplied. Replace before release.
5. **Privacy policy** published at a stable public URL (does not exist: **P1-2** in the 13 Nov audit) and **Terms**, both counsel-reviewed.
6. **Data safety form.** Answers must be derived from what the product really does: account data (email, name), user-generated content (offers, contracts, evidence files, CV, career profile), identifiers, approximate device and diagnostic data if any telemetry is added, data shared with processors (Supabase; any AI provider only when consented and enabled), encryption in transit, deletion on request. Prepare a data inventory first (roadmap Phase 3).
7. **Account deletion.** Apps that let people create an account must offer deletion **inside the app and via a web link** that Play lists. ORYQEN has privacy requests but **no executed erasure** (SEC-C4), so this is a hard dependency.
8. **Content rating questionnaire** and **target audience**: the product is for adults seeking employment; confirm how minors are excluded (age gate in registration is not documented).
9. **App access instructions for Google's reviewers.** A reviewer must be able to sign in: provide a synthetic reviewer account that works in production, with no real data, and instructions. Registration is currently off by design.
10. **Policy fit for a WebView app.** Play restricts apps that are only a website wrapper without added functionality ("minimum functionality" and repetitive-content policies). **This is a real risk** for a pure Capacitor wrapper. Mitigations to design and test: push notifications, native file and camera integration, offline behavior, deep links for share and verification links. **Confirm** current policy wording.
11. **Permissions declaration.** Today only `INTERNET`. Adding push, camera, notifications or storage access requires each to be justified.
12. **Financial, employment and AI disclosures.** The app gives employment guidance and may use AI: disclose AI features accurately (AI is off today) and avoid claims of legal advice or guaranteed outcomes.
13. **Sri Lanka and other target countries:** distribution countries, local legal requirements, and support contact.
14. **Release tracks.** Internal testing, then closed testing, then production, with a staged rollout and a rollback plan (halt rollout, publish a fixed version code).

## 4. Blockers
**Owner and external:** application id; production domain; keystore custody and Play developer account; privacy policy and Terms; icon artwork; data safety inputs; reviewer test account; legal text.
**Engineering:** production backend to point at; account deletion (SEC-C4); push (FCM, token store, consent, sender); first `bundleRelease` AAB with release signing; physical-device and Android 16 test matrix including file upload and download, camera capture, session persistence, rotation, deep links, offline; add real native value to answer the WebView policy risk; replace `org.fairwork` namespace and app names; decide `minifyEnabled` (currently `false`) and add a ProGuard/R8 review; automated check that the release APK/AAB has no `localhost` or `http://` strings and is not debuggable (a manual version of this check was done 26 Oct).
**Infrastructure:** CI does not build Android release; add a job that builds the AAB and runs `verify-android-poc` against the release variant (secrets only in protected environments).

## 5. Windows and desktop (for completeness)
Electron 45 shell, **unsigned installer**, default icon, product name "ORYQEN Preview"; a release configuration refuses to build without a code-signing certificate and an approved icon, and the shell's pinned origin must change to the production domain [V-doc]. Not part of Play, but the same owner decisions (domain, brand, certificate) gate it. Microsoft Store or direct download is a separate decision.

## 6. Work plan to an internal-testing release
| Step | Depends on | Effort | Parallel? |
|---|---|---|---|
| Owner decisions: id, domain, brand assets, Play account, keystore custody | owner | 1 week (elapsed) | yes, start now |
| Privacy policy, Terms, data inventory, data-safety draft | counsel | 2 to 4 weeks (external) | yes |
| Production backend and reviewer account | roadmap Phase 1 | see roadmap | gates the first real test |
| Account deletion | Backend | 2 to 3 person-weeks | yes |
| FCM push with consent and sender | Android + Backend | 2 to 3 person-weeks | after notifications backend |
| First signed AAB from CI to internal testing | keystore, id, domain | 3 to 5 person-days | after owner decisions |
| Device matrix (Android 14, 15, 16; low-RAM phone; tablet) and fixes | devices or a device cloud (cost) | 2 to 3 person-weeks | after the AAB |
| WebView-policy mitigation (native value) | design decision | 2 to 4 person-weeks | parallel |
| Closed testing then production with staged rollout | account type, Play review | 2 to 4 weeks elapsed (policy-dependent) | sequential |

Estimates are judgment from the code and documents, not measurements.

## 7. Rollback
Web fixes roll back with Vercel instant rollback and reach the app immediately. A bad Android release: halt the staged rollout, promote the previous release, publish a higher `versionCode` with the fix. Keep every uploaded AAB and its checksum. Never rotate or lose the upload key without Google Play's key-reset process.
