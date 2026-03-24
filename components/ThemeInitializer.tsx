"use client";

import { useEffect } from "react";
import { STORAGE_KEY, VALID_SCHEME_IDS } from "@/lib/themeSchemes";

/**
 * Applies saved color scheme on client mount (handles SPA navigation
 * when inline script doesn't run again).
 */
export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const theme = stored && VALID_SCHEME_IDS.includes(stored as (typeof VALID_SCHEME_IDS)[number])
        ? stored
        : "classic";
      document.documentElement.setAttribute("data-theme", theme);
    } catch {
      document.documentElement.setAttribute("data-theme", "classic");
    }
  }, []);

  return null;
}
