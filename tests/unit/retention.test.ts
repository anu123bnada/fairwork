import { describe, expect, it } from "vitest";
import { retentionClasses } from "@/features/privacy/retention";
import { translate, type LocaleCode } from "@/i18n";

describe("retention statement", () => {
  it("covers each class once, keeps permanent records erasable only by request, and is translated", () => {
    expect(new Set(retentionClasses.map(item => item.id)).size).toBe(retentionClasses.length);
    expect(retentionClasses.find(item => item.id === "records")?.who).toBe("request");
    expect(retentionClasses.find(item => item.id === "recruiter")?.who).toBe("automatic");
    for (const item of retentionClasses) {
      const english = translate("en", item.key);
      expect(english).not.toBe(item.key);
      for (const locale of ["si", "ta", "de"] as LocaleCode[]) expect(translate(locale, item.key)).not.toBe(english);
    }
  });
  it("does not promise instant deletion of the whole account", () => {
    expect(translate("en", "rt.intro")).toMatch(/not instant/);
  });
});
