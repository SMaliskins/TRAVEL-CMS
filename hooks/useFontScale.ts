"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "ui-font-scale";
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.2;

const SCALE_STEPS = {
  decrease: 0.9,
  default: 1,
  increase: 1.1,
} as const;

export function useFontScale() {
  const [scale, setScaleState] = useState<number>(DEFAULT_SCALE);
  const [isClient, setIsClient] = useState(false);

  // Load scale from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= MIN_SCALE && parsed <= MAX_SCALE) {
        setScaleState(parsed);
        applyScale(parsed);
      } else {
        applyScale(DEFAULT_SCALE);
      }
    } else {
      applyScale(DEFAULT_SCALE);
    }
  }, []);

  const applyScale = (newScale: number) => {
    if (typeof document !== "undefined") {
      // Set CSS variable on html element (document.documentElement)
      document.documentElement.style.setProperty("--font-scale", String(newScale));
    }
  };

  const setScale = (newScale: number) => {
    // Clamp scale between MIN and MAX
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    
    // (a) Update state
    setScaleState(clampedScale);
    
    // (b) Set CSS var on html
    applyScale(clampedScale);
    
    // (c) Write to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, String(clampedScale));
    } catch (e) {
      // Ignore localStorage errors (e.g., in private browsing)
      console.warn("Failed to save font scale to localStorage:", e);
    }
  };

  const decreaseFont = () => {
    // Step down: if at 1.1 or above, go to 1.0
    // If at 1.0, go to 0.9
    // If at 0.9, go to 0.85 (min)
    if (scale >= SCALE_STEPS.increase) {
      setScale(SCALE_STEPS.default);
    } else if (scale >= SCALE_STEPS.default) {
      setScale(SCALE_STEPS.decrease);
    } else if (scale > MIN_SCALE) {
      setScale(MIN_SCALE);
    }
    // Already at minimum, do nothing
  };

  const increaseFont = () => {
    // Step up: if at 0.9 or below, go to 1.0
    // If at 1.0, go to 1.1
    // If at 1.1, go to 1.2 (max)
    if (scale <= SCALE_STEPS.decrease) {
      setScale(SCALE_STEPS.default);
    } else if (scale <= SCALE_STEPS.default) {
      setScale(SCALE_STEPS.increase);
    } else if (scale < MAX_SCALE) {
      setScale(MAX_SCALE);
    }
    // Already at maximum, do nothing
  };

  const setScaleFromSlider = (value: number) => {
    // Map slider 0-2 to scale 0.85-1.2
    // 0 -> 0.85, 1 -> 1.0, 2 -> 1.2
    let newScale: number;
    if (value === 0) {
      newScale = MIN_SCALE; // 0.85
    } else if (value === 1) {
      newScale = DEFAULT_SCALE; // 1.0
    } else {
      newScale = MAX_SCALE; // 1.2
    }
    setScale(newScale);
  };

  const getSliderValue = () => {
    // Map scale to slider 0-2
    if (scale <= SCALE_STEPS.decrease) return 0; // Small
    if (scale <= SCALE_STEPS.default) return 1; // Default
    return 2; // Large
  };

  const resetFont = () => {
    setScale(DEFAULT_SCALE);
  };

  // Active states: highlight button closest to current scale
  const isDecreaseActive = scale < DEFAULT_SCALE && scale >= SCALE_STEPS.decrease - 0.05;
  const isDefaultActive = Math.abs(scale - DEFAULT_SCALE) < 0.05;
  const isIncreaseActive = scale > DEFAULT_SCALE && scale <= SCALE_STEPS.increase + 0.05;

  return {
    scale,
    decreaseFont,
    increaseFont,
    resetFont,
    setScaleFromSlider,
    getSliderValue,
    isDecreaseActive,
    isIncreaseActive,
    isDefaultActive,
    isClient,
    MIN_SCALE,
    MAX_SCALE,
    DEFAULT_SCALE,
  };
}

