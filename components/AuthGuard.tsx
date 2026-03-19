"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function isExternalApp(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/superadmin");
}

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/" || pathname === "/register" || pathname.startsWith("/login");
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const externalApp = isExternalApp(pathname);

  useEffect(() => {
    if (externalApp) {
      setIsLoading(false);
      return;
    }

    const publicPath = isPublicPath(pathname);

    const checkAuth = async () => {
      try {
        const [sessionRes, userRes] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
        ]);

        const session = sessionRes.data.session;
        const user = userRes.data.user;
        const userError = userRes.error;

        if (!session) {
          setIsAuthenticated(false);
          if (!publicPath) { router.push("/login"); return; }
          setIsLoading(false);
          return;
        }

        if (userError || !user) {
          const isRefreshTokenError = userError && (
            (userError as { message?: string }).message?.includes("Refresh Token") ||
            (userError as { code?: string }).code === "refresh_token_not_found"
          );
          if (isRefreshTokenError) {
            await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          }
          setIsAuthenticated(false);
          if (!publicPath) { router.push("/login"); return; }
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);
        if (publicPath) { router.push("/dashboard"); return; }
      } catch (error) {
        const msg = error && typeof error === "object" && "message" in error ? String((error as { message?: string }).message || "") : "";
        const isRefreshTokenError = msg.includes("Refresh Token") || msg.includes("refresh_token_not_found");
        if (isRefreshTokenError) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
        setIsAuthenticated(false);
        if (!publicPath) { router.push("/login"); return; }
      }
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (externalApp) return;
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
  }, [pathname, router, externalApp]);

  if (externalApp) {
    return <>{children}</>;
  }

  if (isLoading) {
    if (isPublicPath(pathname)) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
        </div>
      );
    }
    return (
      <div className="flex min-h-screen">
        <div className="w-[72px] min-h-screen bg-gray-900" />
        <div className="flex-1">
          <div className="h-14 border-b border-gray-200 bg-white" />
          <div className="p-6">
            <div className="mx-auto max-w-[1800px] space-y-4">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
              <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
