import type { ReactNode } from "react";
import { AppBrandHeader } from "@/components/brand/brand";
export function PageShell({ children }: { children: ReactNode }) {
  return <><a href="#main">Skip to content</a><main id="main" tabIndex={-1}><AppBrandHeader />{children}</main></>;
}
