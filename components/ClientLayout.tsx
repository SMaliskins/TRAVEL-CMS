"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import TabBar from "./TabBar";
import AuthGuard from "./AuthGuard";
import UrlModalProvider from "./UrlModalProvider";
import { ToastProvider } from "@/contexts/ToastContext";
import BugReportOverlay from "./BugReportOverlay";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Pages that should not show sidebar/topbar (exact match for / to avoid matching all paths)
  const hideLayout = pathname === "/" || pathname === "/register" || pathname?.startsWith("/login");

  return (
    <ToastProvider>
    <UrlModalProvider>
    <AuthGuard>
      {hideLayout ? (
        // Login page - no sidebar/topbar, no padding
        <main className="min-h-screen">
          {children}
        </main>
      ) : (
        // All other pages - show sidebar/topbar with proper padding
        <>
          <Sidebar />
          <TopBar />
          <div id="main-content-wrapper" className="min-h-screen pl-[72px] pt-14 transition-all duration-200">
            <TabBar />
            <main>
              {children}
            </main>
          </div>
        </>
      )}
    </AuthGuard>
    <BugReportOverlay />
    </UrlModalProvider>
    </ToastProvider>
  );
}





