# ORYQEN V1.0 master specification (authoritative product vision)

Saved 26 October 2026 from the owner's "Ultimate Global Product Engineering Mission" and the
"Mandatory Real-World Production Completion Directive". It supersedes the earlier 14-module
scope as the long-term target and invalidates none of the completed work. The module
requirements below are preserved feature-for-feature; the surrounding prose (context, rules,
execution strategy) is condensed. Delivery status lives in `docs/ORYQEN_MASTER_DELIVERY_TRACKER.md`;
this file defines the target, not what is done.

**Positioning:** The Employment Trust Infrastructure. **Tagline:** Employment Intelligence.
Verified Trust. Empowered Careers. **Mission:** help people understand, verify, protect, document
and prove employment relationships throughout their professional lives. **Event:** VisioNEX 2026,
27 October 2026; long-term objective is an international employment trust ecosystem.

**Architecture decisions (final):** keep the premium landing page (`src/app/page.tsx`,
`landing.css`, `src/components/oryqen/cinematic-core.tsx`), the Next.js web app, Electron for
Windows, Capacitor for Android, one shared Supabase backend. Do not migrate to Tauri or Flutter.

**Rules (condensed):** preserve working code and user data; inspect before modifying; real
workflows only; authorization on server and database; validate untrusted input; no fabricated
employer data, verification status, vacancies or AI evidence; distinguish verified, unverified,
self-reported, imported and AI-inferred information; no secrets in client bundles; respect consent;
auditable decisions; understandable errors; verify with executable tests and never weaken tests;
no production-readiness claims without evidence; **no push, deployment, hosted migration,
published download or live AI processing of real user data without explicit approval.**
Preserve `src/server/identity.ts.bak` and `landing/v6/next-env.d.ts` (never delete, overwrite or
commit them without authorization).

## Signature innovation: the ORYQEN Trust Chain

Connect: employment offers, employer identity and authorization, agreements, employment evidence,
Work Passport credentials, verification events, corrections and revocations, and audit history.
Each important claim should carry, where applicable: claim identifier, subject, issuer or source,
claim type, evidence references, verification method, verification status, verification timestamp,
expiration, revocation status, visibility permissions and audit events. A user must be able to
answer: What is claimed? Who provided it? Who verified it? What evidence supports it? Is it still
valid? Can it be challenged? Can access be revoked? Prioritize this model over feature count.

## The 22 modules

**01 AI Employment Intelligence.** Manual offer and job-description entry; PDF and supported
document upload with safe parsing, size and type validation; extraction of salary, working hours,
benefits, leave and holidays, probation, notice period; termination-clause analysis; missing
information; suspicious payment-request indicators; potentially exploitative-condition warnings;
contract-ambiguity explanations; risk categories; explainable fairness indicators; suggested
employer questions; user-friendly summaries; offer comparison; analysis history; structured result
validation; AI uncertainty labels; source references; human-review guidance. Deterministic checks
for calculable facts; Gemini for contextual analysis when legitimately enabled. Never fabricate
laws or assert wrongdoing; AI is never the sole basis for consequential decisions.

**02 Global Employer Intelligence.** Employer profiles; organization identifiers; public-source
references with URLs and timestamps; evidence provenance; verification requests; representative
authorization; employer-submitted information; independent verification status; expiration and
re-verification; challenged information; corrections; revocation; recruiter legitimacy indicators;
company comparison; research history. No scraping of restricted services; no invented company
information; identity verification kept separate from general trust assessments; no unsupported
numeric trust scores.

**03 Intelligent Career Discovery.** Skills profile; interests; preferred job types; salary
expectations; location and remote/hybrid preferences; experience level; opportunity matching with
explainable criteria; recommendation history; saved opportunities; opportunity comparison;
skills-gap suggestions; career guidance. Only legitimately sourced or employer-submitted
opportunities; synthetic ones clearly labeled and excluded from real production discovery.

**04 Offer Intelligence Workspace.** Create, draft, edit, analyze, compare, archive and restore
offers; search and filters; decision tracking; offer timelines; employer linkage; supporting
documents; review notes; analysis version history; export summaries; secure private access;
protection against data loss and duplicate submissions.

**05 Digital Agreement Center.** Agreement creation with structured fields; clause management;
version history; side-by-side changes; controlled sharing; worker and authorized employer review;
acceptance or rejection records; amendments; expiry reminders; supporting documents; audit events;
dispute linkage. No claim of legally binding electronic signatures without validated
jurisdiction-specific requirements.

