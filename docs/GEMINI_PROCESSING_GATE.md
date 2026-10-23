# Gemini processing gate — October 18, 2026

## October 22 superseding diagnostic evidence

Latest bounded generation (separate founder approval, now exhausted):
`gemini-3.8-flash`, selected from the already saved successful model list, returned
**HTTP 400 INVALID_ARGUMENT in 11,032 ms**. One POST, timeout 25 seconds, no retry,
fallback or metadata call. Valid provider error JSON; no quota error, valid
analysis or genuinely generated analysis. Evidence:
`test-results/gemini-listed-generation-result.json`. The harness passed because
it completed the bounded diagnostic, **not because generation succeeded**.
The application model, flags and .env.local were unchanged. Only isolated test
configuration selected this model; the real provider client performed the call.

The endpoint, resource-name construction, x-goog-api-key mechanism and current
responseFormat schema configuration were compared with the saved list and
official GenerateContent reference. No confirmed construction defect was found.
The sanitized error classification did not identify the rejected argument; the
raw error was discarded, so its exact cause remains unknown. Do not label this
as invalid credentials, a quota failure or a working integration. Any further
live diagnosis needs separate explicit approval; production processing approval
is independent and remains absent.

Credential and model are configured locally. App-wide enablement and production
policy approval remain false. No .env.local edits were made by the agent.
The old `^AIza[A-Za-z0-9_-]{35}$` diagnostic was an unjustified legacy heuristic,
not an application validator or official universal Gemini credential requirement.
It must not be used to reject authorization keys. Local UTF-8 parsing, exact
loaded-value equality and absence of hidden characters/overrides were verified
without revealing credentials. A regression now accepts opaque synthetic keys.

Separately authorized, exhausted requests:
- Earlier metadata/generation: HTTP 401; no analysis.
- One fictional generation on `gemini-2.5-flash`: HTTP 404 `NOT_FOUND`, 1,080 ms;
  valid error JSON, no generated analysis or quota error.
- One model-list request: HTTP 200, 1,005 ms, valid JSON, no subsequent pages.
  Returned `gemini-2.5-flash` with `generateContent` support. This establishes
  successful authentication for listing, not successful generation. No offer
  data was included. No retries, fallback or model/configuration changes.

Evidence: `test-results/gemini-single-generation-result.json` and
`test-results/gemini-approved-model-list-result.json` (no raw error bodies/keys).
All live-test approvals are exhausted. A further generation needs new approval.
The raw 404 error body was not retained, so a more specific cause cannot be
recovered from that evidence. Do not claim credential invalidity or account
exclusion on the basis of the 404 alone.

Public documentation checked October 22:
- [GenerateContent](https://ai.google.dev/api/generate-content) matches the
  configured POST `v1beta/models/{model}:generateContent` endpoint. The current
  `responseFormat.text` JSON-schema mechanism is documented; no speculative
  switch to an older schema API was made.
- [Model availability](https://ai.google.dev/gemini-api/docs/deprecations) limits
  2.5 access to prior users; this is a possible context, not a confirmed cause.
  The actual model-list result above includes the configured model.
- [API keys](https://ai.google.dev/gemini-api/docs/api-key) documents authorization
  keys and `x-goog-api-key`. Native fetch uses that header, fixed host, no redirects,
  server-only credentials and a 25-second timeout. No universal prefix/length is
  enforced. HTTP 404 messaging now describes the missing resource without
  asserting that the account lacks access.

Historical statements below about absent keys/no requests apply only to October 18.

**BLOCKED for live employment data.** Owner selected Gemini as primary but has not
approved processing region or retention. No provider call, billing activation or
purchase has occurred. The current adapter uses **Gemini Developer API** at
generativelanguage.googleapis.com, not Vertex AI. A region label in an environment
variable is disclosure, not a routing control.

Verified primary-source findings:

- The [Developer API terms](https://ai.google.dev/gemini-api/terms) distinguish paid
  and unpaid services. Unpaid input/output can be used for product/model improvement
  and human review. Paid-service terms restrict product improvement use but permit
  limited abuse-monitoring retention and storage/caching in countries where Google
  or its agents operate. ORYQEN's account/project tier has **not** been verified.
- [Abuse-monitoring documentation](https://ai.google.dev/gemini-api/docs/usage-policies)
  currently specifies 55 days for prompts, context and output. Its policy-enforcement
  exception also needs review against the owner's no-training requirement.
- Google's [ZDR guidance](https://ai.google.dev/gemini-api/docs/zdr) directs workloads
  requiring guaranteed zero retention/enterprise agreements to Vertex AI. It also
  describes implicit in-memory caching. No zero-retention claim is justified here.
- [Logs and datasets](https://ai.google.dev/gemini-api/docs/logs-datasets) are a separate
  project setting. Do not enable Generate Content logging or share datasets containing
  employment information. No account setting was inspected or changed.
- [Available regions](https://ai.google.dev/gemini-api/docs/available-regions) describe
  service availability, not ORYQEN processing residency. Even the separate Cloud
  [endpoint guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations)
  warns that an endpoint alone does not establish residency/in-region processing.
- The same Developer API terms restrict API clients directed at or likely to be
  accessed by under-18s. ORYQEN's intended user eligibility and account enforcement
  must be checked before activation; this task does not silently change signup policy.

Server-only configuration names: `GEMINI_API_KEY` (legacy `GOOGLE_API_KEY` supported),
`GEMINI_MODEL`, `ORYQEN_AI_PROVIDER`, `ORYQEN_AI_ENABLED`,
`ORYQEN_AI_PROCESSING_REGION`, `ORYQEN_AI_DATA_USE`,
`ORYQEN_AI_POLICY_APPROVED`, `ORYQEN_AI_POLICY_APPROVAL_REF`.
Keep both enablement/approval flags false or unset pending approval. No credential
belongs in NEXT_PUBLIC variables, Android assets, logs or committed files. Existing
`.env.local` was not modified. OpenAI remains an explicitly selected alternative;
there is no automatic provider fallback.

Implemented: authenticated/profile-scoped route; durable quotas; exact provider,
model, disclosure, approval and redaction-version consent hash; server redaction;
outbound preview; one fixed-host provider request; 25-second timeout; 3,000 output
token ceiling; structured schema and exact-quote validation; safe errors; no tools,
HTTP redirects or Next request caching;
file uploads, grounding, explicit caching or conversation-state API. Private output
is reauthorized after the provider returns. Redaction is heuristic, not guaranteed
anonymization; unlabeled names/prose can remain. Users must inspect/minimize text.

Next owner action: identify the actual project/product/tier and applicable contract;
verify model availability, logging/caching controls, processing guarantees and
retention exceptions; approve the precise policy and costs separately. If Developer
API terms cannot meet the requirement, assess a separately authorized Vertex AI
adapter/account. Do not pretend an API-key endpoint implements regional controls.
After explicit approval and local key configuration, run a synthetic-only live smoke
test first, then review evidence before authorizing any personal employment data.

Verification: 15 focused mocked-provider/redaction/auth tests passed, including
redirect configuration, timeouts, malformed output and post-response authorization.
Consent-preview browser test and production build/typecheck passed. These checks
do not establish live model availability, provider retention or regional guarantees.
