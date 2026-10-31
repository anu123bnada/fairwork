# Gemini live activation checklist

Status: implemented and tested with fake providers; live generation passed once with synthetic text on `gemini-3.1-flash-lite` (28 Oct, historical). Real-user processing is OFF. This session made no provider call.
Design: `docs/ORYQEN_AI_GATEWAY.md`. Code: `src/server/ai/` (`config.ts`, `provider.ts`, `gateway.ts`, `consent.ts`, `breaker.ts`, `failure.ts`).

## Environment variables (names only; set in Vercel, never in git or chat)
| Name | Purpose |
|---|---|
| `GEMINI_API_KEY` | server-side credential |
| `GEMINI_MODEL` | a model from the provider's own list; current evidence favours `gemini-3.5-flash` or `gemini-3.1-flash-lite` |
| `ORYQEN_AI_PROVIDER` | `gemini` |
| `ORYQEN_AI_ENABLED` | `true` only after approval |
| `ORYQEN_AI_POLICY_APPROVED` | `true` only after the owner's written approval |
| `ORYQEN_AI_POLICY_APPROVAL_REF` | reference to that approval (10-200 chars) |
| `ORYQEN_AI_PROCESSING_REGION` | e.g. the provider region terms accepted |
| `ORYQEN_AI_DATA_USE` | retention and data-use statement |
| `ORYQEN_AI_FALLBACK_PROVIDERS` | optional backups; each needs its own approval variables |
| `ORYQEN_AI_<PROVIDER>_DAILY_REQUESTS`, `_DAILY_TOKENS` | optional budgets |

## Safety controls already in code
Consent per person and per provider bound to a policy hash; redaction; consent receipt written before any send; platform limit 100/day and 10/day, 3/min per account; quota (429) never retried; transient 5xx retried at most twice; timeouts (Gemini 35 s); strict output schema with exact-quote grounding; no content in audit or telemetry; deterministic fallback and explicit unavailable states.

## Activation steps
1. Owner decides the model and approves the policy in writing (decisions D3 and D4 in `OWNER_ACTIONS.md`).
2. Local presence check, no network: `node scripts/ai-readiness.mjs`. Expect `CONFIGURATION_PRESENT_NOT_LIVE_VERIFIED`.
3. Model availability, no user data: `node scripts/ai-health.mjs` (contacts the provider's model list; approval needed).
4. One synthetic generation through the real provider code: `npm run test:live:gemini` (contacts the paid API; approval needed per run).
5. Set the Vercel variables, redeploy staging, run a signed-in offer analysis with synthetic text.
6. Exhibition: keep AI approved only for the demo account, or leave it off and show the labelled deterministic analysis.

## Failure behaviour to rehearse
503 or overload: user sees an unavailable state with retry time; 429: provider paused for the hinted period; invalid output: rejected, not shown. In every case the deterministic analysis remains available.
