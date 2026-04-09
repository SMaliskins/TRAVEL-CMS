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

/**
 * `app` — staff CMS (TopBar, orders, etc.).
 * `referral` — /referral web portal only, so language is not shared with other users on the same browser.
 */
export type UserPreferencesScope = "app" | "referral";

const STORAGE_KEYS: Record<UserPreferencesScope, string> = {
  app: "travelcms.user.preferences",
  referral: "travelcms.referral.portal.preferences",
};

const PREFS_CHANGED_EVENTS: Record<UserPreferencesScope, string> = {
  app: "travelcms:prefs-changed",
  referral: "travelcms:referral-prefs-changed",
};

export function useUserPreferences(scope: UserPreferencesScope = "app") {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isMounted, setIsMounted] = useState(false);

  const storageKey = STORAGE_KEYS[scope];
  const changedEvent = PREFS_CHANGED_EVENTS[scope];

  // Load preferences from localStorage after mount
  useEffect(() => {
    setIsMounted(true);

    const loadPrefs = () => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Merge with defaults to handle missing fields
          setPrefs({ ...DEFAULT_PREFERENCES, ...parsed });
        } else {
          setPrefs(DEFAULT_PREFERENCES);
        }
      } catch (e) {
        console.error("Failed to load user preferences from localStorage", e);
      }
    };

    loadPrefs();

    // Listen for storage events (changes from other tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setPrefs({ ...DEFAULT_PREFERENCES, ...parsed });
        } catch (e) {
          console.error("Failed to parse storage event", e);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Same-window updates (only this scope’s event)
    const handlePrefsChange = (e: Event) => {
      const ce = e as CustomEvent<UserPreferences>;
      if (ce.detail) {
        setTimeout(() => {
          setPrefs({ ...DEFAULT_PREFERENCES, ...ce.detail });
        }, 0);
      }
    };

    window.addEventListener(changedEvent, handlePrefsChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(changedEvent, handlePrefsChange);
    };
  }, [storageKey, changedEvent]);

  // Update preferences and save to localStorage
  const updatePrefs = useCallback(
    (partial: Partial<UserPreferences>) => {
      setPrefs((prevPrefs) => {
        const newPrefs = { ...prevPrefs, ...partial };

        try {
          localStorage.setItem(storageKey, JSON.stringify(newPrefs));

          window.dispatchEvent(new CustomEvent(changedEvent, { detail: newPrefs }));
        } catch (e) {
          console.error("Failed to save user preferences to localStorage", e);
        }

        return newPrefs;
      });
    },
    [storageKey, changedEvent]
  );

  return {
    prefs,
    updatePrefs,
    isMounted,
  };
}
