"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Bell, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

function localizedText(text: string, lang: string): string {
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      return obj[lang] || obj["en"] || text;
    } catch {
      return text;
    }
  }
  return text;
}

function notifIcon(type: string): string {
  switch (type) {
    case "checkin_open": return "✈️";
    case "checkin_reminder": return "⏰";
    case "passport_expiry": return "⚠️";
    case "payment_overdue": return "🔴";
    case "system_update": return "🚀";
    default: return "🔔";
  }
}

function timeAgo(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === "ru" ? "только что" : lang === "lv" ? "tikko" : "just now";
  if (mins < 60) return `${mins}${lang === "ru" ? " мин" : "m"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${lang === "ru" ? " ч" : "h"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days}${lang === "ru" ? " д" : "d"} ago`;
}

export default function DashboardNotifications() {
  const { prefs } = useUserPreferences();
  const lang = prefs.language || "en";
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/notifications/staff?limit=20", { headers, credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (isLoading || notifications.length === 0) return null;

  const headerLabel = { en: "Notifications", ru: "Уведомления", lv: "Paziņojumi" };
  const viewAllLabel = { en: "View all", ru: "Все", lv: "Visi" };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">{headerLabel[lang as keyof typeof headerLabel] || headerLabel.en}</h3>
          {notifications.some((n) => !n.read) && (
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => router.push("/notifications")}
            className="ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            {viewAllLabel[lang as keyof typeof viewAllLabel] || viewAllLabel.en}
            <ExternalLink size={12} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => router.push("/notifications")}
            className={`shrink-0 w-[280px] rounded-lg border p-3 text-left transition-all hover:shadow-md ${
              n.read
                ? "border-gray-200 bg-gray-50 hover:border-gray-300"
                : "border-blue-200 bg-blue-50/50 hover:border-blue-300"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-base shrink-0">{notifIcon(n.type)}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm leading-tight truncate ${n.read ? "text-gray-700" : "font-semibold text-gray-900"}`}>
                  {localizedText(n.title, lang)}
                </p>
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                  {localizedText(n.message, lang)}
                </p>
                <p className="mt-1.5 text-[10px] text-gray-400">{timeAgo(n.created_at, lang)}</p>
              </div>
              {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
