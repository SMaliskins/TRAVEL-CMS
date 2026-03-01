"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/" || pathname === "/register" || pathname.startsWith("/login");
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if current path is public
    const publicPath = isPublicPath(pathname);

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsAuthenticated(false);
          if (!publicPath) {
            router.push("/login");
            return;
          }
          setIsLoading(false);
          return;
        }
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          const isRefreshTokenError = error && (
            (error as { message?: string }).message?.includes("Refresh Token") ||
            (error as { code?: string }).code === "refresh_token_not_found"
          );
          if (isRefreshTokenError) {
            await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          }
          setIsAuthenticated(false);
          if (!publicPath) {
            router.push("/login");
            return;
          }
          setIsLoading(false);
          return;
        }
        setIsAuthenticated(true);
        if (publicPath) {
          router.push("/dashboard");
          return;
        }
      } catch (error) {
        const msg = error && typeof error === "object" && "message" in error ? String((error as { message?: string }).message || "") : "";
        const isRefreshTokenError = msg.includes("Refresh Token") || msg.includes("refresh_token_not_found");
        if (isRefreshTokenError) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
        setIsAuthenticated(false);
        if (!publicPath) {
          router.push("/login");
          return;
        }
      }
      setIsLoading(false);
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          setIsAuthenticated(false);
          if (!publicPath) {
            router.push("/login");
          }
        } else if (event === "SIGNED_IN" && session) {
          setIsAuthenticated(true);
          if (publicPath) {
            router.push("/dashboard");
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  // For public paths, render children regardless of auth state
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  // For protected paths, only render if authenticated
  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
