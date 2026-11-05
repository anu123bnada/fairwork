# ORYQEN feature matrix (31 October 2026)

States: VERIFIED_COMPLETE, IMPLEMENTED_UNVERIFIED, PARTIAL, BLOCKED, NOT_IMPLEMENTED.
Per-module detail (built / missing / tests / blockers) lives in `ORYQEN_22_MODULE_ACCEPTANCE.md`; this file maps it to the 14 exhibition domains.
Evidence rule: unit, PGlite and browser-fixture tests prove no regression; they are not proof of hosted or live-provider readiness.

| # | Domain | State | Where | Backend / Frontend / DB | Authorization | Evidence | Remaining blockers |
|---|---|---|---|---|---|---|---|
| 1 | AI Employment Intelligence | PARTIAL | `src/features/offer`, `src/server/ai`, `src/components/fairwork/offer-intake.tsx` | ready / ready / ready | consent, redaction, policy flag | unit, PGlite; live Gemini passed once with synthetic text on `gemini-3.1-flash-lite` (28 Oct) | owner AI policy approval; stable model choice. Deterministic analysis is the labelled fallback |
| 2 | Company Research | PARTIAL | `src/features/research` | ready / ready / ready | per-user limits, SSRF-guarded fetch | unit, live GLEIF 3/3 | other registries need keys; no invented scores |
| 3 | Opportunities | PARTIAL | `src/components/fairwork/opportunities.tsx` | ready / ready / ready | RLS | unit, browser | no external live-job source; user-created records only |
| 4 | Offer management | PARTIAL | `src/components/fairwork/offer-drafts.tsx`, offers API | ready / ready / ready | RLS | unit, PGlite, browser | none known locally |
| 5 | Agreements | PARTIAL | agreement API and screens | ready / ready / ready | immutable versions | unit, PGlite + real PG | clause editing; no e-signature legal claim is made |
| 6 | Work records and evidence | PARTIAL | vault and work-record services | ready / ready / ready | owner-only RLS | unit, PGlite + real PG | hosted Storage bucket unverified |
| 7 | Work Passport | PARTIAL | passport API | ready / ready / ready | recipient-scoped | unit, real PG | signing key is owner-held; skills not in shared passport; **5 Nov: "Print or save as PDF" private copy added (browser print dialog, not a signed or server-generated PDF)** |
| 8 | Organization portal | PARTIAL | org and recruiter services | ready / ready / ready | independent approval | unit, real PG | role granularity |
| 9 | Disputes and appeals | PARTIAL | case services | ready / ready / ready | reviewer conflict checks, MFA | unit, real PG | org response workflow |
| 10 | Tamper-resistant records | PARTIAL | audit triggers, hash chain | ready / partial / ready | admin MFA | real PG tamper tests | not blockchain; wording must stay "append-only, hash-chained" |
| 11 | AI assistant | PARTIAL | rules-based copilot | ready / ready / ready | private, deletable | unit, browser | model-backed mode awaits AI approval |
| 12 | Security and privacy | PARTIAL | auth, RLS, quotas | ready / ready / ready | route audit | unit, real PG | passkeys; executing account deletion is a reviewed manual step |
| 13 | Admin control center | PARTIAL | admin console | ready / ready / ready | capability + MFA | unit, real PG | account moderation, monitoring |
| 14 | Web and Android | PARTIAL | `src/`, `mobile/poc` | n/a | n/a | build, axe, route matrix | physical-device acceptance; release signing key |

Latest local gates (31 Oct, commit `a0a4076`): `tsc --noEmit` pass; `npm run lint` pass (0 warnings); `vitest run` 154 files, 1038 passed, 17 skipped, 0 failed; `next build` pass.
Not run this session: Playwright E2E, real-stack harness, hosted smoke test, Android build. Treat those as UNVERIFIED until run.
No domain is VERIFIED_COMPLETE for exhibition-as-production; hosted verification is a separate, owner-approved step.
