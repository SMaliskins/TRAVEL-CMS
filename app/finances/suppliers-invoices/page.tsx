"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import ContentModal from "@/components/ContentModal";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";
import { Download, Eye, FileText } from "lucide-react";
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

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">{t(lang, "common.loading")}</div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {t(lang, "invoices.noSupplierInvoices")}
          </div>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
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
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDateDDMMYYYY(doc.created_at)}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
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
                        className="inline-flex p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                        title={t(lang, "invoices.download")}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
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
