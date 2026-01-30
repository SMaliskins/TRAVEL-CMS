"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  estimatedCostUsd: number;
  byOperation: Record<string, { calls: number; tokens: number; cost: number }>;
  byCompany: Array<{
    companyId: string;
    companyName: string;
    calls: number;
    tokens: number;
    cost: number;
  }>;
}

export default function AIUsagePage() {
  const router = useRouter();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "all">("month");

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/superadmin/ai-usage?period=${period}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/superadmin/login");
          return;
        }
        throw new Error("Failed to load");
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to load AI usage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Usage</h1>
          <p className="text-slate-600">Monitor OpenAI API usage across all companies</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as "month" | "all")}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : !stats ? (
        <div className="text-center py-12 text-slate-500">
          Failed to load statistics
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600">Total API Calls</p>
              <p className="text-3xl font-bold text-slate-900">{stats.totalCalls.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600">Total Tokens</p>
              <p className="text-3xl font-bold text-slate-900">{stats.totalTokens.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600">Estimated Cost</p>
              <p className="text-3xl font-bold text-green-600">${stats.estimatedCostUsd.toFixed(2)}</p>
            </div>
          </div>

          {/* By Operation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">By Operation</h2>
              {Object.keys(stats.byOperation).length === 0 ? (
                <p className="text-slate-500">No usage data</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats.byOperation).map(([operation, data]) => (
                    <div key={operation} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900 capitalize">
                          {operation.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm text-slate-500">
                          {data.calls} calls • {data.tokens.toLocaleString()} tokens
                        </p>
                      </div>
                      <p className="text-green-600 font-medium">${data.cost.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Companies by Usage</h2>
              {!stats.byCompany || stats.byCompany.length === 0 ? (
                <p className="text-slate-500">No usage data</p>
              ) : (
                <div className="space-y-3">
                  {stats.byCompany.slice(0, 10).map((company) => (
                    <div key={company.companyId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">{company.companyName}</p>
                        <p className="text-sm text-slate-500">
                          {company.calls} calls • {company.tokens.toLocaleString()} tokens
                        </p>
                      </div>
                      <p className="text-green-600 font-medium">${company.cost.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pricing Reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-blue-800 font-semibold mb-2">OpenAI Pricing Reference (GPT-4o)</h3>
            <p className="text-blue-700 text-sm">
              Input: $2.50 / 1M tokens • Output: $10.00 / 1M tokens
            </p>
            <p className="text-blue-600 text-sm mt-1">
              Costs are estimates and may vary. Check your OpenAI dashboard for actual billing.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
