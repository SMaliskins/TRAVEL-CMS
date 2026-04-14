"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getOrCreateStaffDeviceId } from "@/lib/auth/staffDeviceId";

const INTERVAL_MS = 2 * 60 * 1000;

/**
 * Keeps user_auth_sessions updated while the staff UI is open (Supervisor visibility).
 */
export default function SessionHeartbeat() {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const send = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const deviceId = getOrCreateStaffDeviceId();
        if (!deviceId) return;
        await fetch("/api/auth/session-heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ deviceId }),
          credentials: "include",
        });
      } catch {
        // ignore network errors
      }
    };

    send();
    const id = window.setInterval(() => {
      if (mounted.current) void send();
    }, INTERVAL_MS);

    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
