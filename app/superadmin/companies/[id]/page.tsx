"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface Module { id: string; code: string; name: string; is_paid: boolean; monthly_price_eur: number }
interface Addon { id: string; name: string; slug: string; price_monthly: number; category: string; is_active: boolean }
interface Plan { id: string; name: string; slug: string; price_monthly: number; price_yearly: number; storage_limit_gb: number; orders_limit: number | null; users_limit: number | null }
interface CompanyModule { moduleId: string; isEnabled: boolean }
interface CompanyAddon { addonId: string; quantity: number; isActive: boolean }
interface User { id: string; name: string; email: string; role: string; isActive: boolean; lastSignIn: string | null }

interface CompanyDetail {
  id: string; name: string; legalName: string | null; country: string | null;
  regNumber: string | null; vatNumber: string | null; address: string | null;
  phone: string | null; email: string | null; website: string | null;
  isDemo: boolean; demoExpiresAt: string | null; createdAt: string;
  trialEndsAt: string | null; status: string;
  planId: string | null; planName: string; planPrice: number;
  subscriptionStatus: string; billingCycle: string | null;
  storageUsedBytes: number; storageLimit: number;
  supabaseStatus: string; supabaseConfigured: boolean; hasStripe: boolean;
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Active" },
    trial: { bg: "bg-blue-100", text: "text-blue-700", label: "Trial" },
    demo: { bg: "bg-amber-100", text: "text-amber-700", label: "Demo" },
    past_due: { bg: "bg-red-100", text: "text-red-700", label: "Past Due" },
    cancelled: { bg: "bg-gray-100", text: "text-gray-600", label: "Cancelled" },
    trial_expired: { bg: "bg-orange-100", text: "text-orange-700", label: "Trial Expired" },
    inactive: { bg: "bg-gray-100", text: "text-gray-500", label: "Inactive" },
  };
  const s = map[status] || map.inactive;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>{s.label}</span>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [companyModules, setCompanyModules] = useState<CompanyModule[]>([]);
  const [companyAddons, setCompanyAddons] = useState<CompanyAddon[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [selectedPlan, setSelectedPlan] = useState("");
  const [modStates, setModStates] = useState<Record<string, boolean>>({});
  const [addonStates, setAddonStates] = useState<Record<string, { active: boolean; qty: number }>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/superadmin/companies/${id}`);
      if (!res.ok) {
        if (res.status === 401) { router.push("/superadmin/login"); return; }
        if (res.status === 404) { router.push("/superadmin/companies"); return; }
        throw new Error("Failed");
      }
      const d = await res.json();
      setCompany(d.company);
      setModules(d.modules);
      setAddons(d.addons);
      setCompanyModules(d.companyModules);
      setCompanyAddons(d.companyAddons);
      setUsers(d.users);
      setPlans(d.plans);

      setSelectedPlan(d.company.planId || "");
      const mMap: Record<string, boolean> = {};
      for (const m of d.modules) {
        const cm = d.companyModules.find((cm: CompanyModule) => cm.moduleId === m.id);
        mMap[m.id] = cm ? cm.isEnabled : false;
      }
      setModStates(mMap);

      const aMap: Record<string, { active: boolean; qty: number }> = {};
      for (const a of d.addons) {
        const ca = d.companyAddons.find((ca: CompanyAddon) => ca.addonId === a.id);
        aMap[a.id] = { active: ca ? ca.isActive : false, qty: ca ? ca.quantity : 1 };
      }
      setAddonStates(aMap);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/superadmin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: id,
          planId: selectedPlan || null,
          modules: modules.map((m) => ({ moduleId: m.id, isEnabled: !!modStates[m.id] })),
          addons: addons.map((a) => ({ addonId: a.id, quantity: addonStates[a.id]?.qty || 1, isActive: !!addonStates[a.id]?.active })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMsg("Saved successfully");
      loadData();
    } catch {
      setMsg("Error saving");
    } finally {
      setSaving(false);
    }
  };

  const enableAllModules = () => {
    const map: Record<string, boolean> = {};
    for (const m of modules) map[m.id] = true;
    setModStates(map);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!company) return null;

  const enabledCount = Object.values(modStates).filter(Boolean).length;
  const activeAddonCount = Object.values(addonStates).filter((s) => s.active).length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/superadmin/companies")}
          className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            {statusBadge(company.status)}
          </div>
          {company.legalName && <p className="text-sm text-slate-500">{company.legalName}</p>}
        </div>
      </div>

      {/* Company Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard label="Country" value={company.country || "—"} />
        <InfoCard label="Created" value={formatDateDDMMYYYY(company.createdAt)} />
        <InfoCard label="Plan" value={`${company.planName}${company.planPrice > 0 ? ` (€${company.planPrice}/mo)` : ""}`} />
        <InfoCard label="Storage" value={`${formatBytes(company.storageUsedBytes)}${company.storageLimit > 0 ? ` / ${formatBytes(company.storageLimit)}` : ""}`} />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Contact Info</h3>
          <dl className="space-y-2 text-sm">
            {company.email && <InfoRow label="Email" value={company.email} />}
            {company.phone && <InfoRow label="Phone" value={company.phone} />}
            {company.website && <InfoRow label="Website" value={company.website} />}
            {company.address && <InfoRow label="Address" value={company.address} />}
            {company.regNumber && <InfoRow label="Reg. Number" value={company.regNumber} />}
            {company.vatNumber && <InfoRow label="VAT Number" value={company.vatNumber} />}
            {!company.email && !company.phone && <p className="text-slate-400">No contact info</p>}
          </dl>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Subscription</h3>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Status" value={company.subscriptionStatus} />
            <InfoRow label="Billing" value={company.billingCycle || "—"} />
            {company.trialEndsAt && <InfoRow label="Trial Ends" value={formatDateDDMMYYYY(company.trialEndsAt)} />}
            <InfoRow label="Stripe" value={company.hasStripe ? "Connected" : "Not connected"} />
            <InfoRow label="Supabase" value={company.supabaseConfigured ? "Configured" : "Not configured"} />
          </dl>
        </div>

        {/* Users */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Users ({users.length})</h3>
          {users.length === 0 ? (
            <p className="text-sm text-slate-400">No users</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{u.name || u.email}</p>
                    {u.name && <p className="text-xs text-slate-400">{u.email}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{u.role}</span>
                    <span className={`w-2 h-2 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Plan & Modules & Add-ons Management */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h3 className="text-lg font-semibold text-slate-900">Manage Plan & Features</h3>

        {/* Plan Select */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tariff Plan</label>
          <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}
            className="mt-1 block w-full max-w-sm px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">No plan (Free)</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — €{Number(p.price_monthly)}/mo</option>
            ))}
          </select>
        </div>

        {/* Modules */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Modules ({enabledCount}/{modules.length})</label>
            <button onClick={enableAllModules} className="text-xs text-purple-600 hover:text-purple-700 font-medium">Enable all</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {modules.map((m) => (
              <label key={m.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-purple-300 transition">
                <input type="checkbox" checked={!!modStates[m.id]}
                  onChange={(e) => setModStates((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-slate-700">{m.name}</span>
                {m.is_paid && <span className="text-xs text-slate-400 ml-auto">€{Number(m.monthly_price_eur)}</span>}
              </label>
            ))}
          </div>
        </div>

        {/* Add-ons */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Add-ons ({activeAddonCount})</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {addons.map((a) => {
              const st = addonStates[a.id] || { active: false, qty: 1 };
              return (
                <div key={a.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <input type="checkbox" checked={st.active}
                    onChange={(e) => setAddonStates((prev) => ({ ...prev, [a.id]: { ...prev[a.id], active: e.target.checked } }))}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-sm text-slate-700 flex-1">{a.name}</span>
                  <span className="text-xs text-slate-400">€{Number(a.price_monthly)}</span>
                  {st.active && (
                    <input type="number" min={1} value={st.qty}
                      onChange={(e) => setAddonStates((prev) => ({ ...prev, [a.id]: { ...prev[a.id], qty: parseInt(e.target.value) || 1 } }))}
                      className="w-14 px-2 py-1 border border-slate-200 rounded text-xs text-center" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {msg && <span className={`text-sm ${msg.includes("Error") ? "text-red-600" : "text-emerald-600"}`}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800 font-medium">{value}</dd>
    </div>
  );
}
