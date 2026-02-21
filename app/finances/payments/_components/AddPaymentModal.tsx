"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { useDateFormat } from "@/contexts/CompanySettingsContext";
import { formatDateDDMMYYYY, type DateFormatPattern } from "@/utils/dateFormat";
import PartySelect from "@/components/PartySelect";
import { Landmark, Banknote, CreditCard } from "lucide-react";

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

export interface EditPaymentData {
  id: string;
  order_id: string;
  order_code?: string;
  invoice_id?: string | null;
  method: "cash" | "bank" | "card";
  amount: number;
  currency: string;
  paid_at: string;
  payer_name?: string | null;
  payer_party_id?: string | null;
  note?: string | null;
  account_id?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  preselectedOrderId?: string;
  preselectedOrderCode?: string;
  editPayment?: EditPaymentData | null;
}

export default function AddPaymentModal({
  open,
  onClose,
  onCreated,
  preselectedOrderId,
  preselectedOrderCode,
  editPayment,
}: Props) {
  const dateFormat = useDateFormat();

  const isoToDisplay = useCallback((iso: string, fmt: DateFormatPattern) => formatDateDDMMYYYY(iso, fmt), []);


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

  const dateInputRef = useRef<HTMLInputElement>(null);
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

    if (editPayment) {
      const iso = editPayment.paid_at?.split("T")[0] || new Date().toISOString().slice(0, 10);
      setOrderId(editPayment.order_id);
      setInvoiceId(editPayment.invoice_id || "");
      setPaidAt(iso);
      setPaidAtDisplay(isoToDisplay(iso, dateFormat));
      setMethod(editPayment.method || "bank");
      setAmount(String(editPayment.amount));
      setCurrency(editPayment.currency || "EUR");
      setAccountId(editPayment.account_id || "");
      setPayerName(editPayment.payer_name || "");
      setPayerPartyId(editPayment.payer_party_id || null);
      setPayerSearch(editPayment.payer_name || "");
      setNote(editPayment.note || "");
      setError("");
      setOrderSearch(editPayment.order_code || "");
      setInvoiceOptions([]);
      setSelectedOrder({
        id: editPayment.order_id,
        order_code: editPayment.order_code || "",
        client_display_name: editPayment.payer_name || null,
        amount_total: 0,
        amount_paid: 0,
        amount_debt: 0,
      });
      loadBankAccounts();
      if (editPayment.order_code) {
        loadOrderDetails(editPayment.order_id, editPayment.order_code);
      }
    } else {
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
    }
  }, [open, preselectedOrderId, preselectedOrderCode, editPayment]);

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

      const url = editPayment
        ? `/api/finances/payments/${editPayment.id}`
        : "/api/finances/payments";
      const res = await fetch(url, {
        method: editPayment ? "PATCH" : "POST",
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
          <h2 className="text-sm font-semibold text-gray-900">{editPayment ? "Edit Payment" : "Add Payment"}</h2>
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
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  if (e.target.value) {
                    const inv = invoiceOptions.find((i) => i.id === e.target.value);
                    if (inv?.total) setAmount(String(inv.total));
                    if (inv?.payer_name) {
                      setPayerName(inv.payer_name);
                      setPayerSearch(inv.payer_name);
                    }
                  }
                }}
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
              <div
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-white cursor-pointer select-none flex items-center justify-between"
                onClick={() => {
                  try { dateInputRef.current?.showPicker(); } catch { dateInputRef.current?.click(); }
                }}
              >
                <span>{paidAtDisplay}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                ref={dateInputRef}
                type="date"
                value={paidAt}
                onChange={(e) => {
                  const iso = e.target.value;
                  if (iso) {
                    setPaidAt(iso);
                    setPaidAtDisplay(isoToDisplay(iso, dateFormat));
                  }
                }}
                className="sr-only"
                tabIndex={-1}
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
                  <Landmark size={16} className="shrink-0" />
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
                  <Banknote size={16} className="shrink-0" />
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
                  <CreditCard size={16} className="shrink-0" />
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
              key={`payer-${payerPartyId || "empty"}-${payerName}`}
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
            {saving ? "Saving..." : editPayment ? "Save" : "Add Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
