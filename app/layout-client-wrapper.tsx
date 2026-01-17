"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/hooks/useSidebar";

const RAIL_WIDTH = 72;
const EXPANDED_WIDTH = 260;

// Pages that should not have sidebar margins
const NO_LAYOUT_PATHS = ["/login"];

// Function to apply layout styles immediately
function applyLayoutStyles(mode: string, skipLayout: boolean) {
  const mainWrapper = document.getElementById("main-content-wrapper");
  if (!mainWrapper) return;

  // Don't apply sidebar margins on login page
  if (skipLayout) {
    mainWrapper.style.marginLeft = "0";
    mainWrapper.style.paddingLeft = "0";
    return;
  }

  if (mode === "expanded") {
    mainWrapper.style.marginLeft = `${EXPANDED_WIDTH}px`;
    mainWrapper.style.paddingLeft = "0";
  } else {
    mainWrapper.style.marginLeft = "0";
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
  
  // Check if current path should skip layout styles
  const skipLayout = NO_LAYOUT_PATHS.some((path) => pathname?.startsWith(path));

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

  return <>{children}</>;
}
