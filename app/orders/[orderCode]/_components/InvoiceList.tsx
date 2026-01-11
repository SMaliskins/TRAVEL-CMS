"use client";

import React, { useEffect, useState } from "react";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue';
  total: number;
  subtotal: number;
  tax_amount: number;
  client_name: string;
  notes: string | null;
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

  const loadInvoices = async () => {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices`);
      if (!response.ok) throw new Error('Failed to load invoices');
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
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

      // TODO: Implement PDF export API endpoint
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/pdf`
      );
      
      if (!response.ok) {
        // Временное решение пока нет API
        alert('PDF export API not yet implemented. Coming soon!');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      alert('✅ PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('PDF export feature coming soon!');
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to cancel this invoice? Services will be unlocked.')) {
      return;
    }

    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) return;

      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...invoice,
          status: 'cancelled',
        }),
      });

      if (!response.ok) throw new Error('Failed to cancel invoice');

      alert('✅ Invoice cancelled. Services unlocked.');
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 transition-colors"
        >
          + Create Invoice
        </button>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-4">No invoices created yet</p>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 text-sm font-medium text-white bg-black rounded hover:bg-gray-800 transition-colors"
          >
            Create First Invoice
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="rounded-lg bg-white border border-gray-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{invoice.invoice_number}</h3>
                    {getStatusBadge(invoice.status)}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span>Client: {invoice.client_name}</span>
                    <span className="mx-2">•</span>
                    <span>Date: {formatDate(invoice.invoice_date)}</span>
                    {invoice.due_date && (
                      <>
                        <span className="mx-2">•</span>
                        <span>Due: {formatDate(invoice.due_date)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(invoice.total)}</div>
                  <div className="text-xs text-gray-500">{invoice.invoice_items.length} services</div>
                </div>
              </div>

              {/* Services Preview */}
              <div className="mb-3 text-sm text-gray-600">
                {invoice.invoice_items.slice(0, 3).map((item, idx) => (
                  <div key={item.id}>
                    • {item.service_name} - {formatCurrency(item.line_total)}
                  </div>
                ))}
                {invoice.invoice_items.length > 3 && (
                  <div className="text-xs text-gray-400 italic">
                    +{invoice.invoice_items.length - 3} more services
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t">
                <button
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => handleViewInvoice(invoice.id)}
                >
                  View
                </button>
                
                {/* NEW: Edit button — only for Draft/Sent/Overdue */}
                {(invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'overdue') && (
                  <button
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                    onClick={() => handleEditInvoice(invoice.id)}
                  >
                    Edit
                  </button>
                )}
                
                {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                  <button
                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors"
                    onClick={() => handleCancelInvoice(invoice.id)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                  onClick={() => handleExportPDF(invoice.id)}
                >
                  Export PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
