"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useCurrentUserRole } from "@/contexts/CurrentUserContext";
import { canManageCashJournal } from "@/lib/auth/paymentPermissions";
import { t } from "@/lib/i18n";

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

interface ZReport {
  id: string;
  report_date: string;
  z_amount: number;
  currency: string;
  file_name: string | null;
  download_url?: string | null;
  note?: string | null;
}

interface DailyReport {
  date: string;
  payments: CashPayment[];
  total: number;
  zReport?: ZReport | null;
  discrepancy?: number | null;
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
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const userRole = useCurrentUserRole();
  const canManageCashJournalAccess = canManageCashJournal(userRole);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(() => loadCashflowFilters()?.tab ?? "cash");
  const [dailyReport, setDailyReport] = useState<DailyReport[]>([]);
  const [allPayments, setAllPayments] = useState<CashPayment[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [zModalDate, setZModalDate] = useState<string | null>(null);
  const [zAmount, setZAmount] = useState("");
  const [zNote, setZNote] = useState("");
  const [zFile, setZFile] = useState<File | null>(null);
  const [zSaving, setZSaving] = useState(false);
  const [zError, setZError] = useState("");

  const [filterAccount, setFilterAccount] = useState<string>("all");
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

  const openZModal = (date: string) => {
    if (!canManageCashJournalAccess) return;
    const existing = dailyReport.find((d) => d.date === date)?.zReport || null;
    setZModalDate(date);
    setZAmount(existing ? String(existing.z_amount) : "");
    setZNote(existing?.note || "");
    setZFile(null);
    setZError("");
  };

  const saveZReport = async () => {
    if (!zModalDate || !canManageCashJournalAccess) return;
    const amount = Number(zAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setZError("Enter valid Z-report amount");
      return;
    }
    const existing = dailyReport.find((d) => d.date === zModalDate)?.zReport || null;
    if (!existing && !zFile) {
      setZError("Attach Z-report photo or PDF");
      return;
    }
    setZSaving(true);
    setZError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const fd = new FormData();
      fd.append("report_date", zModalDate);
      fd.append("z_amount", String(amount));
      fd.append("currency", "EUR");
      fd.append("note", zNote);
      if (zFile) fd.append("file", zFile);
      const res = await fetch("/api/finances/z-reports", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setZError(json.error || "Failed to save Z-report");
        return;
      }
      setZModalDate(null);
      await loadData();
    } finally {
      setZSaving(false);
    }
  };

