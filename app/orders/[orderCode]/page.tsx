"use client";

import { useState, useEffect } from "react";
import { slugToOrderCode } from "@/lib/orders/orderCode";
import OrderServicesBlock from "./_components/OrderServicesBlock";

type TabType = "client" | "finance" | "documents" | "communication" | "log";

export default function OrderPage({
  params,
}: {
  params: Promise<{ orderCode: string }>;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("client");
  const [orderCode, setOrderCode] = useState<string>("");

  useEffect(() => {
    params.then((resolvedParams) => {
      // Convert slug to order code format for display
      const orderCodeFromSlug = slugToOrderCode(resolvedParams.orderCode);
      setOrderCode(orderCodeFromSlug);
    });
  }, [params]);

  if (!orderCode) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
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
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Client
              </h2>
              <p className="text-gray-600">Coming next</p>
            </div>
          )}

          {activeTab === "finance" && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Finance
              </h2>
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">
                    Payer
                  </h3>
                  <p className="text-sm text-gray-600">Payer information</p>
                </div>
                <p className="text-gray-600">Other finance details coming next</p>
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
