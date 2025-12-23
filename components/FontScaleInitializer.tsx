"use client";

import { useEffect } from "react";

export default function FontScaleInitializer() {
  useEffect(() => {
    // This runs after hydration, but the inline script in layout already set it.
    // This is just a fallback to ensure consistency.
    const stored = localStorage.getItem("ui-font-scale");
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0.85 && parsed <= 1.2) {
        document.documentElement.style.setProperty("--font-scale", String(parsed));
      } else {
        document.documentElement.style.setProperty("--font-scale", "1");
      }
    } else {
      document.documentElement.style.setProperty("--font-scale", "1");
    }
  }, []);

  return null;
}

