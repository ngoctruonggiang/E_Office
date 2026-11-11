"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { LoadingState } from "@/components/ui/Spinner";

/**
 * Client-side route guard. Shows a spinner while the session bootstraps, then
 * either renders the protected content or redirects to /login. Pure SPA guard —
 * good enough since the API itself enforces auth on every request.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return <>{children}</>;
}
