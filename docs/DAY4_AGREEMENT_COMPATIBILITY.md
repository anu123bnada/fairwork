# Development Day 4 — compatibility contract

Implementation started October 14, 2026 (Asia/Colombo). This is a local contract,
not evidence of deployment. The user's Day 4 attachment authorizes implementation
while Day 3 visual gate D3-13 remains open, superseding the older entry gate.

## Compatibility matrix

| Existing Day 3 | Day 4 treatment |
|---|---|
| Immutable `day3_offers` and version/hash | Exact source retained. New versions are created through the existing offer editor; no raw upload or fabricated extraction. |
| Five generated questions | All questions of the selected revision are explicitly shared when the worker proposes. No other offer revision is shared. |
| Immutable attributed answers | Freeze answer ID, question ID, text, author and database time; hash the complete snapshot. Missing required answers block proposal. Answers never silently resolve missing terms. |
| Worker and company | Derived from the source, never accepted as authority claims. Only that worker creates/amends/proposes. |
| Employer-created source's representative | May be explicitly selected for a new agreement, subject to current company authority. Membership alone is insufficient. |
| Private worker source without representative | Worker explicitly designates an approved independent representative on a new agreement. Counterparty sees only the proposed projection, never the private source API. |
| Legacy confirmation and effective pointer | Remain readable and unchanged. Never imported as Day 4 consent or used as a Work Record evidence basis. |
| `/api/v1/agreements` legacy GET/POST | Preserved. Add `/api/v1/agreement-workflows` for strict versioned commands/reads to avoid changing the occupied legacy endpoint. |
| Legacy `get_agreement` RPC | Preserved. New `agreement_workflow` and `read_agreement_workflow` RPCs use a fixed discriminated command union. No arbitrary operation/SQL dispatch. |

## Canonical content and consent

`agreement-terms.v1` uses stable field IDs from API.md §6. The adapter maps
salary/currency/hoursPerWeek/startDate/responsibilities and matching optional
source fields to those IDs. Missing or invalid values remain explicit unresolved
items; no default salary basis, period, benefits or legal terms are invented.
Hours period is `week` only when a valid `hoursPerWeek` value supplies it.
All extra source fields remain in the frozen source snapshot and hash.

The database freezes source ID/version/hash, typed canonical terms, unresolved
items, shared questions, exact answers, worker, company, representative and
current authority decision. Canonical serialization is PostgreSQL JSONB text,
UTF-8 SHA-256; arrays are sorted by stable identifier. Clients only echo hashes.
The separate unresolved-set hash covers sorted item IDs and is included in each
acknowledgement. Each participant must submit that exact set, with no duplicates.
An acknowledgement records awareness, not resolution or legal sufficiency.

Version content is immutable even in draft. A changed source, answer snapshot or
renewed authority requires a new version and fresh acknowledgements/decisions.
Replacing the representative requires a **new agreement**; no confirmation is
inherited. Amendment preserves the last effective version until a new version
earns two independent confirmations. Decline is terminal for that version.

## State and concurrency

Stored states: draft → proposed → confirmed/declined; an abandoned proposal or
replaced effective version becomes superseded. Read status derives
`awaiting_answers`, `ready_for_review`, `awaiting_acknowledgements`,
`awaiting_confirmations`, `effective`, `declined`, or `revision_conflict`.
Disputes are not implemented and are not represented as successful operations.

Commands compare exact version, content hash and stored state. Acknowledgements
are separate from confirmation. Confirmation requires the actor's persisted
acknowledgement plus the same submitted exact set. Role derives from JWT identity.
Two participants can acknowledge the same immutable version without one
invalidating the other's expected version. Root locks serialize decisions and
pointer changes; the source lock intersects existing offer/answer commands and
membership lock intersects the existing authority command. Replays reauthorize,
return immutable command receipts and never repeat mutations/audit events.

Participant reads return only authorized versions, independent acknowledgement
and decision receipts, current proposal and effective context. A URL contains
only an identifier and confers no access. No private source text or directory is
exposed. Revoked/suspended participants cannot write; former representatives lose
read access. Current authority is evaluated again on each command.

## Deliberate scope reconciliation

- The route/RPC names are additive compatibility adapters rather than replacing
  the Day 3 paths listed in API.md. All required operations remain explicit.
- Terms are edited through the existing authoritative offer revision command,
  then frozen by create/amend; there is no second competing terms editor.
- All generated source questions are shared as one explicit proposal set.
  Arbitrary subset sharing/custom questions are outside this implemented adapter.
- Real PostgreSQL multi-connection tests, hosted sessions, exact Figma parity and
  Android installation remain separate evidence gates; local simulation cannot
  satisfy them.

Implementation and verification status belongs in `DAY4_COMPLETION.md`.
