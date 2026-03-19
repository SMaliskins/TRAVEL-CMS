"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Bell, Rocket, Plane, AlertTriangle, CreditCard, CheckCircle2, Filter } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

type Section = "all" | "system" | "checkin" | "payments" | "passport";

const SECTIONS: { key: Section; label: Record<string, string>; types: string[]; icon: React.ReactNode }[] = [
  { key: "all", label: { en: "All", ru: "Все", lv: "Visi" }, types: [], icon: <Bell size={16} /> },
  { key: "system", label: { en: "System", ru: "Система", lv: "Sistēma" }, types: ["system_update"], icon: <Rocket size={16} /> },
  { key: "checkin", label: { en: "Check-in", ru: "Регистрация", lv: "Reģistrācija" }, types: ["checkin_open", "checkin_reminder"], icon: <Plane size={16} /> },
  { key: "payments", label: { en: "Payments", ru: "Платежи", lv: "Maksājumi" }, types: ["payment_overdue"], icon: <CreditCard size={16} /> },
  { key: "passport", label: { en: "Passport", ru: "Паспорт", lv: "Pase" }, types: ["passport_expiry"], icon: <AlertTriangle size={16} /> },
];

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

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "ru" ? "ru-RU" : lang === "lv" ? "lv-LV" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const { prefs } = useUserPreferences();
  const lang = prefs.language || "en";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/notifications/staff?limit=200", { headers, credentials: "include" });
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

  const markAsRead = async (ids: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      await fetch("/api/notifications/staff", {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
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
    } catch {
      // silent
    }
  };

  const sectionDef = SECTIONS.find((s) => s.key === activeSection)!;
  const filtered = activeSection === "all"
    ? notifications
    : notifications.filter((n) => sectionDef.types.includes(n.type));

  const unreadCount = filtered.filter((n) => !n.read).length;

  const title: Record<string, string> = { en: "Notifications", ru: "Уведомления", lv: "Paziņojumi" };
  const markAllLabel: Record<string, string> = { en: "Mark all as read", ru: "Отметить все как прочитанные", lv: "Atzīmēt visus kā lasītus" };
  const emptyLabel: Record<string, string> = { en: "No notifications", ru: "Нет уведомлений", lv: "Nav paziņojumu" };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Bell size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title[lang] || title.en}</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-500">
                  {unreadCount} {lang === "ru" ? "непрочитанных" : lang === "lv" ? "nelasīti" : "unread"}
                </p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                {markAllLabel[lang] || markAllLabel.en}
              </div>
            </button>
          )}
        </div>

        {/* Section tabs */}
        <div className="mb-4 flex items-center gap-1 rounded-lg bg-white border border-gray-200 p-1">
          <Filter size={16} className="text-gray-400 ml-2 mr-1 shrink-0" />
          {SECTIONS.map((section) => {
            const count = section.key === "all"
              ? notifications.length
              : notifications.filter((n) => section.types.includes(n.type)).length;
            if (count === 0 && section.key !== "all") return null;
            return (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeSection === section.key
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {section.icon}
                {section.label[lang] || section.label.en}
                <span className={`ml-0.5 text-xs ${activeSection === section.key ? "text-blue-200" : "text-gray-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {isLoading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              {lang === "ru" ? "Загрузка..." : "Loading..."}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bell size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-400">{emptyLabel[lang] || emptyLabel.en}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((n) => {
                const isExpanded = expandedId === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markAsRead([n.id]);
                      setExpandedId(isExpanded ? null : n.id);
                    }}
                    className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 ${
                      !n.read ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <span className="mt-0.5 text-xl shrink-0">{notifIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm leading-tight ${n.read ? "text-gray-700" : "font-semibold text-gray-900"}`}>
                          {localizedText(n.title, lang)}
                        </p>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                      <p className={`mt-1 text-sm text-gray-600 ${isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
                        {localizedText(n.message, lang)}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">{formatDate(n.created_at, lang)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
