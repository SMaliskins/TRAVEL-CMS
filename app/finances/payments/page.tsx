"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import AddPaymentModal, { type EditPaymentData } from "./_components/AddPaymentModal";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { canModifyFinancePayments } from "@/lib/auth/paymentPermissions";
import { t } from "@/lib/i18n";
import { Landmark, Banknote, CreditCard, Trash2, Pencil, Printer } from "lucide-react";

interface BankAccountOption {
  id: string;
  account_name: string;
}

interface Payment {
  id: string;
  order_id: string;
  order_code: string | null;
  order_client: string | null;
  invoice_id: string | null;
  method: "cash" | "bank" | "card";
  amount: number;
  currency: string;
  paid_at: string;
  account_id: string | null;
  account_name: string | null;
  bank_name: string | null;
  payer_name: string | null;
  note: string | null;
  entered_by_name?: string | null;
  created_at: string;
  status?: string;
  processor?: string | null;
  processing_fee?: number | null;
}


const METHOD_STYLES: Record<string, string> = {
  bank: "bg-blue-100 text-blue-700",
  cash: "bg-green-100 text-green-700",
  card: "bg-purple-100 text-purple-700",
};

const PAYMENTS_STORAGE_KEY = "travelcms.finances.payments.filters";

function loadPaymentsFilters() {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (s) {
      return JSON.parse(s) as {
        filterMethod: string;
        period: PeriodType;
        filterDateFrom: string;
        filterDateTo: string;
        filterAccountId?: string;
      };
    }
  } catch {}
  return null;
}

function savePaymentsFilters(f: {
  filterMethod: string;
  period: PeriodType;
  filterDateFrom: string;
  filterDateTo: string;
  filterAccountId: string;
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(f));
  } catch {}
}

