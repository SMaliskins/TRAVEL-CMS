"use client";

import React, { useEffect, useState, useMemo } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import ContentModal from "@/components/ContentModal";
import DateInput from "@/components/DateInput";
import { useToast } from "@/contexts/ToastContext";
import { Eye, FileDown, Mail, Pencil, Plus, Trash2, XCircle } from "lucide-react";

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
    service_id?: string | null;
    service_name: string;
    service_client?: string | null;
    service_category?: string | null;
    service_date_from: string | null;
    service_date_to: string | null;
    service_dates_text?: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  language?: string | null;
}

interface InvoiceListProps {
  orderCode: string;
  onCreateNew: () => void;
  onInvoiceChanged?: () => void;
  orderAmountTotal?: number;
}

interface PaymentSummary {
  totalPaid: number;
  linkedToInvoices: number;
  deposit: number;
}

export default function InvoiceList({ orderCode, onCreateNew, onInvoiceChanged, orderAmountTotal = 0 }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [openActionsInvoiceId, setOpenActionsInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideCancelled, setHideCancelled] = useState(true);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const { showToast } = useToast();
  const [cancelConfirm, setCancelConfirm] = useState<{ invoiceId: string; message: string } | null>(null);
  const [printPreviewHtml, setPrintPreviewHtml] = useState<string | null>(null);
  const [printPreviewTitle, setPrintPreviewTitle] = useState<string | null>(null);
  const [editingLinesInvoice, setEditingLinesInvoice] = useState<Invoice | null>(null);
  const [editingLinesItems, setEditingLinesItems] = useState<Array<{
    id: string;
    service_name: string;
    service_client?: string | null;
    service_category?: string | null;
    service_date_from: string | null;
    service_date_to: string | null;
    service_dates_text?: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>>([]);
  const [saveLinesSaving, setSaveLinesSaving] = useState(false);
  const [addLineSaving, setAddLineSaving] = useState(false);
  const [addLineForm, setAddLineForm] = useState({
    service_name: "",
    service_client: "",
    service_date_from: "",
    service_date_to: "",
    quantity: 1,
    unit_price: "",
  });

  const loadInvoices = async (): Promise<Invoice[]> => {
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
      const list = data.invoices || [];
      setInvoices(list);
      setPaymentSummary(data.paymentSummary || null);
      return list;
    } catch (error: any) {
      console.error('Error loading invoices:', error);
      alert(`Failed to load invoices: ${error.message || 'Unknown error'}`);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [orderCode]);

  const closeActionsModal = () => setOpenActionsInvoiceId(null);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (editingLinesInvoice) closeEditLines();
      else if (openActionsInvoiceId) closeActionsModal();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [editingLinesInvoice, openActionsInvoiceId]);

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

  const [editDatesForm, setEditDatesForm] = useState<{
    invoice_date: string;
    deposit_date: string;
    final_payment_date: string;
  }>({ invoice_date: "", deposit_date: "", final_payment_date: "" });

  const openEditInvoice = (invoice: Invoice) => {
    setEditingLinesInvoice(invoice);
    setEditingLinesItems((invoice.invoice_items || []).map((i) => ({
      id: i.id,
      service_name: i.service_name ?? "",
      service_client: i.service_client ?? "",
      service_category: i.service_category ?? "",
      service_date_from: i.service_date_from ?? null,
      service_date_to: i.service_date_to ?? null,
      service_dates_text: i.service_dates_text ?? null,
      quantity: i.quantity ?? 1,
      unit_price: i.unit_price ?? 0,
      line_total: i.line_total ?? 0,
    })));
    setEditDatesForm({
      invoice_date: invoice.invoice_date || "",
      deposit_date: invoice.deposit_date ?? "",
      final_payment_date: invoice.final_payment_date ?? "",
    });
    setOpenActionsInvoiceId(null);
  };

  const closeEditInvoice = () => {
    setEditingLinesInvoice(null);
    setEditingLinesItems([]);
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

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      const invoice = invoices.find((inv) => inv.id === invoiceId);
      if (!invoice) return;

      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/invoices/${invoiceId}/pdf`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to load invoice" }));
        showToast("error", error.error || "Failed to load invoice");
        return;
      }

      const contentType = response.headers.get("Content-Type") || "";
      const isPdf = contentType.includes("application/pdf");

      if (isPdf) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      } else {
        const html = await response.text();
        setPrintPreviewTitle(invoice.invoice_number);
        setPrintPreviewHtml(html);
      }
    } catch (error: any) {
      console.error("Error viewing invoice:", error);
      showToast("error", error.message || "Failed to view invoice");
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
      onInvoiceChanged?.();
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      showToast("error", "Failed to cancel invoice");
    }
  };

  const parseDateToYYYYMMDD = (s: string | null | undefined): string | null => {
    if (!s || typeof s !== "string") return null;
    const t = s.trim();
    if (!t) return null;
    const dmy = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    return null;
  };

  const closeEditLines = () => {
    closeEditInvoice();
    setAddLineForm({ service_name: "", service_client: "", service_date_from: "", service_date_to: "", quantity: 1, unit_price: "" });
  };

  const updateEditingItem = (itemId: string, updates: Partial<typeof editingLinesItems[0]>) => {
    setEditingLinesItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...updates } : it)));
  };

  const handleSaveEditInvoice = async () => {
    if (!editingLinesInvoice) return;
    setSaveLinesSaving(true);
    try {
      const invId = editingLinesInvoice.id;
      const resInv = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices/${invId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_date: editDatesForm.invoice_date || null,
          deposit_date: (editingLinesInvoice.deposit_amount == null || Number(editingLinesInvoice.deposit_amount) === 0)
            ? null
            : (editDatesForm.deposit_date || null),
          final_payment_date: editDatesForm.final_payment_date || null,
        }),
      });
      if (!resInv.ok) {
        const err = await resInv.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update invoice dates");
      }
      for (const item of editingLinesItems) {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderCode)}/invoices/${invId}/items/${item.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_name: item.service_name,
              service_client: item.service_client || "",
              service_date_from: parseDateToYYYYMMDD(item.service_date_from) ?? item.service_date_from,
              service_date_to: parseDateToYYYYMMDD(item.service_date_to) ?? item.service_date_to,
              service_dates_text: item.service_dates_text ?? "",
              ...(editingLinesInvoice.status === "draft" ? { quantity: item.quantity, unit_price: item.unit_price } : {}),
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save line");
        }
      }
      showToast("success", "Invoice updated");
      const list = await loadInvoices();
      const updated = list.find((i) => i.id === invId);
      if (updated) {
        setEditingLinesInvoice(updated);
        setEditDatesForm({
          invoice_date: updated.invoice_date || "",
          deposit_date: updated.deposit_date ?? "",
          final_payment_date: updated.final_payment_date ?? "",
        });
        setEditingLinesItems((updated.invoice_items || []).map((i) => ({
          id: i.id,
          service_name: i.service_name ?? "",
          service_client: i.service_client ?? "",
          service_category: i.service_category ?? "",
          service_date_from: i.service_date_from ?? null,
          service_date_to: i.service_date_to ?? null,
          service_dates_text: i.service_dates_text ?? null,
          quantity: i.quantity ?? 1,
          unit_price: i.unit_price ?? 0,
          line_total: i.line_total ?? 0,
        })));
      }
    } catch (e: any) {
      showToast("error", e.message || "Failed to save");
    } finally {
      setSaveLinesSaving(false);
    }
  };

  const handleAddLine = async () => {
    if (!editingLinesInvoice) return;
    const name = addLineForm.service_name.trim();
    if (!name) {
      showToast("error", "Service name is required");
      return;
    }
    const unitPrice = parseFloat(addLineForm.unit_price);
    if (isNaN(unitPrice) || unitPrice < 0) {
      showToast("error", "Valid unit price is required");
      return;
    }
    setAddLineSaving(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/invoices/${editingLinesInvoice.id}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_name: name,
            service_client: addLineForm.service_client.trim() || null,
            service_date_from: addLineForm.service_date_from || null,
            service_date_to: addLineForm.service_date_to || null,
            quantity: Number(addLineForm.quantity) || 1,
            unit_price: unitPrice,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add line");
      }
      showToast("success", "Line added");
      setAddLineForm({ service_name: "", service_client: "", service_date_from: "", service_date_to: "", quantity: 1, unit_price: "" });
      const list = await loadInvoices();
      const updated = list.find((i) => i.id === editingLinesInvoice.id);
      if (updated) {
        setEditingLinesInvoice(updated);
        setEditDatesForm({
          invoice_date: updated.invoice_date || "",
          deposit_date: updated.deposit_date ?? "",
          final_payment_date: updated.final_payment_date ?? "",
        });
        setEditingLinesItems((updated.invoice_items || []).map((i) => ({
          id: i.id,
          service_name: i.service_name ?? "",
          service_client: i.service_client ?? "",
          service_category: i.service_category ?? "",
          service_date_from: i.service_date_from ?? null,
          service_date_to: i.service_date_to ?? null,
          service_dates_text: i.service_dates_text ?? null,
          quantity: i.quantity ?? 1,
          unit_price: i.unit_price ?? 0,
          line_total: i.line_total ?? 0,
        })));
      }
    } catch (e: any) {
      showToast("error", e.message || "Failed to add line");
    } finally {
      setAddLineSaving(false);
    }
  };

  const handleDeleteLine = async (itemId: string) => {
    if (!editingLinesInvoice) return;
    if (!confirm("Remove this line from the invoice?")) return;
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}/invoices/${editingLinesInvoice.id}/items/${itemId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to remove line");
      }
      showToast("success", "Line removed");
      const list = await loadInvoices();
      const updated = list.find((i) => i.id === editingLinesInvoice.id);
      if (updated) {
        setEditingLinesInvoice(updated);
        setEditDatesForm({
          invoice_date: updated.invoice_date || "",
          deposit_date: updated.deposit_date ?? "",
          final_payment_date: updated.final_payment_date ?? "",
        });
        setEditingLinesItems((updated.invoice_items || []).map((i) => ({
          id: i.id,
          service_name: i.service_name ?? "",
          service_client: i.service_client ?? "",
          service_category: i.service_category ?? "",
          service_date_from: i.service_date_from ?? null,
          service_date_to: i.service_date_to ?? null,
          service_dates_text: i.service_dates_text ?? null,
          quantity: i.quantity ?? 1,
          unit_price: i.unit_price ?? 0,
          line_total: i.line_total ?? 0,
        })));
      }
    } catch (e: any) {
      showToast("error", e.message || "Failed to remove line");
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
      {editingLinesInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-invoice-title"
          onClick={closeEditLines}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 id="edit-invoice-title" className="text-lg font-semibold text-gray-900">
                Edit invoice — {editingLinesInvoice.invoice_number}
              </h2>
              <button type="button" onClick={closeEditLines} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Invoice date</label>
                  <DateInput
                    value={editDatesForm.invoice_date}
                    onChange={(iso) => setEditDatesForm((prev) => ({ ...prev, invoice_date: iso }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                {(editingLinesInvoice.deposit_amount != null && Number(editingLinesInvoice.deposit_amount) > 0) && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Deposit / prepayment date</label>
                  <DateInput
                    value={editDatesForm.deposit_date}
                    onChange={(iso) => setEditDatesForm((prev) => ({ ...prev, deposit_date: iso }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Final payment date</label>
                  <DateInput
                    value={editDatesForm.final_payment_date}
                    onChange={(iso) => setEditDatesForm((prev) => ({ ...prev, final_payment_date: iso }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <table className="w-full text-sm border-collapse mb-4">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Dates</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Service</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">Client</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-700">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {editingLinesItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-gray-600 align-top">
                          <input
                            type="text"
                            value={item.service_dates_text != null && item.service_dates_text !== ""
                              ? item.service_dates_text
                              : (item.service_date_from ? formatDate(item.service_date_from) + (item.service_date_to && item.service_date_to !== item.service_date_from ? " – " + formatDate(item.service_date_to) : "") : "")}
                            onChange={(e) => updateEditingItem(item.id, { service_dates_text: e.target.value })}
                            placeholder="Dates or any text"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="py-2 px-3 align-top">
                          <input
                            type="text"
                            value={item.service_name}
                            onChange={(e) => updateEditingItem(item.id, { service_name: e.target.value })}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            placeholder="Напр. Flight: Riga - Zurich - Riga или свой текст"
                          />
                        </td>
                        <td className="py-2 px-3 align-top">
                          <input
                            type="text"
                            value={item.service_client ?? ""}
                            onChange={(e) => updateEditingItem(item.id, { service_client: e.target.value })}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                            placeholder="Client"
                          />
                        </td>
                        <td className="py-2 px-3 text-right align-top">
                          {editingLinesInvoice.status === "draft" ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                updateEditingItem(item.id, { unit_price: v, line_total: Math.round(item.quantity * v * 100) / 100 });
                              }}
                              className="w-20 text-right rounded border border-gray-300 px-2 py-1 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          ) : (
                            <span className="text-gray-900">{formatCurrency(item.line_total)}</span>
                          )}
                        </td>
                        <td className="py-2 px-1 align-top">
                          {editingLinesInvoice.status === "draft" && (
                            <button type="button" onClick={() => handleDeleteLine(item.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" title="Remove line">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
              {editingLinesInvoice.status === "draft" ? (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                  <p className="text-xs font-medium text-gray-700 mb-2">Add line</p>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <input
                      type="text"
                      placeholder="Service name *"
                      value={addLineForm.service_name}
                      onChange={(e) => setAddLineForm((f) => ({ ...f, service_name: e.target.value }))}
                      className="col-span-2 rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Client"
                      value={addLineForm.service_client}
                      onChange={(e) => setAddLineForm((f) => ({ ...f, service_client: e.target.value }))}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Date from (dd.mm.yyyy)"
                      value={addLineForm.service_date_from}
                      onChange={(e) => setAddLineForm((f) => ({ ...f, service_date_from: e.target.value }))}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Date to"
                      value={addLineForm.service_date_to}
                      onChange={(e) => setAddLineForm((f) => ({ ...f, service_date_to: e.target.value }))}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Unit price"
                      value={addLineForm.unit_price}
                      onChange={(e) => setAddLineForm((f) => ({ ...f, unit_price: e.target.value }))}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={addLineForm.quantity}
                      onChange={(e) => setAddLineForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 1 }))}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddLine}
                      disabled={addLineSaving || !addLineForm.service_name.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Plus size={14} />
                      {addLineSaving ? "Adding…" : "Add line"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                  Issued invoice: you can edit Dates, Service, and Client and save. To change the total amount, cancel and re-issue a new invoice.
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Subtotal: {formatCurrency(editingLinesInvoice.subtotal)} · VAT: {formatCurrency(editingLinesInvoice.tax_amount)} · Total: {formatCurrency(editingLinesInvoice.total)}
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleSaveEditInvoice}
                disabled={saveLinesSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saveLinesSaving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={closeEditLines} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                Close
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
              <col className="w-[80px]" />
              <col className="w-[170px]" />
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
                <th className="text-center py-2 px-3 font-medium text-gray-700">Status</th>
                <th className="text-left py-2 px-3 font-medium text-gray-700">Due (schedule)</th>
                <th className="text-center py-2 px-3 font-medium text-gray-700">Invoice date</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(groupedInvoices.entries()).map(([payerName, payerInvoices]) => (
                <React.Fragment key={payerName}>
                  {payerInvoices.map((invoice) => {
                    const paid = invoice.paid_amount ?? 0;
                    const invoiceDebt = Math.max(0, invoice.total - paid);
                    
                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setOpenActionsInvoiceId((id) => (id === invoice.id ? null : invoice.id))}
                      >
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
                                  {depAmt > 0 && invoice.deposit_date && (
                                    <div className={`flex items-center gap-1 ${depositPaid ? 'text-green-700' : 'text-gray-700'}`}>
                                      <span className="font-medium w-[38px]">Dep:</span>
                                      <span className="text-gray-600">{formatDate(invoice.deposit_date)}</span>
                                      {daysBadge(daysTo(invoice.deposit_date), depositPaid)}
                                    </div>
                                  )}
                                  {finalAmt > 0 && invoice.final_payment_date && (
                                    <div className={`flex items-center gap-1 ${finalPaid ? 'text-green-700' : 'text-gray-700'}`}>
                                      <span className="font-medium w-[38px]">Final:</span>
                                      <span className="text-gray-600">{formatDate(invoice.final_payment_date)}</span>
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
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openActionsInvoiceId && (() => {
        const invoice = invoices.find((inv) => inv.id === openActionsInvoiceId);
        if (!invoice) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-actions-title"
            onClick={closeActionsModal}
          >
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="invoice-actions-title" className="text-lg font-semibold text-gray-900">
                  {invoice.invoice_number}
                </h2>
                <button
                  type="button"
                  onClick={closeActionsModal}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                  aria-label="Close"
                >
                  <XCircle size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => { closeActionsModal(); handleViewInvoice(invoice.id); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <Eye size={16} />
                  View Invoice
                </button>
                {invoice.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => { closeActionsModal(); openEditInvoice(invoice); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                  >
                    <Pencil size={16} />
                    Edit invoice
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { closeActionsModal(); handleExportPDF(invoice.id); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <FileDown size={16} />
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => { closeActionsModal(); handleSendEmail(invoice.id); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <Mail size={16} />
                  Send email
                </button>
                {invoice.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => { closeActionsModal(); openCancelConfirm(invoice.id); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <XCircle size={16} />
                    Cancel invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {paymentSummary && paymentSummary.totalPaid > 0 && (() => {
        // Overpayment = amount paid not linked to any active (non-cancelled) invoice
        const overpayment = Math.max(0, Math.round((paymentSummary.totalPaid - paymentSummary.linkedToInvoices) * 100) / 100);
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
