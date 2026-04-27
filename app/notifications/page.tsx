"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { staffNotificationsRootQueryKey } from "@/lib/notifications/staffNotificationsQuery";
import { useStaffNotificationsFullQuery } from "@/hooks/useStaffNotificationsFullQuery";
import { useUser } from "@/contexts/UserContext";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  getReleaseNewsText,
  normalizeReleaseNewsLanguage,
  RELEASE_NEWS_LANGUAGES,
  type ReleaseNewsLanguage,
} from "@/lib/notifications/releaseNewsLanguage";
import { Bell, Rocket, Plane, AlertTriangle, CreditCard, CheckCircle2, Filter, ChevronDown, ChevronUp, Sparkles, Wrench, X, Image as ImageIcon } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  ref_id?: string;
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

interface ReleaseItem {
  type: "feature" | "fix";
  text: Record<string, string>;
  image: string | null;
}

interface ReleaseData {
  version: string;
  items: ReleaseItem[];
}

function extractReleaseDate(refId: string): string | null {
  const match = refId?.match(/system_update:(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

interface ReleaseStats {
  seenCount: number;
  readCount: number;
  reactions: Record<string, number>;
  reactionDetails: { emoji: string; userId: string; displayName: string }[];
}

const RELEASE_EMOJIS = [
  { key: "like", label: "Like", icon: "👍" },
  { key: "love", label: "Love", icon: "❤️" },
  { key: "wow", label: "Wow", icon: "😮" },
  { key: "celebrate", label: "Celebrate", icon: "🎉" },
] as const;

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { profile } = useUser();
  const { prefs } = useUserPreferences();
  const lang = prefs.language || "en";

  const {
    data: notifPayload,
    isPending: notifListPending,
  } = useStaffNotificationsFullQuery();
  const notifications = (notifPayload?.notifications ?? []) as Notification[];
  const isLoading = notifListPending && !notifPayload;
  const [activeSection, setActiveSection] = useState<Section>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [releaseCache, setReleaseCache] = useState<Record<string, ReleaseData>>({});
  const [releaseStatsCache, setReleaseStatsCache] = useState<Record<string, ReleaseStats>>({});
  const [expandedItemIdx, setExpandedItemIdx] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [reactionLoading, setReactionLoading] = useState<string | null>(null);
  const [releaseNewsLanguage, setReleaseNewsLanguage] = useState<ReleaseNewsLanguage>(() =>
    normalizeReleaseNewsLanguage(lang)
  );

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
    return headers;
  }, []);

  const fetchReleaseData = useCallback(async (date: string) => {
    if (releaseCache[date]) return;
    try {
      const res = await fetch(`/data/releases/${date}.json`);
      if (!res.ok) return;
      const data: ReleaseData = await res.json();
      setReleaseCache((prev) => ({ ...prev, [date]: data }));
    } catch {
      // no release data available
    }
  }, [releaseCache]);

  const recordReleaseView = useCallback(async (releaseVersion: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch("/api/notifications/release-view", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ releaseVersion }),
      });
    } catch {
      // silent
    }
  }, [getAuthHeaders]);

  const fetchReleaseStats = useCallback(async (releaseVersion: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/notifications/release-stats?releaseVersion=${encodeURIComponent(releaseVersion)}`,
        { headers, credentials: "include" }
      );
      if (!res.ok) return;
      const data: ReleaseStats = await res.json();
      setReleaseStatsCache((prev) => ({ ...prev, [releaseVersion]: data }));
    } catch {
      // silent
    }
  }, [getAuthHeaders]);

  const setReaction = useCallback(
    async (releaseVersion: string, emojiKey: string) => {
      const stats = releaseStatsCache[releaseVersion];
      const myReaction = stats?.reactionDetails?.find((d) => d.userId === profile?.id)?.emoji;
      const isRemoving = myReaction === emojiKey;
      const displayName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "—" : "—";

      setReactionLoading(emojiKey);
      setReleaseStatsCache((prev) => {
        const current = prev[releaseVersion];
        if (!current) return prev;
        const nextReactions = { ...current.reactions };
        let nextDetails = [...(current.reactionDetails || [])];
        if (isRemoving) {
          nextReactions[myReaction] = Math.max(0, (nextReactions[myReaction] || 1) - 1);
          nextDetails = nextDetails.filter((d) => !(d.userId === profile?.id && d.emoji === myReaction));
        } else {
          if (myReaction) {
            nextReactions[myReaction] = Math.max(0, (nextReactions[myReaction] || 1) - 1);
            nextDetails = nextDetails.filter((d) => d.userId !== profile?.id);
          }
          nextReactions[emojiKey] = (nextReactions[emojiKey] || 0) + 1;
          nextDetails.push({ emoji: emojiKey, userId: profile?.id ?? "", displayName });
        }
        return {
          ...prev,
          [releaseVersion]: {
            ...current,
            reactions: nextReactions,
            reactionDetails: nextDetails,
          },
        };
      });

      try {
        const headers = await getAuthHeaders();
        if (isRemoving) {
          const res = await fetch(`/api/notifications/release-reaction?releaseVersion=${encodeURIComponent(releaseVersion)}`, {
            method: "DELETE",
            headers,
            credentials: "include",
          });
          if (!res.ok) await fetchReleaseStats(releaseVersion);
        } else {
          const res = await fetch("/api/notifications/release-reaction", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ releaseVersion, emoji: emojiKey }),
          });
          if (!res.ok) await fetchReleaseStats(releaseVersion);
        }
      } catch {
        await fetchReleaseStats(releaseVersion);
      } finally {
        setReactionLoading(null);
      }
    },
    [getAuthHeaders, fetchReleaseStats, releaseStatsCache, profile]
  );

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
      void queryClient.invalidateQueries({ queryKey: staffNotificationsRootQueryKey });
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
      void queryClient.invalidateQueries({ queryKey: staffNotificationsRootQueryKey });
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
                const releaseDate = n.type === "system_update" ? extractReleaseDate(n.ref_id || "") : null;
                const release = releaseDate ? releaseCache[releaseDate] : null;

                return (
                  <div key={n.id} className={!n.read ? "bg-blue-50/40" : ""}>
                    <button
                      onClick={async () => {
                        if (!n.read) {
                          markAsRead([n.id]);
                          if (n.type === "system_update" && releaseDate) setTimeout(() => fetchReleaseStats(releaseDate), 300);
                        }
                        const newExpanded = isExpanded ? null : n.id;
                        setExpandedId(newExpanded);
                        setExpandedItemIdx(null);
                        if (newExpanded && n.type === "system_update" && releaseDate) {
                          fetchReleaseData(releaseDate);
                          recordReleaseView(releaseDate);
                          fetchReleaseStats(releaseDate);
                        }
                      }}
                      className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className="mt-0.5 text-xl shrink-0">{notifIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm leading-tight ${n.read ? "text-gray-700" : "font-semibold text-gray-900"}`}>
                            {localizedText(n.title, lang)}
                          </p>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                        </div>
                        {!isExpanded && (
                          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                            {localizedText(n.message, lang)}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-gray-400">{formatDate(n.created_at, lang)}</p>
                      </div>
                      <span className="mt-1 shrink-0 text-gray-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5">
                        {release ? (
                          <>
                          <div className="ml-9 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                            <span className="text-xs font-medium text-blue-700">
                              {lang === "ru" ? "Язык новостей" : lang === "lv" ? "Ziņu valoda" : "News language"}
                            </span>
                            <select
                              value={releaseNewsLanguage}
                              onChange={(event) => setReleaseNewsLanguage(normalizeReleaseNewsLanguage(event.target.value))}
                              className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                              {RELEASE_NEWS_LANGUAGES.map((option) => (
                                <option key={option.code} value={option.code}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="ml-9 space-y-1">
                            {release.items.map((item, idx) => {
                              const isItemExpanded = expandedItemIdx === idx;
                              const hasImage = !!item.image;
                              return (
                                <div key={idx}>
                                  <button
                                    onClick={() => {
                                      if (hasImage) setExpandedItemIdx(isItemExpanded ? null : idx);
                                    }}
                                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                                      hasImage ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"
                                    } ${isItemExpanded ? "bg-gray-100" : ""}`}
                                  >
                                    <span className="mt-0.5 shrink-0">
                                      {item.type === "feature" ? (
                                        <Sparkles size={14} className="text-amber-500" />
                                      ) : (
                                        <Wrench size={14} className="text-gray-400" />
                                      )}
                                    </span>
                                    <span className="flex-1 text-sm text-gray-700">
                                      {getReleaseNewsText(item.text, releaseNewsLanguage)}
                                    </span>
                                    {hasImage && (
                                      <span className="shrink-0 flex items-center gap-1 text-xs text-blue-500">
                                        <ImageIcon size={12} />
                                        {isItemExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      </span>
                                    )}
                                    {item.type === "feature" && !hasImage && (
                                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 uppercase">
                                        {lang === "ru" ? "Новое" : "New"}
                                      </span>
                                    )}
                                    {item.type === "fix" && (
                                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 uppercase">
                                        Fix
                                      </span>
                                    )}
                                  </button>
                                  {isItemExpanded && item.image && (
                                    <div className="ml-8 mt-1 mb-2">
                                      <button
                                        onClick={() => setLightboxSrc(item.image)}
                                        className="block rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow max-w-lg"
                                      >
                                        <img
                                          src={item.image}
                                          alt={getReleaseNewsText(item.text, releaseNewsLanguage)}
                                          className="w-full h-auto"
                                        />
                                      </button>
                                      <p className="mt-1 text-[10px] text-gray-400">
                                        {lang === "ru" ? "Нажмите для увеличения" : lang === "lv" ? "Noklikšķiniet, lai palielinātu" : "Click to enlarge"}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {releaseDate && (
                            <div className="ml-9 mt-4 pt-4 border-t border-gray-100 space-y-3">
                              {releaseStatsCache[releaseDate] && (
                                <p className="text-xs text-gray-500">
                                  {releaseStatsCache[releaseDate].seenCount} {lang === "ru" ? "увидели" : lang === "lv" ? "redzēja" : "saw"} · {releaseStatsCache[releaseDate].readCount} {lang === "ru" ? "прочитали" : lang === "lv" ? "izlasa" : "read"}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                {RELEASE_EMOJIS.map(({ key, icon, label }) => {
                                  const count = releaseStatsCache[releaseDate]?.reactions?.[key] ?? 0;
                                  const myReaction = releaseStatsCache[releaseDate]?.reactionDetails?.find((d) => d.userId === profile?.id)?.emoji;
                                  const isSelected = myReaction === key;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() => setReaction(releaseDate, key)}
                                      disabled={!!reactionLoading}
                                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm disabled:opacity-50 transition-colors ${
                                        isSelected
                                          ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                                          : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                                      }`}
                                      title={label}
                                    >
                                      <span>{icon}</span>
                                      {count > 0 && <span className={isSelected ? "text-blue-600" : "text-gray-600"}>{count}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                              {releaseStatsCache[releaseDate]?.reactionDetails?.length > 0 && (
                                <div className="text-xs text-gray-600">
                                  <span className="font-medium text-gray-500">
                                    {lang === "ru" ? "Кто поставил реакцию:" : lang === "lv" ? "Reakcijas:" : "Who reacted:"}
                                  </span>
                                  <ul className="mt-1 space-y-0.5">
                                    {releaseStatsCache[releaseDate].reactionDetails.map((d, i) => (
                                      <li key={i} className="flex items-center gap-1.5">
                                        <span>{RELEASE_EMOJIS.find((e) => e.key === d.emoji)?.icon ?? d.emoji}</span>
                                        <span>{d.displayName}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                          </>
                        ) : (
                          <div className="ml-9">
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">
                              {localizedText(n.message, lang)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 p-8"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
