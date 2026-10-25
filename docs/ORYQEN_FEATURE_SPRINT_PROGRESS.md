# ORYQEN feature sprint — 25 October 2026

## Preservation and scope

Repository: `C:/Users/vehiv/Desktop/fairwork`; branch `release/oryqen-oct27`;
starting HEAD `d780bea`. No commits, pushes, deployments or hosted mutations authorized.
Preserve pre-existing modifications to the auth release document, confirmation/sign-in
routes, identity/recovery/registration services, four auth test files, and untracked
`src/lib/auth-errors.ts`, `src/server/identity.ts.bak`, `landing/v6/next-env.d.ts`.
The current request supersedes historical feature exclusions, but does not waive
authorization, consent, privacy or release verification requirements.

## Initial source audit

All fourteen vision areas inventoried below. COMPLETE is not claimed from source
presence. Existing tests are inventory evidence until rerun in this sprint.

| Capability | Existing UI / API / database / security / tests | Initial status and missing proof |
|---|---|---|
| AI employment intelligence | Manual/paste/OCR correction, structured assessment, server Gemini adapter, consent/budget RPC, authorized offer reads, provider safety tests | PARTIAL: generated results not durably retained; provider activation and hosted flow unverified |
| Company research | Company profiles/search, companies RPC, stored organization claims/reviews, authority checks, claim tests | PARTIAL: stored-record coverage only; no external registry; hosted verification absent |
| Offer management | Saved revision editor, list/history/comparison, participant RPC/RLS, unit/SQL/browser tests | PARTIAL: no archive or personal decision lifecycle; unfinished draft behavior needs review |
| Digital agreements | Versioned creation/proposal/acknowledgment/decisions/history, RPC and immutable SQL, participant/authority tests | PARTIAL: manually opened agreement loses URL on refresh; fresh hosted acceptance absent |
| Work records/evidence | Agreement-backed work drafts/submissions/revisions/timeline, text evidence import, RPC/RLS tests | PARTIAL: requires confirmed agreement; standalone self-reported employment absent; private file storage unavailable |
| Work Passport | Eligible evidence profile, named-recipient grants/revocation, export, projection/isolation tests | PARTIAL: self-reported history/profile coverage incomplete; hosted share acceptance absent |
| AI assistant | Private persistent questions/history, topic guidance, authorized optional offer context, SQL/API/browser tests | PARTIAL: explicitly rules-based only; Gemini conversational integration absent |
| Security/identity/accountability | Auth/confirmation/recovery/profile/MFA, protected routes, RPC grants/FORCE RLS, audit/quota tests | PARTIAL: preserve ongoing transport fixes; staging email/session/RPC configuration unverified |
| Opportunities/recommendations | Persistent listings/preferences/choices, rules matching, publisher authorization, SQL/browser tests | PARTIAL: actual hosted schema/workflow unverified; no external feed |
| Employer portal | Organization requests/membership/claims, representative work/case flows | PARTIAL: genuine employer assurance and hosted operation unverified |
| Disputes/appeals | Cases, assignments, followups and appeal RPC/UI, reviewer conflict checks | PARTIAL: hosted independent-review acceptance absent |
| Audit trails | Append-only workflow history, receipts, admin audit and database integrity tests | PARTIAL: hosted catalog/recovery proof absent |
| Admin control center | Scoped queues/settings/review UI/API, MFA/capability guards, tests | PARTIAL: authorized hosted operators and operating procedures unverified |
| Notifications/settings/search | Recipient-scoped notifications, profile/privacy settings and scoped search | PARTIAL: operational delivery and hosted acceptance unverified |

Shared foundation: branded authenticated dashboard exists, but needs richer persisted
activity/navigation. Android Capacitor architecture is preserved; no native acceptance
or production signing has been established in this sprint. Tailwind is not installed;
reuse the existing authored CSS instead of replacing the styling system.

## Read-only environment inspection

`node scripts/hosted-auth-readiness.mjs --network --migration-list` completed on
25 October. It inventoried 32 local migrations. The configured Supabase public
settings have a valid shape, but the linked-project check failed and APP_ORIGIN
is not a canonical HTTPS hosted origin. The script correctly did not contact the
unmatched project. Remote migration inventory remains unknown; do not infer parity
or change the link/configuration automatically. Sanitized report:
`test-results/hosted-auth-readiness-1792894155956.json`.

## Implementation in progress

- Offer lifecycle: actor-private archive/restore and decision tracking, with SQL isolation tests.
- AI: reject numeric extraction not supported by the quoted source.
- Agreements/records: refresh-safe agreement retrieval, then standalone self-reported history.
- Dashboard: persisted work/history activity and direct workflow navigation.

## Release decision

NO-GO pending hosted authentication, migration parity, actual persistence/isolation
acceptance, AI provider proof and operational/security gates. No hosted feature is VERIFIED.
