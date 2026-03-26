"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Plane, ExternalLink, Clock } from "lucide-react";

interface CheckinItem {
  serviceId: string;
  orderCode: string;
  flightNumber: string;
  clientName: string;
  pnr: string;
  departureDateTime: string;
  route: string;
  checkinUrl: string | null;
  status: "open" | "upcoming" | "closing_soon" | "scheduled";
  opensIn: string | null;
  closesIn: string | null;
}

const labels = {
  en: { title: "Flight Check-in", open: "OPEN", upcoming: "Opens in", closing: "Closes in", scheduled: "Scheduled", empty: "No upcoming flights", viewOrder: "Order" },
  ru: { title: "Онлайн-регистрация", open: "ОТКРЫТ", upcoming: "Откроется через", closing: "Закроется через", scheduled: "Запланирован", empty: "Нет ближайших рейсов", viewOrder: "Заказ" },
  lv: { title: "Lidojuma reģistrācija", open: "ATVĒRTS", upcoming: "Atvērsies pēc", closing: "Aizvērsies pēc", scheduled: "Ieplānots", empty: "Nav tuvāko lidojumu", viewOrder: "Pasūtījums" },
};

export default function DashboardCheckins() {
  const { prefs } = useUserPreferences();
  const lang = (prefs.language || "en") as keyof typeof labels;
  const t = labels[lang] || labels.en;
  const router = useRouter();

  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCheckins = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/dashboard/checkins", { headers, credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setCheckins(data.checkins || []);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCheckins();
    const interval = setInterval(fetchCheckins, 60000);
    return () => clearInterval(interval);
  }, [fetchCheckins]);

  const openCount = checkins.filter((c) => c.status === "open" || c.status === "closing_soon").length;

  return (
    <div className="booking-glass-panel !p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plane size={18} className="text-blue-500" />
          <h3 className="text-base font-bold text-gray-900">{t.title}</h3>
          {openCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
              {openCount}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
        </div>
      ) : checkins.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">{t.empty}</p>
      ) : (
        <div className="space-y-2">
          {checkins.slice(0, 6).map((c) => (
            <div key={`${c.serviceId}-${c.flightNumber}`}
              className={`rounded-lg px-3 py-2.5 ${
                c.status === "open" ? "bg-emerald-50 border border-emerald-200" :
                c.status === "closing_soon" ? "bg-amber-50 border border-amber-200" :
                c.status === "upcoming" ? "bg-blue-50/50 border border-blue-100" :
                "bg-gray-50 border border-gray-100"
              }`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-900">{c.flightNumber}</span>
                  {c.route && <span className="text-xs text-gray-500">{c.route}</span>}
                </div>
                {c.status === "open" || c.status === "closing_soon" ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    c.status === "closing_soon" ? "bg-amber-200 text-amber-800" : "bg-emerald-200 text-emerald-800"
                  }`}>
                    {c.status === "closing_soon" ? `${t.closing} ${c.closesIn}` : t.open}
                  </span>
                ) : c.status === "upcoming" ? (
                  <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5 shrink-0">
                    <Clock size={10} /> {t.upcoming} {c.opensIn}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 font-medium shrink-0">
                    {new Date(c.departureDateTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-700 font-medium truncate">{c.clientName}</span>
                  <span className="text-xs text-gray-400 shrink-0">PNR: {c.pnr}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.checkinUrl && (c.status === "open" || c.status === "closing_soon") && (
                    <a href={c.checkinUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition">
                      Check-in <ExternalLink size={10} />
                    </a>
                  )}
                  <button onClick={() => router.push(`/orders/${c.orderCode}`)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    {t.viewOrder}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
