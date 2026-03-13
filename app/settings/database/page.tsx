"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Database, HardDrive, CheckCircle, AlertTriangle, ArrowLeft, Zap, Shield, Server } from "lucide-react";

interface TariffPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  storage_limit_gb: number;
  db_limit_gb: number;
  orders_limit: number | null;
  users_limit: number | null;
  features: Record<string, boolean>;
  is_active: boolean;
}

interface CompanyDB {
  id: string;
  name: string;
  tariff_plan_id: string | null;
  supabase_configured: boolean;
  supabase_status: string;
  supabase_region: string;
  subscription_status: string;
  storage_used_bytes: number;
  storage_checked_at: string | null;
}

interface StorageLog {
  checked_at: string;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  db_size_bytes: number;
  usage_percent: number;
}

export default function DatabaseSettingsPage() {
  const role = useCurrentUserRole();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<TariffPlan[]>([]);
  const [company, setCompany] = useState<CompanyDB | null>(null);
  const [currentPlan, setCurrentPlan] = useState<TariffPlan | null>(null);
  const [storageHistory, setStorageHistory] = useState<StorageLog[]>([]);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setSuccessMsg("Payment successful! Your database is being provisioned. This may take 1-2 minutes.");
    }
    if (searchParams.get("canceled") === "true") {
      setError("Payment was canceled. You can try again when ready.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (role && role !== "supervisor" && role !== "admin" && role !== "director") {
      router.push("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [plansRes, companyRes, storageRes] = await Promise.all([
        fetch("/api/settings/database/plans", { headers }),
        fetch("/api/settings/database/status", { headers }),
        fetch("/api/settings/database/storage-history", { headers }),
      ]);

      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.plans || []);
      }

      if (companyRes.ok) {
        const data = await companyRes.json();
        setCompany(data.company || null);
        if (data.currentPlan) setCurrentPlan(data.currentPlan);
      }

      if (storageRes.ok) {
        const data = await storageRes.json();
        setStorageHistory(data.history || []);
      }
    } catch {
      setError("Failed to load database settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: TariffPlan) => {
    if (plan.slug === "starter") return;

    try {
      setProvisioning(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/settings/database/provision", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start payment");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment setup failed");
      setProvisioning(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      none: { color: "bg-gray-100 text-gray-600", label: "Not configured" },
      provisioning: { color: "bg-yellow-100 text-yellow-700", label: "Provisioning..." },
      active: { color: "bg-green-100 text-green-700", label: "Active" },
      paused: { color: "bg-red-100 text-red-700", label: "Paused" },
      archived: { color: "bg-gray-100 text-gray-500", label: "Archived" },
    };
    const s = map[status] || map.none;
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const storageLimit = currentPlan ? currentPlan.storage_limit_gb * 1024 * 1024 * 1024 : 0.5 * 1024 * 1024 * 1024;
  const storageUsed = company?.storage_used_bytes || 0;
  const storagePercent = storageLimit > 0 ? Math.min((storageUsed / storageLimit) * 100, 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Database size={24} className="text-blue-600" />
            Database & Storage
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your database plan, storage usage, and connection</p>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Current Status */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Current Plan</span>
            {company && statusBadge(company.supabase_status)}
          </div>
          <p className="text-2xl font-bold text-gray-900">{currentPlan?.name || "Starter"}</p>
          <p className="text-sm text-gray-500 mt-1">
            {currentPlan && currentPlan.price_monthly > 0
              ? `$${currentPlan.price_monthly}/month`
              : "Free — shared database"}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Storage Used</span>
            <HardDrive size={18} className="text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatBytes(storageUsed)}</p>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{storagePercent.toFixed(1)}%</span>
              <span>{formatBytes(storageLimit)} limit</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  storagePercent > 90 ? "bg-red-500" : storagePercent > 80 ? "bg-yellow-500" : "bg-blue-500"
                }`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
          {company?.storage_checked_at && (
            <p className="text-xs text-gray-400 mt-2">
              Last checked: {new Date(company.storage_checked_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Database Region</span>
            <Server size={18} className="text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {company?.supabase_region === "eu-central-1" ? "Europe" : company?.supabase_region || "—"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {company?.supabase_configured ? "Dedicated instance" : "Shared platform database"}
          </p>
        </div>
      </div>

      {/* Tariff Plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Plan</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id || (!currentPlan && plan.slug === "starter");
            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 bg-white p-6 shadow-sm transition-all ${
                  isCurrentPlan ? "border-blue-500 ring-1 ring-blue-200" : "border-gray-200 hover:border-gray-300"
                } ${plan.slug === "enterprise" ? "relative overflow-hidden" : ""}`}
              >
                {plan.slug === "enterprise" && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">POPULAR</span>
                  </div>
                )}

                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-1 min-h-[40px]">{plan.description}</p>

                <div className="mt-4 mb-5">
                  <span className="text-3xl font-bold text-gray-900">${plan.price_monthly}</span>
                  <span className="text-sm text-gray-500">/month</span>
                  {plan.price_yearly > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      ${plan.price_yearly}/year (save ${plan.price_monthly * 12 - plan.price_yearly})
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6 text-sm">
                  <li className="flex items-center gap-2 text-gray-700">
                    <HardDrive size={14} className="text-blue-500 shrink-0" />
                    {plan.storage_limit_gb >= 100 ? `${plan.storage_limit_gb} GB` : `${plan.storage_limit_gb} GB`} storage
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <Database size={14} className="text-blue-500 shrink-0" />
                    {plan.db_limit_gb} GB database
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <Zap size={14} className="text-blue-500 shrink-0" />
                    {plan.orders_limit ? `Up to ${plan.orders_limit} orders` : "Unlimited orders"}
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <Shield size={14} className="text-blue-500 shrink-0" />
                    {plan.slug === "starter" ? "Shared database" : "Dedicated database"}
                  </li>
                  {plan.features?.ai_parsing && (
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                      AI Flight Parsing
                    </li>
                  )}
                  {plan.features?.email_templates && (
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                      Email Templates
                    </li>
                  )}
                  {plan.features?.priority_support && (
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                      Priority Support
                    </li>
                  )}
                  {plan.features?.custom_domain && (
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                      Custom Domain
                    </li>
                  )}
                  {plan.users_limit && (
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={14} className="text-blue-500 shrink-0" />
                      Up to {plan.users_limit} users
                    </li>
                  )}
                  {!plan.users_limit && plan.slug !== "starter" && (
                    <li className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={14} className="text-green-500 shrink-0" />
                      Unlimited users
                    </li>
                  )}
                </ul>

                {isCurrentPlan ? (
                  <button disabled className="w-full rounded-lg border-2 border-blue-500 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 cursor-default">
                    Current Plan
                  </button>
                ) : plan.slug === "starter" ? (
                  <button disabled className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 text-sm font-medium text-gray-500 cursor-default">
                    Free Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={provisioning}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {provisioning ? "Setting up..." : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Storage Usage History */}
      {storageHistory.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Storage Usage History</h2>
            <p className="text-sm text-gray-500">Daily snapshots of your storage consumption</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Storage Used</th>
                  <th className="px-6 py-3">DB Size</th>
                  <th className="px-6 py-3">Usage</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {storageHistory.slice(0, 30).map((log, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-600">{new Date(log.checked_at).toLocaleDateString()}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{formatBytes(log.storage_used_bytes)}</td>
                    <td className="px-6 py-3 text-gray-600">{formatBytes(log.db_size_bytes)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              log.usage_percent > 90 ? "bg-red-500" : log.usage_percent > 80 ? "bg-yellow-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(log.usage_percent, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{log.usage_percent.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {log.usage_percent > 90 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle size={12} /> Critical
                        </span>
                      ) : log.usage_percent > 80 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                          <AlertTriangle size={12} /> Warning
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle size={12} /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Shield size={18} />
          How Database Isolation Works
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Starter (Free)</strong> — your data is stored in a shared database with row-level security.
            All agencies&apos; data is isolated, but shares the same infrastructure.
          </p>
          <p>
            <strong>Business & Enterprise</strong> — you get your own dedicated Supabase database.
            Complete data isolation with your own storage, auth, and backups.
            We handle provisioning, schema updates, and maintenance automatically.
          </p>
          <p>
            <strong>Storage</strong> — includes all uploaded files: documents, boarding passes, avatars, invoices.
            Usage is monitored daily. You&apos;ll receive alerts at 80% and 90% capacity.
          </p>
        </div>
      </div>
    </div>
  );
}
