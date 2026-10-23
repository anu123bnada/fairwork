# Day 7 — typed work-case review contract

October 15, 2026. Deadline October 23, 19:00 Sri Lanka. Local candidate only.
The latest request authorizes the case vertical slice while carried Day 3–6
visual gates stay open. The Day 6 plan's denial-first, typed targets, independent
review and live suppression requirements remain authoritative. No skill issuance,
authority-wide fraud cascade, public sharing or automatic AI findings are added.

## Target, permissions and disclosure

- A case targets one immutable `(work_id, version)` and its exact content/evidence
  hashes. Only the active worker or currently authorized designated representative
  can open it against the current, explicitly submitted revision. Reporter is
  derived from verified identity. Private drafts, foreign tenants and stale bases
  are denied. Reason codes: `work_inaccurate`, `evidence_integrity`,
  `verification_conflict`, `suspected_fraud`. These are allegations, not findings.
- An existing protected `review_operator` capability plus aal2 assigns/revokes a
  reviewer. No runtime capability-grant API or global administrator is introduced.
  Operator lists expose only assignment-target metadata, not reasons/evidence.
- Candidate needs active `reviewer` capability, cannot be worker, representative,
  reporter or assigning operator, and cannot have a company-membership history
  with the record's employer. This conservative rule excludes former colleagues.
  Off-platform relationships cannot be inferred: explicit no-conflict acceptance
  is required; false acceptance refuses/revokes access. A real independent human
  is still required for real adjudication; synthetic actors prove software only.
- Assigned reviewer needs current capability, aal2, active profile, unexpired and
  unrevoked assignment and explicit acceptance to see the exact target's text
  evidence or resolve. Before acceptance, only assignment metadata is visible.
  No access to other revisions, raw offer source, unrelated work or profiles.
  Capability/assignment expiry or revocation removes access immediately on reread.
- Participants retain their existing scoped history rights. Other users cannot
  discover the case. IDs and links do not grant access. Lists are keyset bounded.

## State, receipts and decisions

Case status is `open` or `resolved`; assignment readiness is separate. Opening,
assignment, acceptance/refusal, assignment revocation and resolution append an
immutable event and advance optimistic case revision. Commands use actor-scoped
idempotency keys and immutable request/result receipts; replays reauthorize.
One open case per work root and one immutable resolution per case. Every resolution
records exact assignment/reviewer, outcome, rationale and DB time. Payload/target,
events, receipts and decisions cannot be edited or deleted by runtime roles.

Outcomes: `dismiss`, `uphold`, `correction_required`. Reviewers supply a rationale;
no automatic punitive decision or AI trust classification exists. Resolution can
refer to its frozen historical revision even if a correction has since been made;
it never silently retargets to the new revision. Case revision guards prevent
competing or stale decisions. New work verification is blocked while any case on
the root is open. Corrections/withdrawal remain possible and preserve history.

## Suppression and boundaries

The Day 6 authoritative eligibility function retains all existing checks and adds:
any open case on the work root suppresses every revision, including a correction;
an upheld/correction-required resolution permanently suppresses its exact version.
Dismiss removes only its own open-case block. It cannot resurrect withdrawn,
superseded, retracted, rejected, unverified or previously terminally suppressed
history. A corrected new revision requires fresh independent work verification
after the case closes; resolution itself never verifies work.

No appeal mutation exists in this slice. A later case cannot overturn an immutable
terminal resolution. Formal appeals need same-target linkage, disqualified prior
resolvers and a separately tested policy; do not model appeals as editing findings.
Authority-wide cases, agreement cases, skill assertions and recipient disclosure
remain later gates. `suspected_fraud` here concerns the named work revision only.

## Locks, authority and execution

Lock active participant/actor/candidate profiles in UUID order, relevant capability
rows, company membership keys in UUID order, then agreement key 4, work key 5 and
case key 6. Assignment/capability changes intersect these locks; clock-time expiry
is rechecked after waiting. Work verification wrappers use the same work lock to
serialize against opening a case. No broad service-role client or bypass-RLS
executor. New `fw_review_exec` is NOLOGIN/NOBYPASSRLS with only case-family rights;
policy helper sees metadata only. Private case tables use FORCE RLS and explicit
client revokes. Existing participant policies remain intact.

Capability row locking requires `UPDATE(subject_id)` plus an UPDATE USING policy
for the policy executor. Its WITH CHECK is **false** and the existing immutable
capability trigger remains: this permits SELECT FOR SHARE, not capability changes.
The observed revocation race failed without that lock policy and passes with it.
Revocation after a completed read cannot erase already viewed information; fresh
reads and decisions reauthorize. Runtime roles cannot grant their own capability.

Private audit stores IDs/action/changed-field names, not reasons or raw evidence.
Reason/rationale live in participant/accepted-reviewer-authorized case records.
Strict API fields, verified nonanonymous identity, same-origin mutations, private
no-store responses, quotas and bounded reauthenticated retry follow existing APIs.

Transport: POST `/api/v1/work-cases` accepts `open`, `assign`, `accept`, `revoke`,
or `decide`. GET with one `caseId` returns authorized details, exact evidence,
resolution and the immutable ordered event history. GET with optional `workId`
and `cursor` lists at most 20 accessible cases. A reviewer’s false declaration is
recorded as `refuse`; subsequent receipt replay is denied after access revocation.
GET is read-only except existing rate accounting. API outputs are strict DTOs.
Lists are bounded; per-case event history currently returns all events. Pagination
and measured load limits are required before production-scale use.

UI: `/app/cases`, Settings → Case review, or Work Record → Report or review a
concern. An operator enters an independently provisioned reviewer ID; the server
checks capability, conflicts and expiry. The existing authenticator setup route
is linked. This does not provision a reviewer or simulate a real human decision.
Case IDs survive sign-in through a validated, fixed local destination; no arbitrary
redirect is accepted. Existing Figma surfaces are reused; no supplied exact Case
Review reference exists, so visual parity is not asserted.

Next migration after the nine inspected files:
`202610150001_work_case_review.sql`. Earlier migrations stay unchanged. Hosted
application, provisioning, deployment, commit and push require separate approval.
