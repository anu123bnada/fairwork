import { afterEach, describe, expect, it, vi } from "vitest";
import { errorMessages, type ErrorCode } from "@/lib/errors";
import { translate, type MessageKey } from "@/i18n";
import { de, en, si, ta } from "@/i18n/messages";
import { ApiRequestError } from "@/features/authority/client";

const codes = Object.keys(errorMessages) as ErrorCode[];
afterEach(() => vi.unstubAllGlobals());

describe("server messages in the person's language", () => {
  it("has an English catalog entry identical to the server message, and a translation in every other language, for every error code", () => {
    for (const code of codes) {
      const key = `err.${code}` as MessageKey;
      expect(en[key], code).toBe(errorMessages[code]);
      for (const [name, catalog] of [["si", si], ["ta", ta], ["de", de]] as const) expect(catalog[key], `${name} ${code}`).toBeTruthy();
      expect(de[key]).not.toBe(errorMessages[code]);
    }
  });
  it("keeps placeholders out of error messages, since none are filled in", () => {
    for (const code of codes) expect(translate("de", `err.${code}` as MessageKey)).not.toMatch(/\{\w+\}/);
  });
  it("shows an ApiRequestError in the stored language, and in English when nothing is stored", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "de" } });
    expect(new ApiRequestError("AUTH_REQUIRED", 401).message).toBe(de["err.AUTH_REQUIRED"]);
    vi.stubGlobal("window", { localStorage: { getItem: () => null } });
    expect(new ApiRequestError("AUTH_REQUIRED", 401).message).toBe("Sign in to continue.");
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("blocked"); } } });
    expect(new ApiRequestError("INVALID_CREDENTIALS", 401).message).toBe(errorMessages.INVALID_CREDENTIALS);
  });
});
