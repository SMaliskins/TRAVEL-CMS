"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { Pencil, Ban, Plus, Landmark, Banknote, CreditCard } from "lucide-react";
import AddPaymentModal, { type EditPaymentData } from "@/app/finances/payments/_components/AddPaymentModal";

interface Payment {
  id: string;
  order_id: string;
  order_code?: string;
  invoice_id: string | null;
  method: "cash" | "bank" | "card";
  amount: number;
  currency: string;
  paid_at: string;
  payer_name: string | null;
  payer_party_id: string | null;
  note: string | null;
  account_id?: string | null;
  account_name?: string | null;
  status?: string;
}

interface OrderPaymentsListProps {
  orderCode: string;
  orderId: string;
  orderAmountTotal?: number;
  onChanged?: () => void;
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  bank: <Landmark size={13} />,
  cash: <Banknote size={13} />,
  card: <CreditCard size={13} />,
};

const METHOD_STYLE: Record<string, string> = {
  bank: "bg-blue-50 text-blue-700",
  cash: "bg-green-50 text-green-700",
  card: "bg-purple-50 text-purple-700",
};

export default function OrderPaymentsList({ orderCode, orderId, orderAmountTotal = 0, onChanged }: OrderPaymentsListProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [linkedToInvoices, setLinkedToInvoices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editPayment, setEditPayment] = useState<EditPaymentData | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hideCancelled, setHideCancelled] = useState(true);

  const loadPayments = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/finances/payments?orderId=${encodeURIComponent(orderId)}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load payments");
      const data = await res.json();
      const orderPayments = (data.data || []).filter((p: Payment) => p.order_id === orderId);
      setPayments(orderPayments);
    } catch (err) {
      console.error("Error loading payments:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const loadPaymentSummary = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/invoices`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      const linked = Number(data?.paymentSummary?.linkedToInvoices) || 0;
      setLinkedToInvoices(linked);
    } catch {
      // ignore
    }
  }, [orderCode]);

  useEffect(() => {
    loadPayments();
    loadPaymentSummary();
  }, [loadPayments, loadPaymentSummary]);

  const formatCurrency = (amount: number, currency = "EUR") =>
    `€${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleEdit = (p: Payment) => {
    setEditPayment({
      id: p.id,
      order_id: p.order_id,
      order_code: orderCode,
      invoice_id: p.invoice_id,
      method: p.method,
      amount: p.amount,
      currency: p.currency,
      paid_at: p.paid_at,
      payer_name: p.payer_name,
      payer_party_id: p.payer_party_id,
      note: p.note,
      account_id: p.account_id,
    });
  };

  const handleCancel = async (paymentId: string) => {
    if (!confirm("Cancel this payment?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/finances/payments/${paymentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
      loadPayments();
      loadPaymentSummary();
      onChanged?.();
    } catch (err) {
      console.error("Error cancelling payment:", err);
    }
  };

  if (loading) return <div className="text-sm text-gray-400 py-2">Loading payments...</div>;

  if (payments.length === 0) return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
        >
          + Add Payment
        </button>
      </div>
      <div className="text-sm text-gray-400 py-4">No payments yet</div>
      <AddPaymentModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => {
          setShowAddModal(false);
          loadPayments();
          onChanged?.();
        }}
        preselectedOrderId={orderId}
        preselectedOrderCode={orderCode}
      />
    </div>
  );

  const hasCancelled = payments.some((p) => p.status === "cancelled");
  const visiblePayments = hideCancelled
    ? payments.filter((p) => p.status !== "cancelled")
    : payments;
  const total = visiblePayments
    .filter((p) => p.status !== "cancelled")
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
        <div className="flex items-center gap-2">
          {hasCancelled && (
            <button
              onClick={() => setHideCancelled(!hideCancelled)}
              className={`p-1 rounded transition-colors ${
                hideCancelled
                  ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
              }`}
              title={hideCancelled ? 'Show cancelled payments' : 'Hide cancelled payments'}
            >
              {hideCancelled ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            + Add Payment
          </button>
        </div>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs">
            <th className="text-left py-1.5 px-2 font-medium text-gray-600">Date</th>
            <th className="text-left py-1.5 px-2 font-medium text-gray-600">Payer</th>
            <th className="text-center py-1.5 px-2 font-medium text-gray-600">Method</th>
            <th className="text-right py-1.5 px-2 font-medium text-gray-600">Amount</th>
            <th className="text-left py-1.5 px-2 font-medium text-gray-600">Note</th>
            <th className="text-center py-1.5 px-2 font-medium text-gray-600">Invoice</th>
            <th className="text-center py-1.5 px-2 font-medium text-gray-600 w-[80px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visiblePayments.map((p) => {
            const isCancelled = p.status === "cancelled";
            return (
              <tr key={p.id} className={`border-b border-gray-100 ${isCancelled ? "opacity-50 bg-red-50/30" : "hover:bg-gray-50"}`}>
                <td className={`py-1.5 px-2 ${isCancelled ? "text-gray-400 line-through" : "text-gray-700"}`}>{formatDateDDMMYYYY(p.paid_at)}</td>
                <td className={`py-1.5 px-2 ${isCancelled ? "text-gray-400 line-through" : "text-gray-700"}`}>{p.payer_name || "—"}</td>
                <td className="py-1.5 px-2 text-center">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${isCancelled ? "bg-gray-100 text-gray-400" : (METHOD_STYLE[p.method] || "bg-gray-100 text-gray-700")}`}>
                    {METHOD_ICON[p.method]}
                    {p.method}
                  </span>
                </td>
                <td className={`py-1.5 px-2 text-right font-medium ${isCancelled ? "text-gray-400 line-through" : "text-gray-900"}`}>{formatCurrency(p.amount, p.currency)}</td>
                <td className="py-1.5 px-2 text-gray-500 text-xs max-w-[150px] truncate">
                  {isCancelled ? <span className="text-red-500 text-xs">Cancelled</span> : (p.note || "—")}
                </td>
                <td className="py-1.5 px-2 text-center text-xs text-gray-400">
                  {p.invoice_id ? "✓" : "—"}
                </td>
                <td className="py-1.5 px-2">
                  {!isCancelled && (
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(p)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleCancel(p.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Cancel payment">
                        <Ban size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300">
            <td colSpan={3} className="py-1.5 px-2 text-xs font-medium text-gray-600 text-right">Total:</td>
            <td className="py-1.5 px-2 text-right font-semibold text-gray-900 text-sm">{formatCurrency(total)}</td>
            <td colSpan={3} />
          </tr>
          {total > linkedToInvoices + 0.01 && (
            <tr>
              <td colSpan={3} className="py-1 px-2 text-xs font-medium text-purple-600 text-right">Overpayment:</td>
              <td className="py-1 px-2 text-right font-semibold text-purple-700 text-sm">
                +{formatCurrency(Math.round((total - linkedToInvoices) * 100) / 100)}
              </td>
              <td colSpan={3} />
            </tr>
          )}
        </tfoot>
      </table>

      <AddPaymentModal
        open={showAddModal || !!editPayment}
        onClose={() => { setShowAddModal(false); setEditPayment(null); }}
        onCreated={() => {
          setShowAddModal(false);
          setEditPayment(null);
          loadPayments();
          loadPaymentSummary();
          onChanged?.();
        }}
        preselectedOrderId={orderId}
        preselectedOrderCode={orderCode}
        editPayment={editPayment}
      />
    </div>
  );
}
