"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/hooks/useSidebar";
import { UserProvider } from "@/contexts/UserContext";
import { TabsProvider } from "@/contexts/TabsContext";
import { CompanySettingsProvider } from "@/contexts/CompanySettingsContext";

const RAIL_WIDTH = 72;
const EXPANDED_WIDTH = 260;

// Function to apply layout styles immediately
function applyLayoutStyles(mode: string, skipLayout: boolean) {
  const mainWrapper = document.getElementById("main-content-wrapper");
  if (!mainWrapper) return;

  // Don't apply sidebar margins on login page
  if (skipLayout) {
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
  const skipLayout = pathname === "/" || pathname === "/register" || pathname?.startsWith("/login");

  // Apply styles immediately on mount and when mode changes
  useLayoutEffect(() => {
    if (!isClient) return;
    applyLayoutStyles(mode, skipLayout);
    
    const mainWrapper = document.getElementById("main-content-wrapper");
    if (mainWrapper && !skipLayout) {
      mainWrapper.style.transition = "margin-left 200ms ease-in-out, padding-left 200ms ease-in-out";
    }
  }, [mode, isClient, skipLayout]);

  // Also use regular effect to ensure styles are applied
  useEffect(() => {
    if (!isClient) return;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      applyLayoutStyles(mode, skipLayout);
    });
  }, [mode, isClient, skipLayout]);

  return (
    <UserProvider>
      <CompanySettingsProvider>
        <TabsProvider>{children}</TabsProvider>
      </CompanySettingsProvider>
    </UserProvider>
  );
}
