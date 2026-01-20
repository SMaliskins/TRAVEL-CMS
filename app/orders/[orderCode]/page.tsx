"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { slugToOrderCode } from "@/lib/orders/orderCode";
import OrderStatusBadge, { getEffectiveStatus } from "@/components/OrderStatusBadge";
import OrderServicesBlock from "./_components/OrderServicesBlock";
import OrderClientSection from "./_components/OrderClientSection";
import OrderRouteSummary from "./_components/OrderRouteSummary";
import InvoiceCreator from "./_components/InvoiceCreator";
import InvoiceList from "./_components/InvoiceList";

type TabType = "client" | "finance" | "documents" | "communication" | "log";
type OrderStatus = "Draft" | "Active" | "Cancelled" | "Completed" | "On hold";

interface OrderData {
  id: string;
  order_code: string;
  client_display_name: string | null;
  client_party_id?: string | null;
  countries_cities: string | null;
  date_from: string | null;
  date_to: string | null;
  order_type: string;
  order_source?: string;
  status: OrderStatus;
  amount_total: number;
  amount_paid: number;
  amount_debt: number;
  profit_estimated: number;
  client_phone?: string | null;
  client_email?: string | null;
}

export default function OrderPage({
  params,
}: {
  params: Promise<{ orderCode: string }>;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("client");
  const [orderCode, setOrderCode] = useState<string>("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showInvoiceCreator, setShowInvoiceCreator] = useState(false);
  const [invoiceServices, setInvoiceServices] = useState<any[]>([]);
  const [invoiceRefetchTrigger, setInvoiceRefetchTrigger] = useState(0);
  const [showOrderSource, setShowOrderSource] = useState(false);

  // Fetch company settings for conditional Order Source display
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch("/api/company", {
          headers: {
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setShowOrderSource(data.company?.show_order_source || false);
        }
      } catch (err) {
        console.error("Failed to fetch company settings:", err);
      }
    };
    fetchCompanySettings();
  }, []);

  // Fetch order data
  useEffect(() => {
    const fetchOrder = async (code: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(`/api/orders/${encodeURIComponent(code)}`, {
          headers: {
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
          },
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setOrder(data.order || data);
        } else if (response.status === 404) {
          setError("Order not found");
        } else {
          const errData = await response.json().catch(() => ({}));
          setError(errData.error || "Failed to load order");
        }
      } catch (err) {
        console.error("Fetch order error:", err);
        setError("Network error");
      } finally {
        setIsLoading(false);
      }
    };

    params.then((resolvedParams) => {
      const orderCodeFromSlug = slugToOrderCode(resolvedParams.orderCode);
      setOrderCode(orderCodeFromSlug);
      fetchOrder(orderCodeFromSlug);
    });
  }, [params]);

  // Update order status
  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order || isSaving) return;
    
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setOrder({ ...order, status: newStatus });
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error("Failed to update status:", errData.error);
      }
    } catch (err) {
      console.error("Update status error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate effective status (auto-finish if past date_to)
  const effectiveStatus = order ? getEffectiveStatus(order.status, order.date_to) : "Active";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-4">
        {/* A) Order Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Order {orderCode}
              </h1>
              <OrderStatusBadge 
                status={effectiveStatus}
                onChange={effectiveStatus !== "Completed" ? handleStatusChange : undefined}
                readonly={effectiveStatus === "Completed" || isSaving}
              />
            </div>
          </div>
          
          {/* Order Source & Type Radio Bars */}
          <div className="mt-3 flex items-center gap-4">
            {/* Order Source (TA/TO/CORP/NON) - shown only if enabled in Company Settings */}
            {showOrderSource && (
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                {[
                  { value: "TA", label: "TA" },
                  { value: "TO", label: "TO" },
                  { value: "CORP", label: "CORP" },
                  { value: "NON", label: "NON" },
                ].map((source) => (
                  <button
                    key={source.value}
                    type="button"
                    onClick={async () => {
                      if (!order) return;
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
                          },
                          credentials: "include",
                          body: JSON.stringify({ order_source: source.value }),
                        });
                        if (response.ok) {
                          setOrder({ ...order, order_source: source.value });
                        }
                      } catch (err) {
                        console.error("Update error:", err);
                      }
                    }}
                    disabled={isSaving}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      order?.order_source === source.value
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    } disabled:opacity-50`}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            )}

            {/* Order Type (Leisure/Business/Lifestyle) */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {[
                { value: "leisure", label: "Leisure" },
                { value: "business", label: "Business" },
                { value: "lifestyle", label: "Lifestyle" },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={async () => {
                    if (!order) return;
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
                        },
                        credentials: "include",
                        body: JSON.stringify({ order_type: type.value }),
                      });
                      if (response.ok) {
                        setOrder({ ...order, order_type: type.value });
                      }
                    } catch (err) {
                      console.error("Update error:", err);
                    }
                  }}
                  disabled={isSaving}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    order?.order_type === type.value
                      ? "bg-gray-700 text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  } disabled:opacity-50`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* B) Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setActiveTab("client")}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === "client"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Services
            </button>
            <button
              onClick={() => setActiveTab("finance")}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === "finance"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Finance
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === "documents"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab("communication")}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === "communication"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Communication
            </button>
            <button
              onClick={() => setActiveTab("log")}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === "log"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Log
            </button>
          </nav>
        </div>

        {/* Route Summary */}
        {order && (
          <OrderRouteSummary
            orderId={order.id}
            orderCode={orderCode}
            clientDisplayName={order.client_display_name}
            countriesCities={order.countries_cities}
            dateFrom={order.date_from}
            dateTo={order.date_to}
            orderType={order.order_type}
            orderSource={order.order_source}
            onUpdate={(updates) => {
              setOrder({
                ...order,
                ...updates,
              } as OrderData);
            }}
          />
        )}

        {/* Tab Content */}
        <div className="mb-6">
          {activeTab === "client" && order && (
            <div className="space-y-6">
              {/* Services Block - Priority */}
              <OrderServicesBlock 
                orderCode={orderCode}
                defaultClientId={order.client_party_id}
                defaultClientName={order.client_display_name || undefined}
                orderDateFrom={order.date_from}
                orderDateTo={order.date_to}
                onIssueInvoice={(services) => {
                  setInvoiceServices(services);
                  setShowInvoiceCreator(true);
                  setActiveTab("finance");
                }}
              />
              
              {/* Client Section */}
              <OrderClientSection
                orderId={order.id}
                orderCode={orderCode}
                clientDisplayName={order.client_display_name}
                clientPartyId={order.client_party_id}
                countriesCities={order.countries_cities}
                dateFrom={order.date_from}
                dateTo={order.date_to}
                clientPhone={order.client_phone}
                clientEmail={order.client_email}
                amountTotal={order.amount_total}
                amountPaid={order.amount_paid}
                orderType={order.order_type}
                onUpdate={(updates) => {
                  setOrder({
                    ...order,
                    ...updates,
                  } as OrderData);
                }}
              />
            </div>
          )}

          {activeTab === "finance" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              {showInvoiceCreator ? (
                <InvoiceCreator
                  orderCode={orderCode}
                  clientName={order?.client_display_name || null}
                  selectedServices={invoiceServices}
                  onClose={() => {
                    setShowInvoiceCreator(false);
                    setInvoiceServices([]);
                  }}
                  onSuccess={() => {
                    setShowInvoiceCreator(false);
                    setInvoiceServices([]);
                    setInvoiceRefetchTrigger(prev => prev + 1);
                  }}
                />
              ) : (
                <InvoiceList
                  orderCode={orderCode}
                  key={invoiceRefetchTrigger}
                  onCreateNew={() => {
                    // Switch to Client tab to select services
                    setActiveTab("client");
                    alert("Please select services from the table and click 'Issue Invoice'");
                  }}
                />
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Documents
              </h2>
              <p className="text-gray-600">Coming next</p>
            </div>
          )}

          {activeTab === "communication" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Communication
              </h2>
              <p className="text-gray-600">Coming next</p>
            </div>
          )}

          {activeTab === "log" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">Log</h2>
              <p className="text-gray-600">Coming next</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
