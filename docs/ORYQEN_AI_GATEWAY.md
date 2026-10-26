# ORYQEN AI gateway

Status 28 Oct 2026: **implemented and unit-, SQL- and browser-tested with fake providers; live Gemini is blocked by the account's quota, and the OpenAI and self-hosted adapters have never been called against a real service** (no credentials exist for them here). Real-user AI processing remains **disabled** until the owner approves each provider in writing.

## What it does

One server-side entry point (`src/server/ai/gateway.ts`) analyses an offer by trying the person's consented providers in order.

| Concern | Behaviour |
|---|---|
| Providers | `gemini` (primary by default), `openai`, and `selfhosted` (any server that speaks the OpenAI chat-completions protocol, for example vLLM or Ollama, at an `https` address or a loopback address for local testing). Adding another is one adapter plus one configuration entry. |
| Approval | Per provider. The owner enables AI (`ORYQEN_AI_ENABLED`, `ORYQEN_AI_POLICY_APPROVED`) and gives each provider its own approval reference, processing region and data-use text (`ORYQEN_AI_<PROVIDER>_POLICY_APPROVAL_REF`, `_PROCESSING_REGION`, `_DATA_USE`). The unsuffixed names approve the primary only, so approving one provider never approves another. Each provider gets its own policy hash. |
| Consent | The person's consent names the primary and, optionally, backup providers, each bound to that provider's current policy hash. Text goes to a backup only if it is named and the hash is current. A stale hash skips it. |
| Receipts | Immediately before each provider is contacted, a durable consent receipt and budget admission is recorded (a hash of the redacted text, never the text). A refused receipt means nothing is sent. |
| Quota (HTTP 429) | The exact failure is classified without copying provider text. The provider's own pause hint (`Retry-After` or Google's `RetryInfo`) is read. The circuit breaker pauses that provider for the hint (at least 60 s, at most 24 h; 15 min if none was given). While paused, requests send nothing and consume no receipt. Quota is never retried automatically and keys or accounts are never rotated. |
| Transient faults | HTTP 500, 502, 503, 504, 529 and connection failures are retried up to twice (0.5 s, 1.5 s) inside the one consented request. Timeouts, quota, rejected credentials, blocked or invalid output are not retried. After three transient failures in a row the provider is paused for 60 s, doubling while probes fail. |
| Fallback | If the primary cannot answer and the person consented to a backup, the backup is tried (once, with the same bounded retries). If nobody can answer the person sees an explicit unavailable or quota state with the earliest known retry time and which providers were tried. Nothing is queued: the text is not kept, so there is no retention to control. Deterministic checks and manual review keep working. |
| Budgets | Optional per-provider daily request and token budgets (`ORYQEN_AI_<PROVIDER>_DAILY_REQUESTS`, `_DAILY_TOKENS`). A provider over budget is skipped without any request. The database also keeps its platform and per-account limits (100 a day for the platform, 10 a day and 3 a minute for each account); a fallback attempt consumes its own receipt. |
| Output | Structured JSON, validated against the strict schema, with exact-quote and number grounding. Company existence, registration, legal compliance and salary fairness are never taken from a model. |
| Timeouts | Gemini 35 s, OpenAI 25 s, self-hosted 60 s; redirects are refused; responses are size-limited before parsing. |
| Availability | `node scripts/ai-health.mjs` asks each configured provider whether the model exists and can generate text. It sends no user data and does not use generation quota. On 28 Oct 2026 it reported the configured Gemini model as available even though generation requests were quota-exhausted: model availability and quota are separate facts. |
| Monitoring | The administrator "AI" panel lists each provider's state (available, paused, over budget), pause reason, retry time and today's attempts, successes, failures by kind and tokens. Telemetry records attempts and outcomes per provider without content. The state is held in each server process's memory; a serverless platform may run several instances, so each keeps its own view. |
| Secrets | Keys are read only on the server. They are never sent to the browser, Electron or Android bundles, logged, or returned. |

## Where AI is and is not used

Built and integrated: **offer analysis** (consent-gated, grounded extraction and risk signals).
Deliberately not delegated to a model: calculations (pay normalization, leave arithmetic), identity and registry status, legal-source references, authorization and permission decisions, credential and recruiter verification states.
Not integrated: AI summaries of company research, agreement analysis, career matching, work-history interpretation and a conversational copilot all remain rules-based. Each would be a new consent notice and a new grounded schema on top of this gateway; none was added in this batch.

## Database change

`20261028100000_ai_gateway_providers.sql` removes a latent defect: the original consent receipt allowed exactly one model name per provider (`gpt-4o-mini`, `gemini-2.5-flash`), so any other model the owner configured, such as the current `gemini-3.x` models, would have been refused by the database even after written approval. The model is now any safe identifier, and `selfhosted` is an allowed provider. Receipts stay append-only. Tested on PGlite in `admin-db.test.ts`.

## Owner decisions still needed

Which providers (if any besides Gemini) are approved for real user data, with their regions and retention terms; the Gemini quota or billing tier; whether to run a self-hosted model (this machine has no GPU, so none was run); daily budgets.
