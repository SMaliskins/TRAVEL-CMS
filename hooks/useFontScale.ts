"use client";

import { useState, useEffect } from "react";

// Storage keys
const SCALE_STORAGE_KEY = "ui-font-scale";
const FONT_STORAGE_KEY = "ui-font-family";

// Scale presets (5 options)
export const SCALE_PRESETS = [
  { value: 0.8, label: "Compact", description: "Максимум информации" },
  { value: 0.9, label: "Small", description: "Меньше стандартного" },
  { value: 1.0, label: "Default", description: "Стандартный размер" },
  { value: 1.1, label: "Large", description: "Комфортный для чтения" },
  { value: 1.2, label: "Extra Large", description: "Максимальный размер" },
] as const;

// Font family presets (using CSS variables from next/font)
export const FONT_PRESETS = [
  { value: "system", label: "System", css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { value: "inter", label: "Inter", css: "var(--font-inter), -apple-system, sans-serif" },
  { value: "roboto", label: "Roboto", css: "var(--font-roboto), -apple-system, sans-serif" },
  { value: "opensans", label: "Open Sans", css: "var(--font-opensans), -apple-system, sans-serif" },
  { value: "lato", label: "Lato", css: "var(--font-lato), -apple-system, sans-serif" },
  { value: "nunito", label: "Nunito", css: "var(--font-nunito), -apple-system, sans-serif" },
  { value: "poppins", label: "Poppins", css: "var(--font-poppins), -apple-system, sans-serif" },
  { value: "sourcesans", label: "Source Sans", css: "var(--font-sourcesans), -apple-system, sans-serif" },
] as const;

const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.2;
const DEFAULT_FONT = "system";

export function useFontScale() {
  const [scale, setScaleState] = useState<number>(DEFAULT_SCALE);
  const [fontFamily, setFontFamilyState] = useState<string>(DEFAULT_FONT);
  const [isClient, setIsClient] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    
    // Load scale
    const storedScale = localStorage.getItem(SCALE_STORAGE_KEY);
    if (storedScale) {
      const parsed = parseFloat(storedScale);
      if (!isNaN(parsed) && parsed >= MIN_SCALE && parsed <= MAX_SCALE) {
        setScaleState(parsed);
        applyScale(parsed);
      } else {
        applyScale(DEFAULT_SCALE);
      }
    } else {
      applyScale(DEFAULT_SCALE);
    }
    
    // Load font family
    const storedFont = localStorage.getItem(FONT_STORAGE_KEY);
    if (storedFont) {
      setFontFamilyState(storedFont);
      applyFontFamily(storedFont);
    } else {
      applyFontFamily(DEFAULT_FONT);
    }
  }, []);

  const applyScale = (newScale: number) => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--font-scale", String(newScale));
      // Also apply to base font size
      document.documentElement.style.fontSize = `${newScale * 100}%`;
    }
  };

  const applyFontFamily = (fontValue: string) => {
    if (typeof document !== "undefined") {
      const preset = FONT_PRESETS.find(f => f.value === fontValue);
      if (preset) {
        document.documentElement.style.setProperty("--font-family", preset.css);
        document.body.style.fontFamily = preset.css;
      }
    }
  };

  const setScale = (newScale: number) => {
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    setScaleState(clampedScale);
    applyScale(clampedScale);
    
    try {
      localStorage.setItem(SCALE_STORAGE_KEY, String(clampedScale));
    } catch (e) {
      console.warn("Failed to save font scale:", e);
    }
  };

  const setFontFamily = (fontValue: string) => {
    setFontFamilyState(fontValue);
    applyFontFamily(fontValue);
    
    try {
      localStorage.setItem(FONT_STORAGE_KEY, fontValue);
    } catch (e) {
      console.warn("Failed to save font family:", e);
    }
  };

  // For slider (0-100 mapped to scale range)
  const setScaleFromSlider = (value: number) => {
    // Map 0-100 to MIN_SCALE-MAX_SCALE
    const newScale = MIN_SCALE + (value / 100) * (MAX_SCALE - MIN_SCALE);
    setScale(newScale);
  };

  const getSliderValue = () => {
    // Map scale to 0-100
    return Math.round(((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100);
  };

  // Get current preset index (for preset buttons)
  const getCurrentPresetIndex = () => {
    const index = SCALE_PRESETS.findIndex(p => Math.abs(p.value - scale) < 0.05);
    return index >= 0 ? index : 2; // Default to middle
  };

  const setScalePreset = (index: number) => {
    if (index >= 0 && index < SCALE_PRESETS.length) {
      setScale(SCALE_PRESETS[index].value);
    }
  };

  const resetFont = () => {
    setScale(DEFAULT_SCALE);
    setFontFamily(DEFAULT_FONT);
  };

  return {
    // Scale
    scale,
    setScale,
    setScaleFromSlider,
    getSliderValue,
    getCurrentPresetIndex,
    setScalePreset,
    // Font family
    fontFamily,
    setFontFamily,
    // Reset
    resetFont,
    // Meta
    isClient,
    MIN_SCALE,
    MAX_SCALE,
    DEFAULT_SCALE,
    SCALE_PRESETS,
    FONT_PRESETS,
  };
}

