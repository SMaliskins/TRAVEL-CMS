# CODE WRITER TASK: Fix React Hydration Error #185

**Created:** 2026-01-05  
**Priority:** CRITICAL (site broken in production)  
**Requested by:** SM  

---

## Problem

Production site shows:
```
Error: Minified React error #185
```

This is a **Hydration Error** — server HTML doesn't match client render.

---

## Root Cause

Incorrect changes to hooks in commit `0a8c06a`:

1. **`useSidebar.ts`** — `useState(getSidebarModeFromStorage)` calls localStorage on server
2. **`useSidebar.ts`** — wrong `useSyncExternalStore` usage (returns function instead of cleanup)
3. **`useUserPreferences.ts`** — same issues as useSidebar
4. **`useClock.ts`** — may have issues with `useSyncExternalStore`

---

## Solution

Revert hooks to original version from `main` branch, keeping only the valid fix in `useFontScale.ts`.

---

## Changes Required

### 1. `hooks/useClock.ts` — REVERT to original

```typescript
"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Hook that provides current time, updating every second
 * Safe for SSR - returns a consistent date on initial render
 */
export function useClock(): Date {
  // Initialize with null to ensure consistent SSR/client rendering
  const [now, setNow] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Set initial time only on client
    setNow(new Date());

    const tick = () => {
      setNow(new Date());
    };

    // Update every second for better synchronization
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Return a default date during SSR to avoid hydration mismatch
  return now || new Date(0);
}
```

### 2. `hooks/useSidebar.ts` — REVERT to original

```typescript
"use client";

import { useState, useEffect } from "react";

export type SidebarMode = "expanded" | "collapsed" | "hover";

const STORAGE_KEY_MODE = "travelcms.sidebar.mode";

const RAIL_WIDTH = 72;
const EXPANDED_WIDTH = 260;

export function useSidebar() {
  const [mode, setModeState] = useState<SidebarMode>("hover");
  const [isHovered, setIsHoveredState] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load mode from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    try {
      const storedMode = localStorage.getItem(STORAGE_KEY_MODE);
      if (storedMode === "expanded" || storedMode === "collapsed" || storedMode === "hover") {
        setModeState(storedMode);
      }
    } catch (e) {
      console.warn("Failed to load sidebar mode:", e);
    }
  }, []);

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
```

### 3. `hooks/useUserPreferences.ts` — REVERT to original

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

export type UserPreferences = {
  timezone: string; // IANA, e.g. "Europe/Riga"
  cityLabel: string; // e.g. "Riga"
  currency: string; // ISO 4217, e.g. "EUR"
  language: string; // BCP-47, e.g. "en"
};

const DEFAULT_PREFERENCES: UserPreferences = {
  timezone: "Europe/Riga",
  cityLabel: "Riga",
  currency: "EUR",
  language: "en",
};

const STORAGE_KEY = "travelcms.user.preferences";

export function useUserPreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isMounted, setIsMounted] = useState(false);

  // Load preferences from localStorage after mount
  useEffect(() => {
    setIsMounted(true);
    
    const loadPrefs = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Merge with defaults to handle missing fields
          setPrefs({ ...DEFAULT_PREFERENCES, ...parsed });
        }
      } catch (e) {
        console.error("Failed to load user preferences from localStorage", e);
      }
    };

    loadPrefs();

    // Listen for storage events (changes from other tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setPrefs({ ...DEFAULT_PREFERENCES, ...parsed });
        } catch (e) {
          console.error("Failed to parse storage event", e);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also listen for custom events from same window (for immediate updates)
    // Use setTimeout to defer state update until after render phase to avoid React warning
    const handlePrefsChange = (e: CustomEvent) => {
      if (e.detail) {
        setTimeout(() => {
          setPrefs({ ...DEFAULT_PREFERENCES, ...e.detail });
        }, 0);
      }
    };

    window.addEventListener("travelcms:prefs-changed" as any, handlePrefsChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("travelcms:prefs-changed" as any, handlePrefsChange);
    };
  }, []);

  // Update preferences and save to localStorage
  const updatePrefs = useCallback((partial: Partial<UserPreferences>) => {
    setPrefs((prevPrefs) => {
      const newPrefs = { ...prevPrefs, ...partial };
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
        
        // Dispatch custom event for same-window updates
        window.dispatchEvent(
          new CustomEvent("travelcms:prefs-changed", { detail: newPrefs })
        );
      } catch (e) {
        console.error("Failed to save user preferences to localStorage", e);
      }
      
      return newPrefs;
    });
  }, []);

  return {
    prefs,
    updatePrefs,
    isMounted,
  };
}
```

### 4. `hooks/useFontScale.ts` — KEEP current version (fix is valid)

The `applyScale` function move is correct and doesn't cause hydration issues.

---

## Verification

```bash
npm run build
```

Then deploy and verify no hydration error in production.

---

## Smoke Test

- [ ] `npm run build` completes successfully
- [ ] No React Error #185 in production
- [ ] Sidebar works correctly
- [ ] Clock displays correctly
- [ ] User preferences load correctly