**06 Employment Evidence Vault.** Employment history; work records; important events;
salary-related documents; certificates; employment letters; milestones; evidence uploads; private
storage; document metadata; access control; verification status; correction requests; revocation;
export and deletion where applicable. Short-lived signed URLs or equivalent; no public storage of
private evidence.

**07 ORYQEN Work Passport (flagship).** Portable employment identity; professional summary; skills;
experience; timeline; achievements; verified credentials; evidence references; self-reported
claims; issuer information; shareable profile; QR-based verification; time-limited sharing; share
revocation; public/private field controls; PDF export; credential verification page; status and
expiration checks. Verified and unverified claims visually distinct; no confidential evidence
without authorization.

**08 Organization & Recruiter Portal.** Organization onboarding and profile; representative
verification; recruiter accounts; team membership; role permissions; verification requests;
employer offer and agreement workflows; employment confirmations; evidence review; dispute
responses; audit history; organization notifications. Never grant verified organization authority
because someone typed a company name or email domain.

**09 Dispute & Appeals Center.** Case creation and categorization; evidence submission;
confidential attachments; timelines; authorized organization responses; reviewer assignments;
review status; follow-up requests; appeals; decisions; notifications; corrections; audit history;
fair procedures and restricted access. ORYQEN is not a court, regulator or authorized arbitration
service.

**10 Trust Ledger & Audit Engine.** Server-side audit logging; actor attribution; timestamps;
versioned changes; record integrity checks; technically enforced append-only protections;
tamper-evident hashing where implemented; decision history; verification revocation; administrative
action records; audit export for authorized users; restricted access. No false claim of blockchain
or absolute immutability; document the real guarantees and threat model.

**11 AI Career Copilot.** Employment document explanation; offer and agreement guidance; interview
preparation; negotiation questions; career guidance; platform assistance; contextual help;
multilingual explanations; conversation history and deletion; user-controlled context; AI consent
management; safety disclosures. No definitive legal advice.

**12 Security & Privacy Command.** Secure authentication; email verification; password recovery;
session management; MFA; passkeys where feasible; secure account recovery; server-side
authorization; RLS; rate limiting; input validation; secure document access; security event logs;
privacy notices; consent controls; data export; account-deletion workflow; retention controls;
cross-account and organization isolation; safe AI data handling. Audit for IDOR, broken access
control, SQL injection, XSS, CSRF, unsafe redirects, SSRF, secret leakage, insecure uploads,
authentication bypass, privilege escalation, permissive RLS and unsafe admin operations.

**13 Administration & Trust Operations.** Authorized admin dashboard; reviewer roles; organization
verification queue; dispute and appeals oversight; abuse reports; account moderation; audit
inspection; platform settings; operational monitoring; review assignments; administrative decision
history; safe support tooling. Least privilege; no hidden backdoors.

**14 Premium Multiplatform UX.** One identity across web, Windows and Android; professional
international SaaS aesthetic; existing logo and colors; excellent typography; consistent spacing;
clear information architecture; dashboards; accessible forms; responsive layouts; light/dark themes
where appropriate; restrained animation; loading, empty, error and success states; keyboard
navigation; touch usability; reduced motion; accessible contrast; professional data visualization.

**15 Global Localization Engine.** English, Sinhala, Tamil; extensible architecture; German
readiness; locale-aware dates and currencies; salary periods; time zones; country selection;
localized notifications; translation fallbacks; persisted language preference. No claim of
complete translation coverage where incomplete.

**16 Country-Aware Employment Intelligence.** Jurisdiction selection; country-specific terminology;
authoritative employment-rule references with source publication dates and validity dates;
working-hours guidance; wage reference support; contract-condition checks; jurisdiction-aware
warnings; source freshness; human review; unsupported-jurisdiction handling. Never invent laws or
thresholds; show a limitation where authoritative information is unavailable.

**17 Recruiter Scam Protection.** Suspicious payment-request indicators; domain mismatch checks;
recruiter identity inconsistency checks; impersonation warning signs; suspicious communication
indicators; contact-verification guidance; evidence-based explanations; user reporting; dispute and
correction procedures. Proportionate, explainable warnings; no public accusation of fraud based on
AI predictions alone.

**18 Verifiable Credentials & QR Proof.** Issuer identity; credential issuance; signed verification
payloads; expiration; revocation; verification endpoints; QR verification; minimal public
disclosure; status checks; privacy-controlled sharing. Never call self-attested information
"verified"; use established cryptographic libraries, not custom cryptography.

**19 Fairness & Salary Benchmarking.** Salary normalization; currency handling; pay-period
conversion; working-hour normalization; compensation and benefits comparison; source-backed
benchmark datasets; data freshness; geographic context; explanation of limitations; defensible
confidence indicators. No invented market salaries; estimates are never presented as official.

