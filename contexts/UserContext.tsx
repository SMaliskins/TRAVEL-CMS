"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface UserContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  updateAvatar: (url: string) => void;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          id: data.id,
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          avatar_url: data.avatar_url || null,
        });
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const updateAvatar = (url: string) => {
    setProfile((prev) => prev ? { ...prev, avatar_url: url } : null);
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <UserContext.Provider value={{ profile, isLoading, updateAvatar, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
