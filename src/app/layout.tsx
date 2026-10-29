import type { Metadata } from "next";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./globals.css";
import "@/components/oryqen/recovery.css";
import "@/components/brand/brand.css";
import "@/components/oryqen/tokens.css";
import "@/components/oryqen/design-system.css";

export const metadata: Metadata = {
  title: { default: "ORYQEN — Your work, clearly recorded", template: "%s | ORYQEN" },
  applicationName: "ORYQEN",
  description: "Understand offers, clarify agreements and keep a private record of your work.",
  icons: { icon: "/oryqen/approved/oryqen-symbol.png", apple: "/oryqen/approved/oryqen-symbol.png" },
  openGraph: { type: "website", siteName: "ORYQEN", title: "ORYQEN — Your work, clearly recorded", description: "Understand offers. Clarify agreements. Keep your work record private." },
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-brand="oryqen" suppressHydrationWarning><head><script src="/oryqen-theme.js" /></head><body>{children}</body></html>;
}
