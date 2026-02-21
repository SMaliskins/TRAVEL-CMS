"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import PeriodSelector, { PeriodType } from "@/components/dashboard/PeriodSelector";
import { FileDown, CheckCircle } from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue' | 'processed';
  total: number;
  subtotal: number;
  tax_amount: number;
  payer_name: string;
  order_id: string;
  order_code?: string;
  notes: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  invoice_items: Array<{
    id: string;
    service_name: string;
    service_client: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

export default function FinancesInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodType>("currentMonth");
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const handlePeriodChange = (newPeriod: PeriodType, startDate?: string, endDate?: string) => {
    setPeriod(newPeriod);
    if (startDate && endDate) {
      setDateFrom(startDate);
      setDateTo(endDate);
    }
  };

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

      const response = await fetch(`/api/finances/invoices?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        let filtered = data.invoices || [];
        
        if (filterStatus !== 'all') {
          filtered = filtered.filter((inv: Invoice) => inv.status === filterStatus);
        }
        
        setInvoices(filtered);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, dateFrom, dateTo, router]);

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

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      overdue: 'bg-orange-100 text-orange-700',
      processed: 'bg-purple-100 text-purple-700',
    };

    const labels = {
      draft: 'Draft',
      sent: 'Sent',
      paid: 'Paid',
      cancelled: 'Cancelled',
      overdue: 'Overdue',
      processed: 'Processed',
    };

    return (
      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-600 mt-1">Manage and process invoices</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Status:</span>
          {['all', 'draft', 'sent', 'paid', 'overdue', 'processed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          startDate={dateFrom}
          endDate={dateTo}
          dropdownAlign="left"
        />
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Invoice #</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Payer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Order</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No invoices found
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{invoice.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(invoice.invoice_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{invoice.payer_name || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {invoice.order_code ? (
                      <button
                        onClick={() => router.push(`/orders/${invoice.order_code}`)}
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
                  <td className="px-4 py-3">{getStatusBadge(invoice.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleExportPDF(invoice.id, invoice.order_code)}
                        className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                        title="Export PDF"
                      >
                        <FileDown size={15} />
                      </button>
                      {invoice.status !== 'processed' && (
                        <button
                          onClick={() => handleMarkProcessed(invoice.id)}
                          className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                          title="Mark as processed"
                        >
                          <CheckCircle size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
