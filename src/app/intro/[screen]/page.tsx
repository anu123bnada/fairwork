import { IntroScreen } from "@/components/fairwork/product-app";

const screens = new Set(["splash", "language", "onboarding"]);

export default async function IntroPage({ params, searchParams }: { params: Promise<{ screen: string }>; searchParams: Promise<{ slide?: string | string[] }> }) {
  const { screen } = await params;
  const { slide } = await searchParams;
  const initialSlide = slide === "2" ? 1 : slide === "3" ? 2 : 0;
  if (!screens.has(screen)) return <IntroScreen screen="splash" />;
  return <IntroScreen key={`${screen}-${initialSlide}`} screen={screen as "splash" | "language" | "onboarding"} initialSlide={initialSlide} />;
}
