# Day 6 — record integrity contract

Local candidate, October 14, 2026. Deadline October 23, 19:00 Sri Lanka.
No standalone Day 6 plan existed. This reconciles the Day 5 handoff with the
new request: withdrawal/correction/eligibility and an owner-private Passport
are the vertical slice. Full assigned case adjudication, authority-fraud review,
skill certificates, file uploads and public/recipient sharing are not implemented
by this adapter. The earlier visual gates remain open, independently of function.

## Commands and permissions

- **Withdraw:** active record worker only, any current non-withdrawn revision,
  explicit 1–2000-character reason. Permanent for this root. Does not require
  current employer authority or an unchanged effective agreement: a worker must
  remain able to stop presenting their history after an employer departs.
  Former/current employer and other tenants cannot withdraw the worker's record.
- **Correct:** active worker only, explicit reason, new immutable revision through
  the existing Day 5 revise/reopen validator and current effective agreement basis.
  Preserves root parties, previous revision, evidence and decisions. Supersedes
  the old version atomically; no verification transfers. Same representative
  reapproval requires fresh agreement/work basis. Replacement needs new roots.
- **Retract verification:** only the exact original verifier, with current
  designated company authority and active participants, may retract a current
  verified decision with a reason. This appends an immutable invalidation and
  changes current presentation to invalidated. It is withdrawal of their own
  assertion, not adjudication of a dispute. Worker can withdraw their record;
  they cannot impersonate the verifier. Correction plus fresh verification is
  required to regain eligibility. No command deletes/reinstates an invalidation.

Every command compares exact version/state/content/evidence hashes, reauthorizes
replays, returns an immutable actor-scoped receipt and commits audit atomically.
No client actor/company/status/timestamp is accepted. Old direct work RPC paths
must also reject withdrawn roots; new guards cannot be bypassed by old clients.

## Transaction order and retention

Existing write lock order remains participant rows, membership, agreement key 4,
work key 5. Withdrawal uses only worker eligibility, then agreement/work locks;
it never waits for consent from the representative. Corrections and retractions
use the full participant/current-authority order. Concurrent conflicting commands
serialize and compare the locked current version. Identical replay returns the
same receipt; changed input/key reuse conflicts. Reads do not imply a still-valid
snapshot after another transaction commits; reloading reevaluates eligibility.

Withdrawal and invalidation rows reference exact immutable versions/decisions.
History retains original payload, evidence owner/time, verification reason/actor/
time, correction relationship and withdrawal/retraction reason. Historical
verification is always labeled historical when its version is no longer current.
Private audit stores action, IDs and changed-field names, not evidence/reasons.
Reasons are in private participant-authorized integrity records.

## Authority changes

Revocation/expiry immediately denies new representative access/actions. Ordinary
departure does not rewrite a truthful historical decision: eligibility checks the
exact immutable approval at the DB-stamped verification time, not current tenure.
Owner withdrawal remains possible. A retraction, correction or withdrawal suppresses
eligibility regardless of that historical approval. Full fraud-case policy and
review assignment are prerequisites to future external disclosure; private history
must not be marketed as legal employer verification or reviewed skill evidence.

## Compatibility

Use one forward migration; preserve all eight earlier files. Additive integrity
RPC/HTTP adapter returns a reasoned receipt. Existing revise/reopen remains valid
and still atomically supersedes previous verification; the UI uses the new
reasoned correction path. Private Passport initialization is an explicit owner
command, not a write hidden in GET. Entries are a live projection of persistent
eligible work, not a copied client-maintained verification flag.
