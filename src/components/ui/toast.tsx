"use client";
import { useEffect, useState } from "react";

type ToastItem = { id: number; message: string; tone: "success" | "danger" | "neutral" };
const EVENT = "oryqen-toast";
let counter = 0;

// Call from a client handler once a real action has completed.
export function toast(message: string, tone: ToastItem["tone"] = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastItem>(EVENT, { detail: { id: ++counter, message, tone } }));
}

// Mounted once in the shell. A polite live region (no landmark role), so it is announced without stealing focus or duplicating the page status.
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const timers = new Set<number>();
    const onToast = (event: Event) => {
      const item = (event as CustomEvent<ToastItem>).detail;
      setItems(previous => [...previous.slice(-2), item]);
      const timer = window.setTimeout(() => { timers.delete(timer); setItems(previous => previous.filter(entry => entry.id !== item.id)); }, 4500);
      timers.add(timer);
    };
    window.addEventListener(EVENT, onToast);
    return () => { window.removeEventListener(EVENT, onToast); timers.forEach(window.clearTimeout); };
  }, []);
  return <div className="oq-toasts" aria-live="polite">{items.map(item => <div className="oq-toast" data-tone={item.tone} key={item.id}>{item.message}</div>)}</div>;
}