**20 Smart Alerts & Employment Timeline.** Agreement and verification expiry reminders; document
changes; dispute status changes; appeal deadlines; employment milestones; account security alerts;
notification preferences; in-app notification center; email where configured; Android notifications
where feasible. No sensitive details in push notifications.

**21 Developer API & Integrations.** Documented, versioned API contracts; scoped credentials;
organization permissions; rate limits; webhook signing, retries and replay protection; integration
audit events; usage limits; developer documentation. No overly broad scopes; no external
publication before security testing.

**22 Sustainable Business Platform.** Free worker protection tier; optional worker premium;
organization plans; enterprise entitlements; subscription-ready architecture; usage metering;
feature access controls; billing integration boundary; invoice and subscription records only when
actually supported; administrative plan controls. No simulated payments; no billing activation
without a real, tested payment provider; essential worker protections stay accessible.

## Mandatory real-world completion requirements (owner directive)

**A. Live Gemini.** Server-side integration; verify the supported model and API; correct the
request and structured-response format; use the existing key securely without displaying or
committing it; genuine integration tests with synthetic employment documents; Zod validation;
retries, timeouts, quotas, error handling and safe fallback; save actual analyses to authorized
accounts; integrate into offers, agreements and the assistant; show AI conclusions separately from
verified facts; privacy notices, consent and data minimization. Do not bypass the AI approval
gates; do not claim Gemini is live for real users until privacy requirements are satisfied;
identify the exact human approvals still required.

**B. Advanced company research.** Provider-based architecture; legitimate public registries or
authorized research APIs; source URLs, timestamps, identifiers and evidence; name and domain
matching; registry information distinguished from employer claims; contradictory or outdated record
detection; source freshness and verification expiry; manual verification and correction requests;
explainable findings; caching, rate limiting and safe errors. No scraping of restricted platforms;
no fabricated results; production claims only after working with real, legally accessible data in at
least one jurisdiction; where a source needs a subscription or approval, build the boundary and
document the requirement.

**C. Global employment capabilities.** Country selection; English, Sinhala and Tamil, with
extensible German; international date, time, phone and address formats; currency-aware salary
comparison and period normalization; time zones; country-specific terminology; jurisdiction-aware
guidance with source references; unsupported-jurisdiction safeguards; accessible language
switching; persisted locale. Every country-specific rule needs a legitimate source, date and
validity scope.

**D. Android production application** (Capacitor): production application ID; ORYQEN branding; real
authentication and session management; offer analysis; Work Passport; employment records;
agreements; employer workflows where authorized; shared backend; HTTPS only; file selection and
upload; network recovery; correct navigation; release verification; device installation testing;
checksums; signing and update documentation. Production signing uses owner-approved credentials;
never generate, expose or commit production keys without authorization.

**E. Windows production application** (Electron): production installer; secure BrowserWindow;
context isolation; no unsafe Node integration; safe external navigation; secure sessions; real
workflows; shared backend; installer verification; versioning; checksums; update and distribution
strategy; code-signing preparation. No signed-release claim without a real certificate and a
verified signature.

**F. Required end-to-end proof:** (1) a synthetic offer yields a real Gemini response; (2) a real
company researched from an authorized source with cited evidence; (3) language switching renders
localized screens; (4) analysis with country-specific references; (5) offer created on web is
visible on Windows and Android; (6) Android release candidate installed and a real authenticated
workflow completed; (7) the same for the Windows candidate; (8) cross-account and
cross-organization isolation; (9) no API credentials in distributed client packages; (10)
signing status and artifact integrity confirmed. Automated tests alone are not proof of device
installation, third-party API operation or live hosting.

## Completion criteria

A module is complete only with a functional UI, working backend, persistence, correct authorization
and validation, error handling, passing automated tests, verified real journeys and documented
limitations. A platform is release-ready only when it builds, installs or opens, authenticates,
runs critical workflows, synchronizes data, passes security checks, has correct release
configuration and artifact authenticity, and has all required approvals. Code existing is not a
finished feature; passing tests are not production verification; an APK or installer existing is
not release readiness; an AI API responding is not privacy approval; migrations existing is not a
verified hosted database.

## Required reporting

Git state; all 22 modules with verification status; working journeys; web, Windows, Android,
backend/database and Gemini readiness; security findings; exact test results; artifact locations;
blockers; actions needing owner approval; verdict READY / CONDITIONALLY READY / NOT READY. Keep
`docs/ORYQEN_MASTER_DELIVERY_TRACKER.md` and `docs/ORYQEN_SESSION_HANDOFF.md` current after every
implementation batch.
