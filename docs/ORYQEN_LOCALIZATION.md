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
