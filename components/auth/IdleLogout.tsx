"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/** Staff app: sign out if no user input for this long (browser tab). */
const IDLE_MS = 4 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
] as const;

/**
 * Logs the user out after prolonged inactivity (main shell only; mounted with SessionHeartbeat).
 */
export default function IdleLogout() {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const loggingOutRef = useRef(false);

  const checkIdle = useCallback(async () => {
    if (loggingOutRef.current) return;
    if (Date.now() - lastActivityRef.current < IDLE_MS) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    loggingOutRef.current = true;
    try {
      await supabase.auth.signOut();
    } catch {
      // still redirect
    }
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const bump = () => {
      lastActivityRef.current = Date.now();
    };

    lastActivityRef.current = Date.now();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, bump, { passive: true });
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkIdle();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const intervalId = window.setInterval(() => {
      void checkIdle();
    }, CHECK_INTERVAL_MS);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, bump);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
    };
  }, [checkIdle]);

  return null;
}
