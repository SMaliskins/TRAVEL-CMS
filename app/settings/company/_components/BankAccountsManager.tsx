"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BANK_LIST } from "@/lib/constants/banks";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string | null;
  iban: string | null;
  swift: string | null;
  currency: string;
  is_default: boolean;
  is_active: boolean;
  use_in_invoices?: boolean;
}

interface Props {
  readonly: boolean;
}

const BANK_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "NOK", "DKK", "Multi-currency"];

export default function BankAccountsManager({ readonly }: Props) {
  const formContainerRef = useRef<HTMLDivElement>(null);
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
  const [formUseInInvoices, setFormUseInInvoices] = useState(true);
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
    setFormUseInInvoices(true);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (acc: BankAccount) => {
    setEditingId(acc.id);
    setFormName(acc.account_name);
    setFormBank(acc.bank_name || "");
    setFormIban(acc.iban || "");
    setFormSwift(acc.swift || "");
    setFormCurrency(acc.currency === "MULTI" ? "Multi-currency" : acc.currency);
    setFormDefault(acc.is_default);
    setFormUseInInvoices(acc.use_in_invoices !== false);
    setShowForm(true);
    setTimeout(() => formContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
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
      currency: formCurrency === "Multi-currency" ? "MULTI" : formCurrency,
      is_default: formDefault,
      use_in_invoices: formUseInInvoices,
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
        const text = await res.text();
        let json: { error?: string } = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          console.error("[BankAccounts] Save error (non-JSON):", text?.slice(0, 200));
        }
        const message = json.error || (res.status === 500 ? "Server error. Ensure database migrations are applied (e.g. add_banking_use_in_invoices_and_currencies)." : `Failed to save (${res.status})`);
        console.error("[BankAccounts] Save error:", json.error || message);
        setError(message);
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

  const toggleUseInInvoices = async (acc: BankAccount) => {
    const token = await getToken();
    if (!token) return;
    await fetch(`/api/company/bank-accounts/${acc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ use_in_invoices: !(acc.use_in_invoices !== false) }),
    });
    loadAccounts();
  };

  if (loading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Banking Details</h3>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Banking Details</h3>
        {!readonly && !showForm && !editingId && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
              setTimeout(() => formContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
            }}
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
        <ul className="mb-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {accounts.map((acc) => (
            <li key={acc.id}>
              {editingId === acc.id && !readonly ? (
                <div ref={formContainerRef} onClick={(e) => e.stopPropagation()} className="p-4 bg-gray-50 border-l-4 border-blue-400 space-y-3">
                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Account Name <span className="text-red-500">*</span></label>
                    <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Main EUR Account" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
                      <select
                        value={formBank && BANK_LIST.includes(formBank as (typeof BANK_LIST)[number]) && formBank !== "Other" ? formBank : "Other"}
                        onChange={(e) => setFormBank(e.target.value === "Other" ? "" : e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select bank</option>
                        {BANK_LIST.filter((b) => b !== "Other").map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                      {(!formBank || !BANK_LIST.includes(formBank as (typeof BANK_LIST)[number]) || formBank === "Other") && (
                        <input
                          type="text"
                          value={formBank && !BANK_LIST.includes(formBank as (typeof BANK_LIST)[number]) ? formBank : ""}
                          onChange={(e) => setFormBank(e.target.value)}
                          placeholder="Custom bank name"
                          className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
                      <select value={formCurrency === "MULTI" ? "Multi-currency" : formCurrency} onChange={(e) => setFormCurrency(e.target.value === "Multi-currency" ? "MULTI" : e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                        {BANK_CURRENCIES.map((c) => <option key={c} value={c === "Multi-currency" ? "MULTI" : c}>{c}</option>)}
                      </select>
                      <p className="text-xs text-gray-500 mt-0.5">Multi-currency = accepts any currency.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">IBAN</label>
                      <input type="text" value={formIban} onChange={(e) => setFormIban(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">SWIFT</label>
                      <input type="text" value={formSwift} onChange={(e) => setFormSwift(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={formDefault} onChange={(e) => setFormDefault(e.target.checked)} className="rounded border-gray-300" />
                      Default account
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={formUseInInvoices} onChange={(e) => setFormUseInInvoices(e.target.checked)} className="rounded border-gray-300" />
                      Use in invoices
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button onClick={handleSave} disabled={saving || !formName.trim()} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
                      {saving ? "Saving..." : "Update"}
                    </button>
                    <button type="button" onClick={() => { handleDeactivate(acc.id); resetForm(); }} className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded hover:bg-red-100">
                      Remove
                    </button>
                    <button type="button" onClick={resetForm} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => !readonly && startEdit(acc)}
                  disabled={readonly}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50/80 disabled:cursor-default disabled:hover:bg-transparent transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{acc.account_name}</span>
                    {acc.is_default && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Default</span>
                    )}
                    {acc.use_in_invoices === false && (
                      <span className="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded">Hidden from invoices</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500 break-words">
                    {[acc.bank_name, acc.iban, acc.swift ? `SWIFT: ${acc.swift}` : "", acc.currency === "MULTI" ? "Multi-currency" : acc.currency].filter(Boolean).join(" · ")}
                  </p>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showForm && !editingId && (
        <div ref={formContainerRef} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50 border-l-4 border-blue-400">
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
              <select
                value={formBank && BANK_LIST.includes(formBank as (typeof BANK_LIST)[number]) && formBank !== "Other" ? formBank : "Other"}
                onChange={(e) => setFormBank(e.target.value === "Other" ? "" : e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select bank</option>
                {BANK_LIST.filter((b) => b !== "Other").map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
                <option value="Other">Other</option>
              </select>
              {(!formBank || !BANK_LIST.includes(formBank as (typeof BANK_LIST)[number]) || formBank === "Other") && (
                <input
                  type="text"
                  value={formBank && !BANK_LIST.includes(formBank as (typeof BANK_LIST)[number]) ? formBank : ""}
                  onChange={(e) => setFormBank(e.target.value)}
                  placeholder="Custom bank name"
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={formCurrency === "MULTI" ? "Multi-currency" : formCurrency}
                onChange={(e) => setFormCurrency(e.target.value === "Multi-currency" ? "MULTI" : e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {BANK_CURRENCIES.map((c) => (
                  <option key={c} value={c === "Multi-currency" ? "MULTI" : c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-0.5">Multi-currency = account accepts any currency.</p>
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
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formDefault}
                onChange={(e) => setFormDefault(e.target.checked)}
                className="rounded border-gray-300"
              />
              Default account
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formUseInInvoices}
                onChange={(e) => setFormUseInInvoices(e.target.checked)}
                className="rounded border-gray-300"
              />
              Use in invoices
            </label>
          </div>
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
