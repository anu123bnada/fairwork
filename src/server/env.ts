import "server-only";
import { validateServerEnvironment } from "@/lib/env";
export function getServerEnvironment() {
  return validateServerEnvironment({ origin: process.env.APP_ORIGIN, dataMode: process.env.FAIRWORK_DATA_MODE });
}
