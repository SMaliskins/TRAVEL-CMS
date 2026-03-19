"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { t } from "@/lib/i18n";
import { ArrowDown, ArrowUp, ArrowUpDown, FileDown, CheckCircle, Search, Send, CheckCheck, Eye, ExternalLink, X } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: 'draft' | 'sent' | 'issued' | 'paid' | 'cancelled' | 'overdue' | 'processed' | 'amended';
  total: number;
  subtotal: number;
  tax_amount: number;
  client_name: string;
  payer_name: string;
  order_id: string;
  order_code?: string;
  notes: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  processed_total?: number | null;
  paid_amount?: number;
  remaining?: number;
  final_payment_date?: string | null;
  deposit_date?: string | null;
  email_status?: {
    delivery_status: string;
    delivered_at: string | null;
    opened_at: string | null;
    open_count: number;
    sent_at: string;
  } | null;
  invoice_items: Array<{
    id: string;
    service_name: string;
    service_client: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}



const STORAGE_KEY = "travelcms.finances.invoices.filters";

function loadFilters() {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s) as { filterStatus: string; activeOnly: boolean; period: PeriodType; dateFrom: string; dateTo: string };
  } catch {}
  return null;
}

function saveFilters(f: { filterStatus: string; activeOnly: boolean; period: PeriodType; dateFrom: string; dateTo: string }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {}
}

