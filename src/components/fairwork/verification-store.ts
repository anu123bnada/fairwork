import { verificationContext, type VerificationContext } from "@/features/identity/verification-context";
import { recoveryContext, type RecoveryContext } from "@/features/identity/recovery-context";
import { participantAuthQuery } from "@/features/offer/participant-path";
import { authPath } from "@/features/identity/auth-navigation";

// Per-component memory only: no credentials in storage, DOM, rendered HTML,
// outgoing navigation URLs or GET requests. Capture occurs on subscription,
// after hydration, and never authenticates automatically.
type Config<T> = { path: string; parse: (search: string, hash: string) => T; expired: T };
const confirmation: Config<VerificationContext> = { path: "/auth/confirm", parse: verificationContext, expired: { kind: "expired" } };
const recovery: Config<RecoveryContext> = { path: "/auth/recover", parse: recoveryContext, expired: { kind: "expired" } };
export const createRecoveryStore = (enabled: boolean) => createVerificationStore(enabled, recovery);
export function createVerificationStore<T = VerificationContext>(enabled: boolean, config: Config<T> = confirmation as unknown as Config<T>) {
  let snapshot: T | null = null;
  let cleanLocation = "";
  const listeners = new Set<() => void>();
  function capture() {
    // A browser Back action can fire before React unmounts this page. Never
    // rewrite another route or carry callback credentials into that route.
    if (window.location.pathname !== config.path) {
      snapshot = null; cleanLocation = "";
      listeners.forEach(listener => listener());
      return;
    }
    if (snapshot && window.location.href === cleanLocation) return;
    snapshot = config.parse(window.location.search, window.location.hash);
    window.history.replaceState(window.history.state, "", authPath(config.path, participantAuthQuery(window.location.search)));
    cleanLocation = window.location.href;
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => null,
    clear() { snapshot = config.expired; listeners.forEach(listener => listener()); },
    subscribe(listener: () => void) {
      if (!enabled) return () => {};
      listeners.add(listener);
      capture();
      window.addEventListener("hashchange", capture);
      window.addEventListener("popstate", capture);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("hashchange", capture);
        window.removeEventListener("popstate", capture);
      };
    },
  };
}
