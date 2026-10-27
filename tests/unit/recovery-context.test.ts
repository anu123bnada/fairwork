import { describe, expect, it } from "vitest";
import { authLinkDestination, recoveryContext } from "@/features/identity/recovery-context";
import { translate, type LocaleCode } from "@/i18n";

const jwt = `${"a".repeat(20)}.${"b".repeat(20)}.${"c".repeat(20)}`;
const session = (type: string, extra = "") => `#access_token=${jwt}&expires_in=3600&refresh_token=abcDEF123&token_type=bearer&type=${type}${extra}`;

describe("recovery link inspection", () => {
  it("accepts the documented token_hash fragment, with or without type=recovery", () => {
    const hash = "a".repeat(64);
    expect(recoveryContext("", `#token_hash=${hash}`)).toEqual({ kind: "ready", tokenHash: hash });
    expect(recoveryContext("", `#token_hash=${hash}&type=recovery`)).toEqual({ kind: "ready", tokenHash: hash });
    expect(recoveryContext("?workspace=employer", `#token_hash=${hash}`)).toMatchObject({ kind: "ready" });
  });
  it("accepts the default dashboard recovery and invitation links (tokens in the fragment) and tells them apart", () => {
    expect(recoveryContext("", session("recovery"))).toMatchObject({ kind: "session", link: "recovery", accessToken: jwt, refreshToken: "abcDEF123" });
    expect(recoveryContext("", session("invite"))).toMatchObject({ kind: "session", link: "invite" });
  });
  it("reports an empty page, an expired link and a provider error without offering to consume anything", () => {
    expect(recoveryContext("", "")).toEqual({ kind: "missing" });
    expect(recoveryContext("", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")).toEqual({ kind: "expired" });
    expect(recoveryContext("?error_code=otp_expired", "")).toEqual({ kind: "expired" });
    expect(recoveryContext("", "#error=access_denied&error_code=access_denied")).toEqual({ kind: "invalid" });
    expect(recoveryContext("?error=server_error", "")).toEqual({ kind: "invalid" });
  });
  it("cannot complete a PKCE code and says so instead of guessing", () => {
    expect(recoveryContext("?code=abc123", "")).toEqual({ kind: "unsupported" });
  });
  it("rejects credentials in the query string, wrong or duplicate types, mixed protocols and malformed values", () => {
    const hash = "a".repeat(64);
    for (const [search, fragment] of [
      [`?token_hash=${hash}`, ""], [`?access_token=${jwt}&refresh_token=x&type=recovery`, ""],
      ["", session("signup")], ["", session("magiclink")], ["", session("email_change")], ["", session("recovery", "&type=invite")],
      ["", `#token_hash=${hash}&access_token=${jwt}&refresh_token=abc&token_type=bearer&type=recovery`],
      ["", `#token_hash=${hash}&token_hash=${hash}`], ["", `#token_hash=${hash}&type=signup`], ["", "#token_hash=short"], ["", "#token_hash=has space and !!"],
      ["", `#access_token=notajwt&refresh_token=abc&token_type=bearer&type=recovery`], ["", `#access_token=${jwt}&type=recovery&token_type=bearer`],
      ["", `#access_token=${jwt}&refresh_token=abc&type=recovery`], ["", `#access_token=${jwt}&access_token=${jwt}&refresh_token=abc&token_type=bearer&type=recovery`],
    ] as const) expect(recoveryContext(search, fragment), `${search} ${fragment}`).toEqual({ kind: "invalid" });
  });
  it("never returns a credential from a context it rejects", () => {
    const rejected = JSON.stringify(recoveryContext("?access_token=" + jwt, session("signup")));
    expect(rejected).not.toContain(jwt);
  });
});

describe("links that landed on the wrong page", () => {
  it("sends recovery and invitation links to the recovery page and signup links to confirmation", () => {
    expect(authLinkDestination(session("recovery"))).toBe("/auth/recover");
    expect(authLinkDestination(session("invite"))).toBe("/auth/recover");
    expect(authLinkDestination(session("signup"))).toBe("/auth/confirm");
    expect(authLinkDestination(`#token_hash=${"a".repeat(64)}&type=recovery`)).toBe("/auth/recover");
    expect(authLinkDestination(`#token_hash=${"a".repeat(64)}`)).toBe("/auth/confirm");
    expect(authLinkDestination("#error=access_denied&error_code=otp_expired")).toBe("/auth/recover");
  });
  it("ignores ordinary fragments and anything it does not recognize, and only ever returns fixed paths", () => {
    for (const hash of ["", "#features", "#faq", "#type=recovery", "#access_token=x&type=oauth", "#access_token=x&type=//evil.example", "#next=https://evil.example"]) expect(authLinkDestination(hash), hash).toBeNull();
    for (const hash of [session("recovery"), session("signup"), "#error=a&error_code=b"]) expect(["/auth/recover", "/auth/confirm"]).toContain(authLinkDestination(hash));
  });
});

describe("recovery wording", () => {
  it("exists in every language for each link state", () => {
    for (const key of ["au.rec.openEmail", "au.rec.linkExpired", "au.rec.linkUnusable", "au.rec.linkUnsupported", "au.rec.unsupportedBody", "au.rec.useLatest", "au.rec.requestNew", "au.rec.linkUsedError", "au.rec.inviteNote", "au.rec.checkingLink", "au.rec.waitFormat"] as const) {
      const english = translate("en", key);
      expect(english).not.toBe(key);
      for (const locale of ["si", "ta", "de"] as LocaleCode[]) expect(translate(locale, key), `${locale} ${key}`).not.toBe(english);
    }
  });
});
