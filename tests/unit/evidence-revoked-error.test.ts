import { expect, it } from "vitest";
import { errorMessages, mapDatabaseError } from "@/lib/errors";

it("turns the database's EVIDENCE_REVOKED token into a plain 409 message and never passes other text through", () => {
  const mapped = mapDatabaseError({ message: "EVIDENCE_REVOKED" });
  expect([mapped.code, mapped.status, mapped.message]).toEqual(["EVIDENCE_REVOKED", 409, errorMessages.EVIDENCE_REVOKED]);
  expect(errorMessages.EVIDENCE_REVOKED).toMatch(/Mark it as valid again/);
  expect(mapDatabaseError({ message: "EVIDENCE_REVOKED: secret detail" }).code).toBe("SERVICE_UNAVAILABLE");
});
