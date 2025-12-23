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
