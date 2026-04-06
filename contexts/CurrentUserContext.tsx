"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";

/** Payload aligned with GET /api/users/me */
export type CurrentUserMe = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  role_id?: string | null;
  role: string | null;
  company_id?: string | null;
};

export type CurrentUserContextValue = {
  user: CurrentUserMe | null;
  role: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

async function fetchMeFromApi(): Promise<{ user: CurrentUserMe | null; error: string | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { user: null, error: null };
    }
    const res = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      credentials: "include",
    });
    if (!res.ok) {
      return {
        user: null,
        error: res.status === 401 ? null : `Failed (${res.status})`,
      };
    }
    const data = (await res.json()) as {
      id?: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      role_id?: string | null;
      role?: string | null;
      company_id?: string | null;
    };
    return {
      user: {
        id: String(data.id ?? ""),
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email ?? null,
        role_id: data.role_id ?? null,
        role: data.role ?? null,
        company_id: data.company_id ?? null,
      },
      error: null,
    };
  } catch {
    return { user: null, error: "network" };
  }
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUserMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncFromSession = useCallback(async () => {
    setIsLoading(true);
    const { user: next, error: err } = await fetchMeFromApi();
    setUser(next);
    setError(err);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void syncFromSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncFromSession();
    });
    return () => subscription.unsubscribe();
  }, [syncFromSession]);

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isLoading,
      error,
      refresh: syncFromSession,
    }),
    [user, isLoading, error, syncFromSession]
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return ctx;
}

/** Same return type as legacy hook — reads shared /api/users/me state */
export function useCurrentUserRole(): string | null {
  return useCurrentUser().role;
}
