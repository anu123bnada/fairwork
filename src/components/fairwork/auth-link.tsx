"use client";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authPath } from "@/features/identity/auth-navigation";

function ContextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const search = useSearchParams();
  return <Link href={authPath(href, search.toString())} className={className}>{children}</Link>;
}
export function AuthLink(props: { href: string; children: ReactNode; className?: string }) {
  return <Suspense fallback={<Link href={props.href} className={props.className}>{props.children}</Link>}><ContextLink {...props}/></Suspense>;
}
