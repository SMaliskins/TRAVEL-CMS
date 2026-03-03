"use client";

import React, { createContext, useContext, useRef, useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface NavigationHistoryContextType {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
}

const NavigationHistoryContext = createContext<NavigationHistoryContextType | null>(null);

// Paths we ignore for history (login, landing, etc.)
function isTrackedPath(path: string | null): boolean {
  if (!path) return false;
  if (path === "/" || path === "/register") return false;
  if (path.startsWith("/login") || path.startsWith("/devlog")) return false;
  return true;
}

const MAX_HISTORY = 50;

function computeFlags(history: string[], idx: number) {
  return {
    canGoBack: idx > 0 && history.length > 1,
    canGoForward: idx >= 0 && idx < history.length - 1,
  };
}

export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const historyRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const isProgrammaticRef = useRef(false);
  const isInitialMount = useRef(true);

  const [flags, setFlags] = useState({ canGoBack: false, canGoForward: false });

  const updateFlags = useCallback(() => {
    setFlags(computeFlags(historyRef.current, indexRef.current));
  }, []);

  const goBack = useCallback(() => {
    const history = historyRef.current;
    const idx = indexRef.current;
    if (idx <= 0 || history.length < 2) return;
    const prevPath = history[idx - 1];
    isProgrammaticRef.current = true;
    indexRef.current = idx - 1;
    updateFlags();
    router.push(prevPath);
  }, [router, updateFlags]);

  const goForward = useCallback(() => {
    const history = historyRef.current;
    const idx = indexRef.current;
    if (idx < 0 || idx >= history.length - 1) return;
    const nextPath = history[idx + 1];
    isProgrammaticRef.current = true;
    indexRef.current = idx + 1;
    updateFlags();
    router.push(nextPath);
  }, [router, updateFlags]);

  useEffect(() => {
    if (!isTrackedPath(pathname)) return;

    const history = historyRef.current;
    const idx = indexRef.current;

    if (isProgrammaticRef.current) {
      isProgrammaticRef.current = false;
      updateFlags();
      return;
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      historyRef.current = [pathname];
      indexRef.current = 0;
      updateFlags();
      return;
    }

    // User navigated (link click, etc.)
    const newHistory = history.slice(0, idx + 1);
    if (newHistory[newHistory.length - 1] !== pathname) {
      newHistory.push(pathname);
      if (newHistory.length > MAX_HISTORY) {
        historyRef.current = newHistory.slice(-MAX_HISTORY);
        indexRef.current = historyRef.current.length - 1;
      } else {
        historyRef.current = newHistory;
        indexRef.current = newHistory.length - 1;
      }
      updateFlags();
    }
  }, [pathname, updateFlags]);

  const value: NavigationHistoryContextType = {
    canGoBack: flags.canGoBack,
    canGoForward: flags.canGoForward,
    goBack,
    goForward,
  };

  return (
    <NavigationHistoryContext.Provider value={value}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavigationHistory() {
  const ctx = useContext(NavigationHistoryContext);
  return ctx ?? { canGoBack: false, canGoForward: false, goBack: () => {}, goForward: () => {} };
}
