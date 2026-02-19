"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string | null;
  iban: string | null;
  swift: string | null;
  currency: string;
  is_default: boolean;
  is_active: boolean;
}

interface Props {
  readonly: boolean;
}

export default function BankAccountsManager({ readonly }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formBank, setFormBank] = useState("");
  const [formIban, setFormIban] = useState("");
  const [formSwift, setFormSwift] = useState("");
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formDefault, setFormDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const loadAccounts = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/company/bank-accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setAccounts(json.data ?? []);
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const resetForm = () => {
    setFormName("");
    setFormBank("");
    setFormIban("");
    setFormSwift("");
    setFormCurrency("EUR");
    setFormDefault(false);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (acc: BankAccount) => {
    setEditingId(acc.id);
    setFormName(acc.account_name);
    setFormBank(acc.bank_name || "");
    setFormIban(acc.iban || "");
    setFormSwift(acc.swift || "");
    setFormCurrency(acc.currency);
    setFormDefault(acc.is_default);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setError("");
    const token = await getToken();
    if (!token) { setError("Not authenticated"); setSaving(false); return; }

    const body = {
      account_name: formName.trim(),
      bank_name: formBank.trim() || null,
      iban: formIban.trim() || null,
      swift: formSwift.trim() || null,
      currency: formCurrency,
      is_default: formDefault,
    };

    try {
      const url = editingId
        ? `/api/company/bank-accounts/${editingId}`
        : "/api/company/bank-accounts";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("[BankAccounts] Save error:", json);
        setError(json.error || `Failed to save (${res.status})`);
        setSaving(false);
        return;
      }

      setSaving(false);
      resetForm();
      loadAccounts();
    } catch (err) {
      console.error("[BankAccounts] Network error:", err);
      setError("Network error");
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    await fetch(`/api/company/bank-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: false }),
    });
    loadAccounts();
  };

  if (loading) {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Accounts</h3>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Payment Accounts</h3>
        {!readonly && !showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            + Add Account
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Bank accounts used for receiving payments in the Finances module.
      </p>

      {accounts.length > 0 && (
        <div className="space-y-2 mb-4">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {acc.account_name}
                </span>
                {acc.is_default && (
                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
                <div className="text-xs text-gray-500">
                  {[acc.bank_name, acc.iban, acc.currency].filter(Boolean).join(" | ")}
                </div>
              </div>
              {!readonly && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(acc)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeactivate(acc.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Account Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Main EUR Account"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={formBank}
                onChange={(e) => setFormBank(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">IBAN</label>
              <input
                type="text"
                value={formIban}
                onChange={(e) => setFormIban(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SWIFT</label>
              <input
                type="text"
                value={formSwift}
                onChange={(e) => setFormSwift(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formDefault}
              onChange={(e) => setFormDefault(e.target.checked)}
              className="rounded border-gray-300"
            />
            Default account
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Add"}
            </button>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 italic">No payment accounts configured yet.</p>
      )}
    </div>
  );
}