export default function FinancesInvoicesPage() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const userRole = useCurrentUserRole();
  const isFinance = userRole === "finance" || userRole === "admin";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [attentionInvoices, setAttentionInvoices] = useState<Invoice[]>([]);
  const tokenRef = useRef<string | null>(null);
  const allInvoicesRef = useRef<Invoice[]>([]);
  const [processConfirm, setProcessConfirm] = useState<{ invoiceId: string; invoiceNumber: string } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("status") : null;
    if (fromUrl) return fromUrl;
    return loadFilters()?.filterStatus ?? "all";
  });
  const [activeOnly, setActiveOnly] = useState(() => loadFilters()?.activeOnly ?? true);
  const [searchNumber, setSearchNumber] = useState("");
  const [sortField, setSortField] = useState<"number" | "date" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const urlStatusParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("status") : null;
  const [period, setPeriod] = useState<PeriodType>(() => {
    if (urlStatusParam) return "custom";
    return loadFilters()?.period ?? "currentMonth";
  });
  const [dateFrom, setDateFrom] = useState(() => {
    if (urlStatusParam) return "2020-01-01";
    const stored = loadFilters();
    if (stored?.dateFrom) return stored.dateFrom;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    if (urlStatusParam) return new Date().toISOString().slice(0, 10);
    const stored = loadFilters();
    if (stored?.dateTo) return stored.dateTo;
    return new Date().toISOString().slice(0, 10);
  });

  const handlePeriodChange = (newPeriod: PeriodType, startDate?: string, endDate?: string) => {
    setPeriod(newPeriod);
    if (startDate && endDate) {
      setDateFrom(startDate);
      setDateTo(endDate);
    }
  };

  useEffect(() => {
    saveFilters({ filterStatus, activeOnly, period, dateFrom, dateTo });
  }, [filterStatus, activeOnly, period, dateFrom, dateTo]);

  const loadInvoices = useCallback(async () => {
    try {
      let token = tokenRef.current;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/login'); return; }
        token = session.access_token;
        tokenRef.current = token;
      }

      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const hasDateFilter = !!dateFrom || !!dateTo;
      const fetches: Promise<Response>[] = [
        fetch(`/api/finances/invoices?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ];
      if (hasDateFilter && isFinance) {
        fetches.push(
          fetch(`/api/finances/invoices`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
      }

      const results = await Promise.all(fetches);
      const invRes = results[0];

      let parsedInvoices: Invoice[] = [];

      if (invRes.ok) {
        const data = await invRes.json();
        parsedInvoices = data.invoices || [];
        let filtered = [...parsedInvoices];
        if (filterStatus === 'overdue') {
          const todayStr = new Date().toISOString().slice(0, 10);
          filtered = filtered.filter((inv: Invoice) => {
            if (inv.status === 'paid' || inv.status === 'cancelled') return false;
            const dueDate = inv.final_payment_date || inv.due_date;
            return dueDate && dueDate < todayStr;
          });
        } else if (filterStatus !== 'all') {
          filtered = filtered.filter((inv: Invoice) => inv.status === filterStatus);
        }
        if (activeOnly) {
          filtered = filtered.filter((inv: Invoice) => inv.status !== 'cancelled');
        }
        setInvoices(filtered);
      }

      if (isFinance) {
        let all: Invoice[] = parsedInvoices;
        if (results[1] && results[1].ok) {
          const allData = await results[1].json();
          all = allData.invoices || [];
        }
        allInvoicesRef.current = all;
        setAttentionInvoices(all.filter((inv) =>
          inv.status === "amended" ||
          (inv.status === "cancelled" && inv.processed_at != null && inv.processed_total != null)
        ));
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, activeOnly, dateFrom, dateTo, router, isFinance]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleMarkProcessed = async (invoiceId: string) => {
    try {
      const token = tokenRef.current;
      if (!token) return;

      const response = await fetch(`/api/finances/invoices/${invoiceId}/process`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ processed: true }),
      });

      if (response.ok) {
        loadInvoices();
      }
    } catch (error) {
      console.error('Error marking invoice as processed:', error);
    }
  };

  const handlePreview = async (invoiceId: string, orderCode: string | null | undefined) => {
    try {
      const token = tokenRef.current;
      if (!token) return;
      if (!orderCode) {
        alert("Order code not found for this invoice.");
        return;
      }
      setPreviewLoading(true);
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || "Failed to load preview");
      }
    } catch (error) {
      console.error("Error previewing invoice:", error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const handleExportPDF = async (invoiceId: string, orderCode: string | null | undefined) => {
    try {
      const token = tokenRef.current;
      if (!token) return;
      if (!orderCode) {
        alert('Order code not found for this invoice. Cannot export PDF.');
        return;
      }

      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        const isPdf = contentType.includes('application/pdf');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = isPdf ? `invoice-${invoiceId}.pdf` : `invoice-${invoiceId}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'Failed to export PDF');
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null) => formatDateDDMMYYYY(dateString);
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return `${formatDateDDMMYYYY(dateString)} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const toggleSort = (field: "number" | "date") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
  };

  const displayInvoices = useMemo(() => {
    let list = invoices;
    if (searchNumber.trim()) {
      const q = searchNumber.trim().toLowerCase();
      list = list.filter((inv) => inv.invoice_number.toLowerCase().includes(q));
    }
    if (sortField) {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortField === "number") {
          const aNum = parseInt(a.invoice_number.split("-").pop() || "0", 10);
          const bNum = parseInt(b.invoice_number.split("-").pop() || "0", 10);
          cmp = aNum - bNum;
        } else {
          cmp = (a.invoice_date || "").localeCompare(b.invoice_date || "");
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [invoices, searchNumber, sortField, sortDir]);

  const totals = useMemo(() => {
    let amount = 0, paid = 0, balance = 0;
    for (const inv of displayInvoices) {
      amount += inv.total || 0;
      paid += inv.paid_amount || 0;
      balance += inv.remaining || 0;
    }
    return { amount, paid, balance, count: displayInvoices.length };
  }, [displayInvoices]);

  const handleResetFilters = () => {
    setFilterStatus("all");
    setActiveOnly(true);
    setSearchNumber("");
    setSortField(null);
    setPeriod("currentMonth");
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(now.toISOString().slice(0, 10));
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/finances/invoices");
    }
  };

  const getShortNumber = (invoiceNumber: string): string => {
    const parts = invoiceNumber.split('-');
    return parts[parts.length - 1] || invoiceNumber;
  };

  const getStatusBadge = (status: Invoice['status'], invoice?: Invoice) => {
    const isCancelledProcessed = status === "cancelled" && invoice?.processed_at != null && invoice?.processed_total == null;
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      issued: 'bg-yellow-50 text-yellow-700 border border-yellow-300',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      overdue: 'bg-orange-100 text-orange-700',
      processed: 'bg-purple-100 text-purple-700',
      amended: 'bg-amber-100 text-amber-800 border border-amber-300',
    };
    if (isCancelledProcessed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700">
          Cancelled
          <span className="text-purple-600">/ Processed</span>
        </span>
      );
    }
    return (
      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${styles[status] || styles.draft}`}>
        {t(lang, `invoices.${status}`) || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
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
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
          />
          <span className="text-xs text-gray-600">{t(lang, "invoices.activeOnly")}</span>
        </label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          {['all', 'draft', 'issued', 'sent', 'paid', 'overdue', 'processed', 'amended'].map((s) => (
            <option key={s} value={s}>{t(lang, `invoices.${s}`)}</option>
          ))}
        </select>
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          startDate={dateFrom}
          endDate={dateTo}
          dropdownAlign="left"
          calendarFocusPast
        />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            placeholder="Invoice #"
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md w-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        {(filterStatus !== "all" || !activeOnly || searchNumber || period !== "currentMonth") && (
          <button
            onClick={handleResetFilters}
            className="text-xs text-gray-500 hover:text-red-600 underline"
          >
            Reset
          </button>
        )}
      </div>

      {isFinance && attentionInvoices.length > 0 && (
        <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 overflow-hidden">
          <div className="px-4 py-2.5 bg-amber-100 border-b border-amber-300 flex items-center gap-2">
            <span className="text-amber-700 text-lg">&#9888;</span>
            <h3 className="text-sm font-bold text-amber-800">
              Processed Invoices need Attention
            </h3>
            <span className="ml-1 text-xs font-medium text-amber-600">
              ({attentionInvoices.length})
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-amber-50/80">
              <tr>
                <th className="px-3 py-1.5 text-left font-semibold text-amber-800 text-xs">#</th>
                <th className="px-3 py-1.5 text-left font-semibold text-amber-800 text-xs">Invoice #</th>
                <th className="px-3 py-1.5 text-left font-semibold text-amber-800 text-xs">Date</th>
                <th className="px-3 py-1.5 text-left font-semibold text-amber-800 text-xs">Payer</th>
                <th className="px-3 py-1.5 text-center font-semibold text-amber-800 text-xs">Reason</th>
                <th className="px-3 py-1.5 text-right font-semibold text-amber-800 text-xs">Prev. Amount</th>
                <th className="px-3 py-1.5 text-right font-semibold text-amber-800 text-xs">New Amount</th>
                <th className="px-3 py-1.5 text-center font-semibold text-amber-800 text-xs">Diff</th>
                <th className="px-3 py-1.5 text-center font-semibold text-amber-800 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200">
              {attentionInvoices.map((inv) => {
                const prevTotal = inv.processed_total != null ? Number(inv.processed_total) : null;
                const effectiveTotal = inv.status === "cancelled" ? 0 : inv.total;
                const diff = prevTotal != null ? effectiveTotal - prevTotal : null;
                return (
                  <tr key={inv.id} className="hover:bg-amber-100/50">
                    <td className="px-3 py-1.5 text-gray-500 text-xs">{getShortNumber(inv.invoice_number)}</td>
                    <td className="px-3 py-1.5 text-xs">
                      <a
                        href={`/orders/${inv.order_code ? orderCodeToSlug(inv.order_code) : inv.order_id}`}
                        className="font-medium text-blue-600 hover:underline"
                        target="_blank"
                      >
                        {inv.invoice_number}
                      </a>
                    </td>
                    <td className="px-3 py-1.5 text-xs">{formatDateDDMMYYYY(inv.invoice_date)}</td>
                    <td className="px-3 py-1.5 text-xs">{inv.payer_name || inv.client_name}</td>
                    <td className="px-3 py-1.5 text-center text-xs">
                      {inv.status === "cancelled" ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">Cancelled</span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Amended</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs text-gray-400 line-through">
                      {prevTotal != null ? formatCurrency(prevTotal) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-900">
                      {formatCurrency(effectiveTotal)}
                    </td>
                    <td className="px-3 py-1.5 text-center text-xs">
                      {diff != null ? (
                        <span className={`font-semibold ${diff > 0 ? "text-red-600" : "text-green-600"}`}>
                          {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        onClick={() => setProcessConfirm({ invoiceId: inv.id, invoiceNumber: inv.invoice_number })}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                          inv.status === "cancelled"
                            ? "text-red-700 border-red-400 bg-red-50 hover:bg-red-100"
                            : "text-amber-700 border-amber-400 bg-amber-100 hover:bg-amber-200"
                        }`}
                      >
                        {inv.status === "cancelled" ? "Acknowledge" : "Re-process"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-3 py-2 text-left font-semibold text-gray-700 text-xs cursor-pointer select-none hover:text-blue-600"
                onClick={() => toggleSort("number")}
              >
                <span className="inline-flex items-center gap-1">
                  #
                  {sortField === "number" ? (
                    sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-gray-400" />
                  )}
                </span>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">{t(lang, "invoices.invoiceNo")}</th>
              <th
                className="px-3 py-2 text-left font-semibold text-gray-700 text-xs cursor-pointer select-none hover:text-blue-600"
                onClick={() => toggleSort("date")}
              >
                <span className="inline-flex items-center gap-1">
                  {t(lang, "invoices.date")}
                  {sortField === "date" ? (
                    sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-gray-400" />
                  )}
                </span>
              </th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">{t(lang, "invoices.payer")}</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">{t(lang, "invoices.amount")}</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Paid</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Balance</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs">Days</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs">{t(lang, "invoices.change")}</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">{t(lang, "invoices.status")}</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs">Email</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs">{t(lang, "invoices.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayInvoices.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-400">
                  {t(lang, "invoices.noInvoices")}
                </td>
              </tr>
            ) : (
              displayInvoices.map((invoice) => {
                const isAmended = invoice.status === 'amended';
                const prevTotal = invoice.processed_total != null ? Number(invoice.processed_total) : null;
                const diff = isAmended && prevTotal != null ? invoice.total - prevTotal : null;
                return (
                  <tr key={invoice.id} className={`hover:bg-gray-50 ${isAmended ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-3 py-1.5 text-gray-500">{getShortNumber(invoice.invoice_number)}</td>
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap text-xs">
                      {invoice.order_code ? (
                        <button
                          onClick={() => router.push(`/orders/${orderCodeToSlug(invoice.order_code!)}`)}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {invoice.invoice_number}
                        </button>
                      ) : (
                        <span className="text-gray-900">{invoice.invoice_number}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-3 py-1.5 text-gray-600">{invoice.payer_name || "-"}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gray-900">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-600">
                      {(invoice.paid_amount || 0) > 0 ? formatCurrency(invoice.paid_amount!) : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-medium ${(invoice.remaining ?? invoice.total) > 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatCurrency(invoice.remaining ?? invoice.total)}
                    </td>
                    <td className="px-3 py-1.5 text-center text-xs">
                      {(() => {
                        if (invoice.status === "paid" || invoice.status === "cancelled") return <span className="text-gray-300">—</span>;
                        const dueStr = invoice.final_payment_date || invoice.due_date;
                        if (!dueStr) return <span className="text-gray-300">—</span>;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const due = new Date(dueStr);
                        due.setHours(0, 0, 0, 0);
                        const days = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (days < 0) return <span className="text-red-600 font-semibold">{days}d</span>;
                        if (days === 0) return <span className="text-amber-600 font-semibold">today</span>;
                        if (days <= 3) return <span className="text-amber-500">{days}d</span>;
                        return <span className="text-gray-500">{days}d</span>;
                      })()}
                    </td>
                    <td className="px-3 py-1.5 text-center text-xs">
                      {isAmended && prevTotal != null ? (
                        <span className="inline-flex flex-col items-center gap-0.5">
                          <span className="text-gray-400 line-through">{formatCurrency(prevTotal)}</span>
                          <span className={diff! > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                            {diff! > 0 ? '+' : ''}{formatCurrency(diff!)}
                          </span>
                        </span>
                      ) : invoice.status === 'processed' ? (
                        <span className="text-green-600 text-xs">✓</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">{getStatusBadge(invoice.status, invoice)}</td>
                    <td className="px-3 py-1.5 text-center">
                      {invoice.email_status ? (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          {invoice.email_status.opened_at ? (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                <Eye className="h-3 w-3" />
                                Opened{invoice.email_status.open_count > 1 ? ` ${invoice.email_status.open_count}×` : ""}
                              </span>
                              <span className="text-[10px] text-gray-400">{formatDateTime(invoice.email_status.opened_at)}</span>
                            </>
                          ) : invoice.email_status.delivered_at || invoice.email_status.delivery_status === "delivered" ? (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                <CheckCheck className="h-3 w-3" />
                                Delivered
                              </span>
                              <span className="text-[10px] text-gray-400">{formatDateTime(invoice.email_status.delivered_at || invoice.email_status.sent_at)}</span>
                            </>
                          ) : invoice.email_status.delivery_status === "bounced" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                              ✕ Bounced
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                <Send className="h-3 w-3" />
                                Sent
                              </span>
                              <span className="text-[10px] text-gray-400">{formatDateTime(invoice.email_status.sent_at)}</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handlePreview(invoice.id, invoice.order_code)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Preview PDF"
                        >
                          <FileDown size={15} />
                        </button>
                        {invoice.status === 'processed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-purple-600 bg-purple-50" title="Processed by Finance">
                            <CheckCircle size={12} />
                          </span>
                        ) : invoice.status !== 'cancelled' && isFinance ? (
                          <button
                            onClick={() => setProcessConfirm({ invoiceId: invoice.id, invoiceNumber: invoice.invoice_number })}
                            className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                              isAmended
                                ? 'text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100'
                                : 'text-gray-600 border-gray-300 bg-white hover:bg-green-50 hover:text-green-700 hover:border-green-400'
                            }`}
                            title={isAmended ? "Re-process updated invoice" : "Mark as entered into accounting"}
                          >
                            {isAmended ? "Re-process" : "Process"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {displayInvoices.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold text-xs">
                <td className="px-3 py-2 text-gray-700" colSpan={4}>
                  Total: {totals.count} invoices
                </td>
                <td className="px-3 py-2 text-right text-gray-900">{totals.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-right text-gray-900">{totals.paid.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-right text-red-600">{totals.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      
      {previewUrl && createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50" style={{ zIndex: 999999 }} onClick={closePreview}>
          <div
            className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Invoice Preview</h3>
              <button
                onClick={closePreview}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <iframe
              src={previewUrl}
              className="flex-1 w-full"
              title="Invoice Preview"
            />
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={!!processConfirm}
        title="Mark as Processed"
        message={processConfirm ? `Mark invoice ${processConfirm.invoiceNumber} as processed?\n\nThis means you have entered it into your accounting system.` : ""}
        confirmText="OK"
        cancelText="Cancel"
        onConfirm={() => {
          if (processConfirm) handleMarkProcessed(processConfirm.invoiceId);
          setProcessConfirm(null);
        }}
        onCancel={() => setProcessConfirm(null)}
      />
    </div>
  );
}
