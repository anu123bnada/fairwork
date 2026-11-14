import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { isTechnicalError, userMessage } from "@/lib/user-error";

describe("userMessage", () => {
  it("turns a schema mismatch into a plain sentence and logs the detail", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let caught: unknown;
    try { z.strictObject({ id: z.uuid() }).parse({ id: 5, extra: true }); } catch (error) { caught = error; }
    expect(isTechnicalError(caught)).toBe(true);
    const text = userMessage(caught, "Could not load.");
    expect(text).not.toMatch(/[{}[\]]|invalid_type|unrecognized/i);
    expect(text).toMatch(/could not read|nothing was changed/i);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it("passes ordinary error messages through and never swallows a failure", () => {
    expect(userMessage(new Error("Your session has ended. Sign in again."), "x")).toBe("Your session has ended. Sign in again.");
    expect(userMessage(undefined, "The record could not be saved.")).toBe("The record could not be saved.");
    expect(userMessage(new Error(""), "Fallback text")).toBe("Fallback text");
    expect(userMessage("odd")).toMatch(/could not read/i);
  });
  it("treats pasted JSON or a stack trace as technical", () => {
    expect(isTechnicalError(new Error("[{\"code\":\"invalid_type\"}]"))).toBe(true);
    expect(isTechnicalError(new Error("TypeError at fn (file.js:10:5)"))).toBe(true);
    expect(isTechnicalError(new Error("Offer not found."))).toBe(false);
  });
});
