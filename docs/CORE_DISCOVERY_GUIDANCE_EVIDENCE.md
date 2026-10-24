# Core workflow batch — 24 October 2026

## Opportunity discovery and transparent matching

`/app/opportunities` provides searchable, paginated representative-submitted
listings. Publishers explicitly choose private draft, published or closed status
and an expiry. Every write requires current organization authority; employer
registration alone grants none. Only the original publisher can edit a listing.
Expired, closed and authority-revoked listings disappear from discovery.

Workers can save, hide and restore listings and persist voluntary role, location,
work-arrangement and minimum-pay preferences. Matching explains each stated-field
comparison. Missing fields and incompatible currency/pay-period combinations
remain unknown; no conversion, ranking, suitability score or sensitive attributes
are inferred. Empty results are real empty states, not fabricated vacancies.

GET/POST `/api/v1/opportunities` validate strict request/response schemas and use
the existing verified Supabase session. Writes require same-origin requests.
The new SQL RPCs enforce identity, RLS, authority, version conflicts, quotas and
idempotency. Network retries retain the listing draft and exact request key.
Authorization denial clears displayed content. Revalidation happens on reload;
the UI is not a live revocation subscription.

Migration: `20261024052407_opportunity_discovery.sql`. Four private tables store
listings, current preferences, saved/hidden choices and immutable command receipts.
All force RLS; no direct anon/authenticated/service-role table grants were added.
The existing NOLOGIN/NOBYPASSRLS executor owns only the narrow API functions.
Clearing current preferences stops matching but does not erase historical receipts.

Limitations: current organization policy remains synthetic/demo-provisioned.
No external jobs provider, application submission, contact relay or independently
verified employer data is connected. Unapproved organizations cannot publish.

## Private product guidance

`/app/guidance` persists questions and server-authored topic guidance, with recent
conversation navigation and reload. It explicitly says live AI is unavailable.
The selected topic determines a fixed product-guide answer; arbitrary question
meaning is not interpreted. The response names its source/version and never
claims legal judgment, verified findings or actions taken for the user.

GET/POST `/api/v1/guidance` uses verified identity and strict schemas. The database
constructs answers; clients cannot supply them. Optional saved-offer context uses
the existing authorized agreement RPC and stores only revision/open-question
metadata. Historical contextual turns are reauthorized before returning a thread.
Thread contents belong to the requesting actor, not employers or other users.
Conversations have a 100-turn cap; the recent list shows up to 30 conversations.

Migration: `20261024053156_private_guidance_history.sql`. Private immutable turns
force RLS with narrow RPC grants, identity quotas and idempotent writes.
Operational retention/deletion needs an approved policy; no erase function is
claimed. No AI provider was called, paid service activated or action delegated.

## Reviewed text-document evidence

The existing work-record editor accepts a nonempty UTF-8 `.txt` file of at most
16,000 bytes. Reading and SHA-256 calculation occur on the device. The user can
preview/cancel, explicitly add editable excerpts, then save the existing private
draft. Sharing remains the existing separate explicit submission step.

Each excerpt contains a sanitized filename, original-byte fingerprint and an
editable-transcription notice. Invalid UTF-8, binary controls, unsupported files
and insufficient evidence capacity are rejected without silent truncation.
Excerpts use the existing work-record API, revision storage and participant RLS;
there is no new upload endpoint or authorization system.

The fingerprint identifies the imported bytes, not truth, authorship or the
accuracy of later edits. Original files are not uploaded or retained. PDF/Word,
general binary storage, virus scanning and source-file downloads remain gaps.

## Deployment boundary and verification

Both migrations were exercised only in disposable PGlite databases. They have
not been applied to hosted Supabase or the user's persistent development stack.
Offline release preparation verifies all 32 migration pins and preserves full
12- or 14-digit versions. Historical migrations and their pins are unchanged.

The existing production backup/restore, fresh catalog comparison, migration
approval and postflight checks still apply. Deploying only the UI without these
migrations will not make the new RPCs available. Do not label the full directive
production-ready. See TEST_REPORT.md for exact results and RELEASE_BLOCKERS.md
for remaining acceptance gates.
