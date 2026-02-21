"use client";

import React, { useEffect, useState, useMemo } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import ContentModal from "@/components/ContentModal";
import { useToast } from "@/contexts/ToastContext";
import { FileDown, Mail, XCircle } from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue' | 'issued' | 'issued_sent' | 'processed' | 'replaced';
  total: number;
  subtotal: number;
  tax_amount: number;
  client_name: string;
  payer_name?: string | null;
  payer_email?: string | null;
  notes: string | null;
  created_at?: string;
  replaced_by_invoice_id?: string | null;
  paid_amount?: number;
  deposit_amount?: number | null;
  deposit_date?: string | null;
  final_payment_amount?: number | null;
  final_payment_date?: string | null;
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
  orderAmountTotal?: number;
}

interface PaymentSummary {
  totalPaid: number;
  linkedToInvoices: number;
  deposit: number;
}

export default function InvoiceList({ orderCode, onCreateNew, orderAmountTotal = 0 }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideCancelled, setHideCancelled] = useState(true);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const { showToast } = useToast();
  const [cancelConfirm, setCancelConfirm] = useState<{ invoiceId: string; message: string } | null>(null);
  const [printPreviewHtml, setPrintPreviewHtml] = useState<string | null>(null);
  const [printPreviewTitle, setPrintPreviewTitle] = useState<string | null>(null);

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
      setPaymentSummary(data.paymentSummary || null);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
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

  const calculateGroupTotals = (groupInvoices: Invoice[]) => {
    return groupInvoices.reduce((acc, inv) => {
      acc.total += inv.total;
      acc.paid += inv.paid_amount ?? 0;
      return acc;
    }, { total: 0, paid: 0 });
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const styles: Record<Invoice['status'], string> = {
      draft: 'bg-gray-100 text-gray-700 border-gray-300',
      sent: 'bg-blue-100 text-blue-700 border-blue-300',
      paid: 'bg-green-100 text-green-700 border-green-300',
      cancelled: 'bg-red-100 text-red-700 border-red-300',
      overdue: 'bg-orange-100 text-orange-700 border-orange-300',
      issued: 'bg-slate-100 text-slate-700 border-slate-300',
      issued_sent: 'bg-blue-100 text-blue-700 border-blue-300',
      processed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      replaced: 'bg-amber-100 text-amber-700 border-amber-300',
    };

    const labels: Record<Invoice['status'], string> = {
      draft: 'Draft',
      sent: 'Sent',
      paid: 'Paid',
      cancelled: 'Cancelled',
      overdue: 'Overdue',
      issued: 'Issued',
      issued_sent: 'Issued & Sent',
      processed: 'Processed',
      replaced: 'Replaced',
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
    showToast("error", "View invoice modal — implementation in progress");
  };

  const handleEditInvoice = (invoiceId: string) => {
    setEditingInvoiceId(invoiceId);
    // TODO: Open edit modal
    showToast("error", "Edit invoice modal — implementation in progress");
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
        showToast("error", `Failed to export PDF: ${error.error || "Unknown error"}`);
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
        setPrintPreviewTitle(invoice.invoice_number);
        setPrintPreviewHtml(html);
      }
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      showToast("error", `Failed to export PDF: ${error.message || "Unknown error"}`);
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
        showToast("error", `Failed to send email: ${error.error || "Unknown error"}`);
        return;
      }

      showToast("success", "Invoice email sent successfully!");
      loadInvoices();
    } catch (error: any) {
      console.error('Error sending email:', error);
      showToast("error", `Failed to send email: ${error.message || "Unknown error"}`);
    }
  };

  const openCancelConfirm = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    const isPaid = invoice.status === 'paid';
    const message = isPaid
      ? `Cancel this invoice? Payment €${invoice.total.toFixed(2)} will be moved to the order deposit and services will be unlocked.`
      : 'Are you sure you want to cancel this invoice? Services will be unlocked.';
    setCancelConfirm({ invoiceId, message });
  };

  const handleCancelInvoiceConfirm = async () => {
    if (!cancelConfirm) return;
    const { invoiceId } = cancelConfirm;
    const invoice = invoices.find(inv => inv.id === invoiceId);
    setCancelConfirm(null);
    if (!invoice) return;

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
      showToast("success", successMsg);
      loadInvoices();
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      showToast("error", "Failed to cancel invoice");
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
      replaced: 'Replaced',
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
      replaced: 'text-amber-600',
    };
    return colors[status] || 'text-gray-600';
  };

  return (
    <div className="space-y-4 relative">
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="cancel-invoice-title">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-4">
            <p id="cancel-invoice-title" className="text-gray-900 mb-4">{cancelConfirm.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCancelInvoiceConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {printPreviewHtml && (
        <ContentModal
          isOpen={true}
          onClose={() => {
            setPrintPreviewHtml(null);
            setPrintPreviewTitle(null);
          }}
          title={printPreviewTitle ? `Invoice ${printPreviewTitle}` : "Print preview"}
          htmlContent={printPreviewHtml}
          showPrintButton
        />
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideCancelled(!hideCancelled)}
            className={`p-1.5 rounded transition-colors ${
              hideCancelled 
                ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' 
                : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
            }`}
            title={hideCancelled ? 'Show cancelled invoices' : 'Hide cancelled invoices'}
          >
            {hideCancelled ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col className="w-[60px]" />
              <col className="w-[150px]" />
              <col className="w-[120px]" />
              <col className="w-[80px]" />
              <col className="w-[70px]" />
              <col className="w-[80px]" />
              <col className="w-[40px]" />
              <col className="w-[80px]" />
              <col className="w-[170px]" />
              <col className="w-[85px]" />
              <col className="w-[85px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="text-left py-2 px-3 font-medium text-gray-700">Short nr.</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Complete nr.</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Payer</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Total</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Paid</th>
                <th className="text-right py-2 px-3 font-medium text-gray-700">Debt</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Cur</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Status</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Payment Terms</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Invoice date</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(groupedInvoices.entries()).map(([payerName, payerInvoices]) => (
                <React.Fragment key={payerName}>
                  {payerInvoices.map((invoice) => {
                    const paid = invoice.paid_amount ?? 0;
                    const invoiceDebt = Math.max(0, invoice.total - paid);
                    
                    return (
                      <tr key={invoice.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-900">{getShortNumber(invoice.invoice_number)}</td>
                        <td className="py-2 px-3 truncate">
                          <span className={`${invoice.status === 'cancelled' ? 'text-red-600' : 'text-gray-900'}`}>
                            {invoice.invoice_number}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-700 truncate" title={payerName}>{payerName}</td>
                        <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(invoice.total)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(paid)}</td>
                        <td className={`py-2 px-3 text-right font-medium ${invoiceDebt > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(invoiceDebt)}</td>
                        <td className="py-2 px-3 text-center text-gray-500">EUR</td>
                        <td className="py-2 px-3 text-center">
                          <span className={getStatusColor(invoice.status)}>
                            {getStatusLabel(invoice.status)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {(() => {
                            const isClosed = invoice.status === 'paid' || invoice.status === 'cancelled';
                            const depAmt = invoice.deposit_amount ?? 0;
                            const finalAmt = invoice.final_payment_amount ?? 0;
                            const hasTerms = depAmt > 0 || finalAmt > 0;

                            const daysTo = (dateStr: string | null | undefined) => {
                              if (!dateStr) return null;
                              const today = new Date(); today.setHours(0,0,0,0);
                              const d = new Date(dateStr); d.setHours(0,0,0,0);
                              return Math.ceil((d.getTime() - today.getTime()) / (1000*60*60*24));
                            };
                            const daysBadge = (diff: number | null, isPaid: boolean) => {
                              if (isPaid) return <span className="text-green-600 font-medium">✓</span>;
                              if (diff === null) return null;
                              if (diff < 0) return <span className="text-red-600 font-semibold">{diff}d</span>;
                              if (diff === 0) return <span className="text-orange-600 font-semibold">today</span>;
                              return <span className="text-gray-500">{diff}d</span>;
                            };

                            if (hasTerms && !isClosed) {
                              const depositPaid = depAmt > 0 && paid >= depAmt;
                              const finalPaid = paid >= invoice.total;
                              return (
                                <div className="flex flex-col gap-0.5">
                                  {depAmt > 0 && (
                                    <div className={`flex items-center gap-1 ${depositPaid ? 'text-green-700' : 'text-gray-700'}`}>
                                      <span className="font-medium w-[42px]">Dep:</span>
                                      <span>{formatCurrency(depAmt)}</span>
                                      {invoice.deposit_date && <span className="text-gray-400">{formatDate(invoice.deposit_date)}</span>}
                                      {daysBadge(daysTo(invoice.deposit_date), depositPaid)}
                                    </div>
                                  )}
                                  {finalAmt > 0 && (
                                    <div className={`flex items-center gap-1 ${finalPaid ? 'text-green-700' : 'text-gray-700'}`}>
                                      <span className="font-medium w-[42px]">Final:</span>
                                      <span>{formatCurrency(finalAmt)}</span>
                                      {invoice.final_payment_date && <span className="text-gray-400">{formatDate(invoice.final_payment_date)}</span>}
                                      {daysBadge(daysTo(invoice.final_payment_date), finalPaid)}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            if (!invoice.due_date || isClosed || invoiceDebt === 0) return <span className="text-gray-400">—</span>;
                            const diff = daysTo(invoice.due_date);
                            return (
                              <span className="flex items-center gap-1.5">
                                <span className="text-gray-600">{formatDate(invoice.due_date)}</span>
                                {daysBadge(diff, false)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-3 text-center text-gray-600">{formatDate(invoice.invoice_date)}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleExportPDF(invoice.id)}
                              className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              title="Export PDF"
                            >
                              <FileDown size={15} />
                            </button>
                            <button
                              onClick={() => handleSendEmail(invoice.id)}
                              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                              title="Send Email"
                            >
                              <Mail size={15} />
                            </button>
                            {invoice.status !== 'cancelled' && (
                              <button
                                onClick={() => openCancelConfirm(invoice.id)}
                                className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Cancel invoice"
                              >
                                <XCircle size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paymentSummary && paymentSummary.totalPaid > 0 && (() => {
        const overpayment = orderAmountTotal > 0 ? Math.max(0, Math.round((paymentSummary.totalPaid - orderAmountTotal) * 100) / 100) : 0;
        return (
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
            <span>Total paid: <span className="font-medium text-gray-700">{formatCurrency(paymentSummary.totalPaid)}</span></span>
            {paymentSummary.linkedToInvoices > 0 && (
              <span>Linked to invoices: <span className="font-medium text-gray-700">{formatCurrency(paymentSummary.linkedToInvoices)}</span></span>
            )}
            {paymentSummary.deposit > 0 && overpayment <= 0 && (
              <span className="text-amber-600">
                Deposit (not linked): <span className="font-medium">{formatCurrency(paymentSummary.deposit)}</span>
              </span>
            )}
            {overpayment > 0 && (
              <span className="text-purple-600 font-medium">
                Overpayment: +{formatCurrency(overpayment)}
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
