"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useCurrentUserRole } from "@/contexts/CurrentUserContext";
import { t } from "@/lib/i18n";
import { Upload, Pencil, Trash2, X, FileText, Eye, CheckCircle } from "lucide-react";
import { sanitizeNumber } from "@/utils/sanitizeNumber";
import ContentModal from "@/components/ContentModal";

interface CompanyExpenseRow {
  id: string;
  company_id: string;
  supplier: string;
  invoice_date: string;
  amount: number;
  currency: string;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
  accounting_state?: "pending" | "processed" | string;
  accounting_processed_at?: string | null;
  accounting_processed_by?: string | null;
}

type AccountingStateFilter = "all" | "pending" | "processed";

const STORAGE_KEY = "travelcms.finances.companyExpenses.filters";

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

export default function CompanyExpensesPage() {
  const router = useRouter();
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const currentRole = useCurrentUserRole();
  const isAllowed = currentRole === "supervisor" || currentRole === "finance" || currentRole === "admin";

  const [rows, setRows] = useState<CompanyExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingFileRef = React.useRef<File | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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
  const [accountingFilter, setAccountingFilter] = useState<AccountingStateFilter>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [previewRow, setPreviewRow] = useState<CompanyExpenseRow | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  const [formSupplier, setFormSupplier] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formDescription, setFormDescription] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    saveFilters({ period, dateFrom, dateTo });
  }, [period, dateFrom, dateTo]);

  const loadRows = useCallback(async () => {
    if (!isAllowed) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (supplierFilter.trim()) params.set("supplier", supplierFilter.trim());
      if (amountMin !== "") params.set("amountMin", amountMin);
      if (amountMax !== "") params.set("amountMax", amountMax);
      if (quickSearch.trim()) params.set("search", quickSearch.trim());

      const res = await fetch(`/api/finances/company-expenses?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setRows(json.data ?? []);
      } else if (res.status === 403) {
        setRows([]);
      }
    } catch (err) {
      console.error("Error loading company expenses:", err);
    } finally {
      setLoading(false);
    }
  }, [isAllowed, dateFrom, dateTo, supplierFilter, amountMin, amountMax, quickSearch, router]);

  useEffect(() => {
    if (isAllowed) loadRows();
    else setLoading(false);
  }, [isAllowed, loadRows]);

  const handlePeriodChange = (newPeriod: PeriodType, startDate?: string, endDate?: string) => {
    setPeriod(newPeriod);
    if (startDate && endDate) {
      setDateFrom(startDate);
      setDateTo(endDate);
    }
  };

  const resetForm = () => {
    setFormSupplier("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormAmount("");
    setFormCurrency("EUR");
    setFormDescription("");
    setShowAddForm(false);
    setEditingId(null);
    pendingFileRef.current = null;
  };

  const startEdit = (row: CompanyExpenseRow) => {
    setEditingId(row.id);
    setFormSupplier(row.supplier);
    setFormDate(row.invoice_date);
    setFormAmount(String(row.amount));
    setFormCurrency(row.currency);
    setFormDescription(row.description ?? "");
    setShowAddForm(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formAmount.replace(",", "."));
    if (isNaN(amount) || amount < 0) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setFormSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/finances/company-expenses/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            supplier: formSupplier.trim() || "—",
            invoice_date: formDate,
            amount,
            currency: formCurrency || "EUR",
            description: formDescription.trim() || null,
          }),
        });
        if (res.ok) {
          resetForm();
          loadRows();
        } else {
          const err = await res.json().catch(() => ({}));
          const msg = err.details ? `${err.error || "Failed to update"}\n${err.details}` : (err.error || "Failed to update");
          alert(msg);
        }
      } else {
        const fileToUpload = pendingFileRef.current;
        if (fileToUpload && fileToUpload.size > 0) {
          const formData = new FormData();
          formData.append("file", fileToUpload);
          formData.append("supplier", formSupplier.trim() || "—");
          formData.append("invoice_date", formDate);
          formData.append("amount", String(amount));
          formData.append("currency", formCurrency || "EUR");
          formData.append("description", formDescription.trim() || "");
          const res = await fetch("/api/finances/company-expenses", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          });
          if (res.ok) {
            resetForm();
            loadRows();
          } else {
            const err = await res.json().catch(() => ({}));
            const msg = err.details ? `${err.error || "Failed to add"}\n${err.details}` : (err.error || "Failed to add");
            alert(msg);
          }
        } else {
          const res = await fetch("/api/finances/company-expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              supplier: formSupplier.trim() || "—",
              invoice_date: formDate,
              amount,
              currency: formCurrency || "EUR",
              description: formDescription.trim() || null,
            }),
          });
          if (res.ok) {
            resetForm();
            loadRows();
          } else {
            const err = await res.json().catch(() => ({}));
            const msg = err.details ? `${err.error || "Failed to add"}\n${err.details}` : (err.error || "Failed to add");
            alert(msg);
          }
        }
      }
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t(lang, "companyExpenses.deleteConfirm"))) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/finances/company-expenses/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) loadRows();
    else alert("Failed to delete");
  };

  const handleProcess = async (row: CompanyExpenseRow) => {
    const isProcessed = row.accounting_state === "processed";
    const confirmText = isProcessed
      ? "Revert this company expense back to Pending?"
      : "Confirm that accounting should mark this company expense as processed?";
    if (!confirm(confirmText)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setProcessingId(row.id);
    try {
      const res = await fetch(`/api/finances/company-expenses/${row.id}/process`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ processed: !isProcessed }),
      });
      if (res.ok) {
        await loadRows();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update accounting state");
      }
    } finally {
      setProcessingId(null);
    }
  };

  const renderAccountingBadge = (row: CompanyExpenseRow) => {
    const state = row.accounting_state || "pending";
    const styles: Record<string, string> = {
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      processed: "bg-green-50 text-green-700 border-green-200",
    };
    const label = state === "processed" ? "Processed" : "Pending";
    return (
      <div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${styles[state] || styles.pending}`}>
          {state === "processed" && <CheckCircle className="h-3 w-3" />}
          {label}
        </span>
        {state === "processed" && row.accounting_processed_at && (
          <div className="mt-1 text-[11px] text-gray-500">{formatDateDDMMYYYY(row.accounting_processed_at)}</div>
        )}
      </div>
    );
  };

  const visibleRows = rows.filter((row) => {
    if (accountingFilter === "all") return true;
    const state = row.accounting_state || "pending";
    return state === accountingFilter;
  });

  const pendingCount = rows.filter((row) => (row.accounting_state || "pending") === "pending").length;

  const processFile = useCallback(async (file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setParseLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/finances/company-expenses/parse", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data) {
        const d = json.data as { supplier?: string; invoice_date?: string; amount?: number; currency?: string; description?: string };
        setFormSupplier(d.supplier ?? "");
        setFormDate(d.invoice_date ?? new Date().toISOString().slice(0, 10));
        setFormAmount(d.amount != null ? String(d.amount) : "");
        setFormCurrency(d.currency ?? "EUR");
        setFormDescription(d.description ?? "");
        pendingFileRef.current = file;
        setShowAddForm(true);
      } else {
        alert(json.error || "Parse failed or no data extracted");
      }
    } finally {
      setParseLoading(false);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (![".pdf", "pdf", "png", "jpg", "jpeg", "webp"].some((x) => ext === x.replace(".", ""))) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  };

  const handlePreview = async (row: CompanyExpenseRow) => {
    if (!row.file_path) return;
    setPreviewRow(row);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const res = await fetch(`/api/finances/company-expenses/${row.id}/file`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load file");
      const blob = await res.blob();
      setPreviewBlobUrl(URL.createObjectURL(blob));
    } catch {
      setPreviewRow(null);
    }
  };

  const closePreview = () => {
    setPreviewRow(null);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  };

  const openInvoiceFile = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    try {
      const res = await fetch(`/api/finances/company-expenses/${id}/file`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        if (res.status === 401) router.push("/login");
        else alert((await res.json().catch(() => ({}))).error || "Failed to load file");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (w) setTimeout(() => URL.revokeObjectURL(url), 60000);
      else URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Open invoice file:", err);
      alert("Failed to load file");
    }
  };

  if (!isAllowed) {
    return (
      <div className="p-3 sm:p-6">
        <p className="text-gray-600">{t(lang, "companyExpenses.forbidden")}</p>
        <button
          type="button"
          onClick={() => router.push("/finances/invoices")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t(lang, "invoices.title")}
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">{t(lang, "companyExpenses.title")}</h1>
        <p className="text-sm text-gray-500">{t(lang, "companyExpenses.subtitle")}</p>
      </div>

      {/* Filters — same style as Invoices/Payments */}
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
        <select
          value={accountingFilter}
          onChange={(e) => setAccountingFilter(e.target.value as AccountingStateFilter)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          title="Accounting state"
        >
          <option value="all">All accounting</option>
          <option value="pending">Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}</option>
          <option value="processed">Processed</option>
        </select>
      </div>

      {/* Add invoice: compact bar — table is the main focus */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={handleFileSelect}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => { if (!parseLoading) fileInputRef.current?.click(); }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mb-4 bg-white rounded-lg border border-gray-200 flex flex-row items-center justify-center gap-2 py-2.5 px-4 transition-colors cursor-pointer select-none ${
          parseLoading
            ? "text-gray-500 cursor-wait"
            : dragOver
              ? "border-blue-400 bg-blue-50/60 text-blue-700"
              : "text-gray-600 hover:border-gray-300 hover:bg-gray-50"
        }`}
        onKeyDown={(e) => { if (!parseLoading && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileInputRef.current?.click(); } }}
        aria-label={t(lang, "companyExpenses.dropOrClick")}
      >
        <Upload className="w-4 h-4 shrink-0 text-gray-400" />
        <span className="text-sm">
          {parseLoading ? "Parsing…" : t(lang, "companyExpenses.dropOrClick")}
        </span>
        <span className="text-xs text-gray-400 hidden sm:inline">PDF, PNG, JPG, WebP</span>
      </div>

      {/* Edit form (after parse or when editing a row) — card + inputs like Invoices */}
      {showAddForm && (
        <form onSubmit={handleSubmitAdd} className="mb-4 bg-white rounded-lg border border-gray-200 overflow-hidden p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">{t(lang, "companyExpenses.supplier")}</label>
            <input type="text" value={formSupplier} onChange={(e) => setFormSupplier(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md w-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">{t(lang, "companyExpenses.invoiceDate")}</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">{t(lang, "companyExpenses.amount")}</label>
            <input type="text" inputMode="decimal" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md w-24 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">{t(lang, "companyExpenses.currency")}</label>
            <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md w-20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white">
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-0.5">{t(lang, "companyExpenses.description")}</label>
            <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md w-full focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
          </div>
          <button type="submit" disabled={formSaving} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {formSaving ? "..." : editingId ? "Update" : t(lang, "common.save")}
          </button>
          <button type="button" onClick={resetForm} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Table — same as Payments/Invoices: bg-white rounded-lg border border-gray-200 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">{t(lang, "common.loading")}</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {rows.length === 0
              ? t(lang, "companyExpenses.noRows")
              : "No expenses match the current filters."}
          </div>
        ) : (
          <table className="w-full text-sm min-w-[680px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "companyExpenses.invoiceDate")}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "companyExpenses.supplier")}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">{t(lang, "companyExpenses.amount")}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "companyExpenses.currency")}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "companyExpenses.description")}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Accounting</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">{t(lang, "companyExpenses.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visibleRows.map((row) => {
                const isProcessed = row.accounting_state === "processed";
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{formatDateDDMMYYYY(row.invoice_date)}</td>
                    <td className="px-4 py-3 text-gray-900">{row.supplier}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">{row.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">{row.currency}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={row.description ?? undefined}>{row.description ?? "—"}</td>
                    <td className="px-4 py-3">{renderAccountingBadge(row)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleProcess(row)}
                        disabled={processingId === row.id}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border mr-1 disabled:opacity-50 ${
                          isProcessed
                            ? "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                        title={isProcessed ? "Revert to Pending" : "Mark as processed in accounting"}
                      >
                        {isProcessed ? "Revert" : "Process"}
                      </button>
                      {row.file_path ? (
                        <button
                          type="button"
                          onClick={() => handlePreview(row)}
                          className="inline-flex p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md mr-0.5"
                          title={t(lang, "companyExpenses.viewInvoice")}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : null}
                      {row.file_path ? (
                        <button
                          type="button"
                          onClick={() => openInvoiceFile(row.id)}
                          className="inline-flex p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md mr-0.5"
                          title="Open in new tab"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      ) : null}
                      <button type="button" onClick={() => startEdit(row)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md mr-0.5" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(row.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ContentModal
        isOpen={!!previewRow}
        onClose={closePreview}
        title={previewRow?.file_name || previewRow?.supplier}
        url={previewBlobUrl ?? undefined}
      />
    </div>
  );
}
