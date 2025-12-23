"use client";

import { useEffect, useLayoutEffect } from "react";
import { useSidebar } from "@/hooks/useSidebar";

const RAIL_WIDTH = 72;
const EXPANDED_WIDTH = 260;

// Function to apply layout styles immediately
function applyLayoutStyles(mode: string) {
  const mainWrapper = document.getElementById("main-content-wrapper");
  if (!mainWrapper) return;

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

  // Apply styles immediately on mount and when mode changes
  useLayoutEffect(() => {
    if (!isClient) return;
    applyLayoutStyles(mode);
    
    const mainWrapper = document.getElementById("main-content-wrapper");
    if (mainWrapper) {
      mainWrapper.style.transition = "margin-left 200ms ease-in-out, padding-left 200ms ease-in-out";
    }
  }, [mode, isClient]);

  // Also use regular effect to ensure styles are applied
  useEffect(() => {
    if (!isClient) return;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      applyLayoutStyles(mode);
    });
  }, [mode, isClient]);

  return <>{children}</>;
}
