"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook to fetch current user's role for permission-based UI (e.g. sidebar nav visibility)
 */
export function useCurrentUserRole(): string | null {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;

        const res = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (cancelled) return;
        setRole(data.role ?? null);
      } catch {
        if (!cancelled) setRole(null);
      }
    }

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return role;
}
