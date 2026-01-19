"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface Tab {
  id: string;
  path: string;
  title: string;
  type: "order" | "directory" | "settings" | "page";
  // Extra info for tooltips
  subtitle?: string; // e.g. client name
  dates?: string;    // e.g. "02.02 - 10.02.2026"
}

interface TabsContextType {
  tabs: Tab[];
  activeTabId: string | null;
  openTab: (path: string, title: string, type?: Tab["type"], extra?: { subtitle?: string; dates?: string }) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  isTabOpen: (path: string) => boolean;
}

const TabsContext = createContext<TabsContextType | null>(null);

const STORAGE_KEY = "travelcms.tabs";
const MAX_TABS = 10;

// Helper to determine tab type from path
function getTabType(path: string): Tab["type"] {
  if (path.startsWith("/orders/") && path !== "/orders/new") return "order";
  if (path.startsWith("/directory/")) return "directory";
  if (path.startsWith("/settings")) return "settings";
  return "page";
}

// Helper to generate title from path
function getTitleFromPath(path: string): string {
  // Order detail pages: /orders/0015-26-SM -> Order 0015/26-SM
  const orderMatch = path.match(/^\/orders\/(\d{4})-(\d{2})-(.+)$/);
  if (orderMatch) {
    return `Order ${orderMatch[1]}/${orderMatch[2]}-${orderMatch[3]}`;
  }
  
  // Directory detail pages
  if (path.startsWith("/directory/")) {
    return "Contact";
  }
  
  // Static pages
  const pageNames: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/orders": "Orders",
    "/orders/new": "New Order",
    "/directory": "Directory",
    "/settings": "Settings",
    "/settings/users": "User Management",
    "/settings/profile": "My Profile",
    "/analytics/orders": "Analytics",
  };
  
  return pageNames[path] || path.split("/").pop() || "Page";
}

// Load tabs from localStorage
function loadTabsFromStorage(): { tabs: Tab[]; activeTabId: string | null } {
  if (typeof window === "undefined") {
    return { tabs: [], activeTabId: null };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        tabs: Array.isArray(parsed.tabs) ? parsed.tabs : [],
        activeTabId: parsed.activeTabId || null,
      };
    }
  } catch (e) {
    console.error("Failed to load tabs from storage:", e);
  }
  
  return { tabs: [], activeTabId: null };
}

// Save tabs to localStorage
function saveTabsToStorage(tabs: Tab[], activeTabId: string | null) {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabId }));
  } catch (e) {
    console.error("Failed to save tabs to storage:", e);
  }
}

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    const stored = loadTabsFromStorage();
    setTabs(stored.tabs);
    setActiveTabId(stored.activeTabId);
    setIsInitialized(true);
  }, []);

  // Save to localStorage when tabs change
  useEffect(() => {
    if (isInitialized) {
      saveTabsToStorage(tabs, activeTabId);
    }
  }, [tabs, activeTabId, isInitialized]);

  // Sync active tab with current pathname
  useEffect(() => {
    if (!isInitialized || !pathname) return;
    
    // Find tab matching current path
    const matchingTab = tabs.find(t => t.path === pathname);
    if (matchingTab) {
      // Activate matching tab
      if (matchingTab.id !== activeTabId) {
        setActiveTabId(matchingTab.id);
      }
    } else {
      // No matching tab - deactivate all tabs
      if (activeTabId !== null) {
        setActiveTabId(null);
      }
    }
  }, [pathname, tabs, activeTabId, isInitialized]);

  const isTabOpen = useCallback((path: string): boolean => {
    return tabs.some(t => t.path === path);
  }, [tabs]);

  const openTab = useCallback((path: string, title?: string, type?: Tab["type"], extra?: { subtitle?: string; dates?: string }) => {
    // Check if tab already exists
    const existingTab = tabs.find(t => t.path === path);
    
    if (existingTab) {
      // Tab exists - just activate it and navigate
      setActiveTabId(existingTab.id);
      router.push(path);
      return;
    }
    
    // Create new tab
    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      path,
      title: title || getTitleFromPath(path),
      type: type || getTabType(path),
      subtitle: extra?.subtitle,
      dates: extra?.dates,
    };
    
    setTabs(prev => {
      // Limit number of tabs
      const updated = [...prev, newTab];
      if (updated.length > MAX_TABS) {
        // Remove oldest tab (first one)
        return updated.slice(1);
      }
      return updated;
    });
    
    setActiveTabId(newTab.id);
    router.push(path);
  }, [tabs, router]);

  const closeTab = useCallback((id: string) => {
    const tabIndex = tabs.findIndex(t => t.id === id);
    if (tabIndex === -1) return;
    
    const isActive = activeTabId === id;
    const newTabs = tabs.filter(t => t.id !== id);
    
    setTabs(newTabs);
    
    if (isActive && newTabs.length > 0) {
      // Activate adjacent tab
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      const newActiveTab = newTabs[newActiveIndex];
      setActiveTabId(newActiveTab.id);
      router.push(newActiveTab.path);
    } else if (newTabs.length === 0) {
      // No tabs left - go to orders
      setActiveTabId(null);
      router.push("/orders");
    }
  }, [tabs, activeTabId, router]);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    router.push("/orders");
  }, [router]);

  const handleSetActiveTab = useCallback((id: string) => {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      setActiveTabId(id);
      router.push(tab.path);
    }
  }, [tabs, router]);

  return (
    <TabsContext.Provider
      value={{
        tabs,
        activeTabId,
        openTab,
        closeTab,
        closeAllTabs,
        setActiveTab: handleSetActiveTab,
        isTabOpen,
      }}
    >
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within a TabsProvider");
  }
  return context;
}
