"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import AddPaymentModal from "./_components/AddPaymentModal";

interface Payment {
  id: string;
  order_id: string;
  order_code: string | null;
  order_client: string | null;
  invoice_id: string | null;
  method: "cash" | "bank" | "card";
  amount: number;
  currency: string;
  paid_at: string;
  account_id: string | null;
  account_name: string | null;
  bank_name: string | null;
  payer_name: string | null;
  note: string | null;
  created_at: string;
}

const METHOD_LABELS: Record<string, string> = {
  bank: "Bank",
  cash: "Cash",
  card: "Card",
};

const METHOD_STYLES: Record<string, string> = {
  bank: "bg-blue-100 text-blue-700",
  cash: "bg-green-100 text-green-700",
  card: "bg-purple-100 text-purple-700",
};

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const loadPayments = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams();
      if (filterMethod !== "all") params.set("method", filterMethod);
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);

      const res = await fetch(`/api/finances/payments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setPayments(json.data ?? []);
      }
    } catch (err) {
      console.error("Error loading payments:", err);
    } finally {
      setLoading(false);
    }
  }, [filterMethod, filterDateFrom, filterDateTo, router]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Delete this payment?")) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/finances/payments/${paymentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.ok) {
      loadPayments();
    }
  };

  const formatCurrency = (amount: number, cur: string) => {
    const symbols: Record<string, string> = { EUR: "\u20ac", USD: "$", GBP: "\u00a3" };
    return `${symbols[cur] || cur}${Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading payments...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-600 mt-1">Record and track payments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          + Add Payment
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Method:</span>
          {["all", "bank", "cash", "card"].map((m) => (
            <button
              key={m}
              onClick={() => setFilterMethod(m)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                filterMethod === m
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {m === "all" ? "All" : METHOD_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">From:</span>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <span className="text-sm text-gray-700">To:</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          {(filterDateFrom || filterDateTo) && (
            <button
              onClick={() => {
                setFilterDateFrom("");
                setFilterDateTo("");
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 flex items-center gap-4">
        <span className="text-sm text-gray-600">
          Total: <strong className="text-gray-900">{payments.length}</strong> payments
        </span>
        <span className="text-sm text-gray-600">
          Amount: <strong className="text-gray-900">{formatCurrency(totalAmount, "EUR")}</strong>
        </span>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Order</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Payer</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Method</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Account</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Note</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No payments found
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">
                    {formatDateDDMMYYYY(p.paid_at)}
                  </td>
                  <td className="px-4 py-3">
                    {p.order_code ? (
                      <button
                        onClick={() => router.push(`/orders/${p.order_code}`)}
                        className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      >
                        {p.order_code}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.payer_name || "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                        METHOD_STYLES[p.method] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {METHOD_LABELS[p.method] || p.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(p.amount, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {p.account_name || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                    {p.note || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100"
                      title="Delete payment"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddPaymentModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => loadPayments()}
      />
    </div>
  );
}
