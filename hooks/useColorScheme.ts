"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type ColorSchemeId,
  THEME_SCHEMES,
  DEFAULT_COLOR_SCHEME,
  STORAGE_KEY,
} from "@/lib/themeSchemes";

export function useColorScheme() {
  const [scheme, setScheme] = useState<ColorSchemeId>(DEFAULT_COLOR_SCHEME);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidScheme(stored)) {
        setScheme(stored as ColorSchemeId);
      }
    } catch {
      // ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && isValidScheme(e.newValue)) {
        setScheme(e.newValue as ColorSchemeId);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setColorScheme = useCallback((id: ColorSchemeId) => {
    setScheme(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
      document.documentElement.setAttribute("data-theme", id);
    } catch {
      // ignore
    }
  }, []);

  const resetColorScheme = useCallback(() => {
    setColorScheme(DEFAULT_COLOR_SCHEME);
  }, [setColorScheme]);

  return {
    scheme,
    setColorScheme,
    resetColorScheme,
    isClient,
    schemes: THEME_SCHEMES,
  };
}

function isValidScheme(value: string): value is ColorSchemeId {
  return THEME_SCHEMES.some((s) => s.id === value);
}
