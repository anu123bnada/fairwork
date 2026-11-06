# ORYQEN AI providers

Status: gateway **IMPLEMENTED_UNVERIFIED for real users** (fake-provider tests pass; one live synthetic-text call to Gemini passed on 28 Oct 2026; real-user processing is OFF). Details of the gateway: `ORYQEN_AI_GATEWAY.md`. Activation checklist: `ORYQEN_GEMINI_ACTIVATION.md`. This file is the provider-level summary and the plan for extending AI beyond offer analysis.

## What exists (verified in code, `src/server/ai/`)
- One server-side entry point (`gateway.ts`) with provider adapters: `gemini`, `openai`, and `selfhosted` (any server speaking the OpenAI chat-completions protocol). Adding another provider is one adapter plus one configuration entry. Nothing switches to a paid provider automatically; each provider needs its own written approval reference, region and data-use text.
- Consent per person and per provider, bound to that provider's policy hash; a durable receipt before any text leaves the server; redaction first.
- Limits: platform and per-account budgets in the database, optional per-provider daily budgets, timeouts (Gemini 35 s, OpenAI 25 s, self-hosted 60 s), at most two retries on transient faults, quota (429) never retried, a circuit breaker per provider.
- Structured output validated against a strict schema with exact-quote grounding; calculations, registry status, legal references and permission decisions are never taken from a model.
- Honest states: with AI disabled, unapproved or out of quota, the person sees that, and the labelled deterministic analysis keeps working.
- Admin "AI" panel shows each provider's state; `node scripts/ai-health.mjs` checks model availability without sending user data.

## What is NOT integrated yet
AI is used for **offer analysis only**. These are rules-based or absent and would each need a new consent notice and a new grounded schema on the same gateway: career analysis, CV writing help, challenge evaluation, the career mentor, company-research summaries, agreement analysis. None of them is claimed as AI-powered anywhere in the product.

## Free-provider claim
Not verified. The gateway can talk to a self-hosted model on a machine you control (this development machine has no GPU, so none was run). No free hosted tier has been tested for real use; the Gemini free tier hit quota (HTTP 429, then 503 overload) when probed on 27 and 28 Oct 2026.

## Rules for any future AI feature
1. Server-side calls only; keys never reach the browser, the Android app or logs.
2. Explicit consent naming the provider; no private employment documents, CVs or challenge files are sent without it; **no visitor submission is used for training**.
3. Structured, validated output; AI may improve wording but must never invent qualifications, employers, scores or completion records.
4. Every AI result is labelled AI-assessed and shows its basis and limits; consequential outcomes (for example a challenge score that appears on a Work Passport) need a human review path and an appeal.
5. A deterministic or "unavailable" state must exist for every AI feature.

## Owner decisions needed
Which provider(s) are approved for real user data, region and retention terms, the billing tier or budget, and whether to run a self-hosted model.
