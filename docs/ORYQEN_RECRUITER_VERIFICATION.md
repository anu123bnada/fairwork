# Recruiter Identity & Affiliation Verification

Part of the offer check (Check screen) and the employer workspace. It answers one narrow question: **what supports, contradicts or leaves open the claim that this named person represents this named employer?** It does not decide whether anyone is honest, and it never confirms who a person is.

## Three connected panels in the offer-check workflow

| Panel | Question | Where |
| --- | --- | --- |
| Company Intelligence | What do public sources say about the employer (GLEIF, cited, dated)? | Company research |
| Recruiter Verification | Does the employer vouch for this person? | Check screen (`RecruiterVerification`), employer workspace (`RecruiterEmployerPanel`) |
| Offer Intelligence | Are the offer's terms complete and fair? | Assessment, analysis, rule panels |

The panels share no hidden score. A recruiter result never changes the offer score, and the offer score never changes a recruiter result.

## What is stored, and what is not

Stored (private, 90 days, then purged): the claim the worker typed (recruiter name, employer name, optional role, email, site, posting and profile links, optional employer organization and registry id), an acknowledged notice version, and employer representative **decisions** (confirm with expiry of 1–180 days, dispute, withdraw), each with a reason and time. Claims are immutable; to correct one, delete it and make another. Limits: 20 live claims per person, 5 claimed domains per organization.

Never stored: any evidence outcome. DNS and file checks, registry lookups and email/posting comparisons are computed live on each view and carry their own observation time. A pasted message is judged in the browser and is never sent.

## Evidence model

Every item has an `area` (employer, domain, email, posting, profile, decision), a `source` (employer confirmation, live check, registry, supplied by the user, not checked), an `effect` (supports, contradicts, neutral, not checked), a time, and where applicable a source link. Items the user typed are labelled as such and are never proof. Anything that could not be checked is listed as such, with an `unresolved` list of what the person should do next.

The only authoritative statements are employer representative decisions. Everything else is context:

* **Domain control** — a representative claims a domain and publishes `oryqen-verification=<token>` as a DNS TXT at `_oryqen-verification.<domain>` or as `/.well-known/oryqen-verification.txt`. An email or posting on that domain counts as organization evidence only while control is observed.
* **Look-alikes** — a different registrable name within one character after folding (for example `rn`/`m`) or the same name under another top-level domain is flagged as a material contradiction.
* **Registry** — an optional linked GLEIF record is compared with the claimed employer name; a mismatch is shown, a match is not treated as proof the person works there.
* **Professional networks** — profile pages are never read (their terms forbid automated reading). The link is displayed for the person to open themselves.

## Status engine (deterministic, no model)

| Status | Meaning |
| --- | --- |
| Verified | A current employer representative confirmation exists and nothing material contradicts it. |
| Partially verified | Some supporting evidence (for example observed domain control and a matching email) but no current employer confirmation. |
| Unverified | Nothing supports the claim yet. This is not an accusation. |
| Conflicting evidence | An employer dispute, a look-alike, or a mismatch after an employer confirmed. |

## Privacy and abuse controls

* The requester is hidden from representatives; deciders are hidden from the requester (only counts, dated decisions and reasons are shown).
* Only approved representatives of the claimed organization can see or decide; others get an empty queue or 404 (RLS plus RPC checks, tested on PGlite and real PostgreSQL).
* Live fetches go through one public-address-only network module (`src/server/net/public-network.ts`) that blocks private, loopback and link-local addresses at connection time, with size, time and redirect limits; at most 20 outbound-fetching requests per minute per person.
* Cross-origin writes are refused; all writes are idempotent by key; the worker can delete a check at any time, which removes decisions with it.
* Wording is never accusatory: the UI uses "Unverified" and "Does not match", never "fake" or "scammer"; the e2e test asserts this.

## Honest limits

ORYQEN's organization approval is a demonstration policy, not verification of a legal entity, and the result says so. A confirmation proves only that an approved ORYQEN representative said so on a date. No identity document check, no phone or video verification, no scoring of recruiters. Hosted behaviour (DNS egress from the production host) is unverified.

## Tests

* `tests/unit/recruiter-verification.test.ts` (17): domain helpers, look-alikes, status engine, evidence builder with fake DNS/HTTP/registry, failure isolation.
* `tests/unit/recruiter-routes.test.ts` (5): origin, auth, validation, rate limit.
* `tests/integration/recruiter-verification-db.test.ts` (9): RLS, hiding, idempotency, expiry, purge, quotas — PGlite and real PostgreSQL.
* `tests/e2e/recruiter-verification.spec.ts` (2): notice gate, evidence display, local wording check, delete, translation, phone overflow.
* `scripts/local-recruiter-journey.mjs`: real Auth + PostgreSQL journey inside the real-stack harness.

Migration: `supabase/migrations/20261028140000_recruiter_verification.sql` (local only; hosted application needs owner approval).
