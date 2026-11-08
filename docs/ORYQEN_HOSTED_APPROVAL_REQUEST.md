# Hosted staging verification: single approval request

Status: **NOT APPROVED. Nothing in this file has been run.** Tier 1 (anonymous, read-only) already ran on 1 Nov 2026: 24 PASS, 0 FAIL, 5 WARN.

## What is requested
One approval for the following, on `https://oryqen-staging.vercel.app` and its Supabase project `oryqen-staging` only. Production and the `Fairwork` project are never touched.

| Item | Detail |
|---|---|
| Environment | Hosted staging (Vercel + Supabase `oryqen-staging`) |
| Writes | **Yes.** Auth users; one private offer draft; one synthetic PDF in `evidence-vault` (the script deletes it again); one private opportunity preference; audit and telemetry rows. |
| Accounts created | **Two** staging-only synthetic accounts (A and B), each registered once. Needs two mailboxes you control (for example plus-addressed) so you can click the confirmation emails. |
| Credentials | You type each password at the hidden prompt of the scripts in your own terminal. I never see, receive or store them. No keys, OTPs or connection strings go into chat. |
| Files uploaded | One generated, non-personal PDF of a few dozen bytes. |
| Scripts used | `scripts/test-hosted-worker-journeys.mjs` (account A: sign-in, offer persistence, vault upload and signed download, then deletes the PDF), `scripts/run-hosted-browser-journeys.mjs --writes` (browser journeys), `scripts/verify-hosted-realtime.mjs` (A and B channel isolation, no writes). Read-only `verify-hosted-staging.mjs` and `verify-hosted-rendering.mjs` are rerun. |
| Not covered | Passport sharing between A and B and agreements need a second approved person or operator capability; the scripts report these as NOT RUN. The local real-stack harness is the evidence for them. |
| Backup first | `node scripts/backup-staging-logical.mjs` (reads staging through the linked Supabase CLI, writes git-ignored `backups/`). Needs the CLI already linked, which is your login, not mine. |
| Cleanup | The PDF and developer key are removed by the scripts. The two accounts and any offer draft are left in place as labelled synthetic data unless you delete them in the Supabase dashboard (Authentication, Users). No bulk delete is performed by me. |
| Risks | Staging data changes; confirmation emails go to your mailboxes; a failed run can leave an offer draft or an unconfirmed user; staging is shared with anyone who has its URL, so accounts must use throwaway passwords. No paid API is called (AI stays OFF; the deterministic analysis is what is tested). |

## How the run goes if approved
1. You run the backup command and the three scripts in your terminal, typing passwords at the prompts.
2. You paste only the PASS/FAIL output (the scripts print nothing secret).
3. I record the dated result in `ORYQEN_TESTING.md` and fix any genuine defect found.

## Decline
If declined, hosted tiers stay NOT RUN and the exhibition relies on the local real-stack evidence (see `ORYQEN_TESTING.md`), with the hosted gap stated plainly.
