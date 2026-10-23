# Day 6 — private Passport eligibility v1

One database policy function is authoritative. React must never decide that an
ineligible work record is verified. Policy version: `private-work-passport.v1`.

An active authenticated worker may initialize one persistent private Passport.
No owner ID is accepted from clients. GET returns only their root and a bounded,
UUID-keyset-paginated projection (20 entries per page) of records satisfying ALL:

1. Record belongs to the authenticated worker; requested revision is its current
   revision and state is verified. Root is not withdrawn.
2. Exactly one independently attributed verified decision matches the typed
   worker/company/designated representative/authority basis and both hashes.
3. No immutable invalidation exists for that decision. Superseded/corrected,
   invalidated, disputed, rejected, draft, submitted and withdrawn versions cannot
   appear. Older verified receipts cannot rescue a nonverified current revision.
4. Agreement ID/revision/hash matches the frozen version; two independent exact
   agreement decisions/acknowledgements remain present. A later agreement revision
   does not silently retarget historical work.
5. The frozen approval is approve, for that exact company/representative, effective
   no later than the original verification time and expiring after it. Ordinary
   later revocation/expiry blocks actions but does not falsify prior work.
6. Canonical work/evidence hashes match the immutable snapshot. Private stored
   text evidence and provenance match that submitted evidence set.

Projection: work ID/version, role, period, hours, short work summary, company ID
and permitted name, agreement ID/version/hash/effectiveAt, verification receipt
ID/time/verifier/authority, evidence count and evidence-set hash. No raw evidence,
verification reason, salary, private offer source, contacts or storage paths.
Company name is a scoped label, not registry/legal verification. Record-detail
links lead to the existing authenticated participant endpoint; IDs grant no access.

No public endpoint, sharing token, recipient grant, public cache or anonymous
Passport exists. Existing share UI remains unavailable; it cannot expose the
new data. Owner initialization is persisted and idempotent. Entries are derived
on every read so withdrawal/correction/retraction takes effect without copying
or manually toggling Passport badges. Read consistency is normal PostgreSQL
statement snapshot semantics; a new request after a committed change suppresses it.

Future disclosure requires typed fraud/case eligibility, independent review,
owner curation, field registry, named-recipient scope and revocation tests.
This private adapter is not the broader DATABASE.md skill-assertion/sharing chain.
