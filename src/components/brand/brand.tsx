import Image from "next/image";
import type { ReactNode } from "react";
import { approvedBrand } from "@/lib/brand/identity";

type BrandProps = {
  className?: string;
  /** Only preserve artwork already present at this exact placement. */
  existing?: ReactNode;
  theme?: "light" | "dark";
};

function Artwork({ kind, className = "", existing = null, theme = "light" }: BrandProps & { kind: "logo" | "mark" }) {
  if (!approvedBrand) return <>{existing}</>;
  const asset = approvedBrand[kind][theme];
  return <Image className={`oq-brand-art oq-brand-${kind} ${className}`} data-oryqen-brand={kind}
    src={asset.src} width={asset.width} height={asset.height} alt="ORYQEN" unoptimized />;
}

/** A supplied full lockup; never typeset a substitute wordmark. */
export function BrandLogo(props: BrandProps) { return <Artwork {...props} kind="logo" />; }
export function BrandMark(props: BrandProps) { return <Artwork {...props} kind="mark" />; }

/** Keeps existing UI only while the official identity is unconfigured. */
export function ExistingBrand({ children }: { children: ReactNode }) {
  return approvedBrand ? null : <>{children}</>;
}

/** One responsive anchor. No empty header, link, or layout shift while pending.
 * The current product has light surfaces regardless of OS preference; dark is
 * explicit so a dark OS never selects an invisible asset on a light surface.
 */
export function AppBrandHeader({ prominent = false, collapsed = false, theme = "light" }: {
  prominent?: boolean;
  collapsed?: boolean;
  theme?: "light" | "dark";
}) {
  if (!approvedBrand) return null;
  return <header className={`oq-brand-header${prominent ? " oq-brand-prominent" : ""}${collapsed ? " oq-brand-collapsed" : ""}`} data-brand-anchor="application" data-brand-theme={theme}>
    {prominent ? <BrandLogo theme={theme} /> : collapsed ? <BrandMark theme={theme} /> : <>
      <BrandLogo className="oq-brand-desktop" theme={theme} />
      <BrandMark className="oq-brand-mobile" theme={theme} />
    </>}
  </header>;
}
