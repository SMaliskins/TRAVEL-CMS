"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  description: string;
  canSubscribe: boolean;
}

interface Subscription {
  id: string;
  status: string;
  billingCycle: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  plan: {
    id: string;
    name: string;
    monthlyPrice: number;
    description: string;
    includedModules: string[];
  } | null;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (success === "true") {
      setMessage({ type: "success", text: "Payment successful! Your subscription is now active." });
      loadSubscription();
    } else if (canceled === "true") {
      setMessage({ type: "error", text: "Checkout was canceled." });
    }
  }, [searchParams]);

  const loadSubscription = async () => {
    try {
      setIsLoading(true);
      const response = await fetchWithAuth("/api/stripe/subscription");
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error("Failed to load subscription:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    try {
      setIsCheckoutLoading(planId);
      setMessage(null);
      const response = await fetchWithAuth("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          successUrl: `${window.location.origin}/settings/billing?success=true`,
          cancelUrl: `${window.location.origin}/settings/billing?canceled=true`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Failed to create checkout session" });
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      setMessage({ type: "error", text: "Failed to start checkout" });
    } finally {
      setIsCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      setIsPortalLoading(true);
      setMessage(null);
      const response = await fetchWithAuth("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/settings/billing`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Failed to open billing portal" });
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Portal error:", error);
      setMessage({ type: "error", text: "Failed to open billing portal" });
    } finally {
      setIsPortalLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-700",
      trialing: "bg-blue-100 text-blue-700",
      past_due: "bg-orange-100 text-orange-700",
      canceled: "bg-gray-100 text-gray-700",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          colors[status] || "bg-gray-100 text-gray-700"
        }`}
      >
        {status.replace("_", " ")}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Billing</h1>
          <p className="text-gray-500 mt-1">Manage your subscription and billing</p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Current Subscription */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h2>

          {subscription?.plan ? (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-semibold text-gray-900">
                    {subscription.plan.name}
                  </span>
                  {getStatusBadge(subscription.status)}
                </div>
                <p className="text-gray-500 mt-1">{subscription.plan.description}</p>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-gray-500 mt-2">
                    {subscription.cancelAtPeriodEnd ? (
                      <>Cancels at end of period: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</>
                    ) : (
                      <>Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                {subscription.hasStripeCustomer && (
                  <button
                    onClick={handleManageBilling}
                    disabled={isPortalLoading}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {isPortalLoading ? "Opening..." : "Manage Billing"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-500">No active subscription. Choose a plan below.</p>
            </div>
          )}
        </div>

        {/* Available Plans */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-4 rounded-xl border-2 ${
                  subscription?.plan?.id === plan.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{plan.name}</span>
                  <span className="text-lg font-bold text-gray-900">
                    €{plan.monthlyPrice}
                    <span className="text-sm font-normal text-gray-500">/mo</span>
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                {plan.canSubscribe && subscription?.plan?.id !== plan.id && (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={!!isCheckoutLoading}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition"
                  >
                    {isCheckoutLoading === plan.id ? "Redirecting..." : "Upgrade"}
                  </button>
                )}
                {subscription?.plan?.id === plan.id && (
                  <p className="text-sm text-blue-600 font-medium">Current plan</p>
                )}
                {!plan.canSubscribe && plan.monthlyPrice === 0 && (
                  <p className="text-sm text-gray-500">Free plan</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
