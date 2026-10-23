"use client";
import { ErrorState } from "@/components/fairwork/status";
import { Button } from "@/components/fairwork/button";
import { AppBrandHeader } from "@/components/brand/brand";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main className="oq-about"><AppBrandHeader /><ErrorState /><Button onClick={retry}>Try again</Button><p>Reload the saved record before retrying a change.</p></main>;
}
