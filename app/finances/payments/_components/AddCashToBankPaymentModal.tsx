"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useDateFormat } from "@/contexts/CompanySettingsContext";
import { formatDateDDMMYYYY, type DateFormatPattern } from "@/utils/dateFormat";
import { sanitizeNumber } from "@/utils/sanitizeNumber";
import type { EditPaymentData } from "./AddPaymentModal";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string | null;
  currency: string;
  is_default: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editPayment?: EditPaymentData | null;
}

export default function AddCashToBankPaymentModal({ open, onClose, onSaved, editPayment }: Props) {
  const dateFormat = useDateFormat();
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isoToDisplay = (iso: string, fmt: DateFormatPattern) => formatDateDDMMYYYY(iso, fmt);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editPayment) {
      setPaidAt(editPayment.paid_at?.split("T")[0] || new Date().toISOString().slice(0, 10));
      setAmount(String(editPayment.amount));
      setCurrency(editPayment.currency || "EUR");
      setAccountId(editPayment.account_id || "");
      setNote(editPayment.note || "");
    } else {
      setPaidAt(new Date().toISOString().slice(0, 10));
      setAmount("");
      setCurrency("EUR");
      setAccountId("");
      setNote("Cash deposited to bank via ATM");
    }
    void loadAccounts();
  }, [open, editPayment]);

  useEffect(() => {
    if (accountId || accounts.length === 0) return;
    const def = accounts.find((a) => a.is_default) || accounts[0];
    setAccountId(def.id);
    if (def.currency && def.currency !== "MULTI") setCurrency(def.currency);
  }, [accounts, accountId]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const loadAccounts = async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/company/bank-accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setAccounts(json.data ?? []);
    }
  };

  const save = async () => {
    setError("");
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!accountId) {
      setError("Select bank account");
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const url = editPayment ? `/api/finances/payments/${editPayment.id}` : "/api/finances/payments";
      const res = await fetch(url, {
        method: editPayment ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method: "atm",
          amount: amountNum,
          currency,
          paid_at: paidAt,
          account_id: accountId,
          payer_name: "Cash to bank (ATM)",
          note: note || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.message || json.error || "Failed to save ATM deposit");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-start sm:pt-[10vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md rounded-t-xl bg-white shadow-xl sm:rounded-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {editPayment ? "Edit Cash to Bank Payment" : "Add Cash to Bank Payment"}
          </h2>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          {error && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">{isoToDisplay(paidAt, dateFormat)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(sanitizeNumber(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Bank account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
            >
              <option value="">Select account</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name}{acc.bank_name ? ` · ${acc.bank_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              placeholder="ATM deposit details"
            />
          </div>
          <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Method is saved as ATM. Entered by is assigned automatically from the current manager.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
