# ORYQEN — production and mobile release gates

October 23: Next.js upgraded from affected16.4.0 to exact16.4.1, advisory check
affected:false. Patched build/typecheck, 49 focused checks and 13 fixture browser
tests pass. Existing local stack/app restored without recreation/data changes.
This resolves the detected framework-version issue, not the external release
gates below. Latest fictional Gemini generation still failed400; approval spent.

October 22 superseding status: 30 pinned local migrations verified offline, fresh
package `test-results/stage9-release-1792681998022/`; historical hosted history
has not been refreshed. Gemini key/model are present, listing authenticated with
HTTP200, but the latest separately authorized fictional generation on listed
gemini-3.8-flash failed400 INVALID_ARGUMENT; all external-test approvals exhausted.
Real personal-data processing remains unapproved. Current feature/evidence matrix
is the first section of COMPLETION_PROGRESS.md. The dated counts/key assumptions
below are historical. Release remains NO-GO. Do not activate a synthetic-to-real
data-mode switch: see OFFER_INDICATORS_V1.md for actual production prerequisites.

October 18 update: 22 preserved/additive migrations are applied to the isolated
LOCAL backend only. The prior six-pending-migration approval package is stale;
18 files are pending relative to the historical four-version hosted inventory.
Reconcile hosted history read-only and review the current pinned hashes before
seeking approval. Current authentication requires `api.account_access`; deploying
application code before its reviewed schema intentionally fails closed. No hosted
backup export, restore, migration, signup, account creation or deployment is authorized.
Named-recipient sharing and self-deactivation add receipt/state recovery requirements:
restore must never resurrect revoked grants, removed fields or disabled accounts.
Gemini's actual account/processing/retention approval and key remain absent. See
GEMINI_PROCESSING_GATE.md. No live AI, external company verification or Android
runtime completion is claimed. The local Chrome PWA is installed/tested, not an EXE.

2026-10-15. Local implementation is not permission to deploy. Runtime still
accepts only `FAIRWORK_DATA_MODE=synthetic`; changing the brand does not change
the approved data policy, employer assurance or review staffing.

## Security and operations

- Existing server-only Supabase client uses verified `getUser`, never trusts role
  presentation or client actor IDs. Strict JSON schemas, 64 KiB body bounds,
  same-origin writes, generic auth errors, private/no-store responses, MFA and
  SQL quotas remain. Check native tests and API results in the verification report.
- Added CSP restrictions on framing, plugins, base URL and form destinations.
  This is not a complete script-source/nonce CSP. Existing frame denial, nosniff,
  no-referrer and camera/microphone/geolocation denial remain.
- Auth relies on provider rate limits; distributed edge abuse controls and their
  actual deployed configuration are not proven. Do not substitute a per-process
  counter for distributed protection. SQL domain quotas are transactional.
- Secrets remain local and ignored; no production service-role key introduced.
  No credentials are copied into the source rollback. Rotate compromised secrets
  through the owner, never print them to diagnostics. Environment checks reject
  partial/unsafe Supabase configuration and unknown data modes.
- Request errors log only request ID and safe code. An external monitoring sink,
  alert routing, escalation owner and synthetic heartbeat are not deployed.
  Before release, configure redaction and test an alert without employment data,
  tokens, passwords, MFA secrets or raw evidence in telemetry.
- CI workflow runs validation only, with blank Supabase public config and disposable
  databases. No deployment job or secrets. Local commands are verified separately;
  GitHub-hosted execution remains unverified until an approved push/PR.
- Case/work detail history still needs bounded paging and representative query
  plans/load testing. List pagination alone does not prove scale.
- Visual keyboard/label/overflow/reduced-motion tests are scoped evidence, not a
  complete WCAG audit. Screen-reader and mobile assistive-technology testing remain.

## Recovery rehearsal before hosted release

1. Owner records the exact synthetic project and release migration manifest.
   Obtain approval before hosted changes. Never reset an unknown database.
2. Owner makes an encrypted restricted export and inventories coverage: application
   schema, immutable events, receipts, capability/authority state, Auth identities,
   provider/MFA configuration and external secrets. No Storage user files exist.
3. Restore into a separately approved isolated environment, never over production.
   Re-provision excluded Auth/MFA/settings securely; rotate credentials as required.
4. Replay withdrawal, revocation and privacy tombstones before any traffic. Verify
   foreign-account denial, exact revisions, unresolved case suppression and no
   reappearance of deleted/disclosed evidence. Compare manifests/counts privately.
5. Record measured recovery time/data loss against owner-approved RTO/RPO. Test
   monitoring and rollback with traffic still disabled. No RTO/RPO is invented.
6. Restrict export access and apply the approved synthetic cleanup window to
   exports as well as live data. Disposable test migrations are not backup proof.

## Hosted verification

Need an approved HTTPS origin and hosting plan, actual Supabase Auth cookie
renewal/expiry/two-session isolation, PostgREST RPC grants/catalog checks, MFA
enrollment/expiry, Storage denial, security headers and controlled migration
rehearsal. Production policies/contact, retention, privacy fulfillment, genuine
authority and independent reviewer staffing are prerequisites for real-user use.
Hosted Auth email templates are not in this repository and have not been changed.

## Android

Reuse Capacitor 8.5.3 with the hosted Next application and same-origin APIs. Next
server routes cannot run in a static export. Existing local POC loads
`http://localhost:3102` only through `adb reverse tcp:3102 tcp:3102`; do not replace
it with an invented LAN or production URL. Native HTTP/cookie plugins remain
disabled. Internet is the only requested platform permission; the packaged APK also includes AndroidX’s app-scoped signature-protected dynamic receiver permission. Back delegates to WebView
history then finishes the activity; device behavior requires actual testing.

Retain `org.fairwork.localpoc` for this POC. Main manifest denies cleartext; debug
network config allows only exact localhost, not its subdomains. Gradle disables
release variants. ORYQEN labels/icons/splash/offline page do not relax these guards.
No signing credentials are created for release and no release AAB is claimed.

After an authorized device is connected:

```powershell
npm --prefix mobile/poc run doctor
# Run the existing local Android backend command documented in ANDROID_POC_20261013.md.
adb reverse tcp:3102 tcp:3102
adb install -r mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.fairwork.localpoc/.MainActivity
```

Use the SDK's absolute adb path if it is not on PATH. Inspect startup/onboarding,
sign-in/MFA/refresh/expiry, authenticated API calls, exact agreement/work/case
decisions, hardware Back/dialog dismissal/root exit, background/foreground/process
recreation, offline/reconnect and no stale success claims. Record device/OS/WebView
and screenshots. Browser mobile emulation does not establish any of these native
results. Do not silently install a hypervisor or change firmware settings.

Before store submission, replace local transport only after approved HTTPS/session
testing, choose the production application ID/versioning, enable a separately
reviewed release variant, protect signing/upload keys and build/test an AAB.
[Android's App Bundle guidance](https://developer.android.com/guide/app-bundle)
and [Play App Signing](https://developer.android.com/guide/app-bundle/faq) describe
the publishing/signing flow. Complete the actual SDK/data inventory, privacy URL,
Data safety disclosures and reviewer access instructions. Where in-app account
creation is offered, review [Google's account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
No policy compliance or store acceptance is claimed from this checklist.
