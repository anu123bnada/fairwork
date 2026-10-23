# FAIRWORK 2.0 — independent scan verification and local repair handoff

Date: 12 October 2026 (Asia/Colombo)  
Repository: `C:\Users\vehiv\Desktop\fairwork`  
Scope: the seven findings supplied in the referenced “vishion nex” conversation.

## Outcome

All seven findings are substantiated, with the qualifications below. This patch addresses the five priority defects and adds `.tmp/` to Git ignore rules. The cross-session agreement workflow remains incomplete, and existing implementation files remain untracked. Neither is represented as complete or deployment-ready.

Verification used a separate copy of the current working files, the repository's installed dependency versions, synthetic identities, in-memory PGlite databases and an isolated localhost browser server. The initial eight Day 3 database tests passed before changes. Five new security regressions failed against the original implementation. The final suite passes **99 unit/integration tests and 21 Chromium browser tests**. TypeScript, lint, and the isolated production build also pass.

No hosted migrations, hosted Supabase changes, deployment, commit, push, staging, reset, or cleanup of user files was performed. Credentials and `.env.local` were not copied into the verification workspace. Application of the patch is guarded by comparisons against the original file contents; a separate application receipt records the resulting repository checks.

## Finding-by-finding verification

| # | Finding and independent evidence | Resolution / remaining boundary |
|---|---|---|
| 1 | **Confirmed — bootstrap audit constraint.** Day 2 allows `bootstrap_capability`; Day 3 removed it. With an existing synthetic bootstrap audit event, the original migration failed at statement 16 with PostgreSQL `23514`. With no historical bootstrap event, a later bootstrap audit insert also failed. | The Day 3 constraint retains the action. The regression fixture now inserts a bootstrap audit event before migration and verifies another insertion afterward. Existing audit history is not deleted or rewritten. |
| 2 | **Confirmed — generated question UUIDs.** PostgreSQL accepted the raw MD5-shaped identifiers, but the actual Zod answer-request schema rejected a generated ID in the baseline regression. PostgreSQL's UUID type alone did not prove API compatibility. | Set explicit UUIDv8 version and RFC variant bits while retaining deterministic offer/revision/field identity. All five generated questions now pass the real answer schema and can be answered through the database RPC. Replay returns the same question IDs. |
| 3 | **Confirmed — representative substitution.** A second approved representative successfully confirmed the first representative's offer in the baseline reproduction. Current company membership did not identify the agreed participant. | Persist `representative_id`, derive it from the authenticated employer on the initial employer review, and freeze it across revisions. Worker amendments preserve it. Confirmation binds actor, company, worker, representative and the revision's authority decision. Self-representation, another representative, revocation and reuse of an old revision after reapproval are denied. |
| 4 | **Confirmed — displayed versus confirmed revision.** Code inspection showed `updateTerm` writing shared draft state, the agreement rendering that state, and confirmation sending the earlier saved `offer.version`. The RPC response also omitted its persisted snapshot, including on replay. | Both fresh review and replay return `snapshot` and `representativeId`. Home, analysis, check and agreement displays use saved terms. Missing saved terms disable confirmation. Saving a revision clears prior answers, confirmation state and agreement ID. Browser regressions prove rejected edits displaying 9999 cannot replace the saved 1200 displayed for revision 1; a saved revision 2 gets a new confirmation and agreement ID. |
| 5 | **Confirmed — executor RLS isolation.** An unrelated active identity could read other offers when the fixture ran as `fw_user_exec`. The baseline used only `private.is_active()` on all six Day 3 tables. **This was not a demonstrated anonymous/public table leak:** client table/schema privileges were already denied. | Scope offer visibility to the worker or designated currently authorized representative; scope child rows through the visible parent and receipts to their actor. Write policies check attribution and parent relationships; agreement writes also check saved terms hash and authority. All six tables are tested against unrelated and other-approved-representative identities, with additional forged-insert tests. Client table access remains denied. |
| 6 | **Confirmed — incomplete two-person UI workflow.** Offer and agreement routes expose commands, with no cross-session participant read endpoint. Product state is in React memory; refresh loses the loaded revision. The UI and existing documentation explicitly describe missing handoff and preview-only downstream modules. | **Open.** No invitation, lookup, sharing, work-record, passport or notification subsystem was added. Refresh fails closed rather than reconstructing an agreement from browser storage. Worker-created drafts have no explicit representative-designation contract and therefore cannot be confirmed. The UI states that limitation. |
| 7 | **Confirmed — repository protection.** The initial Git status showed the modified README and almost all implementation files as untracked, including `.tmp/`. The local `day3-offer-store.json` exists; the demo-store code persists account/offer state there. Its contents were not needed as test data. | Add `.tmp/` to `.gitignore`. The state file is preserved. Existing files are not staged or committed, so the untracked-source issue remains for an explicitly approved version-control step. Ignoring a path prevents normal accidental additions; it does not remove any earlier committed copy. |

## Security design and compatibility details

An employer-originated offer fixes one representative for its lifetime. Changing the worker, company or representative on an existing chain is rejected. Either participant may submit a new revision under the existing command contract; the representative's current authority decision is captured for that revision. Same-person reapproval requires a new revision and fresh confirmations. A different representative requires a new offer/agreement chain.

Worker-originated reviews remain usable as private drafts, but company membership is not used to guess their counterparty. Adding an explicit, consented representative-selection contract belongs to the missing participant workflow. This is a deliberate compatibility restriction: previously accepted unsafe confirmations now fail.

