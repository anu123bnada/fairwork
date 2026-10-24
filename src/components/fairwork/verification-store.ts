import { verificationContext, type VerificationContext } from "@/features/identity/verification-context";
import { participantAuthQuery } from "@/features/offer/participant-path";
import { authPath } from "@/features/identity/auth-navigation";

// Per-component memory only: no credentials in storage, DOM, rendered HTML,
// outgoing navigation URLs or GET requests. Capture occurs on subscription,
// after hydration, and never authenticates automatically.
export function createVerificationStore(enabled: boolean) {
  let snapshot: VerificationContext | null = null;
  let cleanLocation = "";
  const listeners = new Set<() => void>();
  function capture() {
    // A browser Back action can fire before React unmounts this page. Never
    // rewrite another route or carry callback credentials into that route.
    if (window.location.pathname !== "/auth/confirm") {
      snapshot = null; cleanLocation = "";
      listeners.forEach(listener => listener());
      return;
    }
    if (snapshot && window.location.href === cleanLocation) return;
    snapshot = verificationContext(window.location.search, window.location.hash);
    window.history.replaceState(window.history.state, "", authPath("/auth/confirm", participantAuthQuery(window.location.search)));
    cleanLocation = window.location.href;
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => null,
    clear() { snapshot = { kind: "expired" }; listeners.forEach(listener => listener()); },
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
