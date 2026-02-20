"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { useDraggableModal } from "@/hooks/useDraggableModal";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string | null;
  iban: string | null;
  currency: string;
  is_default: boolean;
}

interface OrderOption {
  id: string;
  order_code: string;
  client_display_name: string | null;
  amount_total: number;
  amount_paid: number;
  amount_debt: number;
}

interface InvoiceOption {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  payer_name: string | null;
}

interface PartyOption {
  id: string;
  display_name: string;
  type: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  preselectedOrderId?: string;
  preselectedOrderCode?: string;
}

export default function AddPaymentModal({
  open,
  onClose,
  onCreated,
  preselectedOrderId,
  preselectedOrderCode,
}: Props) {
  const [orderId, setOrderId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidAtDisplay, setPaidAtDisplay] = useState(() => {
    const d = new Date(); return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  });

  const [method, setMethod] = useState<"cash" | "bank" | "card">("bank");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [accountId, setAccountId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerPartyId, setPayerPartyId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [orderSearch, setOrderSearch] = useState("");
  const [orderOptions, setOrderOptions] = useState<OrderOption[]>([]);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);

  const [payerSearch, setPayerSearch] = useState("");
  const [payerOptions, setPayerOptions] = useState<PartyOption[]>([]);
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);

  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const orderSearchRef = useRef<HTMLInputElement>(null);
  const orderDropdownRef = useRef<HTMLDivElement>(null);
  const payerSearchRef = useRef<HTMLInputElement>(null);
  const payerDropdownRef = useRef<HTMLDivElement>(null);
  const { modalStyle, onHeaderMouseDown, resetPosition } = useDraggableModal();

  useEffect(() => {
    if (!open) return;
    resetPosition();
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose, resetPosition]);

  useEffect(() => {
    if (!open) return;
    loadBankAccounts();
    setOrderId(preselectedOrderId || "");
    setInvoiceId("");
    const now = new Date();
    setPaidAt(now.toISOString().slice(0, 10));
    setPaidAtDisplay(`${String(now.getDate()).padStart(2,"0")}.${String(now.getMonth()+1).padStart(2,"0")}.${now.getFullYear()}`);
    setMethod("bank");
    setAmount("");
    setCurrency("EUR");
    setAccountId("");
    setPayerName("");
    setPayerPartyId(null);
    setPayerSearch("");
    setNote("");
    setError("");
    setOrderSearch(preselectedOrderCode || "");
    setSelectedOrder(null);
    setInvoiceOptions([]);

    if (preselectedOrderCode) {
      loadOrderDetails(preselectedOrderId || "", preselectedOrderCode);
    }
  }, [open, preselectedOrderId, preselectedOrderCode]);

  useEffect(() => {
    if (bankAccounts.length > 0 && !accountId) {
      const def = bankAccounts.find((a) => a.is_default);
      setAccountId(def?.id ?? bankAccounts[0].id);
    }
  }, [bankAccounts, accountId]);

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const loadBankAccounts = async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/company/bank-accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setBankAccounts(json.data ?? []);
    }
  };

  const loadOrderDetails = async (oid: string, ocode: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/orders?search=${encodeURIComponent(ocode)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const orders: OrderOption[] = (json.orders ?? json.data ?? []).map(
          (o: Record<string, unknown>) => ({
            id: String(o.id || ""),
            order_code: String(o.order_code ?? o.orderId ?? ""),
            client_display_name: o.client_display_name ?? o.client ?? null,
            amount_total: Number(o.amount_total ?? o.amount ?? 0),
            amount_paid: Number(o.amount_paid ?? o.paid ?? 0),
            amount_debt: Number(o.amount_debt ?? o.debt ?? 0),
          })
        );
        const match = orders.find((o) => o.order_code === ocode || o.id === oid);
        if (match && match.id) {
          setError("");
          setSelectedOrder(match);
          setOrderId(match.id);
          setOrderSearch(match.order_code);
          if (match.client_display_name) setPayerSearch(match.client_display_name as string);
          if (match.amount_debt > 0) setAmount(String(match.amount_debt));
        }
      }
    } catch (err) {
      console.error("[AddPayment] loadOrderDetails error:", err);
    }
  };

  // Search orders by code or client name
  useEffect(() => {
    if (orderSearch.length < 2 || selectedOrder) {
      if (!selectedOrder) setOrderOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `/api/orders?search=${encodeURIComponent(orderSearch)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        const raw = (json.orders ?? json.data ?? []).slice(0, 10);
        setOrderOptions(
          raw.map((o: Record<string, unknown>) => ({
            id: String(o.id || ""),
            order_code: String(o.order_code ?? o.orderId ?? ""),
            client_display_name: o.client_display_name ?? o.client ?? null,
            amount_total: Number(o.amount_total ?? o.amount ?? 0),
            amount_paid: Number(o.amount_paid ?? o.paid ?? 0),
            amount_debt: Number(o.amount_debt ?? o.debt ?? 0),
          }))
        );
        setShowOrderDropdown(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [orderSearch, selectedOrder, getToken]);

  // Search payer from Directory
  useEffect(() => {
    if (payerSearch.length < 2 || payerPartyId) {
      if (!payerPartyId) setPayerOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `/api/directory?search=${encodeURIComponent(payerSearch)}&limit=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        setPayerOptions(
          (json.data ?? json.parties ?? []).slice(0, 8).map(
            (p: Record<string, unknown>) => ({
              id: p.id,
              display_name: p.display_name || p.name || "",
              type: p.type || "person",
            })
          )
        );
        setShowPayerDropdown(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [payerSearch, payerPartyId, getToken]);

  // Load invoices when order selected
  useEffect(() => {
    if (!orderId || !selectedOrder) {
      setInvoiceOptions([]);
      return;
    }
    (async () => {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `/api/orders/${encodeURIComponent(selectedOrder.order_code)}/invoices`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        const all: InvoiceOption[] = json.invoices ?? json.data ?? [];
        setInvoiceOptions(all.filter((inv) => inv.status !== "cancelled"));
      }
    })();
  }, [orderId, selectedOrder, getToken]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        orderDropdownRef.current &&
        !orderDropdownRef.current.contains(e.target as Node) &&
        orderSearchRef.current &&
        !orderSearchRef.current.contains(e.target as Node)
      ) {
        setShowOrderDropdown(false);
      }
      if (
        payerDropdownRef.current &&
        !payerDropdownRef.current.contains(e.target as Node) &&
        payerSearchRef.current &&
        !payerSearchRef.current.contains(e.target as Node)
      ) {
        setShowPayerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectOrder = (o: OrderOption) => {
    setError("");
    setOrderId(o.id);
    setSelectedOrder(o);
    setOrderSearch(o.order_code);
    setShowOrderDropdown(false);
    if (o.client_display_name && !payerSearch) {
      setPayerSearch(o.client_display_name);
      setPayerName(o.client_display_name);
    }
    if (o.amount_debt > 0) setAmount(String(o.amount_debt));
  };

  const handleSelectPayer = (p: PartyOption) => {
    setPayerPartyId(p.id);
    setPayerName(p.display_name);
    setPayerSearch(p.display_name);
    setShowPayerDropdown(false);
  };

  const handleSave = async () => {
    setError("");
    const effectiveOrderId = orderId || selectedOrder?.id || "";
    if (!effectiveOrderId) {
      setError("Select an order");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }

      const res = await fetch("/api/finances/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: effectiveOrderId,
          invoice_id: invoiceId || null,
          method,
          amount: parseFloat(amount),
          currency,
          paid_at: paidAt,
          account_id: accountId || null,
          payer_name: payerName || payerSearch || null,
          payer_party_id: payerPartyId || null,
          note: note || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("[AddPayment] Save failed", JSON.stringify({ orderId, status: res.status, json }));
        setError(json.error || "Failed to save payment");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-lg shadow-xl" style={modalStyle}>
        <div className="flex items-center justify-between border-b px-5 py-4 cursor-grab active:cursor-grabbing select-none" onMouseDown={onHeaderMouseDown}>
          <h2 className="text-lg font-semibold text-gray-900">Add Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Order search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order <span className="text-red-500">*</span>
            </label>
            {selectedOrder ? (
              <div className="flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                <div>
                  <span className="font-medium text-sm text-gray-900">
                    {selectedOrder.order_code}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    {selectedOrder.client_display_name || ""}
                  </span>
                  <span className="text-gray-400 text-xs ml-2">
                    Debt: {selectedOrder.amount_debt?.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setOrderId("");
                    setOrderSearch("");
                    setAmount("");
                    setInvoiceOptions([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  &times;
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={orderSearchRef}
                  type="text"
                  value={orderSearch}
                  onChange={(e) => {
                    setOrderSearch(e.target.value);
                    setShowOrderDropdown(true);
                  }}
                  onFocus={() =>
                    orderOptions.length > 0 && setShowOrderDropdown(true)
                  }
                  placeholder="Search by order code or client name..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                {showOrderDropdown && orderOptions.length > 0 && (
                  <div
                    ref={orderDropdownRef}
                    className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
                  >
                    {orderOptions.map((o, idx) => (
                      <button
                        key={o.id || idx}
                        onClick={() => handleSelectOrder(o)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                      >
                        <span className="font-semibold text-gray-900">
                          {o.order_code}
                        </span>
                        <span className="text-gray-600 ml-2">
                          {o.client_display_name || "—"}
                        </span>
                        <span className="text-gray-400 text-xs float-right">
                          Debt: {o.amount_debt?.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Invoice (optional) */}
          {invoiceOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice (optional)
              </label>
              <select
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- No invoice --</option>
                {invoiceOptions.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} -- {inv.total?.toFixed(2)} (
                    {inv.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <div>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => {
                  const iso = e.target.value;
                  setPaidAt(iso);
                  if (iso) {
                    const [y, m, d] = iso.split("-");
                    setPaidAtDisplay(`${d}.${m}.${y}`);
                  }
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {(["bank", "cash", "card"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                    method === m
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {m === "bank"
                    ? "Bank Transfer"
                    : m === "cash"
                      ? "Cash"
                      : "Card"}
                </button>
              ))}
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Credit to Account
            </label>
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No bank accounts configured.{" "}
                <a
                  href="/settings/company"
                  className="text-blue-600 hover:underline"
                >
                  Add in Settings &rarr; Financial
                </a>
              </p>
            ) : (
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Select account --</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name}
                    {acc.bank_name ? ` (${acc.bank_name})` : ""}
                    {acc.iban ? ` -- ${acc.iban}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Payer - search from Directory */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payer
            </label>
            <input
              ref={payerSearchRef}
              type="text"
              value={payerSearch}
              onChange={(e) => {
                setPayerSearch(e.target.value);
                setPayerName(e.target.value);
                setPayerPartyId(null);
                if (e.target.value.length >= 2) setShowPayerDropdown(true);
              }}
              onFocus={() =>
                payerOptions.length > 0 && setShowPayerDropdown(true)
              }
              placeholder="Search by name in Directory or type manually..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {payerPartyId && (
              <span className="absolute right-3 top-8 text-xs text-green-600">
                Linked
              </span>
            )}
            {showPayerDropdown && payerOptions.length > 0 && (
              <div
                ref={payerDropdownRef}
                className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto"
              >
                {payerOptions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPayer(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <span className="text-gray-400 text-xs">
                      {p.type === "company" ? "Co" : "P"}
                    </span>
                    <span className="text-gray-900">{p.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
