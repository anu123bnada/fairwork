# Offer indicators v1

Implemented October 22, 2026. Source of truth: `src/features/offer/assessment.ts`.

This is a deterministic product checklist, **not a calibrated fairness rating**.
It reports how many reviewed terms are stated without a configured explicit
concern. It does not measure salary adequacy, legal compliance, employer
legitimacy, factual accuracy or safety. These limits appear beside the score.
No Sri Lankan legal threshold or market-wage benchmark is invented.

## Calculation and evidence

Twenty criteria each contribute five points. Equal weights make the calculation
reproducible without pretending to have evidence for ranking one criterion above
another. Five categories each have a maximum of twenty:

| Category | Four criteria |
| --- | --- |
| Pay transparency | Amount, supported currency code, pay period, payment schedule |
| Working time and leave | Weekly hours, schedule, overtime, leave |
| Contract clarity | Role, responsibilities, employment type, duration |
| Worker protections | Trial/probation, notice/termination, safety, original documents |
| Financial commitments | Deductions, fees/deposits, benefits, other obligations |

Each criterion is `stated` (+5), `missing` (+0), `uncertain` (+0), or `concern`
(+0). The UI shows these counts separately. A zero for missing evidence is **not
a misconduct finding**. There are no green/red approval bands or accept/reject
recommendations. A score of 100 is not an assurance that an offer is fair.

Numbers must be explicit positive decimal values; weekly hours cannot exceed
168 (a physical bound, not a legal work limit). Currency currently supports the
explicit code list in the engine; unsupported codes are uncertain, not invalid
currencies. Period must be hourly/daily/weekly/monthly/yearly/project.
Unresolved placeholders such as TBD or "not specified" receive no points.

Scored concerns are deliberately narrow affirmative obligations at the start of
a reviewed field: required unpaid trial/training; mandatory uncompensated
overtime; surrender/retention of originals; business losses deducted from pay;
required fees/deposits. Each matched field is displayed verbatim as evidence.
Negated wording is not scored as a concern. Generic phrase warnings remain
separate and unscored because a phrase alone can be negated, quoted or ambiguous.
These rules can miss paraphrases, contradictions and harmful conditions; they
are not a semantic understanding engine. Free-text presence does not prove a
benefit exists or that its terms are favorable.

## Trust boundary and persistence

`GET /api/v1/offers/assessment?offerId=<uuid>` accepts only one offer ID. It uses
the existing authenticated `get_agreement` RPC, participant authorization and
RLS, then assesses its saved snapshot. Client scores, identities, AI claims and
employer verification flags are not accepted. Output is private/no-store and
bound to offer ID, revision, term hash and `offer-indicators.v1`.

The UI rejects a result for a different revision/hash and offers recovery on
failure. Reloading re-reads persisted terms. No new records or migrations are
needed; the assessment is derived, not an immutable historical decision receipt.
Future changes to criteria require a new engine version; do not label a future
recomputation as an original historical score.

The Add Offer screen also offers an explicit local preview using the same engine.
It requires no company membership, performs no network request and is labeled
unsaved. Editing any field hides the old preview until requested again. It does
not create a record or change the existing authorization requirements for saving.

Employer verification is explicitly `not_assessed`; use the separate scoped
organization/evidence workflow. AI observations cannot modify points. A user may
review suggestions and explicitly revise terms through the existing authorized
offer command, creating normal revision history.

Extraction preserves pay period/tax basis, schedule, leave, duration, document
requirements, deposits and employer name claims in editable fields. Names never
create a company or grant membership. Conflicting salary/hour figures and
duplicate contradictory labeled clauses remain unresolved. Suggestions only
fill blank controls; user corrections are preserved. Images use the existing
local OCR/review flow; arbitrary PDF/Word ingestion is not implemented.

## Production boundaries

Local Supabase uses real Auth, PostgreSQL and RLS; `FAIRWORK_DATA_MODE=synthetic`
is a policy gate, not a switch to mock persistence. `validateServerEnvironment`
currently rejects other modes. Do not change the environment to "production"
and expect real-data approval. Before a real-data mode is implemented/activated:

1. Approve real representative/evidence policy replacing synthetic
   `demo-authority.v1`, reviewer scope, retention and appeal procedures.
2. Establish a separately approved production environment and migration history;
   never transfer synthetic identities, memberships or verification claims.
3. Complete backup/isolated restore, HTTPS/Auth/email and least-privilege checks.
4. Review privacy/terms, provider processing and consent separately. Provider
   configuration is not proof of approved processing or regional guarantees.
5. Test two independent real authorized accounts, revocation, MFA and audit
   retention before traffic is enabled. Founder owner bootstrap remains separate.

Hosted activation and production mode remain NO-GO until these gates pass.
