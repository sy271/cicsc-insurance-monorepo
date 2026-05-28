"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/family-vault",
  "/insurance",
  "/policies",
  "/analysis",
  "/claims",
  "/chat",
  "/flow",
  "/personal-details",
];

const AUTH_PAGES = ["/auth/sign-in", "/auth/sign-up"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (isProtectedPath(pathname) && !isAuthenticated) {
      router.replace(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (AUTH_PAGES.includes(pathname) && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, pathname, router]);

  if (loading && isProtectedPath(pathname)) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  return <>{children}</>;
}

