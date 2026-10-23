"use client";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ProductProvider } from "./product-app";

/** An explicit record change must never inherit another record's editable state.
 * Remount before rendering children so even the first frame cannot confirm stale
 * terms. Normal no-query navigation keeps the existing in-memory editing flow.
 */
export function ProductRouteProvider({ children }: { children: ReactNode }) {
  const search = useSearchParams();
  const selection = search.has("offerId") ? `explicit:${search.getAll("offerId").join("|")}` : "remembered";
  return <ProductProvider key={selection}>{children}</ProductProvider>;
}
