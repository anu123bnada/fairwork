# Verifying the signed-in application on staging without sharing passwords

Passwords never go to the assistant or into chat. Everything below runs on your machine; the assistant only reads the printed PASS/FAIL lines.

## Smallest exact owner action (about 10 minutes, no inbox needed)
1. Supabase dashboard (project `oryqen-staging`, `jpvgsmzomlmowarlfkdl`) > **Authentication > Users > Add user > Create new user**, tick **Auto Confirm User**, so no email is sent and no inbox is needed. Create two dedicated test accounts with addresses you control or that cannot receive mail (for example `oryqen-test-worker@example.test` and `oryqen-test-employer@example.test`) and passwords you do not use anywhere else. Write the passwords nowhere the assistant can read.
2. Run, in an interactive terminal in the repo folder, and type each password at the hidden prompt:
   ```powershell
   node scripts/test-hosted-worker-journeys.mjs https://oryqen-staging.vercel.app --email oryqen-test-worker@example.test
   ```
   It signs in through the real sign-in API, runs the signed-in worker journeys against staging, and signs out. It stores nothing.
3. Send me the printed lines (not the passwords). I count only what that output proves.

## What the script now exercises with one account
Sign-in, plan, offer analysis (must say AI is off), Evidence Vault upload/list/signed download/delete, **evidence correction notes, revoke and reinstate (module 06)**, **company-research history (module 02)**, job discovery, notifications, credentials, Developer API key, sign-out. Steps that need a second person or an operator capability print `NOT RUN` with the reason, never a pass.

## Two-account and operator journeys (agreements, expiry, disputes, recruiters)
These need the second test account plus capabilities on staging. Nothing is granted without you: if you want them verified, run the SQL for the capability you choose in the Supabase SQL editor for the **test accounts only** (I will write the exact statement for the specific journey and wait for your go-ahead), then tell me to extend the script. I will not insert users or capabilities into the staging database myself.

## What does not count as hosted verification
Layout sweeps with an intercepted identity, mocked API replies, local real-stack runs, and database tests. They are useful and are reported separately.

## Browser journeys (added by the release pass)
`node scripts/run-hosted-browser-journeys.mjs --email <test account>` signs in through the real sign-in page and drives the signed-in screens in a fresh browser context. Read-only by default (`--writes` adds one private draft, `--signout` adds a sign-out journey). See `docs/ORYQEN_RELEASE_VERIFICATION.md`.
