import { FairworkScreen } from "@/components/fairwork/product-app";

const screens = new Set([
  "home",
  "add-offer",
  "analyzing",
  "check",
  "questions",
  "agreement",
  "agreement-workflow",
  "work-record",
  "cases",
  "passport",
  "settings",
  "employer",
  "notifications",
  "share",
  "intro-welcome",
]);

export default async function ProductScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<{ preview?: string | string[] }>;
}) {
  const [{ screen }, { preview }] = await Promise.all([params, searchParams]);
  if (!screens.has(screen)) return <FairworkScreen screen="not-found" />;
  return <FairworkScreen screen={screen} demoPreview={preview === "demo"} />;
}
