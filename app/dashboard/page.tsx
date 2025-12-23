"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  monthlyProfitTarget,
  currentMonthProfit,
  getAchievedPercentage,
} from "@/lib/kpi/mockKpis";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  // Mock data (shared with TopBar)
  const monthSales = 24500;
  const ordersThisMonth = 47;
  const estimatedProfit = currentMonthProfit;
  const targetValue = monthlyProfitTarget;
  const targetProgress = Math.round(getAchievedPercentage());

  // Get current month name
  const getCurrentMonth = () => {
    return new Date().toLocaleDateString("en-US", { month: "long" });
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setEmail(data.user.email || null);
      setLoading(false);
    };

    checkUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header with Welcome and Month Score */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome, {email}
              </h1>
              <p className="mt-2 text-gray-600">
                {getCurrentMonth()} Score
              </p>
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Month Sales */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">
              Month Sales
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              €{monthSales.toLocaleString()}
            </p>
          </div>

          {/* Target Progress */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">
              Target Progress
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {targetProgress}%
            </p>
          </div>

          {/* Orders This Month */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">
              Orders This Month
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {ordersThisMonth}
            </p>
          </div>

          {/* Estimated Profit */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">
              Estimated Profit
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              €{estimatedProfit.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Your Progress Block */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Your Progress
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Target: €{targetValue.toLocaleString()}</span>
              <span>{targetProgress}%</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Insights Block */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Insights
          </h2>
          <p className="text-gray-600">
            AI will suggest clients likely to book soon
          </p>
        </div>

        {/* Logout Button */}
        <div className="flex justify-end">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-gray-700 transition-colors hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}