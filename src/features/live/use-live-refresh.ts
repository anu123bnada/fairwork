"use client";
import { useEffect, useRef, useState } from "react";
import { nextRefreshDelay } from "./refresh-schedule";

export type LiveStatus = "live" | "stale" | "offline";
// Keeps a person's own data fresh through the same authenticated API reads the screen already uses: it refreshes when the tab becomes visible, the window regains focus or the network returns,
// and on a visible-tab timer with backoff after failures. It reads nothing the person could not already read and subscribes to no shared channel.
export function useLiveRefresh(refresh: () => Promise<void>, enabled = true) {
  const [status, setStatus] = useState<LiveStatus>("live");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, failures = 0, timer: number | undefined, running = false;
    const schedule = () => { window.clearTimeout(timer); if (!stopped) timer = window.setTimeout(() => void run(), nextRefreshDelay(failures)); };
    async function run() {
      if (stopped || running) return;
      if (document.visibilityState === "hidden") { schedule(); return; }
      if (!navigator.onLine) { setStatus("offline"); schedule(); return; }
      running = true;
      try { await latest.current(); failures = 0; setLastUpdated(Date.now()); setStatus("live"); }
      // A failed check is always disclosed; the next success clears it.
      catch { failures += 1; setStatus("stale"); }
      finally { running = false; schedule(); }
    }
    const wake = () => { if (document.visibilityState === "visible") void run(); };
    const offline = () => setStatus("offline");
    schedule();
    document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake); window.addEventListener("online", wake); window.addEventListener("offline", offline);
    return () => { stopped = true; window.clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); window.removeEventListener("online", wake); window.removeEventListener("offline", offline); };
  }, [enabled]);
  return { status, lastUpdated };
}
