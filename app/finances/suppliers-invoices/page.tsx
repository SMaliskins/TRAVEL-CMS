"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import ContentModal from "@/components/ContentModal";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useCurrentUserRole } from "@/contexts/CurrentUserContext";
import { t } from "@/lib/i18n";
import { CheckCircle, Download, Eye, FileText, Pencil, Trash2, X } from "lucide-react";
import { sanitizeNumber } from "@/utils/sanitizeNumber";

interface UploadedDoc {
  id: string;
  file_name: string;
  order_code: string | null;
  order_id: string | null;
  created_at: string;
  download_url: string | null;
  supplier: string | null;
  effective_amount: number | null;
  effective_currency: string | null;
  effective_invoice_date: string | null;
  effective_invoice_number: string | null;
  document_state?: "active" | "deleted" | "replaced" | string;
  accounting_state?: "pending" | "processed" | "attention" | "cancelled_processed" | string;
  accounting_processed_at?: string | null;
  attention_reason?: "deleted" | "changed" | "replaced" | string | null;
  replaced_by_document_id?: string | null;
  matched_service_count?: number;
}

const STORAGE_KEY = "travelcms.finances.suppliersInvoices.filters";

function loadFilters() {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s) as { period: PeriodType; dateFrom: string; dateTo: string };
  } catch {}
  return null;
}

function saveFilters(f: { period: PeriodType; dateFrom: string; dateTo: string }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {}
}