  // Z-Report calendar: max 3 months
  const MAX_CALENDAR_DAYS = 93;
  const totalByDate = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of dailyReport) {
      map[d.date] = d.total;
    }
    return map;
  }, [dailyReport]);

  const zReportByDate = React.useMemo(() => {
    const map: Record<string, ZReport> = {};
    for (const d of dailyReport) {
      if (d.zReport) map[d.date] = d.zReport;
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
    const byMonth: { monthKey: string; monthLabel: string; days: { date: string; dayOfMonth: number; weekday: number; total: number; zReport: ZReport | null }[] }[] = [];
    let currentMonth = "";
    let currentRows: { date: string; dayOfMonth: number; weekday: number; total: number; zReport: ZReport | null }[] = [];
    for (const dateStr of calendarRange.days) {
      const d = new Date(dateStr + "T00:00:00");
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const dayOfMonth = d.getDate();
      let weekday = d.getDay() - 1;
      if (weekday < 0) weekday = 6;
      const total = totalByDate[dateStr] ?? 0;
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
      currentRows.push({ date: dateStr, dayOfMonth, weekday, total, zReport: zReportByDate[dateStr] || null });
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
  }, [calendarRange.days, totalByDate, zReportByDate]);

  const bankAccounts = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of allPayments) {
      if (p.account_name) set.add(p.account_name);
    }
    return [...set].sort();
  }, [allPayments]);

  const filteredDailyReport = React.useMemo(() => {
    if (filterAccount === "all") return dailyReport;
    return dailyReport
      .map((day) => {
        const filtered = day.payments.filter((p) => p.account_name === filterAccount);
        return { ...day, payments: filtered, total: filtered.reduce((s, p) => s + p.amount, 0) };
      })
      .filter((day) => day.payments.length > 0);
  }, [dailyReport, filterAccount]);

  const filteredGrandTotal = React.useMemo(() => {
    if (filterAccount === "all") return grandTotal;
    return filteredDailyReport.reduce((s, d) => s + d.total, 0);
  }, [filteredDailyReport, filterAccount, grandTotal]);

  const scrollToDay = (date: string) => {
    const el = document.getElementById(`day-${date}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-2">
        <button
          onClick={() => { setTab("cash"); setFilterAccount("all"); }}
          className={`px-4 py-1.5 text-sm font-medium rounded-md ${
            tab === "cash"
              ? "bg-green-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {t(lang, "cashflow.zReport")}
        </button>
        <button
          onClick={() => { setTab("bank"); setFilterAccount("all"); }}
          className={`px-4 py-1.5 text-sm font-medium rounded-md ${
            tab === "bank"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {t(lang, "cashflow.bankMovements")}
        </button>
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          startDate={dateFrom}
          endDate={dateTo}
          dropdownAlign="left"
        />
        {tab === "bank" && bankAccounts.length > 1 && (
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="all">All accounts</option>
            {bankAccounts.map((acc) => (
              <option key={acc} value={acc}>{acc}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="mx-auto max-w-[1800px] space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-10 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-28 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="bg-white rounded-lg border">
            <div className="h-12 border-b bg-gray-50 rounded-t-lg" />
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 flex-1 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : tab === "cash" && calendarByMonth.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {canManageCashJournalAccess && (
                <button
                  type="button"
                  onClick={() => openZModal(new Date().toISOString().slice(0, 10))}
                  className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 sm:w-auto"
                >
                  + Add Z-Report
                </button>
              )}
            <div className="rounded-lg bg-gray-900 px-6 py-3 text-white">
              <span className="text-sm">{t(lang, "cashflow.grandTotal")}:</span>{" "}
              <span className="text-lg font-bold">{formatCurrency(grandTotal)}</span>
              <span className="ml-2 text-xs text-gray-400">
                ({allPayments.length} {t(lang, "payments.paymentsCount")})
              </span>
            </div>
          </div>
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
                    {days.map(({ date, dayOfMonth, total, zReport }) => (
                      <div
                        key={date}
                        className={`min-h-[42px] border rounded p-0.5 flex flex-col items-center justify-center gap-0 ${
                          zReport ? "border-green-200 bg-green-50" : "border-gray-100"
                        }`}
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
                        {canManageCashJournalAccess && (
                          <button
                            type="button"
                            onClick={() => openZModal(date)}
                            className={`mt-0.5 rounded px-1 text-[8px] font-semibold leading-4 ${
                              zReport ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                            title={zReport ? "Edit Z-report" : "Add Z-report"}
                          >
                            Z
                          </button>
                        )}
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
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{t(lang, "cashflow.dailyDetails")}</h2>
              <div className="space-y-4">
                {dailyReport.map((day) => {
                  const diff = day.discrepancy ?? null;
                  const hasMismatch = diff !== null && Math.abs(diff) >= 0.01;
                  return (
                  <div
                    id={`day-${day.date}`}
                    key={day.date}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto scroll-mt-4"
                  >
              {/* Day header */}
              <div className="flex flex-col gap-2 bg-gray-50 px-3 sm:px-4 py-3 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {formatDateDDMMYYYY(day.date)}
                  </h3>
                  <span className="text-sm font-bold text-gray-900">
                    {t(lang, "payments.total")}: {formatCurrency(day.total)}
                  </span>
                </div>
                {canManageCashJournalAccess && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-white px-2 py-1 text-gray-700">
                        Z-report: {day.zReport ? formatCurrency(Number(day.zReport.z_amount)) : "not entered"}
                      </span>
                      {day.zReport?.download_url && (
                        <a
                          href={day.zReport.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-white px-2 py-1 text-blue-600 hover:underline"
                        >
                          View photo
                        </a>
                      )}
                      {diff !== null && (
                        <span className={`rounded px-2 py-1 font-semibold ${hasMismatch ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {hasMismatch ? "Discrepancy" : "Matched"}: {formatCurrency(diff)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openZModal(day.date)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {day.zReport ? "Edit Z-report" : "Add Z-report"}
                    </button>
                  </div>
                )}
              </div>

              <table className="w-full text-sm min-w-[400px]">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      {t(lang, "payments.order")}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      {t(lang, "payments.payer")}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      {t(lang, "payments.note")}
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      {t(lang, "payments.amount")}
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
                );
                })}
              </div>
            </div>
          )}
        </div>
      ) : dailyReport.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          {tab === "cash" ? t(lang, "cashflow.noCashPayments") : t(lang, "cashflow.noBankPayments")}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="bg-gray-900 text-white px-6 py-3 rounded-lg">
              <span className="text-sm">{t(lang, "cashflow.grandTotal")}:</span>{" "}
              <span className="text-lg font-bold">{formatCurrency(filteredGrandTotal)}</span>
              <span className="text-gray-400 text-xs ml-2">
                ({filteredDailyReport.reduce((s, d) => s + d.payments.length, 0)} {t(lang, "payments.paymentsCount")})
              </span>
            </div>
          </div>
          {filteredDailyReport.map((day) => (
            <div
              key={day.date}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-gray-50 px-3 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">
                  {formatDateDDMMYYYY(day.date)}
                </h3>
                <span className="text-sm font-bold text-gray-900">
                  {t(lang, "payments.total")}: {formatCurrency(day.total)}
                </span>
              </div>
              <table className="w-full text-sm table-fixed min-w-[500px]">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="w-[12%] px-3 py-1.5 text-left text-xs font-medium text-gray-500">{t(lang, "payments.order")}</th>
                    <th className="w-[20%] px-3 py-1.5 text-left text-xs font-medium text-gray-500">{t(lang, "payments.payer")}</th>
                    {tab === "bank" && (
                      <th className="w-[15%] px-3 py-1.5 text-left text-xs font-medium text-gray-500">{t(lang, "payments.account")}</th>
                    )}
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500">{t(lang, "payments.note")}</th>
                    <th className="w-[12%] px-3 py-1.5 text-right text-xs font-medium text-gray-500">{t(lang, "payments.amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {day.payments.map((p: CashPayment) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5">
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
                      <td className="px-3 py-1.5 text-gray-600 truncate">
                        {p.payer_name || p.order_client || "-"}
                      </td>
                      {tab === "bank" && (
                        <td className="px-3 py-1.5 text-gray-600 text-xs truncate">{p.account_name || "-"}</td>
                      )}
                      <td className="px-3 py-1.5 text-gray-500 text-xs truncate">
                        {p.note || "-"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-gray-900">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {canManageCashJournalAccess && zModalDate && (
        <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-start sm:pt-[10vh]">
          <div className="fixed inset-0 bg-black/40" onClick={() => setZModalDate(null)} />
          <div className="relative z-10 w-full rounded-t-xl bg-white shadow-xl sm:max-w-md sm:rounded-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Z-Report for {formatDateDDMMYYYY(zModalDate)}</h2>
              <button onClick={() => setZModalDate(null)} className="text-xl leading-none text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              {zError && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-600">{zError}</div>}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Amount from cash register Z-report</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={zAmount}
                  onChange={(e) => setZAmount(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Photo/PDF of Z-report</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setZFile(e.target.files?.[0] || null)}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">Required for a new daily Z-report. Re-upload only if replacing the file.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Note</label>
                <input
                  value={zNote}
                  onChange={(e) => setZNote(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                  placeholder="Optional note"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <button onClick={() => setZModalDate(null)} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={saveZReport}
                disabled={zSaving}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {zSaving ? "Saving..." : "Save Z-report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
