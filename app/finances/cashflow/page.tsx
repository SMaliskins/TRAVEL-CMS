"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";

interface CashPayment {
  id: string;
  order_code: string | null;
  order_client: string | null;
  method: string;
  amount: number;
  currency: string;
  paid_at: string;
  payer_name: string | null;
  account_name: string | null;
  bank_name: string | null;
  note: string | null;
}

interface DailyReport {
  date: string;
  payments: CashPayment[];
  total: number;
}

type Tab = "cash" | "bank";

const CASHFLOW_STORAGE_KEY = "travelcms.finances.cashflow.filters";

function loadCashflowFilters() {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(CASHFLOW_STORAGE_KEY);
    if (s) return JSON.parse(s) as { tab: Tab; period: PeriodType; dateFrom: string; dateTo: string };
  } catch {}
  return null;
}

function saveCashflowFilters(f: { tab: Tab; period: PeriodType; dateFrom: string; dateTo: string }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CASHFLOW_STORAGE_KEY, JSON.stringify(f));
  } catch {}
}

export default function CashFlowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(() => loadCashflowFilters()?.tab ?? "cash");
  const [dailyReport, setDailyReport] = useState<DailyReport[]>([]);
  const [allPayments, setAllPayments] = useState<CashPayment[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);

  const [period, setPeriod] = useState<PeriodType>(() => loadCashflowFilters()?.period ?? "currentMonth");
  const [dateFrom, setDateFrom] = useState(() => {
    const s = loadCashflowFilters();
    if (s?.dateFrom) return s.dateFrom;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo] = useState(() => loadCashflowFilters()?.dateTo ?? new Date().toISOString().slice(0, 10));

  const handlePeriodChange = (newPeriod: PeriodType, startDate?: string, endDate?: string) => {
    setPeriod(newPeriod);
    if (startDate && endDate) {
      setDateFrom(startDate);
      setDateTo(endDate);
    }
  };

  useEffect(() => {
    saveCashflowFilters({ tab, period, dateFrom, dateTo });
  }, [tab, period, dateFrom, dateTo]);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const method = tab === "cash" ? "cash" : "bank";
      let effectiveDateTo = dateTo;
      if (tab === "cash") {
        const from = new Date(dateFrom + "T00:00:00");
        const to = new Date(dateTo + "T00:00:00");
        const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        if (days > MAX_CALENDAR_DAYS) {
          const cap = new Date(from);
          cap.setDate(cap.getDate() + MAX_CALENDAR_DAYS - 1);
          effectiveDateTo = cap.toISOString().slice(0, 10);
        }
      }
      const params = new URLSearchParams({
        method,
        dateFrom,
        dateTo: effectiveDateTo,
      });

      const res = await fetch(`/api/finances/cashflow?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setDailyReport(json.data?.dailyReport ?? []);
        setAllPayments(json.data?.payments ?? []);
        setGrandTotal(json.data?.grandTotal ?? 0);
      }
    } catch (err) {
      console.error("Error loading cashflow:", err);
    } finally {
      setLoading(false);
    }
  }, [tab, dateFrom, dateTo, router]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) =>
    `\u20ac${Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Z-Report calendar: max 3 months
  const MAX_CALENDAR_DAYS = 93;
  const totalByDate = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of dailyReport) {
      map[d.date] = d.total;
    }
    return map;
  }, [dailyReport]);

  const calendarRange = React.useMemo(() => {
    if (tab !== "cash") return { start: "", end: "", days: [] as string[] };
    const from = new Date(dateFrom + "T00:00:00");
    const to = new Date(dateTo + "T00:00:00");
    let end = new Date(to);
    const diffDays = Math.ceil((end.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (diffDays > MAX_CALENDAR_DAYS) {
      end = new Date(from);
      end.setDate(end.getDate() + MAX_CALENDAR_DAYS - 1);
    }
    const days: string[] = [];
    const cur = new Date(from);
    const endStr = end.toISOString().slice(0, 10);
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10);
      days.push(d);
      if (d === endStr) break;
      cur.setDate(cur.getDate() + 1);
    }
    return { start: dateFrom, end: end.toISOString().slice(0, 10), days };
  }, [tab, dateFrom, dateTo]);

  const calendarByMonth = React.useMemo(() => {
    if (calendarRange.days.length === 0) return [];
    const byMonth: { monthKey: string; monthLabel: string; days: { date: string; dayOfMonth: number; weekday: number; total: number }[] }[] = [];
    let currentMonth = "";
    let currentRows: { date: string; dayOfMonth: number; weekday: number; total: number }[] = [];
    const weekStartsOnMonday = 1;
    for (const dateStr of calendarRange.days) {
      const d = new Date(dateStr + "T00:00:00");
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const dayOfMonth = d.getDate();
      let weekday = d.getDay() - 1;
      if (weekday < 0) weekday = 6;
      const total = totalByDate[dateStr] ?? 0;
      const monthLabel = (() => {
        const [y, m] = monthKey.split("-");
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        return `${d.toLocaleString("en-US", { month: "short" })} ${y}`;
      })();
      if (monthKey !== currentMonth && currentRows.length > 0) {
        const prevLabel = (() => {
          const [y, m] = currentMonth.split("-");
          const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
          return `${d.toLocaleString("en-US", { month: "short" })} ${y}`;
        })();
        byMonth.push({ monthKey: currentMonth, monthLabel: prevLabel, days: currentRows });
        currentRows = [];
      }
      currentMonth = monthKey;
      currentRows.push({ date: dateStr, dayOfMonth, weekday, total });
    }
    if (currentRows.length > 0) {
      const [y, m] = currentMonth.split("-");
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      byMonth.push({
        monthKey: currentMonth,
        monthLabel: `${d.toLocaleString("en-US", { month: "short" })} ${y}`,
        days: currentRows,
      });
    }
    return byMonth;
  }, [calendarRange.days, totalByDate]);

  const scrollToDay = (date: string) => {
    const el = document.getElementById(`day-${date}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cash Flow</h1>
        <p className="text-sm text-gray-600 mt-1">
          Daily cash reports (Z-report) and bank movements
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("cash")}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            tab === "cash"
              ? "bg-green-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Z-Report (Cash)
        </button>
        <button
          onClick={() => setTab("bank")}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            tab === "bank"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Bank Movements
        </button>
      </div>

      {/* Date filters */}
      <div className="mb-4 flex items-center gap-3">
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          startDate={dateFrom}
          endDate={dateTo}
          dropdownAlign="left"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : tab === "cash" && calendarByMonth.length > 0 ? (
        <div className="space-y-4">
          {/* Z-Report calendar (max 3 months) */}
          {calendarByMonth.map(({ monthKey, monthLabel, days }) => {
            const firstWeekday = days[0]?.weekday ?? 0;
            const padStart = firstWeekday;
            const cellCount = padStart + days.length;
            const padEnd = cellCount % 7 === 0 ? 0 : 7 - (cellCount % 7);
            const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
            return (
              <div key={monthKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 text-xs font-semibold text-gray-700">
                  {monthLabel}
                </div>
                <div className="p-2">
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-400 mb-0.5">
                    {weekDays.map((wd, i) => (
                      <div key={i}>{wd}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: padStart }, (_, i) => (
                      <div key={`pad-${i}`} className="min-h-[32px]" />
                    ))}
                    {days.map(({ date, dayOfMonth, total }) => (
                      <div
                        key={date}
                        className="min-h-[32px] border border-gray-100 rounded p-0.5 flex flex-col items-center justify-center gap-0"
                      >
                        <span className="text-[10px] font-medium text-gray-500 leading-tight">{dayOfMonth}</span>
                        {total > 0 ? (
                          <>
                            <span className="text-[10px] font-semibold text-gray-900 leading-tight truncate max-w-full">{formatCurrency(total)}</span>
                            <button
                              type="button"
                              onClick={() => scrollToDay(date)}
                              className="w-4 h-4 rounded bg-green-600 hover:bg-green-700 text-white flex items-center justify-center text-[8px] font-bold leading-none"
                              title={formatDateDDMMYYYY(date)}
                            >
                              →
                            </button>
                          </>
                        ) : null}
                      </div>
                    ))}
                    {Array.from({ length: padEnd }, (_, i) => (
                      <div key={`pad-end-${i}`} className="min-h-[32px]" />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Day details (for scroll target and full list) */}
          {dailyReport.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Daily details</h2>
              <div className="space-y-4">
                {dailyReport.map((day) => (
                  <div
                    id={`day-${day.date}`}
                    key={day.date}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden scroll-mt-4"
                  >
              {/* Day header */}
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">
                  {formatDateDDMMYYYY(day.date)}
                </h3>
                <span className="text-sm font-bold text-gray-900">
                  Total: {formatCurrency(day.total)}
                </span>
              </div>

              {/* Day payments */}
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Order
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Payer
                    </th>
                    
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Note
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {day.payments.map((p: CashPayment) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {p.order_code ? (
                          <button
                            onClick={() =>
                              router.push(`/orders/${orderCodeToSlug(p.order_code!)}`)
                            }
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {p.order_code}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {p.payer_name || p.order_client || "-"}
                      </td>
                      
                      <td className="px-4 py-2 text-gray-500 text-xs max-w-[200px] truncate">
                        {p.note || "-"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grand total */}
          <div className="flex justify-end">
            <div className="bg-gray-900 text-white px-6 py-3 rounded-lg">
              <span className="text-sm">Grand Total:</span>{" "}
              <span className="text-lg font-bold">{formatCurrency(grandTotal)}</span>
              <span className="text-gray-400 text-xs ml-2">
                ({allPayments.length} payments)
              </span>
            </div>
          </div>
        </div>
      ) : dailyReport.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No {tab === "cash" ? "cash" : "bank"} payments for this period
        </div>
      ) : (
        <div className="space-y-4">
          {dailyReport.map((day) => (
            <div
              key={day.date}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">
                  {formatDateDDMMYYYY(day.date)}
                </h3>
                <span className="text-sm font-bold text-gray-900">
                  Total: {formatCurrency(day.total)}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Order</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Payer</th>
                    {tab === "bank" && (
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Account</th>
                    )}
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Note</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {day.payments.map((p: CashPayment) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {p.order_code ? (
                          <button
                            onClick={() => router.push(`/orders/${orderCodeToSlug(p.order_code!)}`)}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {p.order_code}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {p.payer_name || p.order_client || "-"}
                      </td>
                      {tab === "bank" && (
                        <td className="px-4 py-2 text-gray-600 text-xs">{p.account_name || "-"}</td>
                      )}
                      <td className="px-4 py-2 text-gray-500 text-xs max-w-[200px] truncate">
                        {p.note || "-"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className="flex justify-end">
            <div className="bg-gray-900 text-white px-6 py-3 rounded-lg">
              <span className="text-sm">Grand Total:</span>{" "}
              <span className="text-lg font-bold">{formatCurrency(grandTotal)}</span>
              <span className="text-gray-400 text-xs ml-2">({allPayments.length} payments)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
