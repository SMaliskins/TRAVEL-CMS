"use client";

import { useState, useEffect, useCallback } from "react";
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
  const total = checkins.length;

  return (
    <div className="booking-glass-panel !p-5 !overflow-visible">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
        {t.title}
      </h3>

      {isLoading ? (
        <div className="mt-2 flex items-center justify-center py-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
        </div>
      ) : (
        <>
          <p className="mt-1 text-3xl font-black text-gray-900">{total}</p>

          {openCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-emerald-600 bg-emerald-50">
              {openCount} open
            </div>
          )}

          <div className="mt-3 space-y-1.5 max-h-[240px] overflow-y-auto">
            {checkins.slice(0, 12).map((c, i) => (
              <div key={`${c.serviceId}-${c.flightNumber}-${c.pnr}-${i}`}
                className={`rounded-lg px-2.5 py-2 ${
                  c.status === "open" ? "bg-emerald-50 border border-emerald-200" :
                  c.status === "closing_soon" ? "bg-amber-50 border border-amber-200" :
                  c.status === "upcoming" ? "bg-blue-50/50 border border-blue-100" :
                  "bg-gray-50 border border-gray-100"
                }`}>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-gray-900">{c.flightNumber}</span>
                    {c.route && <span className="text-[10px] text-gray-500">{c.route}</span>}
                  </div>
                  {c.status === "open" || c.status === "closing_soon" ? (
                    c.checkinUrl ? (
                      <a href={c.checkinUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition shrink-0">
                        Check-in <ExternalLink size={8} />
                      </a>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 shrink-0">{t.open}</span>
                    )
                  ) : c.status === "upcoming" ? (
                    <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5 shrink-0">
                      <Clock size={8} /> {c.opensIn}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {new Date(c.departureDateTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <button
                    onClick={() => { navigator.clipboard.writeText(c.pnr); }}
                    className="text-[10px] font-mono font-bold text-gray-800 bg-gray-100 px-1 py-0.5 rounded cursor-pointer hover:bg-gray-200 transition active:bg-emerald-100"
                    title="Copy PNR"
                  >
                    {c.pnr}
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(c.clientName); }}
                    className="text-[11px] text-gray-700 font-medium truncate cursor-pointer hover:text-gray-900 transition active:text-emerald-700"
                    title="Copy name"
                  >
                    {c.clientName}
                  </button>
                  <button onClick={() => window.open(`/orders/${c.orderCode}`, "_blank")}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-medium shrink-0">
                    →
                  </button>
                </div>
              </div>
            ))}
            {total === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">{t.empty}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
