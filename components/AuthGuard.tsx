"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Pages that don't require authentication
const PUBLIC_PATHS = ["/login"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if current path is public
    const isPublicPath = PUBLIC_PATHS.some((path) => pathname?.startsWith(path));

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setIsAuthenticated(true);
          // If authenticated and on login page, redirect to dashboard
          if (isPublicPath) {
            router.push("/dashboard");
            return;
          }
        } else {
          setIsAuthenticated(false);
          // If not authenticated and not on public path, redirect to login
          if (!isPublicPath) {
            router.push("/login");
            return;
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        if (!isPublicPath) {
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
          if (!isPublicPath) {
            router.push("/login");
          }
        } else if (event === "SIGNED_IN" && session) {
          setIsAuthenticated(true);
          if (isPublicPath) {
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
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname?.startsWith(path));
  if (isPublicPath) {
    return <>{children}</>;
  }

  // For protected paths, only render if authenticated
  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
