import { z } from "zod";
import { participantAuthQuery } from "@/features/offer/participant-path";

// This is a navigation hint, never a URL, role, or authorization claim.
export const authContinuationSchema = z.string().max(250).refine(
  value => value === participantAuthQuery(value), "Invalid continuation",
).optional();

export function authPath(path: string, search = "") {
  const query = participantAuthQuery(search);
  return `${path}${query ? `?${query}` : ""}`;
}
