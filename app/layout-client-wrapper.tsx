"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/hooks/useSidebar";
import { UserProvider } from "@/contexts/UserContext";
import { TabsProvider } from "@/contexts/TabsContext";
import { ModalOverlayProvider } from "@/contexts/ModalOverlayContext";
import { NavigationHistoryProvider } from "@/contexts/NavigationHistoryContext";
import { CompanySettingsProvider } from "@/contexts/CompanySettingsContext";
import ThemeInitializer from "@/components/ThemeInitializer";

const RAIL_WIDTH = 72;
const EXPANDED_WIDTH = 260;

// Function to apply layout styles immediately
function applyLayoutStyles(mode: string, skipLayout: boolean) {
  const mainWrapper = document.getElementById("main-content-wrapper");
  if (!mainWrapper) return;

  if (skipLayout) {
    mainWrapper.style.paddingLeft = "0";
    return;
  }

  const isMobile = window.innerWidth < 1024;
  if (isMobile) {
    mainWrapper.style.paddingLeft = "0";
    return;
  }

  if (mode === "expanded") {
    mainWrapper.style.paddingLeft = `${EXPANDED_WIDTH}px`;
  } else {
    mainWrapper.style.paddingLeft = `${RAIL_WIDTH}px`;
  }
}

export default function LayoutClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mode, isClient } = useSidebar();
  const pathname = usePathname();
  
  // Pages that should not have sidebar margins (exact match for / to avoid matching all paths)
  const skipLayout = pathname === "/" || pathname === "/register" || pathname?.startsWith("/login") || pathname?.startsWith("/superadmin");

  // Apply styles immediately on mount and when mode changes
  useLayoutEffect(() => {
    if (!isClient) return;
    applyLayoutStyles(mode, skipLayout);
    
    const mainWrapper = document.getElementById("main-content-wrapper");
    if (mainWrapper && !skipLayout) {
      mainWrapper.style.transition = "margin-left 200ms ease-in-out, padding-left 200ms ease-in-out";
    }
  }, [mode, isClient, skipLayout]);

  useEffect(() => {
    if (!isClient) return;
    
    requestAnimationFrame(() => {
      applyLayoutStyles(mode, skipLayout);
    });

    const handleResize = () => applyLayoutStyles(mode, skipLayout);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mode, isClient, skipLayout]);

  return (
    <UserProvider>
      <CompanySettingsProvider>
        <ThemeInitializer />
        <NavigationHistoryProvider>
          <TabsProvider>
            <ModalOverlayProvider>{children}</ModalOverlayProvider>
          </TabsProvider>
        </NavigationHistoryProvider>
      </CompanySettingsProvider>
    </UserProvider>
  );
}
