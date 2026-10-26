# ORYQEN localization and jurisdiction notes

## What exists (26 Oct 2026)

- `src/i18n/messages.ts`: typed catalog. English defines every key (22 today). Sinhala (`si`), Tamil
  (`ta`) and German (`de`) may omit keys; a missing key falls back to the English string (never to the key).
- `src/i18n/index.ts`: `translate`, `coverage`, `untranslatedKeys`, `LOCALES` with status `complete`
  (English), `partial` (Sinhala, Tamil) and `preview` (German).
- `src/i18n/use-i18n.ts`: the user's choice is stored in the device's local storage (`oryqen.locale`),
  falls back to memory when storage is blocked, and sets `<html lang>`.
- `src/i18n/format.ts`: locale-aware dates, date-times with time zones, currencies; pay-period
  normalization with stated assumptions; currency comparison that refuses to proceed without a dated,
  sourced exchange rate.
- UI: language switcher in Settings; the onboarding language screen now applies the choice.

## What is translated

Bottom navigation, Settings title and subtitle, the language screen, and the headings and main
controls of the newer panels (employer research, employment history, self-reported skills, team
roster, saved analysis history). **Everything else remains English.** The switcher shows the count
as a plain sentence ("Only 22 interface strings are translated so far; most screens remain in English"), never as a percentage of the product.

## Quality caveat

The Sinhala, Tamil and German strings are machine-assisted drafts written without native-speaker
review. Each locale shows a note saying so. They must be reviewed before any claim of language
support. Sinhala and Tamil rendering was checked in Chromium on Windows (system fonts); Android
WebView font availability is not verified.

## Not done

Server-side language preference (the profile `locale` column and identity RPCs accept only `en`; a
reviewed migration is required), localized notifications and emails, international phone and
address formats, right-to-left support (not needed for these four languages).

## Adding a language

Add a `Partial<Messages>` object in `messages.ts`, register it in `LOCALES` and `CATALOG`, translate
at least the navigation keys, and check `coverage(code)` and the browser test. Do not claim support
in product copy beyond what `coverage` reports.

## Jurisdiction references (module 16)

`src/features/jurisdiction/references.ts` holds rules only with primary-source wording, URL,
retrieval date and scope. Supported: Germany (Arbeitszeitgesetz §3 daily working time, §4 rest breaks;
text from gesetze-im-internet.de, retrieved 2026-10-26, an unofficial consolidation that shows no
"as of" date). Sri Lanka is listed as `source_unavailable` with the reason: the Department of
Labour site could not be read (expired certificate) and the Parliament copy retrieved was only the
2024 amendment. Every other country shows a limitation. References older than 180 days are flagged
for re-verification. The check compares figures the user already has; it never concludes that an
employer broke the law.

## Update 26 Oct 2026: home dashboard

The signed-in home dashboard is translated in Sinhala, Tamil and German (28 new keys, about 50 per locale). A phone-width browser test checks each locale for the translated greeting, offer prompt, passport card, hint and links, absence of raw keys, and no horizontal overflow; the Sinhala screenshot was reviewed and renders correctly. Panels below the dashboard (saved offers, work records, company information) and the Check flow are still English, and every non-English string remains an **unreviewed machine-assisted draft** that needs native-speaker review before release.

## Update 27 Oct 2026: saved offers, company research, vault and plan panels

The saved-offers panel, the company research panel (including registry field labels, finding kinds, date formats and country names taken from the browser's own locale data), the Evidence Vault headings and the plan panel are translated. `tests/e2e/localized-panels.spec.ts` checks each language at phone width for translated headings, labels and results, no leftover keys, no overflow, and writes screenshots. Still English: the Check flow, work records, agreements, cases, registration, error messages from the server and the research limitation sentences returned by the server. All non-English strings remain unreviewed drafts.

## Update 27 Oct 2026: work record screen, pay comparison, reminders

The work record screen (summary, list, empty state, details, review, withdrawal, retraction and the entry form) is translated; `tests/e2e/localized-work-record.spec.ts` checks the empty state, form and record details in Sinhala, Tamil and German at phone width, and the Sinhala screenshot was reviewed. The English note about evidence storage was corrected to say that Evidence Vault documents are separate and not yet attached to records. About 220 strings per language are drafts awaiting native review.

Offer check and questions screens (27 Oct 2026): translated, with browser tests in si, ta and de at phone width. Field names inside the text handed to the local rules stay English on purpose: the rules read English field names, so translating that text would silently disable them. The question sentences returned by the server are English.
