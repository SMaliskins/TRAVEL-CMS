"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";

// Subscription for external store pattern
const subscribe = (callback: () => void) => {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
};

const getSnapshot = () => new Date();
const getServerSnapshot = () => new Date(0);

/**
 * Hook that provides current time, updating every second
 * Safe for SSR - returns a consistent date on initial render
 */
export function useClock(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
