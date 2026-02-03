"use client";

import React, { useEffect, useState, useMemo } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue' | 'issued' | 'issued_sent' | 'processed';
  total: number;
  subtotal: number;
  tax_amount: number;
  client_name: string;
  payer_name?: string | null;
  notes: string | null;
  created_at?: string;
  invoice_items: Array<{
    id: string;
    service_name: string;
    service_category: string;
    service_date_from: string | null;
    service_date_to: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

interface InvoiceListProps {
  orderCode: string;
  onCreateNew: () => void;
}

export default function InvoiceList({ orderCode, onCreateNew }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideCancelled, setHideCancelled] = useState(false);

  const loadInvoices = async () => {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load invoices:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `Failed to load invoices: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
      // Show user-friendly error message
      alert(`Failed to load invoices: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [orderCode]);

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null) => formatDateDDMMYYYY(dateString);

  // Extract short number from invoice number (e.g., "00965" from "0633/25-SM-00965")
  const getShortNumber = (invoiceNumber: string): string => {
    const parts = invoiceNumber.split('-');
    return parts[parts.length - 1] || invoiceNumber;
  };

  // Group invoices by payer
  const groupedInvoices = useMemo(() => {
    const filtered = hideCancelled 
      ? invoices.filter(inv => inv.status !== 'cancelled')
      : invoices;
    
    const grouped = new Map<string, Invoice[]>();
    filtered.forEach(invoice => {
      const payerName = invoice.payer_name || invoice.client_name || 'Unknown';
      if (!grouped.has(payerName)) {
        grouped.set(payerName, []);
      }
      grouped.get(payerName)!.push(invoice);
    });
    return grouped;
  }, [invoices, hideCancelled]);

  // Calculate totals for a payer group
  const calculateGroupTotals = (groupInvoices: Invoice[]) => {
    return groupInvoices.reduce((acc, inv) => {
      acc.total += inv.total;
      acc.paid += inv.status === 'paid' ? inv.total : 0;
      return acc;
    }, { total: 0, paid: 0 });
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700 border-gray-300',
      sent: 'bg-blue-100 text-blue-700 border-blue-300',
      paid: 'bg-green-100 text-green-700 border-green-300',
      cancelled: 'bg-red-100 text-red-700 border-red-300',
      overdue: 'bg-orange-100 text-orange-700 border-orange-300',
    };

    const labels = {
      draft: 'Draft',
      sent: 'Sent',
      paid: 'Paid',
      cancelled: 'Cancelled',
      overdue: 'Overdue',
    };

    return (
      <span className={`inline-block px-2 py-1 text-xs font-medium border rounded ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };


  const handleViewInvoice = (invoiceId: string) => {
    setViewingInvoiceId(invoiceId);
    // TODO: Open view-only modal
    alert('View invoice modal — implementation in progress');
  };

  const handleEditInvoice = (invoiceId: string) => {
    setEditingInvoiceId(invoiceId);
    // TODO: Open edit modal
    alert('Edit invoice modal — implementation in progress');
  };

  const handleExportPDF = async (invoiceId: string) => {
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) return;

      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/pdf`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate PDF' }));
        alert(`Failed to export PDF: ${error.error || 'Unknown error'}`);
        return;
      }

      const contentType = response.headers.get('Content-Type') || '';
      const isPdf = contentType.includes('application/pdf');

      if (isPdf) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${String(invoice.invoice_number).replace(/\s+/g, '-')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const html = await response.text();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.print();
          };
        } else {
          const blob = new Blob([html], { type: 'text/html' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${invoice.invoice_number}.html`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          alert('✅ Invoice HTML downloaded. Use browser print to save as PDF.');
        }
      }
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      alert(`Failed to export PDF: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSendEmail = async (invoiceId: string) => {
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) return;

      const email = prompt('Enter email address:', invoice.payer_email || '');
      if (!email || !email.trim()) return;

      const subject = prompt('Email subject:', `Invoice ${invoice.invoice_number}`);
      if (subject === null) return; // User cancelled

      const message = prompt('Email message:', `Please find attached invoice ${invoice.invoice_number}.`);
      if (message === null) return; // User cancelled

      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email.trim(),
            subject: subject || `Invoice ${invoice.invoice_number}`,
            message: message || `Please find attached invoice ${invoice.invoice_number}.`,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to send email' }));
        alert(`Failed to send email: ${error.error || 'Unknown error'}`);
        return;
      }

      alert('✅ Invoice email sent successfully!');
      loadInvoices();
    } catch (error: any) {
      console.error('Error sending email:', error);
      alert(`Failed to send email: ${error.message || 'Unknown error'}`);
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const isPaid = invoice.status === 'paid';
    const confirmMsg = isPaid
      ? `Cancel this invoice? Payment €${invoice.total.toFixed(2)} will be moved to the order deposit and services will be unlocked.`
      : 'Are you sure you want to cancel this invoice? Services will be unlocked.';
    if (!confirm(confirmMsg)) return;

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...invoice,
          status: 'cancelled',
        }),
      });

      if (!response.ok) throw new Error('Failed to cancel invoice');

      const data = await response.json().catch(() => ({}));
      const moved = typeof data.paymentMovedToDeposit === 'number' ? data.paymentMovedToDeposit : 0;
      const successMsg = moved > 0
        ? `Invoice cancelled. Payment €${moved.toFixed(2)} moved to order deposit. Services unlocked.`
        : 'Invoice cancelled. Services unlocked.';
      alert(`✅ ${successMsg}`);
      loadInvoices();
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      alert('Failed to cancel invoice');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading invoices...</div>
      </div>
    );
  }

  const getStatusLabel = (status: Invoice['status']) => {
    const labels: Record<Invoice['status'], string> = {
      draft: 'Draft',
      sent: 'Sent',
      paid: 'Paid',
      cancelled: 'Cancelled',
      overdue: 'Overdue',
      issued: 'Issued',
      issued_sent: 'Sent',
      processed: 'Processed',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: Invoice['status']) => {
    const colors: Record<Invoice['status'], string> = {
      draft: 'text-gray-600',
      sent: 'text-blue-600',
      paid: 'text-green-600',
      cancelled: 'text-red-600',
      overdue: 'text-orange-600',
      issued: 'text-gray-600',
      issued_sent: 'text-blue-600',
      processed: 'text-purple-600',
    };
    return colors[status] || 'text-gray-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Invoices and payment paypapers</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideCancelled(!hideCancelled)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              hideCancelled 
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {hideCancelled ? 'Show' : 'Hide'} Cancelled
          </button>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      {groupedInvoices.size === 0 ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-4">No invoices created yet</p>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Create First Invoice
          </button>
        </div>
      ) : (
        <div className="max-w-6xl">
          {Array.from(groupedInvoices.entries()).map(([payerName, payerInvoices]) => {
            const totals = calculateGroupTotals(payerInvoices);
            const debt = totals.total - totals.paid;
            
            return (
              <div key={payerName} className="mb-4">
                {/* Payer Header */}
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <h3 className="font-semibold text-gray-900">{payerName}</h3>
                </div>
                
                {/* Compact Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-300 bg-gray-50">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Short nr.</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Complete nr.</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Total</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Paid</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-700">Debt</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">Cur</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">Status</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">Invoice date</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">Created</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payerInvoices.map((invoice) => {
                        const paid = invoice.status === 'paid' ? invoice.total : 0;
                        const invoiceDebt = invoice.total - paid;
                        
                        return (
                          <tr key={invoice.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-2 px-3 text-gray-900">{getShortNumber(invoice.invoice_number)}</td>
                            <td className="py-2 px-3">
                              <span className={`${invoice.status === 'cancelled' ? 'text-red-600' : 'text-gray-900'}`}>
                                {invoice.invoice_number}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(invoice.total)}</td>
                            <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(paid)}</td>
                            <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(invoiceDebt)}</td>
                            <td className="py-2 px-3 text-center text-gray-600">EUR</td>
                            <td className="py-2 px-3 text-center">
                              <span className={getStatusColor(invoice.status)}>
                                {getStatusLabel(invoice.status)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center text-blue-600">{formatDate(invoice.invoice_date)}</td>
                            <td className="py-2 px-3 text-center text-blue-600">
                              {invoice.created_at ? formatDate(invoice.created_at) : formatDate(invoice.invoice_date)}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleExportPDF(invoice.id)}
                                  className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
                                  title="Export PDF"
                                >
                                  📄
                                </button>
                                <button
                                  onClick={() => handleSendEmail(invoice.id)}
                                  className="px-2 py-1 text-xs text-green-600 hover:text-green-700"
                                  title="Send Email"
                                >
                                  ✉️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
