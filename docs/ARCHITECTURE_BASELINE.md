# FAIRWORK architecture baseline

| Field | Approved value |
|---|---|
| Architecture version | **FAIRWORK-ARCH-1.0.0** |
| Approval status | **APPROVED — Stage 1 implementation baseline** |
| Approval date | **2026-10-07** |
| Accountable owner | FAIRWORK project owner, the requesting user and primary student developer/operator |
| Approval basis | Owner's request to close M-01/M-09 using the stated solo/free-tier/synthetic constraints; explicit approval of pre-provisioned email/password demo authentication |
| Implementation baseline | Documentation-only Git commit identified by immutable local tag **fairwork-architecture-v1.0.0** |
| Execution authorization | Architecture approved; this task stops before implementation. A subsequent explicit user instruction is required to start Stage 2 |

## Approved document set

The tagged commit contains these normative records:

- [FAIRWORK_MASTER_SPEC.md](FAIRWORK_MASTER_SPEC.md): product scope and single capability claim manifest.
- [ARCHITECTURE.md](ARCHITECTURE.md): topology and architecture decisions.
- [DATABASE.md](DATABASE.md): typed relations, invariants, RLS/grants and lifecycle.
- [AI_SYSTEM.md](AI_SYSTEM.md): future provider abstraction, consent and bounded processing; live AI excluded from this baseline.
- [API.md](API.md): command/RPC contract and allowlists; optional modules excluded.
- [SECURITY.md](SECURITY.md): threat model, privilege boundaries, testing and release obligations.
- [MVP_PLAN.md](MVP_PLAN.md): solo P0A scope, resolved D-01–D-10, schedule and pre-production gates.
- [ARCHITECTURE_REVIEW_RESOLUTION.md](ARCHITECTURE_REVIEW_RESOLUTION.md): disposition of all 26 findings, including final M-01/M-09 closure.
- [STAGE1_APPROVAL.md](STAGE1_APPROVAL.md) and this file: readiness, authority and baseline identity.

The same commit preserves [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) and [ARCHITECTURE_FINAL_VERIFICATION.md](ARCHITECTURE_FINAL_VERIFICATION.md) unchanged as historical independent evidence, and adds a baseline index to [README.md](../README.md). Their historical OPEN/NOT READY statements describe their inspection dates and are superseded only for M-01/M-09 by the resolution/approval records. Do not rewrite the independent reports to manufacture a favorable verdict. README's full lifecycle remains future vision; the master manifest and MVP_PLAN define the approved competition subset.

## Exact boundary and use

Resolve `git rev-parse fairwork-architecture-v1.0.0^{commit}` to identify the exact snapshot; inspect it with `git show fairwork-architecture-v1.0.0:docs/STAGE1_APPROVAL.md`. The tag is local until separately published; no remote push is part of this task. Before another agent or machine starts implementation, transfer/publish this exact commit and tag through an authorized action and verify that the documents match it. A dirty or newer working tree is not automatically approved. Never move or overwrite the baseline tag.

The immutable tag avoids embedding a commit's own hash inside files used to compute that hash. A copy/export of these documents is a convenience; Git is the durable implementation boundary. No application code, framework, migration, deployment or Figma change belongs to this baseline commit.

## Lightweight change rule

Keep architectural changes in an ordinary reviewed Git change: state the reason, affected contract/scope and validation in the existing document/resolution; update all affected specs together. Owner approval is required for changed scope, trust/privacy boundaries or operating assumptions. Implementation changes to trust contracts include matching migrations and meaningful tests in that change. Record a new baseline version/date and a new immutable tag when an approved architectural decision changes; never silently edit the old approval. Routine implementation following this baseline does not require a new architecture version. Runtime capability claims update only after implementation evidence exists.

The current user request governs this task. These documents describe future implementation obligations and do not themselves authorize an agent to start Stage 2.
