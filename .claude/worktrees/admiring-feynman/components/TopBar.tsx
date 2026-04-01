"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useNavigationHistory } from "@/contexts/NavigationHistoryContext";
import { useModalOverlayContext } from "@/contexts/ModalOverlayContext";
import { useClock } from "@/hooks/useClock";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/UserContext";

interface StaffNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

function notifIcon(type: string): string {
  switch (type) {
    case "checkin_open": return "✈️";
    case "checkin_reminder": return "⏰";
    case "passport_expiry": return "⚠️";
    case "payment_overdue": return "🔴";
    default: return "🔔";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function TopBar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  
  const { prefs, isMounted: prefsMounted } = useUserPreferences();
  const { canGoBack, canGoForward, goBack, goForward } = useNavigationHistory();
  const now = useClock();
  const { profile } = useUser();
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [gitCommitSha, setGitCommitSha] = useState<string>("");
  const shortCommitSha = gitCommitSha ? gitCommitSha.slice(0, 7) : "";

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

  // Always read commit SHA from server to avoid stale inlined env values.
  useEffect(() => {
    const fetchCommitSha = async () => {
      try {
        const response = await fetch(`/api/meta/commit?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { sha?: string; shortSha?: string };
        const sha = data.sha;
        const shortSha = data.shortSha;
        if (sha) {
          setGitCommitSha((prev) => (prev === sha ? prev : sha));
        } else if (shortSha) {
          setGitCommitSha((prev) => (prev === shortSha ? prev : shortSha));
        }
      } catch {
        // Silent fallback: commit badge just stays hidden
      }
    };

    fetchCommitSha();
  }, []);

  // ── Notifications ──
  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/notifications/staff", { headers, credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/notifications/staff?unreadCount=true", { headers, credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (notifOpen) fetchNotifications();
  }, [notifOpen, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      await fetch("/api/notifications/staff", {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleNotifClick = async (n: StaffNotification) => {
    if (!n.read) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

        await fetch("/api/notifications/staff", {
          method: "PATCH",
          headers,
          credentials: "include",
          body: JSON.stringify({ ids: [n.id] }),
        });
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // silent
      }
    }
    if (n.link) {
      setNotifOpen(false);
      router.push(n.link);
    }
  };

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClickOutsideNotif(event: MouseEvent) {
      if (
        notifRef.current && !notifRef.current.contains(event.target as Node) &&
        notifBtnRef.current && !notifBtnRef.current.contains(event.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutsideNotif);
      return () => document.removeEventListener("mousedown", handleClickOutsideNotif);
    }
  }, [notifOpen]);

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

  const modalOverlay = useModalOverlayContext();
  const isModalOpen = (modalOverlay?.modalCount ?? 0) > 0;
  if (isModalOpen) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-gray-200 bg-white">
      <div className="flex h-full items-center gap-4 px-4">
        {/* Left side - Nav + Company Logo */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Back / Forward */}
          <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={goBack}
              disabled={!canGoBack}
              className="flex h-8 w-8 items-center justify-center rounded-l-lg text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              title="Back"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goForward}
              disabled={!canGoForward}
              className="flex h-8 w-8 items-center justify-center rounded-r-lg border-l border-gray-200 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              title="Forward"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {companyLogo && (
            <img 
              src={companyLogo} 
              alt="Company Logo" 
              className="h-10 max-w-[140px] object-contain"
            />
          )}
          {shortCommitSha ? (
            <span
              className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-mono text-gray-600"
              title={`Deploy: ${gitCommitSha}`}
            >
              Deploy {shortCommitSha}
            </span>
          ) : null}
        </div>
        
        {/* Right side - Controls */}
        <div className="flex flex-1 flex-shrink-0 items-center justify-end gap-2">

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
          <div className="relative">
            <button
              ref={notifBtnRef}
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
              title="Notifications"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                ref={notifRef}
                className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl z-50 flex flex-col"
              >
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                  <span className="text-sm font-semibold text-gray-800">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:text-blue-800">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                          n.read ? "" : "bg-blue-50/40"
                        }`}
                      >
                        <span className="mt-0.5 flex-shrink-0 text-base">{notifIcon(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-tight ${n.read ? "text-gray-600" : "font-medium text-gray-900"}`}>
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500 truncate">{n.message}</p>
                          <p className="mt-1 text-[10px] text-gray-400">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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