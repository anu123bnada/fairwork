# Turn on real AI for ORYQEN (step by step, plain language)

Why this is not already on: AI analysis sends a person's offer text to Google. The code refuses to do that until the site owner (you) has set the settings below, which is your written confirmation that this is allowed. Nothing in this guide is done for you, because the key and the approval must come from you. **Never paste the key into chat, git, or a document.** You type it only into the two websites named below.

Technical background: `ORYQEN_AI_GATEWAY.md` and `ORYQEN_GEMINI_ACTIVATION.md`. What exists today: AI is used for **offer analysis only**. There is no AI chatbot, career analysis, or AI CV writing; the Help assistant and Private guidance are rules-based by design.

## Before you start: read these three points
1. **Privacy.** Google's terms for its free Gemini API tier may allow submitted text to be used to improve Google's products. Check Google's current "Gemini API additional terms" before letting visitors, and especially students, paste real offers. For a public event the safer choice is to leave AI **off** (the rules-based analysis works) or to tell people clearly to paste only made-up text. Each person is also asked for consent inside the app before anything is sent, and nothing is sent without it.
2. **Quota.** The free tier ran out of quota (HTTP 429) or was overloaded (503) when tested on 27 and 28 Oct 2026. If that happens the app shows "AI unavailable until <time>" and the rules-based analysis keeps working. Free quota will not serve thousands of visitors; set the daily limits in step 4.
3. **Who approves.** The settings below say "the owner approved this in writing". The person who is responsible for the Google account and for the visitors' data should be the one who decides and enters them.

## Step 1: create a Gemini key (Google)
1. Go to **aistudio.google.com** and sign in with the Google account that should own the key.
2. Choose **Get API key**, then **Create API key**. Copy it somewhere private for the next two minutes only.
3. Look at the list of models in AI Studio and pick one whose name starts with `gemini-` (on 28 Oct, `gemini-3.1-flash-lite` answered and `gemini-3.8-flash` was overloaded; names change, so use one AI Studio shows today). The app refuses a model name that does not start with `gemini-`.

## Step 2: find the right Vercel project
1. Go to **vercel.com** and open your team.
2. You have two projects (`oryqen` and `fairwork`). Open the one that lists **oryqen-staging.vercel.app** under **Settings, then Domains**.

## Step 3: add the settings
In that project open **Settings, then Environment Variables**. Add each row (name exactly as written). For the environments, tick **Production** and **Preview**, because your staging address may be served by either.

| Name | Value to enter | Secret? |
|---|---|---|
| `GEMINI_API_KEY` | the key from step 1 | **yes, mark Sensitive** |
| `GEMINI_MODEL` | the model name from step 1, for example `gemini-3.1-flash-lite` | no |
| `ORYQEN_AI_PROVIDER` | `gemini` | no |
| `ORYQEN_AI_ENABLED` | `true` | no |
| `ORYQEN_AI_POLICY_APPROVED` | `true` (this is your approval: only set it if you really approve) | no |
| `ORYQEN_AI_POLICY_APPROVAL_REF` | a short note of your approval, 10 to 200 characters, for example `Owner approval 2026-11-09 for the ORYQEN demo, consent per user` | no |
| `ORYQEN_AI_PROCESSING_REGION` | where Google processes it, up to 120 characters; write what Google's terms say, or `Google Gemini API (Google-chosen region)` if you are unsure | no |
| `ORYQEN_AI_DATA_USE` | up to 1000 characters describing how the text is used, copied from Google's terms for the tier you use, for example `Offer text is sent to Google's Gemini API only after the person consents; see Google's Gemini API terms for retention and use.` | no |

## Step 4: protect against runaway use (recommended)
Add two more rows so a busy day cannot burn your quota or money:

| Name | Value |
|---|---|
| `ORYQEN_AI_GEMINI_DAILY_REQUESTS` | `200` (or lower) |
| `ORYQEN_AI_GEMINI_DAILY_TOKENS` | `400000` (or lower) |

The app also has its own limits: 100 requests a day for the whole platform, and 10 a day and 3 a minute for each account.

## Step 5: redeploy
Settings changes only take effect on a new deployment. In Vercel open **Deployments**, find the latest one for your staging branch, press the three dots, and choose **Redeploy**. Wait for it to finish.

## Step 6: check it
- **In the app (30 seconds):** sign in, open **Add offer**. The box "Optional AI suggestions" should now show a consent request naming Google, instead of "Live AI is unavailable". Do not consent with real data.
- **With the test script:** run `node scripts/test-hosted-worker-journeys.mjs https://oryqen-staging.vercel.app` in the Terminal and type the staging email and password at the prompts (or ask the assistant to start it). Step 3 reports `AI is ON (provider gemini, model ..., region ...)`. It sends no text and uses no AI quota.
- **If it still says unavailable:** one of the settings is missing or invalid (the model name must start with `gemini-`, the approval note must be 10 to 200 characters, region at most 120, data-use at most 1000). Check the spelling of each name, redeploy again, and re-run the check.

## Turning it off again (any time)
Set `ORYQEN_AI_ENABLED` to `false` (or delete it) and redeploy. The rules-based analysis, CV Builder, Passport and everything else keep working.

## What is still not AI, even with this on
The Help assistant, Private guidance, CV Builder, company research and recommendations are rules-based and stay that way. A real AI chat assistant, AI career analysis and an AI Challenge Arena are **not built**; each would need its own consent notice and tests (`ORYQEN_AI_PROVIDERS.md`).