The additional revision trigger detects attempts to reuse a hidden offer ID or replace a chain's participants. Its security-definer owner is the existing non-login, non-bypass `fw_policy_exec` role. It receives SELECT on only five structural columns—offer ID, company, worker, representative and version—and no offer-content or write privilege. Its narrow read policy is separate from the six participant-scoped runtime policies. The trigger is not executable by client roles. Existing immutability, current-version, effective-pointer, idempotency, quota and audit tests continue to pass.

The effective-agreement guard now checks the designated representative's authority basis and the worker's attributed confirmation as well as the matching revision/hash. No service-role access, bypass-RLS role, public private-schema access or new exposed RPC was added.

This repairs the specified Day 3 slice. It does not certify all features described in the broader architecture documents, such as explicit acknowledged-item sets, source/answer reference binding or complete participant read projections.

## Changed files

Paths below are relative to the repository above. The accompanying patch contains the complete changes, including new files that normal `git diff` would omit while untracked.

| File | Change |
|---|---|
| `.gitignore` | Ignore local `.tmp/` state. |
| `supabase/migrations/202610100001_day3_offer_agreement.sql` | Bootstrap action, valid question UUIDs, frozen representative, participant/actor RLS, revision guard, authority binding, saved response snapshot. |
| `src/components/fairwork/product-app.tsx` | Saved-term displays, confirmation gates, revision-dependent state reset. |
| `scripts/day3-hosted-catalog.sql` | Expand to 12 checks; cover scoped policies, bootstrap compatibility and restricted revision guard. |
| `tests/integration/day3-security-regression.test.ts` | Nine new database regression cases, including migration with historical bootstrap data. |
| `tests/integration/day3-offer-db.test.ts` | Require 12 catalog PASS results instead of 10. |
| `tests/e2e/day3-revision-regression.spec.ts` | Four new browser regressions. |
| `tests/e2e/product-app.spec.ts` | Supply saved snapshot/representative in the mocked response contract. |
| `docs/DAY3_HOSTED_PREFLIGHT.md` | Update catalog count and retain outstanding hosted/product gates. |
| `docs/DAY3_SCAN_VERIFICATION_HANDOFF.md` | Repository copy of this handoff. |

The unused local demo store was left intact. The active offer/answer/agreement API routes call the Supabase RPC transport, not `src/server/offer-store.ts`.

## Verification results and limits

| Check | Result |
|---|---|
| Original Day 3 database suite | 8/8 passed before fixes, demonstrating its coverage gap. |
| Added baseline reproductions | 5/5 failed as expected: bootstrap insert, missing snapshot, UUID validation, representative substitution, executor isolation. |
| Original migration with bootstrap history | Failed as expected with `23514`; fixed migration accepts that history. |
| Final unit and integration suite | **99/99 passed**, 13 test files; `vitest run --maxWorkers=1`. |
| Final Day 3 database coverage | 17/17 passed across the original and new suites. |
| Local preflight/catalog | **10/10 preflight and 12/12 catalog** in synthetic PGlite. |
| Browser suite | **21/21 passed**, including four new revision/confirmation regressions. |
| TypeScript | Production-build TypeScript pass and separate `tsc --noEmit` pass. |
| Lint | `eslint . --max-warnings=0` passed. |
| Isolated production build | **Passed with webpack**, Supabase public settings blank and synthetic browser mode enabled. |

The default full test parallelism exhausted local memory; the clean single-worker run passed without errors. Turbopack could not resolve the temporary dependency junction outside the verification directory. The isolated browser runner used `next build --webpack`; repository build configuration was not changed. A successful default Turbopack build is therefore **not claimed**.

The browser tests mock successful application responses and exercise UI/command behavior. PGlite exercises SQL locally with synthetic JWT context. Neither proves a real two-session Supabase workflow, hosted PostgreSQL concurrency, natural token expiry, live MFA, hosted privileges or remote migration state. No hosted verification was attempted.

## Migration and next-owner handoff

The patch edits the existing Day 3 migration because repository documentation identifies it as pending and local. Its hosted application status was not rechecked. **Before any application, independently verify migration history. If this version has already been applied anywhere, do not replay or silently replace it: prepare a forward migration appropriate to that database's existing data.**

Final local Day 3 migration SHA-256:

`effcd3fe1aabca632f86f383c972a3d44efa4459a6de8c41ed6dafda365b62d6`

Remaining work, in order:

1. Review the patch and preservation receipt. The README and all unrelated tracked/untracked files must remain unchanged by this task; no Git index changes are intended.
2. Implement the participant workflow: explicit representative designation where needed, exact-participant authenticated read APIs, authoritative saved-revision loading, independent-session handoff and refresh/recovery. Do not treat a shared identifier as authorization or browser storage as authoritative terms.
3. Complete the downstream work-record/passport/sharing modules separately. Current previews remain previews.
4. When explicitly authorized, finish the existing hosted preflight/history/dry-run process and review the exact migration hash and recovery plan. Applying hosted migrations requires separate approval. After an approved application, require 12/12 catalog results plus synthetic participant, revocation and concurrency checks.
5. Retain the earlier Day 1/Day 2 live authentication, MFA, operator and expiry gates. Local passes do not close them.
6. Stage/commit/push implementation files only after explicit approval, with a deliberate review of untracked files and ignored local state.

The repository is safer with these fixes, but the full two-person product flow and hosted release remain open.
