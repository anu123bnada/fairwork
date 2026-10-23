# Development Day 5 — exact starting task

Prepared October 14, 2026. **Historical starting plan.**

Implemented and expanded by the subsequent Day 5 user request; current scope and
evidence are in DAY5_AGREEMENT_BASIS.md and DAY5_COMPLETION.md. The text below
records the original sequence, not the current implementation status.
Deadline remains October 23, 19:00 Sri Lanka. Read `DAY4_COMPLETION.md` first;
carry the open visual gate, hosted migration approval and Android installation
gates explicitly. This plan does not authorize hosted operations.

1. **First implementation task: Work Record basis contract and deny tests.**
   Add `docs/DAY5_WORK_RECORD_CONTRACT.md` mapping API.md/Database.md to the new
   agreement tables. Define a typed FK basis `(agreement_id, version, worker_id,
   company_id, representative_id, authority_decision_id)` and server-computed
   content hash. A work command must recheck the root's effective pointer, two
   matching immutable decisions and acknowledgements, participant eligibility,
   current authority and future case eligibility under intersecting locks.
   Distinguish retained historical effective terms from a pending draft/proposal;
   a newer source alone must not rewrite the old confirmed contract. Never use
   the legacy `day3_effective_agreements` as Day 5 evidence authority.
2. **Add the next forward migration, preserving all seven existing files.**
   Create worker-owned `work_records` and immutable `work_record_versions` with
   same-parent current/previous pointers. Freeze the exact agreement basis,
   dates/tasks/skill references and designated representative. Draft is private;
   submit explicitly shares the frozen version. Representative replacement
   requires a new agreement/work root; reapproval requires fresh versions.
3. **Implement persistence APIs and strict DTOs.**
   `src/features/work/schema.ts`, `src/server/work.ts`, database transport types;
   create/read/list/version/submit routes from API.md. Apply actor-derived
   identity, expected revision/hash/state, audit+receipt+quota atomically;
   private/no-store and Origin checks. No client-issued trusted skills/status.
4. **Wire existing Work Record cards.**
   Real draft, save, submit, amendment, refresh/reopen and interruption retry.
   Preserve Figma assets and design. Keep evidence badges and Passport previews
   explicitly non-issued until the independent decision/issuance gates pass.
5. **Acceptance before claiming Day 5 complete.**
   Restricted-role and real PostgreSQL tests: wrong worker/company/version,
   pending/declined/legacy basis, wrong representative, expired/revoked/reapproved
   authority, stale hash, draft leakage, replay, submit/amend/revoke races and
   no partial audit/pointer writes. Browser tests must label fixture responses;
   re-run regression/typecheck/lint/build. Hosted and native tests stay separate.

After persistence passes, continue the existing sprint in
`NEXT_SPRINT_20261013.md`: independent work decision and private atomic evidence
issuance; then cases/withdrawal/correction; then private Passport curation and
named-recipient disclosure/revocation. Do not shortcut those into a badge toggle.
