"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface CashPayment {
  id: string;
  order_code: string | null;
  order_client: string | null;
  method: string;
  amount: number;
  currency: string;
  paid_at: string;
  payer_name: string | null;
  account_name: string | null;
  bank_name: string | null;
  note: string | null;
}

interface DailyReport {
  date: string;
  payments: CashPayment[];
  total: number;
}

type Tab = "cash" | "bank";

export default function CashFlowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("cash");
  const [dailyReport, setDailyReport] = useState<DailyReport[]>([]);
  const [allPayments, setAllPayments] = useState<CashPayment[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const method = tab === "cash" ? "cash" : "bank";
      const params = new URLSearchParams({
        method,
        dateFrom,
        dateTo,
      });

      const res = await fetch(`/api/finances/cashflow?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setDailyReport(json.data?.dailyReport ?? []);
        setAllPayments(json.data?.payments ?? []);
        setGrandTotal(json.data?.grandTotal ?? 0);
      }
    } catch (err) {
      console.error("Error loading cashflow:", err);
    } finally {
      setLoading(false);
    }
  }, [tab, dateFrom, dateTo, router]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) =>
    `\u20ac${Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cash Flow</h1>
        <p className="text-sm text-gray-600 mt-1">
          Daily cash reports (Z-report) and bank movements
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("cash")}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            tab === "cash"
              ? "bg-green-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Z-Report (Cash)
        </button>
        <button
          onClick={() => setTab("bank")}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            tab === "bank"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Bank Movements
        </button>
      </div>

      {/* Date filters */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-gray-700">Period:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        />
        <span className="text-sm text-gray-400">&mdash;</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : dailyReport.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No {tab === "cash" ? "cash" : "bank"} payments for this period
        </div>
      ) : (
        <div className="space-y-4">
          {dailyReport.map((day) => (
            <div
              key={day.date}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Day header */}
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">
                  {formatDateDDMMYYYY(day.date)}
                </h3>
                <span className="text-sm font-bold text-gray-900">
                  Total: {formatCurrency(day.total)}
                </span>
              </div>

              {/* Day payments */}
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Order
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Payer
                    </th>
                    {tab === "bank" && (
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Account
                      </th>
                    )}
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                      Note
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {day.payments.map((p: CashPayment) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {p.order_code ? (
                          <button
                            onClick={() =>
                              router.push(`/orders/${p.order_code}`)
                            }
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {p.order_code}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {p.payer_name || p.order_client || "-"}
                      </td>
                      {tab === "bank" && (
                        <td className="px-4 py-2 text-gray-600 text-xs">
                          {p.account_name || "-"}
                        </td>
                      )}
                      <td className="px-4 py-2 text-gray-500 text-xs max-w-[200px] truncate">
                        {p.note || "-"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Grand total */}
          <div className="flex justify-end">
            <div className="bg-gray-900 text-white px-6 py-3 rounded-lg">
              <span className="text-sm">Grand Total:</span>{" "}
              <span className="text-lg font-bold">{formatCurrency(grandTotal)}</span>
              <span className="text-gray-400 text-xs ml-2">
                ({allPayments.length} payments)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
