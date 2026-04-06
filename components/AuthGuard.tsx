"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import TabBar from "./TabBar";

/** CRM shell and Supabase session are not used — own layout / client-app cookies */
function bypassCrmAuth(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/map") ||
    pathname.startsWith("/referral")
  );
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

  const skipCrm = bypassCrmAuth(pathname);

  useEffect(() => {
    if (skipCrm) {
      setIsLoading(false);
      return;
    }

    const publicPath = isPublicPath(pathname);

    const checkAuth = async (isRetry = false) => {
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
          if (!publicPath) {
            if (!isRetry) {
              await new Promise((r) => setTimeout(r, 400));
              return checkAuth(true);
            }
            router.push("/login");
          }
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
          if (!publicPath) {
            if (!isRetry && !isRefreshTokenError) {
              await new Promise((r) => setTimeout(r, 400));
              return checkAuth(true);
            }
            router.push("/login");
          }
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);
        if (publicPath) { router.push("/dashboard"); }
        setIsLoading(false);
        return;
      } catch (error) {
        const msg = error && typeof error === "object" && "message" in error ? String((error as { message?: string }).message || "") : "";
        const isRefreshTokenError = msg.includes("Refresh Token") || msg.includes("refresh_token_not_found");
        if (isRefreshTokenError) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
        setIsAuthenticated(false);
        if (!publicPath) {
          if (!isRetry) {
            await new Promise((r) => setTimeout(r, 400));
            return checkAuth(true);
          }
          router.push("/login");
        }
      }
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (skipCrm) return;
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
  }, [pathname, router, skipCrm]);

  if (skipCrm) {
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
    // Show real shell during auth — profile/company can load in parallel
    return (
      <>
        <Sidebar />
        <TopBar />
        <div id="main-content-wrapper" className="min-h-screen pl-[72px] pt-16 transition-all duration-200 theme-page-bg">
          <TabBar />
          <main className="relative z-0 flex-1 flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          </main>
        </div>
      </>
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
