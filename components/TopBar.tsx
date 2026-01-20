"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useClock } from "@/hooks/useClock";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/UserContext";
import TopBarProgress from "./TopBarProgress";
import TopBarSearch from "./TopBarSearch";

export default function TopBar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  
  const { prefs, isMounted: prefsMounted } = useUserPreferences();
  const now = useClock();
  const { profile } = useUser();
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  // Fetch company logo
  useEffect(() => {
    const fetchCompanyLogo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch("/api/company", { 
          headers: {
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include" 
        });
        if (response.ok) {
          const data = await response.json();
          if (data.company?.logo_url) {
            setCompanyLogo(data.company.logo_url);
          }
        }
      } catch (err) {
        console.error("Failed to fetch company logo:", err);
      }
    };
    fetchCompanyLogo();
  }, []);

  // Get initials from name
  const getInitials = () => {
    if (!profile) return "?";
    const first = profile.first_name?.[0] || "";
    const last = profile.last_name?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    setIsDropdownOpen(false);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout error:", error);
      }
      // Redirect to login page
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
      setIsLoggingOut(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        avatarRef.current &&
        !avatarRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  return (
    <div className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-gray-200 bg-white">
      <div className="flex h-full items-center gap-4 px-4">
        {/* Left side - Company Logo */}
        <div className="flex-shrink-0">
          {companyLogo && (
            <img 
              src={companyLogo} 
              alt="Company Logo" 
              className="h-8 max-w-[120px] object-contain"
            />
          )}
        </div>
        
        {/* Center - Progress widget */}
        <div className="flex flex-1 items-center justify-center">
          <TopBarProgress />
        </div>
        
        {/* Right side - Search and controls */}
        <div className="flex flex-shrink-0 items-center justify-end gap-2">
          {/* Multi-Search */}
          <div className="max-w-md">
            <TopBarSearch />
          </div>

          {/* Icons */}
          <div className="flex items-center gap-2">
          {/* Help */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
            title="Help"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* Notifications with badge */}
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
            title="Notifications"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"></span>
          </button>

          {/* Status */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
            title="Status"
          >
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
          </button>

          {/* Date + City */}
          {prefsMounted && now.getTime() !== 0 ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm text-gray-600">
                {new Intl.DateTimeFormat(prefs.language, {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  timeZone: prefs.timezone,
                }).format(now)}
              </span>
              <span className="text-xs text-gray-500">{prefs.cityLabel}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm text-gray-600">-- --- --</span>
              <span className="text-xs text-gray-500">--</span>
            </div>
          )}

          {/* Avatar with dropdown */}
          <div className="relative">
            <button
              ref={avatarRef}
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials()
              )}
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div
                ref={dropdownRef}
                className="absolute right-0 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg z-50"
              >
                <div className="py-1">
                  <a
                    href="/settings/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    My Profile
                  </a>
                  <div className="border-t border-gray-100 my-1" />
                  <a
                    href="/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Settings
                  </a>
                  <a
                    href="/settings/company"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Company
                  </a>
                  <a
                    href="/settings/users"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    User Management
                  </a>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 disabled:opacity-50"
                    onClick={handleLogout}
                  >
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}