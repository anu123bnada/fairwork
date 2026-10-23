import { getPublicEnvironment, validateServerEnvironment } from "@/lib/env";

export function register() {
  // Fail early on malformed/partial configuration or accidental real-data mode.
  // Both public values absent is the explicit unconfigured development state.
  getPublicEnvironment();
  validateServerEnvironment({ origin: process.env.APP_ORIGIN, dataMode: process.env.FAIRWORK_DATA_MODE });
}
