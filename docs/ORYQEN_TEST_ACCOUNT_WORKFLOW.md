# Verifying the signed-in application without sharing passwords

Passwords never go to the assistant or into chat. Two supported ways, both run on your own machine.

## A. Hosted journey script (staging)
1. In `https://oryqen-staging.vercel.app/register`, create a dedicated test account (an inbox you own) and confirm its email. Use a password you do not use anywhere else.
2. In the repo folder run:
   ```powershell
   node scripts/test-hosted-worker-journeys.mjs https://oryqen-staging.vercel.app --email <your test account>
   ```
   It asks for the password at a hidden prompt, signs in through the real sign-in page in a real browser, runs the signed-in worker journeys, and prints one PASS/FAIL/BLOCKED line per check. It stores nothing.
3. Send the printed lines. The assistant counts only what that output proves and fixes the failures.

## B. Second account and operator journeys
Journeys 2, 4, 6, 8, 9, 11 need a second test account and operator capabilities on staging. That is a hosted database grant the assistant is not authorised to make: if you want these verified, grant the capability yourself in the Supabase SQL editor for your own test account (document the statement in `OWNER_ACTIONS.md`) or approve a specific grant.

## What does not count
Layout sweeps with an intercepted identity, mocked API replies, and local real-stack runs are useful but are never reported as hosted verification.
