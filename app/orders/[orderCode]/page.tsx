"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { slugToOrderCode } from "@/lib/orders/orderCode";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import OrderServicesBlock from "./_components/OrderServicesBlock";

type TabType = "client" | "finance" | "documents" | "communication" | "log";

interface OrderData {
  id: string;
  order_code: string;
  client_display_name: string | null;
  countries_cities: string | null;
  date_from: string | null;
  date_to: string | null;
  order_type: string;
  status: string;
  amount_total: number;
  amount_paid: number;
  amount_debt: number;
  profit_estimated: number;
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
          <h1 className="text-2xl font-bold text-gray-900">
            Order {orderCode}
          </h1>
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
              Client
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

        {/* Tab Content */}
        <div className="mb-6">
          {activeTab === "client" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Client
              </h2>
              {order?.client_display_name ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500">Name:</span>
                    <p className="text-gray-900 font-medium">{order.client_display_name}</p>
                  </div>
                  {order.countries_cities && (
                    <div>
                      <span className="text-sm text-gray-500">Destination:</span>
                      <p className="text-gray-900">{order.countries_cities}</p>
                    </div>
                  )}
                  {(order.date_from || order.date_to) && (
                    <div>
                      <span className="text-sm text-gray-500">Dates:</span>
                      <p className="text-gray-900">
                        {formatDateDDMMYYYY(order.date_from)} — {formatDateDDMMYYYY(order.date_to)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No client information</p>
              )}
            </div>
          )}

          {activeTab === "finance" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Finance
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500">Amount</span>
                  <p className="text-lg font-semibold">€{order?.amount_total || 0}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <span className="text-sm text-gray-500">Paid</span>
                  <p className="text-lg font-semibold text-green-700">€{order?.amount_paid || 0}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <span className="text-sm text-gray-500">Debt</span>
                  <p className="text-lg font-semibold text-red-700">€{order?.amount_debt || 0}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-500">Profit</span>
                  <p className="text-lg font-semibold text-blue-700">€{order?.profit_estimated || 0}</p>
                </div>
              </div>
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

        {/* C) Services Block - Always visible */}
        <OrderServicesBlock />
      </div>
    </div>
  );
}
