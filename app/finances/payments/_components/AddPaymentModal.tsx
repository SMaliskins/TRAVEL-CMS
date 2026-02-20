"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { useDateFormat } from "@/contexts/CompanySettingsContext";
import { formatDateDDMMYYYY, type DateFormatPattern } from "@/utils/dateFormat";
import PartySelect from "@/components/PartySelect";

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
  const dateFormat = useDateFormat();

  const isoToDisplay = useCallback((iso: string, fmt: DateFormatPattern) => formatDateDDMMYYYY(iso, fmt), []);

  const separator = useMemo(() => dateFormat === "yyyy-mm-dd" ? "-" : ".", [dateFormat]);
  const placeholder = dateFormat;

  const parseDisplayToIso = useCallback((display: string): string | null => {
    const sep = dateFormat === "yyyy-mm-dd" ? "-" : ".";
    const parts = display.split(sep);
    if (parts.length !== 3) return null;
    let d: string, m: string, y: string;
    if (dateFormat === "dd.mm.yyyy") { [d, m, y] = parts; }
    else if (dateFormat === "mm.dd.yyyy") { [m, d, y] = parts; }
    else { [y, m, d] = parts; }
    if (d.length === 2 && m.length === 2 && y.length === 4) return `${y}-${m}-${d}`;
    return null;
  }, [dateFormat]);

  const [orderId, setOrderId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidAtDisplay, setPaidAtDisplay] = useState(() => formatDateDDMMYYYY(new Date().toISOString().slice(0, 10)));

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

  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const orderSearchRef = useRef<HTMLInputElement>(null);
  const orderDropdownRef = useRef<HTMLDivElement>(null);
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
    setOrderId(preselectedOrderId || "");
    setInvoiceId("");
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    setPaidAt(iso);
    setPaidAtDisplay(isoToDisplay(iso, dateFormat));
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
    setInvoiceOptions([]);

    if (preselectedOrderCode) {
      setSelectedOrder({
        id: preselectedOrderId || "",
        order_code: preselectedOrderCode,
        client_display_name: null,
        amount_total: 0,
        amount_paid: 0,
        amount_debt: 0,
      });
    } else {
      setSelectedOrder(null);
    }

    loadBankAccounts();
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
      <div className="relative z-10 w-full max-w-md bg-white rounded-lg shadow-xl" style={modalStyle}>
        <div className="flex items-center justify-between border-b px-4 py-2.5 cursor-grab active:cursor-grabbing select-none" onMouseDown={onHeaderMouseDown}>
          <h2 className="text-sm font-semibold text-gray-900">Add Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-4 py-3 space-y-2.5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded">
              {error}
            </div>
          )}

          {/* Order search */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              Order <span className="text-red-500">*</span>
            </label>
            {selectedOrder ? (
              <div className="flex items-center justify-between border border-gray-300 rounded-md px-2.5 py-1.5 bg-gray-50">
                <div>
                  <span className="font-medium text-sm text-gray-900">
                    {selectedOrder.order_code}
                  </span>
                  {selectedOrder.client_display_name && (
                    <span className="text-gray-500 text-xs ml-2">
                      {selectedOrder.client_display_name}
                    </span>
                  )}
                  {selectedOrder.amount_debt > 0 && (
                    <span className="text-gray-400 text-xs ml-2">
                      Debt: {selectedOrder.amount_debt.toFixed(2)}
                    </span>
                  )}
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
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                        className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-100"
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
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Invoice (optional)
              </label>
              <select
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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

          {/* Date + Method */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={paidAtDisplay}
                onChange={(e) => {
                  const sepChar = separator;
                  const allowed = sepChar === "-" ? /[^\d-]/g : /[^\d.]/g;
                  let v = e.target.value.replace(allowed, "");
                  const digits = v.replace(/[.\-]/g, "");
                  if (dateFormat === "yyyy-mm-dd") {
                    if (digits.length <= 4) v = digits;
                    else if (digits.length <= 6) v = digits.slice(0,4) + sepChar + digits.slice(4);
                    else v = digits.slice(0,4) + sepChar + digits.slice(4,6) + sepChar + digits.slice(6,8);
                  } else {
                    if (digits.length <= 2) v = digits;
                    else if (digits.length <= 4) v = digits.slice(0,2) + sepChar + digits.slice(2);
                    else v = digits.slice(0,2) + sepChar + digits.slice(2,4) + sepChar + digits.slice(4,8);
                  }
                  setPaidAtDisplay(v);
                  const iso = parseDisplayToIso(v);
                  if (iso) setPaidAt(iso);
                }}
                placeholder={placeholder}
                maxLength={10}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setMethod("bank")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md border-2 transition-all ${
                    method === "bank"
                      ? "bg-blue-50 text-blue-700 border-blue-500 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
                  </svg>
                  Bank
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("cash")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md border-2 transition-all ${
                    method === "cash"
                      ? "bg-green-50 text-green-700 border-green-500 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("card")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md border-2 transition-all ${
                    method === "card"
                      ? "bg-purple-50 text-purple-700 border-purple-500 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Card
                </button>
              </div>
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {/* Account */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              Credit to Account
            </label>
            {bankAccounts.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
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
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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

          {/* Payer - from Directory with create option */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              Payer
            </label>
            <PartySelect
              key={`payer-${payerPartyId || "empty"}`}
              value={payerPartyId}
              onChange={(id, name) => {
                setPayerPartyId(id);
                setPayerName(name);
                setPayerSearch(name);
              }}
              roleFilter=""
              initialDisplayName={payerName || payerSearch}
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note..."
              className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-2.5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
