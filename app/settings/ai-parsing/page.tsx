"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { ArrowLeft, Brain, Database, DollarSign, Activity, Zap, Key, CheckCircle, XCircle } from "lucide-react";

interface Template {
  id: string;
  airline_hint: string | null;
  source: string;
  use_count: number;
  created_at: string;
  updated_at: string;
}

interface UsageLog {
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: string;
  success: boolean;
  created_at: string;
}

interface ModelStats {
  calls: number;
  tokens: number;
  cost: number;
}

interface DashboardData {
  templates: Template[];
  usage: {
    allTime: {
      totalCalls: number;
      totalTokens: number;
      totalCost: number;
      byModel: Record<string, ModelStats>;
      byOperation: Record<string, ModelStats>;
    };
    thisMonth: { calls: number; cost: number };
    recentLogs: UsageLog[];
  };
  config: {
    hasOwnOpenAIKey: boolean;
    hasOwnAnthropicKey: boolean;
    hasGlobalOpenAIKey: boolean;
    hasGlobalAnthropicKey: boolean;
    modelPreference: string;
  };
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatModel(model: string): string {
  const map: Record<string, string> = {
    "gpt-4o": "GPT-4o (Vision)",
    "gpt-4o-mini": "GPT-4o Mini",
    "claude-3-haiku-20240307": "Claude 3 Haiku",
    "claude-sonnet-4-5": "Claude Sonnet",
  };
  return map[model] || model;
}

export default function AiParsingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setError("Not authenticated"); setLoading(false); return; }

        const res = await fetch("/api/ai/parsing-dashboard", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || "Failed to load");
          setLoading(false);
          return;
        }
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          <Link href="/settings" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> Settings
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
            {error || "Access denied"}
          </div>
        </div>
      </div>
    );
  }

  const { templates, usage, config } = data;

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/settings" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
              <ArrowLeft className="w-4 h-4" /> Settings
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Brain className="w-6 h-6 text-blue-600" /> AI Flight Parsing
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Templates, usage statistics, and AI model configuration
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">This Month</p>
                <p className="text-2xl font-bold text-gray-900">{usage.thisMonth.calls}</p>
                <p className="text-xs text-gray-400">AI parse calls</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Cost This Month</p>
                <p className="text-2xl font-bold text-gray-900">{formatCost(usage.thisMonth.cost)}</p>
                <p className="text-xs text-gray-400">estimated</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Database className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Templates</p>
                <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
                <p className="text-xs text-gray-400">learned formats</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">All Time</p>
                <p className="text-2xl font-bold text-gray-900">{usage.allTime.totalCalls}</p>
                <p className="text-xs text-gray-400">{formatCost(usage.allTime.totalCost)} total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Models Connected */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-gray-400" /> Connected Models
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">OpenAI (GPT-4o / GPT-4o-mini)</p>
                  <p className="text-sm text-gray-500">
                    {config.hasOwnOpenAIKey ? "Company API key" : config.hasGlobalOpenAIKey ? "Platform key (shared)" : "Not configured"}
                  </p>
                </div>
                {(config.hasOwnOpenAIKey || config.hasGlobalOpenAIKey) ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">Anthropic (Claude)</p>
                  <p className="text-sm text-gray-500">
                    {config.hasOwnAnthropicKey ? "Company API key" : config.hasGlobalAnthropicKey ? "Platform key (shared)" : "Not configured"}
                  </p>
                </div>
                {(config.hasOwnAnthropicKey || config.hasGlobalAnthropicKey) ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Model preference: <span className="font-medium">{config.modelPreference}</span> — Text parsing uses GPT-4o-mini, image parsing uses GPT-4o
            </p>
          </div>
        </div>

        {/* Usage by Model */}
        {Object.keys(usage.allTime.byModel).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Usage by Model</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">Model</th>
                    <th className="px-6 py-3 font-medium text-right">Calls</th>
                    <th className="px-6 py-3 font-medium text-right">Tokens</th>
                    <th className="px-6 py-3 font-medium text-right">Cost</th>
                    <th className="px-6 py-3 font-medium text-right">Avg per call</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usage.allTime.byModel)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([model, stats]) => (
                    <tr key={model} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{formatModel(model)}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{stats.calls}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{stats.tokens.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCost(stats.cost)}</td>
                      <td className="px-6 py-3 text-right text-gray-500">{stats.calls > 0 ? formatCost(stats.cost / stats.calls) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Templates */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-400" /> Parse Templates
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Learned ticket formats — used as few-shot examples for AI parsing
            </p>
          </div>
          {templates.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Database className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>No templates yet. Templates are created automatically when AI successfully parses a ticket.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">Airline</th>
                    <th className="px-6 py-3 font-medium">Source</th>
                    <th className="px-6 py-3 font-medium text-right">Used</th>
                    <th className="px-6 py-3 font-medium">Created</th>
                    <th className="px-6 py-3 font-medium">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{t.airline_hint || "Unknown"}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.source === "ai" ? "bg-blue-50 text-blue-700" :
                          t.source === "regex" ? "bg-green-50 text-green-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {t.source}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600">{t.use_count}x</td>
                      <td className="px-6 py-3 text-gray-500">{formatDate(t.created_at)}</td>
                      <td className="px-6 py-3 text-gray-500">{formatDate(t.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {usage.recentLogs.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Recent AI Calls</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Operation</th>
                    <th className="px-6 py-3 font-medium">Model</th>
                    <th className="px-6 py-3 font-medium text-right">Tokens</th>
                    <th className="px-6 py-3 font-medium text-right">Cost</th>
                    <th className="px-6 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.recentLogs.map((log, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-6 py-3 font-medium text-gray-900">{log.operation}</td>
                      <td className="px-6 py-3 text-gray-600">{formatModel(log.model)}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{(log.total_tokens || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 text-right text-gray-900">{formatCost(parseFloat(log.estimated_cost_usd) || 0)}</td>
                      <td className="px-6 py-3 text-center">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500 inline" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 inline" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">How Smart Parsing Works</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>Tier 1 — Regex (free):</strong> 15 airline-specific parsers run instantly at no cost.</p>
            <p><strong>Tier 2 — AI (GPT-4o-mini):</strong> When regex fails, AI parses the text automatically. ~$0.001 per ticket.</p>
            <p><strong>Self-learning:</strong> Each successful AI parse is saved as a template. Similar tickets use these templates as examples, improving accuracy over time.</p>
            <p><strong>Images:</strong> Screenshots and scanned PDFs use GPT-4o with vision. ~$0.017 per image.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
