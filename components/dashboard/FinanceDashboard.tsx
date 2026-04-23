"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import StatisticCard, { CardPeriodType } from "@/components/dashboard/StatisticCard";
import AddPaymentModal from "@/app/finances/payments/_components/AddPaymentModal";
import ConfirmModal from "@/components/ConfirmModal";
import { Plus, FileText, AlertTriangle, CreditCard, Plane, Upload, ExternalLink, Eye, CheckCircle, Search } from "lucide-react";

interface FinanceDashboardProps {
  periodStart: string;
  periodEnd: string;
  statistics: {
    revenue: number;
    overdueAmount: number;
    overdueInPeriodAmount?: number;
  } | null;
  previousYear: {
    revenue: number;
  } | null;
  calcCardDates: (cp: CardPeriodType) => { start: string; end: string };
  calculateChangePercent: (current: number, previous: number) => number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  total: number;
  client_name: string;
  payer_name: string;
  order_id: string;
  order_code?: string;
  processed_at?: string | null;
  processed_total?: number | null;
}

interface Payment {
  id: string;
  order_code: string | null;
  order_client: string | null;
  method: string;
  amount: number;
  currency: string;
  paid_at: string;
  payer_name: string | null;
}

interface UploadedDoc {
  id: string;
  file_name: string;
  order_code: string | null;
  created_at: string;
  download_url: string | null;
}

const METHOD_BADGE: Record<string, string> = {
  bank: "bg-blue-100 text-blue-700",
  cash: "bg-green-100 text-green-700",
  card: "bg-purple-100 text-purple-700",
};

