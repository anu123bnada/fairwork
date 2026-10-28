# ORYQEN AI processing — approval proposal (28 Oct 2026)

Status: **PROPOSAL. Nothing in it is approved or enabled.** Live AI stays off (`ORYQEN_AI_ENABLED=false`, `ORYQEN_AI_POLICY_APPROVED=false`) until the owner approves this in writing. Until then the application only uses synthetic text for any provider test.

## What would be sent
Employment text a signed-in person chooses to analyse: pasted offer or contract text, OCR output, answers to questions. It can contain names, pay, employer details and addresses. The gateway already redacts, requires the person's per-use consent, pins the policy by hash, and keeps no content in the audit trail.

## Proposed configuration (Preview branch `release/oryqen-oct27` only)
| Item | Proposed value | Why |
|---|---|---|
| Provider | `gemini` (Gemini Developer API, `generativelanguage.googleapis.com`) | Already integrated and tested through the real provider code |
| Model | `gemini-3.1-flash-lite` | The only model that produced a validated structured answer on 28 Oct (SUCCESS in 13 s). The configured `gemini-3.8-flash` answered 503 overloaded the same day |
| Billing tier | **Paid tier** (Cloud Billing linked to the project) | The pricing page lists paid-tier content as "not used to improve our products"; the free tier lists content as used to improve products. Private employment text must not go through the free tier |
| Region | **Not controllable on this API.** The Developer API has no region selector; Google may process and cache in any country where it or its agents operate. Vertex AI would allow a chosen region but needs a different adapter and a Google Cloud project | A region variable would only be a label, not a control |
| Retention | Abuse monitoring: prompts, context and output kept up to 55 days per Google's usage-policies page (checked 22 Oct; re-check before approval) | Cannot be turned off by ORYQEN |
| Per-person limits | Existing gateway budgets, breaker and daily ceilings; hard monthly spend cap set in Google Cloud billing | Bounds cost |

## Estimated cost (paid standard rates from Google's pricing page, 28 Oct)
`gemini-3.1-flash-lite`: $0.25 per 1M input tokens, $1.50 per 1M output tokens.
An offer analysis of about 4,000 input and 1,500 output tokens costs about $0.0033. 1,000 analyses cost about $3.25; 10,000 cost about $32.50. These are estimates from assumed token counts, not measured bills.
For comparison `gemini-3.8-flash` costs three times as much per token until 31 Dec 2026 and six times as much afterwards.

## Decisions only the owner can make
1. Accept that employment text leaves ORYQEN to Google, processed in unspecified countries, retained up to 55 days for abuse monitoring.
2. Confirm paid tier is active on the Google project (ORYQEN cannot see this) and set a monthly spend cap.
3. Choose: Developer API as proposed, or ask for a Vertex AI adapter to get a fixed region (extra work and a Google Cloud project).
4. Provide a written approval reference for `ORYQEN_AI_POLICY_APPROVAL_REF`.
5. Confirm the privacy notice shown to people (see `ORYQEN_LEGAL_DECISIONS.md`) says this.

## Values to set in Vercel yourself (never paste into chat)
`ORYQEN_AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.1-flash-lite`, `GEMINI_API_KEY` (mark Sensitive), `ORYQEN_AI_POLICY_APPROVAL_REF`, `ORYQEN_AI_PROCESSING_REGION` (state "provider-managed, not controllable"), `ORYQEN_AI_DATA_USE` (state "paid tier, not used for product improvement, up to 55 days abuse-monitoring retention"), then `ORYQEN_AI_POLICY_APPROVED=true` and `ORYQEN_AI_ENABLED=true`. Section I of `OWNER_ACTIONS.md` has the steps.

## After approval I will
Run one hosted analysis with synthetic text, confirm validated output, consent gating, budget limits, provider-failure fallback and data isolation, then report. No real person's data is used until you say so.
