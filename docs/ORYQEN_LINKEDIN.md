# ORYQEN and LinkedIn

Status: **NOT_IMPLEMENTED** (nothing in the code talks to LinkedIn). Checked 6 Nov 2026 against LinkedIn's own developer documentation: [Getting Access to LinkedIn APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) and [Sign In with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2).

## What LinkedIn officially allows without special approval
Only "Open Permissions", enabled by a developer on their own LinkedIn developer application:

| Product | Permission | What it gives |
|---|---|---|
| Sign In with LinkedIn using OpenID Connect | `profile` | the member's name, headline and photo |
| Sign In with LinkedIn using OpenID Connect | `email` | the member's primary email address (the field is optional and can be missing) |
| Share on LinkedIn | `w_member_social` | post, comment and like on behalf of an authenticated member |

LinkedIn's own page says this sign-in does not verify a person's identity and must not be marketed as verification.

## What it does not allow
A member's work experience, education, skills or full profile are **not** in the open permissions. Everything else (Talent, Sales, Marketing, Learning) needs approval into a LinkedIn partner program, and the Compliance permissions are closed. So "import my LinkedIn experience" is **not available** to ORYQEN through an official API and must not be promised.

## What ORYQEN can honestly offer
1. **Optional "Connect LinkedIn" for name, headline, photo and email**, through OAuth with the `openid profile email` scopes. Shown in ORYQEN as **self-reported and imported from LinkedIn**, never as verified.
2. **Share a public portfolio link on LinkedIn** (`w_member_social`), only after an explicit tap by the person, never automatic posting.
3. **User-assisted alternatives that need no approval:** typing profile details, pasting text from LinkedIn, uploading a CV or a LinkedIn "Save to PDF" file the person exports themselves, and adding a public portfolio link.

## What ORYQEN will not do
Scrape LinkedIn, ask for a LinkedIn password, bypass OAuth, store tokens in the browser, log tokens, or present anything from LinkedIn as independently verified.

## Owner steps required before any code can be live (not done)
1. An adult account holder creates a LinkedIn developer application (LinkedIn's developer portal has asked for an associated LinkedIn Page; confirm the current requirement) and adds the two self-serve products.
2. Registers the redirect URLs (staging and production, https only).
3. Puts the client id and secret in the server environment only (never in git or chat): proposed names `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.
4. Reviews LinkedIn's API terms and brand rules for how the "Sign in" button and imported data may be shown.

## Proposed design when approved
Server-side authorization-code flow with `state` and PKCE; the token exchange happens only on the server; tokens are encrypted at rest and never sent to the browser; a "Disconnect" action revokes and deletes them; a consent screen lists exactly what is read; imported fields carry the label "imported from LinkedIn, not verified"; every connect and disconnect is audited. A fixture-free test would need a real developer application, so until then only the unit-testable parts (state and PKCE handling, token redaction, labels) can be proven locally.
