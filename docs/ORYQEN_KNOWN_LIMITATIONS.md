# ORYQEN known limitations (25 October 2026)

Read with `docs/ORYQEN_FINAL_RELEASE_TRACKER.md`. Nothing below is hidden by the UI
copy; items marked "labeled" are disclosed to users in the product.

## Not verified on any hosted system

- No hosted (staging or production) end-to-end journey has been run this sprint:
  email confirmation delivery, hosted sessions, cross-user isolation and persistence.
- Staging lacks the three sprint migrations (offer lifecycle, offer drafts, employment
  history). Applying them needs a backup, hash review and separate approval.
- Application deployment parity with staging is unknown.

## AI

- Live Gemini generation is **not proven through the app**. The 22 Oct call returned HTTP
  400 (cause unknown). On 25 Oct the hangs were traced to a broken IPv6 route on the dev
  machine (IPv4 works; plain `OK` request returned 200 after 17.6 s). The app's own
  request shape then got HTTP 503 "high demand" twice, so the schema field
  (`generationConfig.responseFormat`) is neither confirmed nor refuted.
- External AI is off by policy: no owner approval, processing region or retention terms
  exist. Developer API terms and retention are unreviewed against the owner's
  requirements (see the gate document).
- The assistant is rules-based; there is no Gemini conversation history.
- Generated analyses are not stored; only the offers themselves persist.
- Redaction is heuristic; names in free text can survive. Users must review the preview.

## Product gaps

- Employment history is private only: no delete, no verification request, no Work
  Passport integration, no sharing, no supporting-evidence upload. Entries are labeled
  self-reported.
- Original-file uploads are disabled; there is no private file storage.
- Company research uses stored records only; there is no external registry or public
  source import. Company legitimacy is never inferred from offer text (labeled).
- Recommendations use stored listings and rules; there is no live vacancy feed (labeled).
- Notifications are in-app only; no email or push delivery infrastructure.
- Agreement acceptance is a recorded acknowledgment/confirmation, **not** a legally
  binding digital signature (labeled). No legal advice is given.
- Audit history is append-only by database policy, not tamper-proof; it is not a
  blockchain or immutable ledger.
- The demo seed covers worker-side records only. Companies, agreements, verified work and
  passport sharing require approved organizations and MFA operators.
- Dashboard activity is limited to persisted work/history items; there is no
  statistics or charting layer.
- Not delivered this sprint: new landing page work, design-system overhaul, audited
  accessibility pass, mobile-width visual sweep of new screens, performance profiling.

## Environment and tooling

- Native Android and installed-PWA acceptance were not rerun.
- 17 Vitest tests skip in the default run (real-PostgreSQL concurrency); they passed
  when run through the disposable-PostgreSQL scripts on 25 Oct (see the test report).
- The separate `supabase_*_fairwork` local container set is unhealthy and was not
  modified. The `oryqen-local-dev` stack was repaired (see the tracker incident note).
- Supabase advisor items on staging (47 intentional `SECURITY DEFINER` entrypoints;
  leaked-password protection disabled) are open for owner review.
- No security headers beyond those in `next.config.ts`; there is no HSTS header set by
  the application and no script-src restriction in the global CSP.

## Added 26 Oct

- No signed or production-identified Android/Windows release exists; the only installable
  builds are the unsigned Windows Preview and the debug-signed Android preview.
- The hosted deployment (`https://oryqen.vercel.app`) predates this branch; desktop and
  Android apps therefore exercise older code. The apps pin that origin.
- Brand: no owner-approved logo master or icon set exists; launcher and installer icons must be
  supplied before release.
- Telemetry on serverless hosting can exceed its 4-connection role limit with many concurrent
  instances; use a pooler or raise the limit.
- The local real-stack harness needs roughly 3 GB or more of free memory; at 0.6 to 1.6 GB it
  fails with browser/Docker resource errors that are not application defects.
- Entitlements and billing are not implemented. Self-reported employment history has no
  verification path and does not appear on the Passport.
