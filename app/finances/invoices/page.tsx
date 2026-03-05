"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";
import { FileDown, CheckCircle, Download } from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: 'draft' | 'sent' | 'issued' | 'paid' | 'cancelled' | 'overdue' | 'processed' | 'amended';
  total: number;
  subtotal: number;
  tax_amount: number;
  payer_name: string;
  order_id: string;
  order_code?: string;
  notes: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  processed_total?: number | null;
  invoice_items: Array<{
    id: string;
    service_name: string;
    service_client: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

interface UploadedDoc {
  id: string;
  file_name: string;
  order_code: string | null;
  created_at: string;
  download_url: string | null;
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
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>(() => loadFilters()?.filterStatus ?? "all");
  const [activeOnly, setActiveOnly] = useState(() => loadFilters()?.activeOnly ?? true);
  const [period, setPeriod] = useState<PeriodType>(() => loadFilters()?.period ?? "currentMonth");
  const [dateFrom, setDateFrom] = useState(() => {
    const stored = loadFilters();
    if (stored?.dateFrom) return stored.dateFrom;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const [invRes, docRes] = await Promise.all([
        fetch(`/api/finances/invoices?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`/api/finances/uploaded-documents?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (invRes.ok) {
        const data = await invRes.json();
        let filtered = data.invoices || [];
        if (filterStatus !== 'all') {
          filtered = filtered.filter((inv: Invoice) => inv.status === filterStatus);
        }
        if (activeOnly) {
          filtered = filtered.filter((inv: Invoice) => inv.status !== 'cancelled');
        }
        setInvoices(filtered);
      }

      if (docRes.ok) {
        const docData = await docRes.json();
        setUploadedDocs(docData.documents || []);
      } else {
        setUploadedDocs([]);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, activeOnly, dateFrom, dateTo, router]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleMarkProcessed = async (invoiceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/finances/invoices/${invoiceId}/process`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
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

  const handleExportPDF = async (invoiceId: string, orderCode: string | null | undefined) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      if (!orderCode) {
        alert('Order code not found for this invoice. Cannot export PDF.');
        return;
      }

      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/pdf`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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

  const getShortNumber = (invoiceNumber: string): string => {
    const parts = invoiceNumber.split('-');
    return parts[parts.length - 1] || invoiceNumber;
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      overdue: 'bg-orange-100 text-orange-700',
      processed: 'bg-purple-100 text-purple-700',
      amended: 'bg-amber-100 text-amber-800 border border-amber-300',
    };
    return (
      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${styles[status] || styles.draft}`}>
        {t(lang, `invoices.${status}`) || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t(lang, "invoices.loading")}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "invoices.title")}</h1>
        <p className="text-sm text-gray-600 mt-1">{t(lang, "invoices.subtitle")}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">{t(lang, "invoices.activeOnly")}</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">{t(lang, "invoices.status")}:</span>
          {['all', 'draft', 'sent', 'paid', 'overdue', 'processed', 'amended'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(lang, `invoices.${status}`)}
            </button>
          ))}
        </div>
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          startDate={dateFrom}
          endDate={dateTo}
          dropdownAlign="left"
          calendarFocusPast
        />
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "invoices.invoiceNo")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "invoices.date")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "invoices.payer")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "invoices.order")}</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">{t(lang, "invoices.amount")}</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">{t(lang, "invoices.change")}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">{t(lang, "invoices.status")}</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">{t(lang, "invoices.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  {t(lang, "invoices.noInvoices")}
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const isAmended = invoice.status === 'amended';
                const prevTotal = invoice.processed_total != null ? Number(invoice.processed_total) : null;
                const diff = isAmended && prevTotal != null ? invoice.total - prevTotal : null;
                return (
                  <tr key={invoice.id} className={`hover:bg-gray-50 ${isAmended ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-3 text-gray-500">{getShortNumber(invoice.invoice_number)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{invoice.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{invoice.payer_name || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {invoice.order_code ? (
                        <button
                          onClick={() => router.push(`/orders/${orderCodeToSlug(invoice.order_code!)}`)}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {invoice.order_code}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
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
                    <td className="px-4 py-3">{getStatusBadge(invoice.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleExportPDF(invoice.id, invoice.order_code)}
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title={t(lang, "invoices.exportPdf")}
                        >
                          <FileDown size={15} />
                        </button>
                        {invoice.status !== 'processed' && invoice.status !== 'cancelled' && (
                          <button
                            onClick={() => handleMarkProcessed(invoice.id)}
                            className={`p-1.5 rounded transition-colors ${
                              isAmended
                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                            }`}
                            title={isAmended ? t(lang, "invoices.reprocess") : t(lang, "invoices.markProcessed")}
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {uploadedDocs.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-base font-semibold text-gray-900">{t(lang, "invoices.uploadedInvoices")}</h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">{t(lang, "invoices.file")}</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">{t(lang, "invoices.order")}</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">{t(lang, "invoices.uploaded")}</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-700">{t(lang, "invoices.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {uploadedDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{doc.file_name}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {doc.order_code ? (
                        <button
                          onClick={() => router.push(`/orders/${orderCodeToSlug(doc.order_code!)}`)}
                          className="text-blue-600 hover:underline"
                        >
                          {doc.order_code}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{formatDateDDMMYYYY(doc.created_at)}</td>
                    <td className="px-4 py-2 text-right">
                      {doc.download_url && (
                        <a
                          href={doc.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <Download size={14} />
                          {t(lang, "invoices.download")}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
