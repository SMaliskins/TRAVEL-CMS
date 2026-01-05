"use client";

import { useState, useEffect, useSyncExternalStore, useCallback } from "react";

export type SidebarMode = "expanded" | "collapsed" | "hover";

const STORAGE_KEY_MODE = "travelcms.sidebar.mode";

const RAIL_WIDTH = 72;
const EXPANDED_WIDTH = 260;

// Helper to safely get sidebar mode from localStorage
const getSidebarModeFromStorage = (): SidebarMode => {
  if (typeof window === "undefined") return "hover";
  try {
    const storedMode = localStorage.getItem(STORAGE_KEY_MODE);
    if (storedMode === "expanded" || storedMode === "collapsed" || storedMode === "hover") {
      return storedMode;
    }
  } catch {
    // Ignore localStorage errors
  }
  return "hover";
};

export function useSidebar() {
  const [mode, setModeState] = useState<SidebarMode>(getSidebarModeFromStorage);
  const [isHovered, setIsHoveredState] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Use useSyncExternalStore for isClient to avoid hydration issues
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const setMode = (newMode: SidebarMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY_MODE, newMode);
    } catch (e) {
      console.warn("Failed to save sidebar mode:", e);
    }
  };

  const setIsHovered = (value: boolean) => {
    // Only allow hover if mode is "hover"
    if (mode === "hover") {
      setIsHoveredState(value);
    } else {
      setIsHoveredState(false);
    }
  };

  // Sidebar is expanded if: mode === "expanded" OR (mode === "hover" && isHovered)
  const isExpanded = mode === "expanded" || (mode === "hover" && isHovered);
  const isCollapsed = !isExpanded;
  
  // Overlay is enabled only in "hover" mode when hovered
  const overlayEnabled = mode === "hover" && isHovered;

  return {
    mode,
    setMode,
    isHovered,
    setIsHovered,
    isExpanded,
    isCollapsed,
    overlayEnabled,
    railWidth: RAIL_WIDTH,
    expandedWidth: EXPANDED_WIDTH,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isClient,
  };
}
