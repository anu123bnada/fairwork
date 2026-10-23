"use client";

import { useSyncExternalStore } from "react";
const eventName = "oryqen-appearance";
function subscribe(callback: () => void) {
  const update = () => {
    let value: string | null = null;
    try { value = localStorage.getItem("oryqen.appearance"); } catch { /* Optional device preference. */ }
    document.documentElement.dataset.theme = value === "dark" || value === "light" ? value : "system";
    callback();
  };
  window.addEventListener("storage", update);
  window.addEventListener(eventName, callback);
  return () => { window.removeEventListener("storage", update); window.removeEventListener(eventName, callback); };
}
export function AppearanceControl() {
  const preference = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme ?? "system", () => "system");
  return <label className="oq-appearance">Appearance
    <select value={preference} onChange={event => {
      const value = event.target.value;
      document.documentElement.dataset.theme = value;
      try { localStorage.setItem("oryqen.appearance", value); } catch { /* Current page still changes. */ }
      window.dispatchEvent(new Event(eventName));
    }}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select>
    <small>Saved on this device when browser storage is available.</small>
  </label>;
}