export default function PaymentsPage() {
  const router = useRouter();
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const userRole = useCurrentUserRole();
  const canEditOrDeletePayments = canModifyFinancePayments(userRole);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editPayment, setEditPayment] = useState<EditPaymentData | null>(null);
  const [receiptLangMenu, setReceiptLangMenu] = useState<string | null>(null);

  const [filterMethod, setFilterMethod] = useState<string>(() => loadPaymentsFilters()?.filterMethod ?? "all");
  const [filterAccountId, setFilterAccountId] = useState<string>(() => loadPaymentsFilters()?.filterAccountId ?? "");
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [period, setPeriod] = useState<PeriodType>(() => loadPaymentsFilters()?.period ?? "currentMonth");
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const s = loadPaymentsFilters();
    if (s?.filterDateFrom) return s.filterDateFrom;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [filterDateTo, setFilterDateTo] = useState(() => loadPaymentsFilters()?.filterDateTo ?? new Date().toISOString().slice(0, 10));

  const handlePeriodChange = (newPeriod: PeriodType, startDate?: string, endDate?: string) => {
    setPeriod(newPeriod);
    if (startDate && endDate) {
      setFilterDateFrom(startDate);
      setFilterDateTo(endDate);
    }
  };

  useEffect(() => {
    savePaymentsFilters({ filterMethod, period, filterDateFrom, filterDateTo, filterAccountId });
  }, [filterMethod, period, filterDateFrom, filterDateTo, filterAccountId]);

  useEffect(() => {
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/company/bank-accounts", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const list = (json.data ?? []) as BankAccountOption[];
          setBankAccounts(list);
        }
      } catch {
        /* non-critical */
      }
    })();
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams();
      if (filterMethod !== "all") params.set("method", filterMethod);
      if (filterAccountId) params.set("accountId", filterAccountId);
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);

      const res = await fetch(`/api/finances/payments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setPayments(json.data ?? []);
      }
    } catch (err) {
      console.error("Error loading payments:", err);
    } finally {
      setLoading(false);
    }
  }, [filterMethod, filterAccountId, filterDateFrom, filterDateTo, router]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleEdit = (p: Payment) => {
    setEditPayment({
      id: p.id,
      order_id: p.order_id,
      order_code: p.order_code ?? undefined,
      invoice_id: p.invoice_id,
      method: p.method,
      amount: p.amount,
      currency: p.currency,
      paid_at: p.paid_at,
      payer_name: p.payer_name,
      payer_party_id: undefined,
      note: p.note ?? undefined,
      account_id: p.account_id ?? undefined,
      processor: p.processor,
      processing_fee: p.processing_fee,
    });
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Delete this payment?")) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/finances/payments/${paymentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.ok) {
      loadPayments();
      return;
    }
    const json = await res.json().catch(() => ({}));
    alert((json as { message?: string }).message || (json as { error?: string }).error || "Failed to delete payment");
  };

  const handlePrintDepositReceipt = async (paymentId: string, receiptLang = "en") => {
    setReceiptLangMenu(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/finances/payments/${paymentId}/receipt?lang=${receiptLang}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to generate receipt");
      }

      const contentType = response.headers.get("content-type") || "";
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      if (contentType.includes("application/pdf")) {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "deposit-receipt.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }

      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error("Failed to print deposit receipt:", error);
      alert("Failed to generate deposit receipt");
    }
  };

  const formatCurrency = (amount: number, cur: string) => {
    const symbols: Record<string, string> = { EUR: "\u20ac", USD: "$", GBP: "\u00a3" };
    const n = Number(amount);
    const sign = n < 0 ? "-" : "";
    return `${sign}${symbols[cur] || cur}${Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const visiblePayments = payments.filter((p) => p.status !== "cancelled");
  const totalAmount = visiblePayments.reduce((s, p) => s + Number(p.amount), 0);

  if (loading) {
    return (
      <div className="p-3 sm:p-6">
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
    <div className="p-3 sm:p-6">
      <div className="mb-3 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-sm text-gray-700 mr-1">{t(lang, "payments.method")}:</span>
          <button
            onClick={() => setFilterMethod("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border-2 transition-all ${
              filterMethod === "all"
                ? "bg-gray-100 text-gray-900 border-gray-400 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {t(lang, "payments.all")}
          </button>
          <button
            onClick={() => setFilterMethod("bank")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border-2 transition-all ${
              filterMethod === "bank"
                ? "bg-blue-50 text-blue-700 border-blue-500 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Landmark size={16} className="shrink-0" />
            {t(lang, "payments.bank")}
          </button>
          <button
            onClick={() => setFilterMethod("cash")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border-2 transition-all ${
              filterMethod === "cash"
                ? "bg-green-50 text-green-700 border-green-500 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Banknote size={16} className="shrink-0" />
            {t(lang, "payments.cash")}
          </button>
          <button
            onClick={() => setFilterMethod("card")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border-2 transition-all ${
              filterMethod === "card"
                ? "bg-purple-50 text-purple-700 border-purple-500 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <CreditCard size={16} className="shrink-0" />
            {t(lang, "payments.card")}
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="payments-filter-account" className="text-sm text-gray-700 whitespace-nowrap">
            {t(lang, "payments.account")}:
          </label>
          <select
            id="payments-filter-account"
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 min-w-[10rem] max-w-[min(100vw-2rem,20rem)]"
          >
            <option value="">{t(lang, "payments.allAccounts")}</option>
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name}
              </option>
            ))}
          </select>
        </div>
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          startDate={filterDateFrom}
          endDate={filterDateTo}
          dropdownAlign="left"
        />
        <div className="w-full sm:w-auto sm:ml-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            + {t(lang, "payments.addPayment")}
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {t(lang, "payments.total")}: <strong className="text-gray-900">{visiblePayments.length}</strong> {t(lang, "payments.paymentsCount")}
        </span>
        <span className="text-sm text-gray-600">
          {t(lang, "payments.amount")}: <strong className={totalAmount < 0 ? "text-red-600" : "text-gray-900"}>{formatCurrency(totalAmount, "EUR")}</strong>
        </span>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "payments.date")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "payments.order")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "payments.payer")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "payments.method")}</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">{t(lang, "payments.amount")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "payments.account")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "payments.note")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "payments.enteredBy")}</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">{t(lang, "payments.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visiblePayments.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  {t(lang, "payments.noPayments")}
                </td>
              </tr>
            ) : (
              visiblePayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">
                    {formatDateDDMMYYYY(p.paid_at)}
                  </td>
                  <td className="px-4 py-3">
                    {p.order_code ? (
                      <button
                        onClick={() => router.push(`/orders/${orderCodeToSlug(p.order_code!)}`)}
                        className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      >
                        {p.order_code}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.payer_name || "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                        METHOD_STYLES[p.method] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {t(lang, `payments.${p.method}`) || p.method}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${p.amount < 0 ? "text-red-600" : "text-gray-900"}`}>
                    {formatCurrency(p.amount, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {p.account_name || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                    {p.note || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[160px] truncate" title={p.entered_by_name || undefined}>
                    {p.entered_by_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="relative">
                        <button
                          onClick={() => setReceiptLangMenu(receiptLangMenu === p.id ? null : p.id)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Print deposit receipt"
                        >
                          <Printer size={15} />
                        </button>
                        {receiptLangMenu === p.id && (
                          <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded shadow-lg z-50 py-1 min-w-[90px]">
                            {[
                              { code: "en", label: "EN" },
                              { code: "lv", label: "LV" },
                              { code: "ru", label: "RU" },
                              { code: "de", label: "DE" },
                              { code: "fr", label: "FR" },
                              { code: "es", label: "ES" },
                            ].map((l) => (
                              <button
                                key={l.code}
                                onClick={() => handlePrintDepositReceipt(p.id, l.code)}
                                className="block w-full text-left px-3 py-1 text-xs hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                {l.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {canEditOrDeletePayments && (
                        <>
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title={t(lang, "payments.editPayment")}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t(lang, "payments.deletePayment")}
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddPaymentModal
        open={showAddModal || !!editPayment}
        onClose={() => { setShowAddModal(false); setEditPayment(null); }}
        onCreated={() => {
          setShowAddModal(false);
          setEditPayment(null);
          loadPayments();
        }}
        editPayment={editPayment}
      />
    </div>
  );
}
