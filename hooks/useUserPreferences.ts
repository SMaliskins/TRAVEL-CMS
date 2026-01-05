"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

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

// Helper to get preferences from localStorage
const getPrefsFromStorage = (): UserPreferences => {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_PREFERENCES;
};

export function useUserPreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(getPrefsFromStorage);
  
  // Use useSyncExternalStore for isMounted to avoid hydration issues
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Load preferences from localStorage after mount and listen for changes
  useEffect(() => {
    // Listen for storage events (changes from other tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setPrefs({ ...DEFAULT_PREFERENCES, ...parsed });
        } catch {
          console.error("Failed to parse storage event");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also listen for custom events from same window (for immediate updates)
    // Use setTimeout to defer state update until after render phase to avoid React warning
    const handlePrefsChange = (e: Event) => {
      const customEvent = e as CustomEvent<UserPreferences>;
      if (customEvent.detail) {
        setTimeout(() => {
          setPrefs({ ...DEFAULT_PREFERENCES, ...customEvent.detail });
        }, 0);
      }
    };

    window.addEventListener("travelcms:prefs-changed", handlePrefsChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("travelcms:prefs-changed", handlePrefsChange);
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
