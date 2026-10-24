import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createVerificationStore } from "@/components/fairwork/verification-store";

let location: URL;
let events: EventTarget;
let replace: ReturnType<typeof vi.fn>;
beforeEach(() => {
  location = new URL(`https://app.example.test/auth/confirm?workspace=employer#token_hash=${"a".repeat(64)}`);
  events = new EventTarget();
  replace = vi.fn((_state, _unused, path: string) => { location = new URL(path, location); });
  vi.stubGlobal("window", { get location() { return location; }, history: { state: { preserved: true }, replaceState: replace }, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) });
});
afterEach(() => vi.unstubAllGlobals());

it("captures credentials only in memory and preserves them across subscription reconnects", () => {
  const store = createVerificationStore(true);
  expect(store.getServerSnapshot()).toBeNull();
  expect(store.getSnapshot()).toBeNull();
  const stop = store.subscribe(vi.fn());
  expect(location.href).toBe("https://app.example.test/auth/confirm?workspace=employer");
  expect(replace).toHaveBeenCalledWith({ preserved: true }, "", "/auth/confirm?workspace=employer");
  expect(store.getSnapshot()?.kind).toBe("ready");
  stop();
  store.subscribe(vi.fn())();
  expect(store.getSnapshot()?.kind).toBe("ready");
  store.clear();
  expect(store.getSnapshot()).toEqual({ kind: "expired" });
});

it("does not hijack browser Back navigation and drops credentials when leaving", () => {
  const store = createVerificationStore(true);
  const stop = store.subscribe(vi.fn());
  location = new URL("https://app.example.test/sign-in?workspace=employer");
  events.dispatchEvent(new Event("popstate"));
  expect(location.pathname).toBe("/sign-in");
  expect(replace).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot()).toBeNull();
  stop();
});

it("scrubs a new malformed fragment without retaining prior credentials", () => {
  const store = createVerificationStore(true);
  const stop = store.subscribe(vi.fn());
  location.hash = "access_token=invalid";
  events.dispatchEvent(new Event("hashchange"));
  expect(store.getSnapshot()).toEqual({ kind: "invalid" });
  expect(location.hash).toBe("");
  stop();
});

it("does not inspect or rewrite unrelated registration and profile pages", () => {
  const store = createVerificationStore(false);
  store.subscribe(vi.fn())();
  expect(replace).not.toHaveBeenCalled();
  expect(store.getSnapshot()).toBeNull();
});
