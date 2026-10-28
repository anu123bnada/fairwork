# Implementation queue for the partial modules (28 Oct 2026)

Derived from the "Missing" column of `ORYQEN_22_MODULE_ACCEPTANCE.md`. Each item needs: migration (if data), RPC/API with ownership checks and validation, UI (mobile and desktop), unit + real-PostgreSQL tests, a browser or real-stack journey, and only then a status change. Items needing owner input are in the last section and are not started.

## Buildable now (ordered by user impact)
| # | Module | Item | Needs | Acceptance test |
|---|---|---|---|---|
| 1 | 05, 20 | Agreement expiry date on a proposal, enforced on accept, with a reminder in the feed | migration (expires_at), proposal RPC, accept check, reminder source | PG: accept after expiry refused; browser: reminder appears 7 days before |
| 2 | 04 | Server-side offer search and decision filter across all offers (today only loaded offers) | list RPC with query and decision args, indexes | PG: 200 offers, search returns the right rows; browser |
| 3 | 02 | Persisted company-research history per person | migration (private table, RLS owner-only), API list/delete, panel | PG isolation test; browser reload keeps history |
| 4 | 03 | Skills-gap suggestions and recommendation history | migration, API, panel | PG + unit for gap logic |
| 5 | 06 | Evidence correction request and revocation with a status on each document | migration (status, request table), API, UI | PG: only owner can revoke; history append-only |
| 6 | 07 | Skills and achievements in a shared Passport (field-controlled) | migration, share schema, Passport view | PG: unshared fields never returned |
| 7 | 09 | More dispute categories, confidential attachments, organization response | migration, reviewer-only attachment access, UI | PG isolation; real-stack journey |
| 8 | 10 | Cross-record hash chain; export of own event history | migration (chain column and verifier), export route | tamper test; export checksum test |
| 9 | 12 | Security-event log view for the person; account-deletion executor design (reviewed step) | read RPC, UI; executor needs owner decision on append-only records | PG + browser |
| 10 | 13 | Account moderation (suspend/restore with reason, audited) | capability-gated RPC, admin UI | PG: audit row per action, MFA gate |
| 11 | 22 | Admin overview of plans and wider usage metering | read RPC, console panel | PG + browser |
| 12 | 15 | Translate remaining English surfaces and server messages | catalog entries, tests | catalog pin tests |
| 13 | 08 | Recruiter accounts and role permissions beyond representative, team changes | migration, authority checks | PG + real-stack two-account |
| 14 | 17 | Correction procedure for a named party | migration, reviewer flow | PG + browser |
| 15 | 14 | Layout sweep result fixes, keyboard audit scripts | CSS, tests | route-sweep spec green |

## Blocked on the owner or an external party (not started, not faked)
- 19 Salary benchmarking: a licensed benchmark dataset. No invented figures.
- 01, 11 live AI for real data: policy approval (`ORYQEN_AI_APPROVAL_PROPOSAL.md`). Model-backed copilot waits for it.
- 02 other registries: API keys per registry.
- 06 hosted Storage upload proof: needs a signed-in hosted run. 18 production signing key: owner ceremony.
- 20 email and push: provider choice and sender domain. 21 delivery queue: worker or cron decision.
- 16 other countries: legal sources and counsel. 15 native review. 22 payments: optional provider.
- Legal pages: `ORYQEN_LEGAL_DECISIONS.md`.
