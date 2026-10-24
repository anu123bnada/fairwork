# Real runtime verification — 24 October 2026

Deadline: 27 October 2026 evening, Asia/Colombo. Release remains NO-GO.
This report separates current real-service observations from fixtures and older evidence.
All pre-existing working-tree changes and binaries are retained. No hosted writes,
deployment, push, publication, production AI enablement or secret disclosure occurred.

## Current observations

| Action | Expected | Actual and root cause | Repair / verification |
|---|---|---|---|
| Open local app / Supabase | Running isolated services | Ports 3100, 3102, 3000 and 55421 unreachable; Docker engine absent | Started existing Docker Desktop installation and guarded local app. Existing containers healthy; real sign-in UI renders on 3100. No reset or recreation. |
| Worker signup, email, profile, logout/login/reload | Real Auth session | PASS with actual local mail and Supabase; no route fixtures | Evidence below includes TOTP and unconfirmed-session denial. This does not prove SMTP delivery to an external inbox. |
| Employer confirmation test | Continue with workspace hint | Auth confirmation HTTP 200, but old test awaited an exact URL without query parameters | Harness now checks pathname and the intended employer destination; real rerun passed. |
| Local broad workflow | Complete current acceptance harness | 74 checks passed before missing `test-results/activation-plan/constraints-stage-6.sql` stopped execution | Restored missing isolated native test dependency; native PostgreSQL rehearsal passed 33 tests and regenerated the baseline. Subsequent retained queue exceeded one page; harness now follows cursors rather than deleting prior test records. Full rerun pending. |
| Hosted Auth settings | Email provider + confirmation | Fresh read-only HTTP 200; provider enabled, confirmation required, anonymous signup disabled | No configuration change. External inbox/session journey still unverified. |
| Hosted migration inventory | Match 32 local versions | Fresh read-only history has 30 versions; opportunity and guidance versions missing | No hosted migration applied. Version match alone does not verify migration contents. |
| Local configuration as hosted configuration | HTTPS canonical origin | Local APP_ORIGIN fails hosted HTTPS check | This is a local setting, not proof of the deployed environment's settings. |
| Gemini generation | Genuine validated structured analysis | One approved request on configured gemini-2.5-flash: HTTP 404 NOT_FOUND in 992 ms, no analysis | No retry/fallback; configuration unchanged. A second user-approved model lookup + one generation is tracked separately. |
| Provider diagnostic setup | One isolated test | Initial harness merged the ordinary suite and skipped .env.local under NODE_ENV=test; zero external requests | Config now replaces include; explicitly reads only credential/model settings. One-shot markers prevent accidental repeat calls. Initial ordinary regression result: 422 passed, 17 skipped. |
| AI result reload | Persist same generated result | Current AI UI holds response only in React state; endpoint returns response without saving it | Confirmed source-level gap, not a completed workflow. No generated result has been fabricated or saved. |
| Selected-model Gemini | Genuine output after fresh model lookup | Lookup HTTP 200; returned gemini-3.8-flash generation HTTP 400 INVALID_ARGUMENT, no analysis | Approved lookup plus generation exhausted. Added fixed-label argument-message diagnostics; no raw error text logged. Root cause still unresolved. |
| OpenAI response acceptance | Only complete bounded provider output accepted | Adapter previously parsed unbounded JSON without checking completion/refusal | Added 256 KiB response limit, strict single-candidate envelope, completion/refusal checks and regression tests. Offline verification only. |
| Windows shell | Preserved binary launches with sandbox | Fresh smoke passed launch, sandbox, resize, minimize, maximize and simulated offline page | Login/persistence still pending controlled hosted account; simulated offline event is not a real network-recovery test. |
| Android device | Connected authorized device | Fresh adb devices output empty | No Android runtime acceptance claimed. |

## Evidence

- `test-results/local-real-1792837553648/results.json`: initial real worker success; employer URL assertion failure.
- `test-results/local-real-1792837938098/results.json`: current broad local run, real services; stopped at missing constraint baseline.
- `test-results/hosted-auth-readiness-1792837235010.json`: fresh read-only hosted settings and 30/32 version reconciliation.
- `test-results/provider-diagnostics/oct24-user-approved-fictional-once.json`: zero requests, UNCONFIGURED setup failure.
- `test-results/provider-diagnostics/oct24-user-approved-fictional-network-once.json`: one genuine HTTP 404, no accepted analysis.
- `test-results/provider-diagnostics/oct24-approved-model-lookup-generation.json`: one genuine HTTP 400 after successful fresh model lookup.
- `test-results/day7-postgres-1792838807424/tests.log`: 33 native PostgreSQL checks passed; disposable server shut down normally.
- `test-results/desktop-smoke/results.json`: fresh shell smoke, no account acceptance.

Hosted read-only catalog inspection returned 59 private tables, all with FORCE
RLS, and zero direct authenticated table grants. This is configuration evidence,
not proof of every policy or RPC. All 32 local migrations are now applied to the
unlinked isolated development backend; only 30 remain on the hosted backend.

Owner subsequently authorized hosted synthetic workflow records; test email and
direct password/verification entry are still needed. This does not authorize
hosted schema/configuration changes or deployment.

## Acceptance status for all 14 modules

No module is production verified. Existing local implementation is preserved.

| # | Module | Current evidence / remaining gate |
|---|---|---|
| 1 | AI Employment Intelligence | BLOCKED: real generation failed; AI result persistence absent |
| 2 | Company Research | Real local claims/history/isolation pass; external verification incomplete |
| 3 | Opportunities | Local code/fixture coverage; hosted migration absent, real acceptance pending |
| 4 | Offers | Real local save, list, revision/assessment and isolation pass; full requested AI journey blocked |
| 5 | Digital Agreements | Real local two-party confirmation pass; hosted acceptance pending |
| 6 | Work Records | Real local record/independent verification pass; original-file storage incomplete |
| 7 | Passport | Real local eligibility/read/isolation pass; remaining sharing/revocation rerun pending |
| 8 | Employer Portal | Real local requests/independent approval/scoping pass; legitimate employer evidence policy pending |
| 9 | Disputes | Existing implementation; fresh full real case journey pending |
| 10 | Auditable Decisions | Real local history and catalog checks pass; constraint baseline and full tampering rerun pending |
| 11 | AI Assistant | Rules guidance only; not genuine AI; hosted migration absent |
| 12 | Security/Privacy | Real local session/MFA/role denials pass; full privacy and hosted acceptance pending |
| 13 | Admin Center | Real local unauthorized/self-promotion denials pass; privileged owner acceptance blocked |
| 14 | Cross-platform | Existing binaries preserved; fresh Windows/Android same-account persistence NOT VERIFIED |

The complete register → verify → login → offer → genuine AI → save → reload →
logout → login → retrieve workflow has NOT passed. Current local successes must
not be presented as hosted production or cross-device certification.
