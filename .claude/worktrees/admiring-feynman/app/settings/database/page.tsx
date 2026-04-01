"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Database, HardDrive, CheckCircle, AlertTriangle, ArrowLeft,
  Zap, Shield, Server, Users, Clock, Star, Crown, X, Check,
  Mail, MessageSquare, Smartphone, Palette, Brain, Cpu,
  HardDrive as HDD, Plus, Plug, Globe, ToggleLeft, ToggleRight, Loader2,
  ExternalLink,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

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
  features: Record<string, unknown>;
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
  trial_ends_at: string | null;
}

interface StorageLog {
  checked_at: string;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  db_size_bytes: number;
  usage_percent: number;
}

interface Addon {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  category: string;
  unit_label: string | null;
}

interface CompanyAddon {
  id: string;
  addon_id: string;
  quantity: number;
  is_active: boolean;
}

const ADDON_CATEGORY_LABELS: Record<string, { label: string; icon: typeof Mail }> = {
  communication: { label: "Communication", icon: Mail },
  feature: { label: "Features", icon: Smartphone },
  ai: { label: "AI & Automation", icon: Brain },
  infrastructure: { label: "Infrastructure", icon: Server },
  storage: { label: "Storage & Users", icon: HDD },
  integration: { label: "Integrations", icon: Plug },
};

const ADDON_ICONS: Record<string, typeof Mail> = {
  invoice_mailing: Mail,
  payment_reminders: MessageSquare,
  email_templates: Mail,
  sms_notifications: MessageSquare,
  client_app: Smartphone,
  white_label: Palette,
  ai_parsing: Cpu,
  ai_concierge: Brain,
  dedicated_db: Database,
  extra_storage: HDD,
  extra_users: Users,
  hotel_booking: Globe,
  api_access: Plug,
  custom_domain: Globe,
};

const PLAN_ICONS: Record<string, typeof Star> = {
  trial: Clock,
  starter: Zap,
  professional: Star,
  enterprise: Crown,
};

const PLAN_FEATURES: { key: string; label: string; plans: string[] }[] = [
  { key: "invoices", label: "Invoices & Finance", plans: ["trial", "starter", "professional", "enterprise"] },
  { key: "unlimited_orders", label: "Unlimited orders", plans: ["trial", "starter", "professional", "enterprise"] },
  { key: "boarding_passes", label: "Boarding passes", plans: ["trial", "professional", "enterprise"] },
  { key: "dashboard_analytics", label: "Dashboard & Analytics", plans: ["trial", "professional", "enterprise"] },
  { key: "white_label", label: "White label (own brand)", plans: ["trial", "professional", "enterprise"] },
  { key: "priority_support", label: "Priority support", plans: ["trial", "enterprise"] },
];

const ADDON_INCLUDED_IN_PLAN: Record<string, string[]> = {
  white_label: ["trial", "professional", "enterprise"],
  dedicated_db: ["enterprise"],
  email_templates: ["trial", "professional", "enterprise"],
};

