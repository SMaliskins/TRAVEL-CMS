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

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Plane size={14} className="text-blue-500" />
          <h3 className="text-xs font-semibold text-gray-600">{t.title}</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  const openCount = checkins.filter((c) => c.status === "open" || c.status === "closing_soon").length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Plane size={14} className="text-blue-500" />
        <h3 className="text-xs font-semibold text-gray-600">{t.title}</h3>
        {openCount > 0 && (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
            {openCount}
          </span>
        )}
      </div>

      {checkins.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-3">{t.empty}</p>
      ) : (
        <div className="space-y-1.5">
          {checkins.slice(0, 8).map((c) => (
            <div key={`${c.serviceId}-${c.flightNumber}`}
              className={`rounded-lg px-2.5 py-2 ${
                c.status === "open" ? "bg-emerald-50 border border-emerald-200" :
                c.status === "closing_soon" ? "bg-amber-50 border border-amber-200" :
                c.status === "upcoming" ? "bg-blue-50/50 border border-blue-100" :
                "bg-gray-50 border border-gray-100"
              }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-gray-900">{c.flightNumber}</span>
                    {c.route && <span className="text-[10px] text-gray-500">{c.route}</span>}
                    {c.status === "open" || c.status === "closing_soon" ? (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        c.status === "closing_soon" ? "bg-amber-200 text-amber-800" : "bg-emerald-200 text-emerald-800"
                      }`}>
                        {c.status === "closing_soon" ? `${t.closing} ${c.closesIn}` : t.open}
                      </span>
                    ) : c.status === "upcoming" ? (
                      <span className="text-[9px] text-blue-600 font-medium flex items-center gap-0.5">
                        <Clock size={8} /> {t.upcoming} {c.opensIn}
                      </span>
                    ) : (
                      <span className="text-[9px] text-gray-400 font-medium">
                        {new Date(c.departureDateTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-700 font-medium">{c.clientName}</span>
                    <span className="text-[10px] text-gray-400">PNR: {c.pnr}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {c.checkinUrl && (c.status === "open" || c.status === "closing_soon") && (
                    <a href={c.checkinUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition">
                      Check-in <ExternalLink size={9} />
                    </a>
                  )}
                  <button onClick={() => router.push(`/orders/${c.orderCode}`)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">
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
