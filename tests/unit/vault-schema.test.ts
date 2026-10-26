import { describe, expect, it } from "vitest";
import { checkVaultFile, safeFileName, sniffMediaType, vaultLimits } from "@/features/vault/schema";

const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const exe = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 3, 0, 0, 0]);

describe("vault file checks", () => {
  it("identifies the real type from the bytes", () => {
    expect(sniffMediaType(pdf)).toBe("application/pdf");
    expect(sniffMediaType(png)).toBe("image/png");
    expect(sniffMediaType(jpeg)).toBe("image/jpeg");
    expect(sniffMediaType(webp)).toBe("image/webp");
    expect(sniffMediaType(exe)).toBeNull();
    expect(sniffMediaType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMediaType(new Uint8Array())).toBeNull();
  });

  it("refuses empty, oversized, unsupported and mislabelled files", () => {
    expect(checkVaultFile(new Uint8Array(), "application/pdf", "a.pdf")).toEqual({ ok: false, reason: "empty" });
    expect(checkVaultFile(new Uint8Array(vaultLimits.maxBytes + 1), "application/pdf", "a.pdf")).toEqual({ ok: false, reason: "too_large" });
    expect(checkVaultFile(exe, "application/pdf", "payslip.pdf")).toEqual({ ok: false, reason: "unsupported_type" });
    expect(checkVaultFile(pdf, "image/png", "payslip.png")).toEqual({ ok: false, reason: "type_mismatch" });
    expect(checkVaultFile(pdf, "", "payslip")).toMatchObject({ ok: true, mediaType: "application/pdf", fileName: "payslip.pdf" });
  });

  it("builds a safe file name that always carries the verified extension", () => {
    expect(safeFileName("../../etc/passwd.exe", "application/pdf")).toBe("passwd.pdf");
    expect(safeFileName("C:\\Users\\me\\Pay Slip (March).PDF", "application/pdf")).toBe("Pay Slip (March).pdf");
    expect(safeFileName("<script>alert(1)</script>.png", "image/png")).toBe("script.png");
    expect(safeFileName("   ...   ", "image/jpeg")).toBe("document.jpg");
    expect(safeFileName("சான்றிதழ்.pdf", "application/pdf")).toBe("சான்றிதழ்.pdf");
    expect(safeFileName("a".repeat(500), "image/webp").length).toBeLessThanOrEqual(85);
  });
});
