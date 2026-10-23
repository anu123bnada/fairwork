# Development Day 5 — agreement basis and scope

October 14, 2026. Local implementation contract; no hosted authorization.

The new user request expands DAY5_IMPLEMENTATION_PLAN beyond draft/version/submit
to persistent text evidence and independent verified/disputed/rejected decisions.
This expansion is implemented as one vertical slice. File uploads, skill issuance,
case adjudication, Passport curation and sharing remain separate. A disputed work
decision is a counterparty outcome, not a resolved trust case or legal finding.
API.md's confirm maps to `verified`; its dispute maps to `disputed`. Rejection is
an explicit additional terminal decision. Existing agreement contracts stay intact.
The original plan's skill references and API.md's atomic typed skill-evidence
issuance are not claimed by this text-evidence adapter: no reviewed taxonomy/task
mapping is available in this slice. Work decisions verify the complete narrative
record only. Typed skill mappings/assertions require the Day 6 eligibility contract.

## Authoritative basis

Each root fixes agreement ID, worker, employer company and designated independent
representative. Each immutable work revision has a composite FK to the exact
Day 4 agreement revision and its immutable authority decision. No legacy Day 3
confirmation qualifies. Commands derive parties from protected agreement rows;
clients can select an agreement/revision, never supply trusted parties or status.

Creation and new revisions require the agreement's current effective pointer,
confirmed state, two exact independent confirmations and corresponding exact
unresolved acknowledgements. `effectiveAt` is the latest database confirmation
timestamp. The frozen agreement hash and responsibilities define authorized scope;
the worker's role/tasks are claims for the representative to assess, not automatic
proof of matching scope. Missing agreement scope blocks creation. No skill claims
or legal sufficiency are inferred from text.

The work period is an inclusive pair of ISO dates, nonnegative decimal hours
bounded by the period's 24-hour capacity, role and task description. Future dates
cannot be submitted. If the agreement states valid start/end dates, the work must
fall within them. Historical reporting is permitted; agreement effectiveAt remains
visible and is never backdated to the claimed work period.

## Lifecycle, history and evidence

Create/edit appends an immutable draft. Submit freezes/shares the current version.
Only the exact independent designated representative may decide a submitted
version: verified, disputed or rejected. Worker cannot self-verify even if also
an approved company member. Decision includes exact content and evidence-set hashes,
reason and DB time. One decision per version. Worker may explicitly reopen any
current version into a new private draft; the previous version is superseded and
ceases to be eligible for future Passport projection. No decision is transferred.
Historical receipts and evidence remain readable to authorized participants.

Evidence consists of up to ten private text statements, with DB-generated IDs,
worker ownership, version FK, DB recordedAt and server-calculated hash. Saving a
new revision creates a fresh evidence set; unchanged statements are explicitly
resubmitted by the worker, not represented as independently observed artifacts.
Old sets are immutable. Removal/replacement is recorded by revision and audit;
submitted evidence cannot be edited in place. No uploads, public URLs, buckets or
client-selected storage paths exist in this slice.

## Amendments and authority

Pending newer agreement drafts/source revisions do not invalidate the retained
effective basis. A newly effective agreement revision blocks further commands on
old pending work until the worker creates a fresh work revision against the new
effective basis. Historical verified receipts retain their original basis; no
silent retargeting. Reapproval requires fresh agreement and work versions.
Representative replacement requires new roots, never reassignment.

All new actions recheck current exact authority and active participants. Former
representatives lose access; ordinary departure does not rewrite historical truth.
Future fraud/case/withdrawal controls must join Passport eligibility before any
disclosure or skill issuance is enabled.

## Transactions and transport

Lock order: active participant rows, company/representative membership, agreement
root advisory key (seed 4), work root advisory key (seed 5), root/version rows.
This intersects Day 4 decisions and authority revocation. Reauthorize retries,
then compare actor-scoped immutable request hash/receipt. Changed-key payloads,
stale version/hash/state/evidence-set and conflicting decisions fail atomically.
Audit contains action/IDs/changed-field names, never private evidence text.
FORCE RLS and narrowly granted SECURITY DEFINER RPCs retain existing executor
roles. Strict HTTP schemas, verified Supabase user, Origin checks, private/no-store.

## Work Passport v1 read contract (Day 6 dependency)

Private owner projection only: eligible current verified work with exact agreement
ID/revision/hash/effectiveAt; work ID/revision/hash/period/hours/tasks; immutable
verification receipt ID, designated verifier, company ID, authority decision and
verifiedAt; evidence IDs, owner, recordedAt and evidence-set hash. Text evidence is
not automatically disclosed. Exclude drafts, submitted, rejected, disputed and
superseded records. No percentage, skills, employer legal verification or public
sharing may be invented. Day 6 must add case/withdrawal/assertion eligibility and
explicit owner curation before implementing Passport UI or recipient disclosure.
