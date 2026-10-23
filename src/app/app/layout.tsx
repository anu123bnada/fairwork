import { Suspense, type ReactNode } from "react";
import { ProductRouteProvider } from "@/components/fairwork/product-route-provider";
import LoadingPage from "@/app/loading";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingPage />}><ProductRouteProvider>{children}</ProductRouteProvider></Suspense>;
}
