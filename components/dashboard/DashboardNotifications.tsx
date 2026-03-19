"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Bell, ExternalLink } from "lucide-react";

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

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/notifications/staff?limit=5", { headers, credentials: "include" });
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

  if (isLoading || notifications.length === 0) return null;

  const headerLabel = { en: "Notifications", ru: "Уведомления", lv: "Paziņojumi" };
  const viewAllLabel = { en: "View all", ru: "Все", lv: "Visi" };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Bell size={14} className="text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-600">{headerLabel[lang as keyof typeof headerLabel] || headerLabel.en}</h3>
          {notifications.some((n) => !n.read) && (
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          )}
        </div>
        <button
          onClick={() => router.push("/notifications")}
          className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          {viewAllLabel[lang as keyof typeof viewAllLabel] || viewAllLabel.en}
          <ExternalLink size={10} />
        </button>
      </div>

      <div className="space-y-1">
        {notifications.slice(0, 5).map((n) => (
          <button
            key={n.id}
            onClick={() => router.push(n.link || "/notifications")}
            className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
              n.read
                ? "hover:bg-gray-50"
                : "bg-blue-50/50 hover:bg-blue-50"
            }`}
          >
            <div className="flex items-start gap-1.5">
              <span className="text-xs shrink-0 leading-none mt-0.5">{notifIcon(n.type)}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] leading-tight truncate ${n.read ? "text-gray-600" : "font-semibold text-gray-900"}`}>
                  {localizedText(n.title, lang)}
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {localizedText(n.message, lang)}
                </p>
              </div>
              {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
