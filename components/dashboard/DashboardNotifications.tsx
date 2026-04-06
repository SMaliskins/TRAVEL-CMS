"use client";

import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useStaffNotificationsToolbarQuery } from "@/hooks/useStaffNotificationsToolbarQuery";
import { ExternalLink } from "lucide-react";

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
  const { data: payload, isPending } = useStaffNotificationsToolbarQuery();
  const notifications = (payload?.notifications ?? []) as Notification[];
  const isLoading = isPending && !payload;

  const headerLabel = { en: "Notifications", ru: "Уведомления", lv: "Paziņojumi" };
  const viewAllLabel = { en: "View all", ru: "Все", lv: "Visi" };
  const emptyLabel = { en: "No notifications", ru: "Нет уведомлений", lv: "Nav paziņojumu" };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const total = notifications.length;

  return (
    <div className="booking-glass-panel !p-5 !overflow-visible">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          {headerLabel[lang as keyof typeof headerLabel] || headerLabel.en}
        </h3>
        {total > 0 && (
          <button
            onClick={() => window.open("/notifications", "_blank")}
            className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {viewAllLabel[lang as keyof typeof viewAllLabel] || viewAllLabel.en}
            <ExternalLink size={10} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-2 flex items-center justify-center py-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400" />
        </div>
      ) : (
        <>
          <p className="mt-1 text-3xl font-black text-gray-900">{total}</p>

          {unreadCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-blue-600 bg-blue-50">
              {unreadCount} unread
            </div>
          )}

          <div className="mt-3 space-y-1">
            {notifications.slice(0, 3).map((n) => (
              <button
                key={n.id}
                onClick={() => window.open(n.link || "/notifications", "_blank")}
                className={`w-full rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                  n.read ? "hover:bg-gray-50" : "bg-blue-50/50 hover:bg-blue-50"
                }`}
              >
                <div className="flex items-start gap-1.5">
                  <span className="text-xs shrink-0 leading-none mt-0.5">{notifIcon(n.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] leading-tight truncate ${n.read ? "text-gray-600" : "font-semibold text-gray-900"}`}>
                      {localizedText(n.title, lang)}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {timeAgo(n.created_at, lang)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {total === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">
                {emptyLabel[lang as keyof typeof emptyLabel] || emptyLabel.en}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
