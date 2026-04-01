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
