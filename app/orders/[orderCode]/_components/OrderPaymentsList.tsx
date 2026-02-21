"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { Pencil, Trash2, Landmark, Banknote, CreditCard } from "lucide-react";
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
}

interface OrderPaymentsListProps {
  orderCode: string;
  orderId: string;
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

export default function OrderPaymentsList({ orderCode, orderId, onChanged }: OrderPaymentsListProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPayment, setEditPayment] = useState<EditPaymentData | null>(null);

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

  useEffect(() => { loadPayments(); }, [loadPayments]);

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

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Delete this payment?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/finances/payments/${paymentId}`, {
        method: "DELETE",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to delete");
      loadPayments();
      onChanged?.();
    } catch (err) {
      console.error("Error deleting payment:", err);
    }
  };

  if (loading) return <div className="text-sm text-gray-400 py-2">Loading payments...</div>;
  if (payments.length === 0) return <div className="text-sm text-gray-400 py-2">No payments yet</div>;

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-2">Payments</h3>
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
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-1.5 px-2 text-gray-700">{formatDateDDMMYYYY(p.paid_at)}</td>
              <td className="py-1.5 px-2 text-gray-700">{p.payer_name || "—"}</td>
              <td className="py-1.5 px-2 text-center">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${METHOD_STYLE[p.method] || "bg-gray-100 text-gray-700"}`}>
                  {METHOD_ICON[p.method]}
                  {p.method}
                </span>
              </td>
              <td className="py-1.5 px-2 text-right font-medium text-gray-900">{formatCurrency(p.amount, p.currency)}</td>
              <td className="py-1.5 px-2 text-gray-500 text-xs max-w-[150px] truncate">{p.note || "—"}</td>
              <td className="py-1.5 px-2 text-center text-xs text-gray-400">
                {p.invoice_id ? "✓" : "—"}
              </td>
              <td className="py-1.5 px-2">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => handleEdit(p)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300">
            <td colSpan={3} className="py-1.5 px-2 text-xs font-medium text-gray-600 text-right">Total:</td>
            <td className="py-1.5 px-2 text-right font-semibold text-gray-900 text-sm">{formatCurrency(total)}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>

      <AddPaymentModal
        open={!!editPayment}
        onClose={() => setEditPayment(null)}
        onCreated={() => {
          setEditPayment(null);
          loadPayments();
          onChanged?.();
        }}
        editPayment={editPayment}
      />
    </div>
  );
}
