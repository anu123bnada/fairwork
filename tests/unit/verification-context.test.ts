import { describe, expect, it } from "vitest";
import { verificationContext } from "@/features/identity/verification-context";

const token = "a".repeat(64);
describe("verification link context", () => {
  it("accepts one email token from fragment or query without consuming it", () => {
    expect(verificationContext("?workspace=employer", `#token_hash=${token}&type=signup`)).toEqual({ kind: "ready", tokenHash: token });
    expect(verificationContext(`?token_hash=${token}&type=email`, "")).toEqual({ kind: "ready", tokenHash: token });
  });
  it("distinguishes missing and provider-expired links", () => {
    expect(verificationContext("?workspace=employer", "").kind).toBe("missing");
    expect(verificationContext("", "#error_code=otp_expired&error_description=untrusted").kind).toBe("expired");
  });
  it.each([`#token_hash=bad`, `#token_hash=${token}&token_hash=${token}`, `#token_hash=${token}&type=recovery`, "#access_token=secret", "#error=access_denied", "#code=unsupported"])("rejects ambiguous or unsupported context %s", hash => {
    expect(verificationContext("", hash).kind).toBe("invalid");
  });
  it("rejects duplicate tokens across query and fragment", () => {
    expect(verificationContext(`?token_hash=${token}`, `#token_hash=${token}`).kind).toBe("invalid");
  });
  const fragment = "#access_token=synthetic.access.signature&refresh_token=synthetic-refresh&token_type=bearer&type=signup&expires_in=3600&expires_at=9999999999";
  it("accepts the standard default signup fragment without trusting expiry hints", () => {
    expect(verificationContext("?workspace=employer", fragment)).toEqual({ kind: "session", accessToken: "synthetic.access.signature", refreshToken: "synthetic-refresh" });
  });
  it("rejects incomplete, duplicate, mixed, query-string and wrong-purpose credentials", () => {
    for (const hash of [fragment + "&access_token=duplicate", fragment + "&refresh_token=duplicate", fragment + "&type=signup", fragment + `&token_hash=${token}`, fragment.replace("type=signup", "type=recovery"), fragment.replace("token_type=bearer", "token_type=other"), fragment.replace("&refresh_token=synthetic-refresh", ""), fragment.replace("&type=signup", "")]) {
      expect(verificationContext("", hash).kind).toBe("invalid");
    }
    expect(verificationContext(fragment.replace("#", "?"), "").kind).toBe("invalid");
    expect(verificationContext(`?token_hash=${token}`, fragment).kind).toBe("invalid");
  });
});
