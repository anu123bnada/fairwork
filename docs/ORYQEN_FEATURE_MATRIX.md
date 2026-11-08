# ORYQEN feature matrix (updated 7 November 2026)

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

| 15 | Smart CV Builder | IMPLEMENTED_UNVERIFIED | `src/components/fairwork/cv-builder.tsx`, `src/features/cv`, `/api/v1/cv` | ready / ready / ready (migration applied to staging 8 Nov) | owner-only RLS, strict validation | PGlite 5, unit 4, browser 4 (fixtures), real-stack harness (local) | deployed to staging 8 Nov; signed-in hosted use not yet verified; no AI writing, no cover letters; English labels only |
| 16 | Security activity log | IMPLEMENTED_UNVERIFIED | `/api/v1/security-events`, Settings panel | ready / ready / ready (migration applied to staging 8 Nov) | owner-only | PGlite 4, browser 2, real-stack | deployed to staging 8 Nov; signed-in hosted use not yet verified |
| 17 | Saved-listing history | IMPLEMENTED_UNVERIFIED | `/api/v1/opportunities/history`, Opportunities panel | ready / ready / ready (migration applied to staging 8 Nov) | owner-only, minimal snapshot | PGlite 4, browser 2, real-stack | deployed to staging 8 Nov; signed-in hosted use not yet verified |
| 18 | Passport print to PDF | IMPLEMENTED_UNVERIFIED | Passport screen | n/a / ready / n/a | re-authorized read | browser 1 (fixture) | browser-printed copy, not a signed PDF |
| 19 | AI Challenge Arena | NOT_IMPLEMENTED | none | none | none | none | needs design, admin authoring, human review and AI approval |
| 20 | AI career analysis, AI CV writing, AI mentor | NOT_IMPLEMENTED | rules-based guidance only | none | none | none | needs owner AI approval and per-feature consent notices (`ORYQEN_AI_PROVIDERS.md`) |
| 21 | LinkedIn connection | NOT_IMPLEMENTED | none | none | none | official API reviewed 6 Nov (`ORYQEN_LINKEDIN.md`) | adult-created developer app; no experience import without a partner program |
| 22 | Paid plans and billing | NOT_IMPLEMENTED | entitlements only (no billing) | partial | operator assignment | unit, real PG | provider, legal text, adult account holder (`ORYQEN_COMMERCIAL_LAUNCH.md`) |
| 23 | Help assistant (rules-based, not AI) | IMPLEMENTED_UNVERIFIED | `src/components/fairwork/help-assistant.tsx`, `src/features/help/knowledge.ts`, `/app/help` | n/a / ready / n/a (no database, no network, nothing stored) | none needed: it cannot read any record | unit 5, browser 3 (fixtures), CI 651 E2E passed | English only; answers only from a written guide; NOT an AI chatbot (real AI chat needs `ORYQEN_AI_SETUP_STEPS.md` and is not built) |
Latest recorded gates: see `ORYQEN_TESTING.md`: `tsc`, lint, full vitest (1055 passed), `next build` and the real-stack harness (263/263, local) pass; the full Playwright E2E is **not passing** (F-47, intermittent, host memory); hosted tier 2, Android device and live Gemini are NOT RUN.
Not run this session: Playwright E2E, real-stack harness, hosted smoke test, Android build. Treat those as UNVERIFIED until run.
No domain is VERIFIED_COMPLETE for exhibition-as-production; hosted verification is a separate, owner-approved step.