export default function DatabaseSettingsPage() {
  const role = useCurrentUserRole();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<TariffPlan[]>([]);
  const [company, setCompany] = useState<CompanyDB | null>(null);
  const [currentPlan, setCurrentPlan] = useState<TariffPlan | null>(null);
  const [storageHistory, setStorageHistory] = useState<StorageLog[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [activeAddons, setActiveAddons] = useState<CompanyAddon[]>([]);
  const [togglingAddon, setTogglingAddon] = useState<string | null>(null);
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

      const [plansRes, companyRes, storageRes, addonsRes] = await Promise.all([
        fetch("/api/settings/database/plans", { headers }),
        fetch("/api/settings/database/status", { headers }),
        fetch("/api/settings/database/storage-history", { headers }),
        fetch("/api/settings/database/addons", { headers }),
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

      if (addonsRes.ok) {
        const data = await addonsRes.json();
        setAddons(data.addons || []);
        setActiveAddons(data.activeAddons || []);
      }
    } catch {
      setError("Failed to load database settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: TariffPlan) => {
    if (plan.slug === "trial" && currentPlan?.slug === "trial") return;

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
      } else if (data.activated) {
        setSuccessMsg("Trial activated! You have 7 days of full access.");
        fetchData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment setup failed");
    } finally {
      setProvisioning(false);
    }
  };

  const handleToggleAddon = async (addon: Addon, isActive: boolean) => {
    try {
      setTogglingAddon(addon.id);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const endpoint = isActive
        ? "/api/settings/database/addons/deactivate"
        : "/api/settings/database/addons/activate";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addonId: addon.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update add-on");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.activated) {
        setSuccessMsg(`${addon.name} activated!`);
      } else if (data.deactivated) {
        setSuccessMsg(`${addon.name} deactivated.`);
      }

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add-on update failed");
    } finally {
      setTogglingAddon(null);
    }
  };

  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageBilling = async () => {
    try {
      setPortalLoading(true);
      const res = await fetchWithAuth("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/settings/database` }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
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

  const getTrialDaysLeft = (): number | null => {
    if (!company?.trial_ends_at) return null;
    const diff = new Date(company.trial_ends_at).getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
  const trialDaysLeft = getTrialDaysLeft();
  const isTrialExpired = trialDaysLeft !== null && trialDaysLeft <= 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Database size={24} className="text-blue-600" />
            Billing
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan, add-ons, storage, and payment</p>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0" />
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-green-500 hover:text-green-700">
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Trial Warning */}
      {trialDaysLeft !== null && trialDaysLeft <= 3 && trialDaysLeft > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-center gap-2">
          <Clock size={16} className="shrink-0" />
          Your trial expires in <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</strong>. Upgrade now to keep your data and access.
        </div>
      )}

      {isTrialExpired && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          Your trial has expired. Please upgrade to continue using TravelCMS.
        </div>
      )}

      {/* Current Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Current Plan</span>
            {company && statusBadge(company.supabase_status)}
          </div>
          <p className="text-2xl font-bold text-gray-900">{currentPlan?.name || "No plan"}</p>
          <p className="text-sm text-gray-500 mt-1">
            {currentPlan?.slug === "trial"
              ? trialDaysLeft !== null && trialDaysLeft > 0
                ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left`
                : "Expired"
              : currentPlan && currentPlan.price_monthly > 0
                ? `€${currentPlan.price_monthly}/month`
                : "Free — shared database"}
          </p>
          {company?.subscription_status === "active" && (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              <ExternalLink size={12} />
              {portalLoading ? "Opening..." : "Manage billing"}
            </button>
          )}
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
              Last checked: {formatDateDDMMYYYY(company.storage_checked_at)}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Database Region</span>
            <Server size={18} className="text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {company?.supabase_region === "eu-central-1" ? "Europe (Frankfurt)" : company?.supabase_region || "—"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {company?.supabase_configured ? "Dedicated instance" : "Shared platform database"}
          </p>
        </div>
      </div>

      {/* Tariff Plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose Your Plan</h2>
        <p className="text-sm text-gray-500 mb-5">All plans include core CMS features. Upgrade anytime.</p>
        <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id || (!currentPlan && plan.slug === "trial");
            const PlanIcon = PLAN_ICONS[plan.slug] || Zap;
            const isProfessional = plan.slug === "professional";
            const isFree = plan.price_monthly === 0;
            const showPoweredBy = plan.features?.branding === "powered_by";

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 bg-white p-6 shadow-sm transition-all flex flex-col ${
                  isCurrentPlan
                    ? "border-blue-500 ring-1 ring-blue-200"
                    : isProfessional
                      ? "border-indigo-300 ring-1 ring-indigo-100"
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {isProfessional && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      RECOMMENDED
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <PlanIcon size={18} className={isProfessional ? "text-indigo-600" : "text-gray-500"} />
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                </div>

                <p className="text-sm text-gray-500 min-h-[40px]">{plan.description}</p>

                <div className="mt-4 mb-5">
                  {isFree ? (
                    <>
                      <span className="text-3xl font-bold text-gray-900">Free</span>
                      {plan.slug === "trial" && (
                        <span className="text-sm text-gray-500 ml-1">for 7 days</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-gray-900">&euro;{plan.price_monthly}</span>
                      <span className="text-sm text-gray-500">/month</span>
                      {plan.price_yearly > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          &euro;{plan.price_yearly}/year (save &euro;{plan.price_monthly * 12 - plan.price_yearly})
                        </p>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-2 mb-6 text-sm flex-1">
                  <li className="flex items-center gap-2 text-gray-700">
                    <Users size={14} className="text-blue-500 shrink-0" />
                    {plan.users_limit ? `${plan.users_limit} user${plan.users_limit > 1 ? "s" : ""}` : "Unlimited users"}
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <HardDrive size={14} className="text-blue-500 shrink-0" />
                    {plan.storage_limit_gb < 1 ? `${plan.storage_limit_gb * 1000} MB` : `${plan.storage_limit_gb} GB`} storage
                  </li>
                  {plan.orders_limit && (
                    <li className="flex items-center gap-2 text-gray-700">
                      <Database size={14} className="text-blue-500 shrink-0" />
                      Up to {plan.orders_limit} orders
                    </li>
                  )}
                  {!plan.orders_limit && (
                    <li className="flex items-center gap-2 text-gray-700">
                      <Database size={14} className="text-blue-500 shrink-0" />
                      Unlimited orders
                    </li>
                  )}

                  {PLAN_FEATURES.map((feat) => {
                    const included = feat.plans.includes(plan.slug);
                    return (
                      <li key={feat.key} className={`flex items-center gap-2 ${included ? "text-gray-700" : "text-gray-300"}`}>
                        {included ? (
                          <Check size={14} className="text-green-500 shrink-0" />
                        ) : (
                          <X size={14} className="text-gray-300 shrink-0" />
                        )}
                        {feat.label}
                      </li>
                    );
                  })}
                </ul>

                {/* Add-ons under this plan */}
                {addons.length > 0 && (
                  <div className="border-t border-gray-100 pt-3 mt-auto mb-4">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Add-ons</p>
                    <div className="space-y-1.5">
                      {addons.map((addon) => {
                        const includedInPlan = ADDON_INCLUDED_IN_PLAN[addon.slug]?.includes(plan.slug);
                        if (includedInPlan) return null;
                        const isActive = activeAddons.some((ca) => ca.addon_id === addon.id && ca.is_active);
                        const AddonIcon = ADDON_ICONS[addon.slug] || Plus;
                        return (
                          <div key={addon.id} className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <AddonIcon size={11} className="text-gray-400 shrink-0" />
                              <span className="text-xs text-gray-600 truncate">{addon.name}</span>
                            </div>
                            {isActive ? (
                              <span className="text-[10px] font-medium text-green-600 shrink-0">Active</span>
                            ) : (
                              <span className="text-[10px] text-gray-400 shrink-0">+&euro;{addon.price_monthly}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showPoweredBy && (
                  <p className="text-xs text-gray-400 mb-3 text-center">Powered by TravelCMS</p>
                )}

                {isCurrentPlan ? (
                  <button disabled className="w-full rounded-lg border-2 border-blue-500 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 cursor-default">
                    Current Plan
                  </button>
                ) : plan.slug === "trial" && currentPlan ? (
                  <button disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-400 cursor-default">
                    Trial used
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={provisioning}
                    className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      isProfessional
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : plan.slug === "trial"
                          ? "bg-gray-900 text-white hover:bg-gray-800"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {provisioning
                      ? "Setting up..."
                      : plan.slug === "trial"
                        ? "Start Free Trial"
                        : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Manage Add-ons */}
      {addons.length > 0 && currentPlan && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Manage Add-ons</h2>
          <p className="text-sm text-gray-500 mb-4">Activate or deactivate add-ons for your current plan</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {addons.map((addon) => {
              const includedInPlan = ADDON_INCLUDED_IN_PLAN[addon.slug]?.includes(currentPlan.slug);
              const isActive = activeAddons.some((ca) => ca.addon_id === addon.id && ca.is_active);
              const isToggling = togglingAddon === addon.id;
              const AddonIcon = ADDON_ICONS[addon.slug] || Plus;

              return (
                <div
                  key={addon.id}
                  className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${
                    includedInPlan
                      ? "border-blue-100 bg-blue-50/30"
                      : isActive
                        ? "border-green-200 bg-green-50/30"
                        : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`mt-0.5 rounded-lg p-2 ${
                        includedInPlan ? "bg-blue-100" : isActive ? "bg-green-100" : "bg-gray-100"
                      }`}>
                        <AddonIcon size={16} className={
                          includedInPlan ? "text-blue-600" : isActive ? "text-green-600" : "text-gray-500"
                        } />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900">{addon.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{addon.description}</p>
                        {includedInPlan ? (
                          <p className="text-xs font-medium text-blue-600 mt-1.5">Included in {currentPlan.name}</p>
                        ) : (
                          <p className="text-sm font-medium text-gray-700 mt-1.5">
                            &euro;{addon.price_monthly}/mo
                            {addon.unit_label && (
                              <span className="text-xs text-gray-400 ml-1">{addon.unit_label}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    {includedInPlan ? (
                      <Check size={20} className="text-blue-500 shrink-0 mt-2" />
                    ) : (
                      <button
                        onClick={() => handleToggleAddon(addon, isActive)}
                        disabled={isToggling}
                        className="shrink-0 mt-1"
                        title={isActive ? "Deactivate" : "Activate"}
                      >
                        {isToggling ? (
                          <Loader2 size={24} className="animate-spin text-gray-400" />
                        ) : isActive ? (
                          <ToggleRight size={28} className="text-green-500" />
                        ) : (
                          <ToggleLeft size={28} className="text-gray-300 hover:text-gray-400 transition-colors" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                    <td className="px-6 py-3 text-gray-600">{formatDateDDMMYYYY(log.checked_at)}</td>
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
          How Plans Work
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Trial</strong> — 7 days of free access with 1 user and up to 50 orders.
            After trial ends, upgrade to a paid plan to keep your data.
          </p>
          <p>
            <strong>Starter</strong> — everything a solo agent needs: unlimited orders, invoicing,
            and finance management. Data stored in a shared database with row-level security.
          </p>
          <p>
            <strong>Professional & Enterprise</strong> — your own branded platform with dedicated
            database, analytics dashboard, and boarding passes. Enterprise adds unlimited users
            and priority support.
          </p>
          <p>
            <strong>Add-ons</strong> — extend any plan with extra features like AI Parsing,
            Client App, Hotel Booking, and more. Available below.
          </p>
        </div>
      </div>
    </div>
  );
}
