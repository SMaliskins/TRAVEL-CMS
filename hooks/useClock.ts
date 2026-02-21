"use client";

import { useState, useEffect, useRef } from "react";

const EPOCH = new Date(0);

/**
 * Hook that provides current time, updating every second
 * Safe for SSR - returns a consistent date on initial render
 */
export function useClock(): Date {
  const [now, setNow] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setNow(new Date());

    intervalRef.current = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return now ?? EPOCH;
}
