import { describe, expect, it } from "vitest";
import { translate, type LocaleCode, type MessageKey } from "@/i18n";

// Some screens build a key from data (a status, a field name). The compiler cannot check those, so this pins every family:
// each member must exist in English and be translated, not left as an English copy, in the three other languages.
const families: Record<string, string[]> = {
  "cr.s.": ["valid", "revoked", "expired", "unknown"],
  "as.st.": ["stated", "missing", "uncertain", "concern"],
  "as.ex.": ["stated", "missing", "uncertain", "concern"],
  "ag.st.": ["ready_for_review", "awaiting_answers", "awaiting_acknowledgements", "awaiting_confirmations", "effective", "declined", "superseded", "revision_conflict"],
  "cs.reason.": ["work_inaccurate", "evidence_integrity", "verification_conflict", "suspected_fraud"],
  "sh.f.": ["task_summary", "observation_date", "evidence_kind", "confirmation_method", "authority_assurance", "verification_status"],
  "ai.out.": ["success", "quota", "paused", "budget", "configuration", "model", "unavailable", "network", "timeout", "incomplete", "blocked", "invalid", "consent_stale"],
  "ai.name.": ["gemini", "openai", "selfhosted", "fallback"],
  "rv.status.": ["verified", "partial", "unverified", "conflicting"],
  "re.d.": ["confirm", "dispute", "withdraw"],
  "rp.c.": ["fee_request", "impersonation", "fake_listing", "harassment", "data_misuse", "other"],
  "adm.n.": ["dashboard", "search", "users", "organizations", "requests", "offers", "agreements", "work", "shares", "cases", "privacy", "ai", "roles", "settings", "incidents", "evidence_access", "audit", "telemetry"],
  "agc.c.": ["same", "changed", "added", "removed"],
  "tl.state.": ["draft", "submitted", "verified", "disputed", "rejected", "superseded", "withdrawn", "invalidated"],
  "rp.s.": ["received", "reviewing", "needs_information", "closed_actioned", "closed_no_action", "withdrawn"],
};
const sameInAllLanguages = new Set(["ai.name.gemini", "ai.name.openai"]); // product names

describe("data-built translation keys", () => {
  for (const [prefix, members] of Object.entries(families)) {
    it(`${prefix}* is complete in every language`, () => {
      for (const member of members) {
        const key = `${prefix}${member}` as MessageKey;
        const english = translate("en", key);
        expect(english, `${key} missing in English`).not.toBe("");
        expect(english, `${key} is not a catalog key`).not.toBe(key);
        for (const locale of ["si", "ta", "de"] as LocaleCode[]) {
          const text = translate(locale, key);
          expect(text.length, `${locale} ${key}`).toBeGreaterThan(0);
          if (!sameInAllLanguages.has(key)) expect(text, `${locale} ${key} is still English`).not.toBe(english);
        }
      }
    });
  }
});