function formatCurrency(amount: number): string {
  return `€${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    issued: "bg-blue-100 text-blue-700",
    sent: "bg-indigo-100 text-indigo-700",
    paid: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    overdue: "bg-red-100 text-red-700",
    amended: "bg-amber-100 text-amber-800",
    processed: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-600"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function groupPaymentsByDate(payments: Payment[]): Record<string, Payment[]> {
  const groups: Record<string, Payment[]> = {};
  for (const p of payments) {
    const dateKey = p.paid_at ? p.paid_at.slice(0, 10) : "unknown";
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(p);
  }
  return groups;
}

export default function FinanceDashboard({
  periodStart,
  periodEnd,
  statistics,
  previousYear,
  calcCardDates,
  calculateChangePercent,
}: FinanceDashboardProps) {
  const router = useRouter();

  const [cardPeriods, setCardPeriods] = useState<Record<string, CardPeriodType>>({
    revenue: "inherit",
    overdue: "allTime",
  });
  const [cardOverrideData, setCardOverrideData] = useState<Record<string, { stats: { revenue: number; overdueAmount: number; overdueInPeriodAmount?: number } | null; prevYear: { revenue: number } | null } | null>>({
    revenue: null,
    overdue: null,
  });

  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [attentionInvoices, setAttentionInvoices] = useState<Invoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [supplierDocs, setSupplierDocs] = useState<UploadedDoc[]>([]);
  const [cashflowTotal, setCashflowTotal] = useState<{ cash: number; bank: number; total: number }>({ cash: 0, bank: 0, total: 0 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processConfirm, setProcessConfirm] = useState<{ invoiceId: string; invoiceNumber: string } | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState("");

  const cardPeriodsKey = JSON.stringify(cardPeriods);
  useEffect(() => {
    const fetchOverrides = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const newData: typeof cardOverrideData = { revenue: null, overdue: null };
      for (const card of ["revenue", "overdue"] as const) {
        const cp = cardPeriods[card];
        if (cp === "inherit") continue;
        const { start, end } = calcCardDates(cp);
        try {
          const [statsRes, prevRes] = await Promise.all([
            fetch(`/api/dashboard/statistics?periodStart=${start}&periodEnd=${end}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }),
            fetch(`/api/dashboard/previous-year?periodStart=${start}&periodEnd=${end}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }),
          ]);
          newData[card] = {
            stats: statsRes.ok ? await statsRes.json() : null,
            prevYear: prevRes.ok ? await prevRes.json() : null,
          };
        } catch { /* ignore */ }
      }
      setCardOverrideData(newData);
    };
    fetchOverrides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardPeriodsKey]);

  const getStats = (card: string) => {
    if (cardPeriods[card] !== "inherit" && cardOverrideData[card]?.stats) return cardOverrideData[card]!.stats;
    return statistics;
  };
  const getPrev = (card: string) => {
    if (cardPeriods[card] !== "inherit" && cardOverrideData[card]) return cardOverrideData[card]!.prevYear;
    return previousYear;
  };

  const loadInvoices = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/finances/invoices");
      if (res.ok) {
        const data = await res.json();
        setRecentInvoices((data.invoices || []).slice(0, 10));
      }
    } catch { /* ignore */ }
  }, []);

  const loadAttention = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/finances/invoices");
      if (res.ok) {
        const data = await res.json();
        const all: Invoice[] = data.invoices || [];
        setAttentionInvoices(all.filter((inv: Invoice) =>
          inv.status === "amended" ||
          (inv.status === "cancelled" && inv.processed_at != null && inv.processed_total != null)
        ));
      }
    } catch { /* ignore */ }
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/finances/payments?dateFrom=${periodStart}&dateTo=${periodEnd}`);
      if (res.ok) {
        const data = await res.json();
        setRecentPayments(data.data || []);
      }
    } catch { /* ignore */ }
  }, [periodStart, periodEnd]);

  const loadSupplierDocs = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/finances/uploaded-documents?dateFrom=${periodStart}&dateTo=${periodEnd}`);
      if (res.ok) {
        const data = await res.json();
        setSupplierDocs((data.data || []).slice(0, 6));
      }
    } catch { /* ignore */ }
  }, [periodStart, periodEnd]);

  const loadCashflow = useCallback(async () => {
    try {
      const [cashRes, bankRes] = await Promise.all([
        fetchWithAuth(`/api/finances/cashflow?dateFrom=${periodStart}&dateTo=${periodEnd}&method=cash`),
        fetchWithAuth(`/api/finances/cashflow?dateFrom=${periodStart}&dateTo=${periodEnd}&method=bank`),
      ]);
      let cash = 0, bank = 0;
      if (cashRes.ok) { const d = await cashRes.json(); cash = d.data?.grandTotal || 0; }
      if (bankRes.ok) { const d = await bankRes.json(); bank = d.data?.grandTotal || 0; }
      setCashflowTotal({ cash, bank, total: cash + bank });
    } catch { /* ignore */ }
  }, [periodStart, periodEnd]);

  useEffect(() => {
    if (!periodStart || !periodEnd) return;
    loadInvoices();
    loadAttention();
    loadPayments();
    loadSupplierDocs();
    loadCashflow();
  }, [periodStart, periodEnd, loadInvoices, loadAttention, loadPayments, loadSupplierDocs, loadCashflow]);

  const handleProcessInvoice = async (invoiceId: string) => {
    try {
      const res = await fetchWithAuth(`/api/finances/invoices/${invoiceId}/process`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processed: true }),
      });
      if (res.ok) { loadAttention(); loadInvoices(); }
    } catch { /* ignore */ }
    setProcessConfirm(null);
  };

  const handlePreview = async (invoiceId: string, orderCode: string | null | undefined) => {
    if (!orderCode) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setPreviewLoading(true);
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        setPreviewUrl(window.URL.createObjectURL(blob));
      }
    } catch { /* ignore */ } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const paymentStats = useMemo(() => {
    const byInvoice = recentPayments.filter((p) => p.method === "bank").reduce((s, p) => s + p.amount, 0);
    const byCash = recentPayments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
    const byCard = recentPayments.filter((p) => p.method === "card").reduce((s, p) => s + p.amount, 0);
    const total = recentPayments.reduce((s, p) => s + p.amount, 0);
    return { byInvoice, byCash, byCard, total, count: recentPayments.length };
  }, [recentPayments]);

  const filteredPayments = useMemo(() => {
    if (!paymentSearch.trim()) return recentPayments;
    const q = paymentSearch.toLowerCase();
    return recentPayments.filter((p) =>
      (p.order_code || "").toLowerCase().includes(q) ||
      (p.order_client || "").toLowerCase().includes(q) ||
      (p.payer_name || "").toLowerCase().includes(q) ||
      p.amount.toString().includes(q)
    );
  }, [recentPayments, paymentSearch]);

  const paymentGroups = useMemo(() => groupPaymentsByDate(filteredPayments), [filteredPayments]);
  const sortedDates = useMemo(() => Object.keys(paymentGroups).sort((a, b) => b.localeCompare(a)), [paymentGroups]);

  return (
    <div className="space-y-6">
      {/* Row 1: Stat Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 relative z-0 min-h-[8.5rem]">
        <StatisticCard
          title="Revenue"
          value={`€${(getStats("revenue")?.revenue || 0).toLocaleString()}`}
          previousValue={`€${(getPrev("revenue")?.revenue || 0).toLocaleString()}`}
          changePercent={
            getPrev("revenue")
              ? calculateChangePercent(getStats("revenue")?.revenue || 0, getPrev("revenue")!.revenue)
              : undefined
          }
          cardPeriod={cardPeriods.revenue}
          onCardPeriodChange={(p) => setCardPeriods((prev) => ({ ...prev, revenue: p }))}
        />
        <StatisticCard
          title="Overdue Payments"
          value={`€${(getStats("overdue")?.overdueAmount || 0).toLocaleString()}`}
          valueClassName="text-red-600"
          cardPeriod={cardPeriods.overdue}
          onCardPeriodChange={(p) => setCardPeriods((prev) => ({ ...prev, overdue: p }))}
          subValue={
            getStats("overdue")?.overdueInPeriodAmount !== undefined
              ? `of which due in period: €${(getStats("overdue")!.overdueInPeriodAmount || 0).toLocaleString()}`
              : undefined
          }
          onClick={() => router.push("/finances/invoices?status=overdue")}
        />
        {/* Cash Flow */}
        <div
          className="booking-glass-panel !p-5 !overflow-visible cursor-pointer"
          onClick={() => router.push("/finances/cashflow")}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Cash Flow</h3>
              <p className="mt-1 text-3xl font-black text-gray-900">{formatCurrency(cashflowTotal.total)}</p>
              <div className="mt-2 flex gap-3 text-xs text-gray-500">
                <span>Cash: {formatCurrency(cashflowTotal.cash)}</span>
                <span>Bank: {formatCurrency(cashflowTotal.bank)}</span>
              </div>
            </div>
            <div className="ml-3 flex-shrink-0 h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-inner text-indigo-500">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
        </div>
        {/* IATA */}
        <div className="booking-glass-panel !p-5 !overflow-visible">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">IATA BSP</h3>
              <p className="mt-3 text-sm text-gray-400 italic">Coming Soon</p>
              <p className="mt-1 text-xs text-gray-600">Settlement reports & reconciliation</p>
            </div>
            <div className="ml-3 flex-shrink-0 h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-inner text-indigo-500">
              <Plane className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Attention Invoices */}
      {attentionInvoices.length > 0 && (
        <div className="booking-glass-panel !p-0 !overflow-hidden border-2 !border-amber-300 !bg-amber-50/50">
          <div className="px-5 py-3 bg-amber-100/80 border-b border-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <h3 className="text-sm font-bold text-amber-800">Invoices need Attention</h3>
            <span className="ml-1 text-xs font-medium text-amber-600">({attentionInvoices.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50/80">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-amber-800 text-xs">Invoice #</th>
                  <th className="px-4 py-2 text-left font-semibold text-amber-800 text-xs">Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-amber-800 text-xs">Payer</th>
                  <th className="px-4 py-2 text-center font-semibold text-amber-800 text-xs">Reason</th>
                  <th className="px-4 py-2 text-right font-semibold text-amber-800 text-xs">Prev.</th>
                  <th className="px-4 py-2 text-right font-semibold text-amber-800 text-xs">New</th>
                  <th className="px-4 py-2 text-center font-semibold text-amber-800 text-xs">Diff</th>
                  <th className="px-4 py-2 text-center font-semibold text-amber-800 text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200">
                {attentionInvoices.map((inv) => {
                  const prevTotal = inv.processed_total != null ? Number(inv.processed_total) : null;
                  const effectiveTotal = inv.status === "cancelled" ? 0 : inv.total;
                  const diff = prevTotal != null ? effectiveTotal - prevTotal : null;
                  return (
                    <tr key={inv.id} className="hover:bg-amber-100/50">
                      <td className="px-4 py-2 text-xs">
                        <a href={`/orders/${inv.order_code ? orderCodeToSlug(inv.order_code) : inv.order_id}`} className="font-medium text-blue-600 hover:underline" target="_blank">
                          {inv.invoice_number}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-xs">{formatDateDDMMYYYY(inv.invoice_date)}</td>
                      <td className="px-4 py-2 text-xs">{inv.payer_name || inv.client_name}</td>
                      <td className="px-4 py-2 text-center text-xs">
                        {inv.status === "cancelled"
                          ? <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">Cancelled</span>
                          : <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Amended</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-400 line-through">{prevTotal != null ? formatCurrency(prevTotal) : "—"}</td>
                      <td className="px-4 py-2 text-right text-xs font-semibold">{formatCurrency(effectiveTotal)}</td>
                      <td className="px-4 py-2 text-center text-xs">
                        {diff != null ? (
                          <span className={`font-semibold ${diff > 0 ? "text-red-600" : "text-green-600"}`}>{diff > 0 ? "+" : ""}{formatCurrency(diff)}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2 text-center">
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
        </div>
      )}

      {/* Recent Invoices */}
      <div className="booking-glass-panel !p-0 !overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-white/80 to-indigo-50/40 border-b border-gray-200/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-inner">
              <FileText className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Recent Invoices</h3>
              <p className="text-[10px] text-gray-400">{recentInvoices.length} invoices</p>
            </div>
          </div>
          <button onClick={() => router.push("/finances/invoices")} className="text-xs text-blue-600 hover:underline font-medium">
            View all →
          </button>
        </div>
        {recentInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100/60">
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payer</th>
                  <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/40">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-4 py-2.5">
                      <a
                        href={`/orders/${inv.order_code ? orderCodeToSlug(inv.order_code) : inv.order_id}`}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {inv.invoice_number}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDateDDMMYYYY(inv.invoice_date)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[180px] truncate">{inv.payer_name || inv.client_name}</td>
                    <td className="px-4 py-2.5 text-center">{getStatusBadge(inv.status)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handlePreview(inv.id, inv.order_code)}
                          disabled={previewLoading || !inv.order_code}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30"
                          title="Preview PDF"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {inv.status === "processed" ? (
                          <span className="p-1.5 text-purple-500" title="Processed">
                            <CheckCircle className="h-3.5 w-3.5" />
                          </span>
                        ) : inv.status !== "cancelled" && inv.status !== "draft" ? (
                          <button
                            onClick={() => setProcessConfirm({ invoiceId: inv.id, invoiceNumber: inv.invoice_number })}
                            className="px-2 py-0.5 rounded text-[10px] font-medium border text-gray-500 border-gray-200 bg-white hover:bg-green-50 hover:text-green-700 hover:border-green-400 transition-colors"
                            title="Mark as processed"
                          >
                            Process
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No invoices found</div>
        )}
      </div>

      {/* Payments */}
      <div className="booking-glass-panel !p-0 !overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-white/80 to-green-50/40 border-b border-gray-200/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center border border-green-100 shadow-inner">
              <CreditCard className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Payments</h3>
              <p className="text-[10px] text-gray-400">
                {formatDateDDMMYYYY(periodStart)} — {formatDateDDMMYYYY(periodEnd)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/finances/payments")} className="text-xs text-blue-600 hover:underline font-medium">
              View all →
            </button>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-sm transition-all"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>

        {/* Payment Stats */}
        <div className="grid grid-cols-4 border-b border-gray-100/60">
          <div className="px-4 py-3 text-center border-r border-gray-100/60">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total</p>
            <p className="text-sm font-black text-gray-900 mt-0.5">{formatCurrency(paymentStats.total)}</p>
            <p className="text-[10px] text-gray-400">{paymentStats.count} payments</p>
          </div>
          <div className="px-4 py-3 text-center border-r border-gray-100/60">
            <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Bank</p>
            <p className="text-sm font-bold text-blue-700 mt-0.5">{formatCurrency(paymentStats.byInvoice)}</p>
          </div>
          <div className="px-4 py-3 text-center border-r border-gray-100/60">
            <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wider">Cash</p>
            <p className="text-sm font-bold text-green-700 mt-0.5">{formatCurrency(paymentStats.byCash)}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider">Card</p>
            <p className="text-sm font-bold text-purple-700 mt-0.5">{formatCurrency(paymentStats.byCard)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              placeholder="Search order, client, amount..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white/80 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Payment List grouped by date */}
        {filteredPayments.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto">
            {sortedDates.map((dateKey) => (
              <div key={dateKey}>
                <div className="px-4 py-1.5 bg-gray-50/80 border-b border-gray-100/40 sticky top-0 z-[1] flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{formatDateDDMMYYYY(dateKey)}</span>
                  <span className="text-[10px] font-semibold text-gray-400">
                    {formatCurrency(paymentGroups[dateKey].reduce((s, p) => s + p.amount, 0))}
                  </span>
                </div>
                <div className="divide-y divide-gray-100/30">
                  {paymentGroups[dateKey].map((p) => (
                    <div key={p.id} className="px-4 py-2 hover:bg-green-50/30 transition-colors flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-800">{p.order_code || "—"}</span>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${METHOD_BADGE[p.method] || "bg-gray-100 text-gray-600"}`}>
                            {p.method}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{p.order_client || p.payer_name || ""}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-900 flex-shrink-0">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            {paymentSearch ? "No payments matching search" : "No payments for this period"}
          </div>
        )}
      </div>

      {/* Suppliers Invoices */}
      {supplierDocs.length > 0 && (
        <div className="booking-glass-panel !p-0 !overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-gray-700">Recent Suppliers Invoices</h3>
            </div>
            <button onClick={() => router.push("/finances/suppliers-invoices")} className="text-xs text-blue-600 hover:underline font-medium">
              View all →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100/60">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/40">
                {supplierDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-medium text-gray-700 max-w-[200px] truncate">{doc.file_name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{doc.order_code || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{formatDateDDMMYYYY(doc.created_at)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {doc.download_url ? (
                        <a href={doc.download_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          <ExternalLink className="h-3.5 w-3.5 inline" />
                        </a>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <AddPaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onCreated={() => { setShowPaymentModal(false); loadPayments(); }}
        />
      )}

      {processConfirm && (
        <ConfirmModal
          isOpen={!!processConfirm}
          title="Process Invoice"
          message={`Mark invoice ${processConfirm.invoiceNumber} as processed?`}
          confirmText="Confirm"
          cancelText="Cancel"
          onConfirm={() => handleProcessInvoice(processConfirm.invoiceId)}
          onCancel={() => setProcessConfirm(null)}
        />
      )}

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closePreview}>
          <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-sm font-bold text-gray-700">Invoice Preview</h3>
              <button onClick={closePreview} className="text-gray-400 hover:text-gray-600 text-lg font-bold">✕</button>
            </div>
            <iframe src={previewUrl} className="flex-1 w-full" title="Invoice PDF Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
