# Day 1 verification backlog

Updated 2026-10-09 from the owner's explicit verification report. Day 1 is functionally ready; independent Day 2 work is authorized. This supersedes earlier instructions in Day 1 reports to block all Day 2 development.

Owner reports PASS: hosted migration history, RPC privilege security, all 16 hosted catalog checks, A/B authentication, profile reads and updates, idempotency/revision protection, cross-account isolation, authenticated RPC surface, browser and unauthenticated security checks.

| Outstanding check | Status | Completion evidence required |
| --- | --- | --- |
| Natural access-token expiry and application-driven refresh | PENDING; existing verification is running | Real expired-token rejection followed by application refresh, renewed cookie/token and unchanged identity |
| Fresh-account profile creation | PENDING; existing test accounts already have profiles | Two newly provisioned synthetic identities exercise first creation, replay, conflicts and isolation through the application and RPC boundary |

Neither outstanding check is claimed to have passed. Preserve the running expiry verifier and its server. No credential, token, MFA seed or password belongs in this report. Day 2 local tests cannot replace these hosted checks.
