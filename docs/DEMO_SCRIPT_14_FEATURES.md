# ORYQEN demonstration script: 14 working features

Runs on the **local** stack (nothing hosted). Everything shown is real: real Supabase Auth and PostgreSQL in Docker, real emails (read from the local mailbox), real data. Nothing is mocked and no AI answer is invented.

## Setup (once)
```bash
node scripts/run-local-development.mjs
```
App: http://127.0.0.1:3100. Mailbox for confirmation and reset emails: http://127.0.0.1:55424. Use four browser profiles or private windows: **Worker (W)**, **Employer representative (E)**, **Approver (A)** (a second person who approves the organization) and **Operator (O)**. Roles A and O need a one-day capability granted by the local seed (`scripts` for local authority) and an authenticator code; the automated run `node scripts/test-local-real-workflows.mjs --manage-app` does all of this and is the safe way to show the same journeys unattended (225 checks).

Say at the start: "Everything you will see is stored in a real database and enforced by row-level security. Where something needs a paid or approved service, it says so instead of pretending."

| # | Feature | Who | Steps | What the audience should see |
|---|---|---|---|---|
| 1 | Account and security | W | /register, create an account, open the confirmation email in the mailbox, click it, create the profile, sign out, sign in; Settings, add an authenticator; /forgot-password, use the email link, set a new password | No session before the email is confirmed; the reset link says it is single-use; replaying it shows "This link has expired" |
| 2 | Offer workspace | W | /app/add-offer, paste a job offer, save; open it, add a private note and attach a document; edit a term, open revision history; download the summary | Revisions are kept; the note and document are visible to W only |
| 3 | Offer analysis (no AI) | W | /app/check on the offer; try PDF and Word import; switch language to Sinhala, Tamil or German | A 20-point checklist from rules; with AI off it says so; nothing fabricated |
| 4 | Digital agreement | E, A, W | E creates an agreement from the offer; W acknowledges and confirms; try to make it effective with one confirmation; then confirm from both sides; compare two versions | One party cannot make it effective; both independent confirmations can |
| 5 | Evidence Vault | W | /app/work-record, upload a PDF pay slip, link it to a record, download it, try a renamed .exe, delete it | Checksummed file, a 60-second signed link, executables refused, deletion removes the file and its links |
| 6 | Work Passport | W, E | W records work; E verifies that exact revision; /app/passport shows it; /app/share, share two fields with E's colleague account, revoke | Only verified work appears; the recipient sees exactly the frozen fields; revoke cuts access at once |
| 7 | Verifiable credential | W | On the Passport, issue a credential; open its link in /verify; revoke; reload | Valid, then Revoked, publicly, with no personal data (local build uses a throwaway signing key) |
| 8 | Dispute and appeal | W, E, A | W opens a case on a record; the Passport entry is suppressed; E responds; an independent reviewer decides; W appeals | A reviewer who worked on the record is refused; one immutable decision |
| 9 | Organization portal | E, A, O | E requests an organization; A (independent) approves; E manages company claims; revoke E's membership | Authority only after independent approval; claims stay "unverified"; access disappears immediately on revoke |
| 10 | Job discovery | E, W | E publishes a listing; W sets preferences in /app/opportunities, saves two listings and compares them | Match reasons quote W's own preferences; pay in different currencies is not converted |
| 11 | Recruiter check and reports | W, E | W checks a recruiter; E confirms or disputes; W reports a suspicious listing; O reviews it | "Unverified" until the employer confirms; E never learns who asked; the reviewer never sees the reporter |
| 12 | Notifications and timeline | W | /app/notifications; mark one read; hide a category; open the Work Record screen for the timeline | Only authorised activity; reminders for expiring shares |
| 13 | Developer API | W | Settings > Developer access, create a key, verify a credential through the API with it, revoke the key | The key is shown once; usage is counted; a revoked key fails immediately |
| 14 | Plans | O, E | Show the free plan with no billing; O assigns the team plan; E publishes a sixth listing | Honest "no billing" statement; the limit is enforced and then lifted |

## Say plainly at the end
- 14 working journeys, each verified locally against real services. **None is verified on the hosted Supabase or Vercel yet.** The owner has pending approvals (see `OWNER_ACTIONS.md`).
- Not included: real-user AI (off until the owner approves the policy), salary benchmarks (no licensed data), a hosted file bucket, production signing keys, persistent webhook delivery.
