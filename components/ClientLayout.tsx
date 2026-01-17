"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import AuthGuard from "./AuthGuard";

// Pages that should not show sidebar/topbar
const NO_LAYOUT_PATHS = ["/login"];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Check if current path should hide the layout
  const hideLayout = NO_LAYOUT_PATHS.some((path) => pathname?.startsWith(path));

  return (
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
          <main id="main-content-wrapper" className="min-h-screen pt-14 transition-all duration-200">
            {children}
          </main>
        </>
      )}
    </AuthGuard>
  );
}