export default function SuppliersInvoicesPage() {
  const router = useRouter();
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const userRole = useCurrentUserRole();
  const isFinanceUser = userRole === "finance" || userRole === "admin";

  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodType>(() => loadFilters()?.period ?? "currentMonth");
  const [dateFrom, setDateFrom] = useState(() => {
    const stored = loadFilters();
    if (stored?.dateFrom) return stored.dateFrom;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const stored = loadFilters();
    if (stored?.dateTo) return stored.dateTo;
    return new Date().toISOString().slice(0, 10);
  });
  const [supplierFilter, setSupplierFilter] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [quickSearch, setQuickSearch] = useState("");

  const [previewDoc, setPreviewDoc] = useState<UploadedDoc | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSupplier, setFormSupplier] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    saveFilters({ period, dateFrom, dateTo });
  }, [period, dateFrom, dateTo]);

  const handlePeriodChange = (newPeriod: PeriodType, startDate?: string, endDate?: string) => {
    setPeriod(newPeriod);
    if (startDate && endDate) {
      setDateFrom(startDate);
      setDateTo(endDate);
    }
  };

  const loadDocs = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/finances/uploaded-documents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents || []);
      } else {
        setDocs([]);
      }
    } catch (error) {
      console.error("Error loading supplier invoices:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, router]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const filteredDocs = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    const sup = supplierFilter.trim().toLowerCase();
    const min = amountMin === "" ? null : Number(amountMin.replace(",", "."));
    const max = amountMax === "" ? null : Number(amountMax.replace(",", "."));

    return docs.filter((d) => {
      if (sup) {
        const s = (d.supplier || "").toLowerCase();
        if (!s.includes(sup)) return false;
      }
      if (q) {
        const hay = [
          d.file_name,
          d.supplier,
          d.order_code,
          d.effective_invoice_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (min !== null && !isNaN(min)) {
        if (d.effective_amount == null || d.effective_amount < min) return false;
      }
      if (max !== null && !isNaN(max)) {
        if (d.effective_amount == null || d.effective_amount > max) return false;
      }
      return true;
    });
  }, [docs, quickSearch, supplierFilter, amountMin, amountMax]);

  const handlePreview = async (doc: UploadedDoc) => {
    if (!doc.order_code) return;
    setPreviewDoc(doc);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/orders/${encodeURIComponent(doc.order_code)}/documents/${doc.id}/file`,
        { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} }
      );
      if (!res.ok) throw new Error("Failed to load file");
      const blob = await res.blob();
      setPreviewBlobUrl(URL.createObjectURL(blob));
    } catch {
      setPreviewDoc(null);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  };

  const startEdit = (doc: UploadedDoc) => {
    setEditingId(doc.id);
    setFormSupplier(doc.supplier ?? "");
    setFormDate(doc.effective_invoice_date ?? "");
    setFormAmount(doc.effective_amount != null ? String(doc.effective_amount) : "");
    setFormCurrency(doc.effective_currency || "EUR");
    setFormInvoiceNumber(doc.effective_invoice_number ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormSupplier("");
    setFormDate("");
    setFormAmount("");
    setFormCurrency("EUR");
    setFormInvoiceNumber("");
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const target = docs.find((d) => d.id === editingId);
    if (!target?.order_code) return;
    const amount = formAmount.trim() === "" ? null : parseFloat(formAmount.replace(",", "."));
    if (amount !== null && (isNaN(amount) || amount < 0)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setFormSaving(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(target.order_code)}/documents/${editingId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            supplier_name: formSupplier.trim() || null,
            invoice_date: formDate || null,
            amount,
            currency: (formCurrency || "EUR").toUpperCase(),
            invoice_number: formInvoiceNumber.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update");
        return;
      }
      cancelEdit();
      loadDocs();
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (doc: UploadedDoc) => {
    if (!doc.order_code) return;
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(
      `/api/orders/${encodeURIComponent(doc.order_code)}/documents/${doc.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
    );
    if (res.ok) {
      loadDocs();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete");
    }
  };

  const handleProcess = async (doc: UploadedDoc) => {
    const actionLabel =
      doc.accounting_state === "attention" && doc.attention_reason === "deleted"
        ? "mark this deleted invoice as cancelled processed"
        : doc.accounting_state === "attention"
          ? "process this updated invoice"
          : "mark this supplier invoice as processed";
    if (!confirm(`Confirm that accounting should ${actionLabel}?`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setProcessingId(doc.id);
    try {
      const res = await fetch(`/api/finances/uploaded-documents/${doc.id}/process`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ processed: true }),
      });
      if (res.ok) {
        await loadDocs();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to process supplier invoice");
      }
    } finally {
      setProcessingId(null);
    }
  };

  const getAccountingBadge = (doc: UploadedDoc) => {
    const state = doc.accounting_state || "pending";
    const styles: Record<string, string> = {
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      processed: "bg-green-50 text-green-700 border-green-200",
      attention: "bg-red-50 text-red-700 border-red-200",
      cancelled_processed: "bg-purple-50 text-purple-700 border-purple-200",
    };
    const label =
      state === "cancelled_processed"
        ? "Cancelled processed"
        : state === "attention"
          ? "Attention"
          : state.charAt(0).toUpperCase() + state.slice(1);
    return (
      <div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${styles[state] || styles.pending}`}>
          {state === "processed" && <CheckCircle className="h-3 w-3" />}
          {label}
        </span>
        {doc.accounting_processed_at && (
          <div className="mt-1 text-[11px] text-gray-500">{formatDateDDMMYYYY(doc.accounting_processed_at)}</div>
        )}
      </div>
    );
  };

  const getMatchBadge = (doc: UploadedDoc) => {
    if (doc.document_state === "deleted") {
      return <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Deleted</span>;
    }
    if (doc.document_state === "replaced") {
      return <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Replaced</span>;
    }
    const count = doc.matched_service_count || 0;
    if (count > 0) {
      return <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Matched: {count}</span>;
    }
    return <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Unmatched</span>;
  };

  const getAttentionText = (doc: UploadedDoc) => {
    if (doc.accounting_state !== "attention") return "—";
    if (doc.attention_reason === "deleted") return "This invoice was deleted";
    if (doc.attention_reason === "replaced") return "This invoice was replaced";
    if (doc.attention_reason === "changed") return "This invoice was changed";
    return "Needs accounting review";
  };

  const getProcessButtonLabel = (doc: UploadedDoc) => {
    if (doc.accounting_state === "attention" && doc.attention_reason === "deleted") return "Mark cancelled processed";
    if (doc.accounting_state === "attention") return "Process updated";
    return "Process";
  };

  const canProcess = (doc: UploadedDoc) =>
    (doc.accounting_state || "pending") === "pending" || doc.accounting_state === "attention";

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">{t(lang, "invoices.suppliersInvoices")}</h1>
        <p className="text-sm text-gray-500">{t(lang, "invoices.suppliersInvoicesSubtitle")}</p>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-2">
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          startDate={dateFrom}
          endDate={dateTo}
          calendarFocusPast
          dropdownAlign="left"
        />
        <input
          type="text"
          placeholder={t(lang, "companyExpenses.searchPlaceholder")}
          value={quickSearch}
          onChange={(e) => setQuickSearch(e.target.value)}
          className="pl-3 pr-3 py-1.5 text-sm border border-gray-300 rounded-md w-48 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
        <input
          type="text"
          placeholder={t(lang, "companyExpenses.supplier")}
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder={t(lang, "companyExpenses.amountMin")}
          value={amountMin}
          onChange={(e) => setAmountMin(sanitizeNumber(e.target.value))}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-24 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder={t(lang, "companyExpenses.amountMax")}
          value={amountMax}
          onChange={(e) => setAmountMax(sanitizeNumber(e.target.value))}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-24 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      {editingId && (
        <form
          onSubmit={handleSubmitEdit}
          className="mb-4 bg-white rounded-lg border border-gray-200 overflow-hidden p-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              {t(lang, "companyExpenses.supplier")}
            </label>
            <input
              type="text"
              value={formSupplier}
              onChange={(e) => setFormSupplier(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md w-44 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              {t(lang, "companyExpenses.invoiceDate")}
            </label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              {t(lang, "companyExpenses.amount")}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md w-24 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              {t(lang, "companyExpenses.currency")}
            </label>
            <select
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md w-20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Invoice #</label>
            <input
              type="text"
              value={formInvoiceNumber}
              onChange={(e) => setFormInvoiceNumber(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md w-32 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={formSaving}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {formSaving ? "..." : t(lang, "common.save")}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">{t(lang, "common.loading")}</div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {t(lang, "invoices.noSupplierInvoices")}
          </div>
        ) : (
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t(lang, "companyExpenses.invoiceDate")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t(lang, "companyExpenses.supplier")}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">
                  {t(lang, "companyExpenses.amount")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t(lang, "companyExpenses.currency")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t(lang, "invoices.file")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t(lang, "invoices.order")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Match
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Accounting
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Attention
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  {t(lang, "invoices.uploaded")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">
                  {t(lang, "companyExpenses.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {doc.effective_invoice_date
                      ? formatDateDDMMYYYY(doc.effective_invoice_date)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate" title={doc.supplier ?? undefined}>
                    {doc.supplier || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums whitespace-nowrap">
                    {doc.effective_amount != null ? doc.effective_amount.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{doc.effective_currency || "—"}</td>
                  <td className="px-4 py-3 text-gray-900 max-w-[260px] truncate" title={doc.file_name}>
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {doc.file_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {doc.order_code ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/orders/${orderCodeToSlug(doc.order_code!)}`)}
                        className="text-blue-600 hover:underline"
                      >
                        {doc.order_code}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{getMatchBadge(doc)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{getAccountingBadge(doc)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px]">
                    {getAttentionText(doc)}
                    {doc.accounting_state === "attention" && doc.replaced_by_document_id && (
                      <div className="mt-1 text-blue-600">Replacement available</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDateDDMMYYYY(doc.created_at)}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {isFinanceUser && canProcess(doc) && (
                      <button
                        type="button"
                        onClick={() => handleProcess(doc)}
                        disabled={processingId === doc.id}
                        className="mr-1 inline-flex rounded border border-purple-300 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                        title="Mark as entered into accounting"
                      >
                        {processingId === doc.id ? "..." : getProcessButtonLabel(doc)}
                      </button>
                    )}
                    {doc.order_code && (
                      <button
                        type="button"
                        onClick={() => handlePreview(doc)}
                        className="inline-flex p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md mr-0.5"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {doc.download_url && (
                      <a
                        href={doc.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md mr-0.5"
                        title={t(lang, "invoices.download")}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(doc)}
                      className="inline-flex p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md mr-0.5"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      className="inline-flex p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ContentModal
        isOpen={!!previewDoc}
        onClose={closePreview}
        title={previewDoc?.file_name}
        url={previewBlobUrl ?? undefined}
      />
    </div>
  );
}
