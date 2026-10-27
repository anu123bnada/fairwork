"use client";
import { useEffect } from "react";
import { authLinkDestination } from "@/features/identity/recovery-context";

// An email link can land on the site root (a dashboard invitation, or a project whose redirect allowlist does not list the callback page). If the
// fragment looks like an authentication link, send the browser to the page that handles it. The destination is one of two fixed same-origin paths; the
// fragment is carried over unchanged and is never read, stored or sent anywhere here.
export function AuthLinkForwarder() {
  useEffect(() => {
    const destination = authLinkDestination(window.location.hash);
    if (destination) window.location.replace(`${destination}${window.location.hash}`);
  }, []);
  return null;
}
