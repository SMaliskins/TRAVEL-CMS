"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Module { id: string; code: string; name: string; is_paid: boolean; monthly_price_eur: number; sort_order: number }
interface Addon { id: string; name: string; slug: string; price_monthly: number; category: string; is_active: boolean; sort_order: number }
interface Plan {
  id: string; name: string; slug: string; description: string;
  price_monthly: number; price_yearly: number;
  storage_limit_gb: number; db_limit_gb: number;
  orders_limit: number | null; users_limit: number | null;
  features: Record<string, unknown>; is_active: boolean; sort_order: number;
}

interface CompanyModule { moduleId: string; isEnabled: boolean }
interface CompanyAddon { addonId: string; quantity: number; isActive: boolean }
interface CompanyRow {
  id: string; name: string; legalName: string | null; country: string | null;
  createdAt: string; status: string; planId: string | null;
  planName: string; planPrice: number;
  subscriptionStatus: string; billingCycle: string | null;
  modules: CompanyModule[]; addons: CompanyAddon[];
}

type Tab = "companies" | "plans" | "addons";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>{s.label}</span>;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SubscriptionsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("companies");
  const [isLoading, setIsLoading] = useState(true);

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/superadmin/subscriptions");
      if (!res.ok) {
        if (res.status === 401) { router.push("/superadmin/login"); return; }
        throw new Error("Failed");
      }
      const d = await res.json();
      setCompanies(d.companies || []);
      setPlans(d.plans || []);
      setModules(d.modules || []);
      setAddons(d.addons || []);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = companies.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.legalName && c.legalName.toLowerCase().includes(q))) return false;
    }
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "companies", label: `Companies & Plans (${companies.length})` },
    { key: "plans", label: "Plan Catalog" },
    { key: "addons", label: "Add-ons Catalog" },
  ];

  if (isLoading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subscriptions</h1>
          <p className="text-sm text-slate-500">Manage company plans, modules & add-ons</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-600" title="Refresh">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "companies" && (
        <CompaniesTab
          companies={filtered} plans={plans} modules={modules} addons={addons}
          search={search} setSearch={setSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          expandedId={expandedId} setExpandedId={setExpandedId}
          onRefresh={loadData}
        />
      )}
      {activeTab === "plans" && <PlanCatalogTab plans={plans} onRefresh={loadData} router={router} />}
      {activeTab === "addons" && <AddonCatalogTab addons={addons} onRefresh={loadData} router={router} />}
    </div>
  );
}

/* ================================================================== */
/*  Companies Tab                                                      */
/* ================================================================== */

function CompaniesTab({
  companies, plans, modules, addons, search, setSearch,
  statusFilter, setStatusFilter, expandedId, setExpandedId, onRefresh,
}: {
  companies: CompanyRow[]; plans: Plan[]; modules: Module[]; addons: Addon[];
  search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  expandedId: string | null; setExpandedId: (v: string | null) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <input type="text" placeholder="Search company..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="demo">Demo</option>
          <option value="inactive">Inactive</option>
          <option value="trial_expired">Trial Expired</option>
          <option value="past_due">Past Due</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Modules</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Add-ons</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((c) => (
              <CompanyRow key={c.id} company={c} plans={plans} modules={modules} addons={addons}
                isExpanded={expandedId === c.id}
                onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                onRefresh={onRefresh} />
            ))}
            {companies.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No companies found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Company Row + Expanded Panel                                       */
/* ------------------------------------------------------------------ */

function CompanyRow({
  company, plans, modules, addons, isExpanded, onToggle, onRefresh,
}: {
  company: CompanyRow; plans: Plan[]; modules: Module[]; addons: Addon[];
  isExpanded: boolean; onToggle: () => void; onRefresh: () => void;
}) {
  const enabledModuleCount = company.modules.filter((m) => m.isEnabled).length;
  const activeAddonCount = company.addons.filter((a) => a.isActive).length;

  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          <p className="font-medium text-slate-900">{company.name}</p>
          {company.legalName && <p className="text-xs text-slate-500">{company.legalName}</p>}
        </td>
        <td className="px-4 py-3">
          <span className="text-slate-800">{company.planName}</span>
          {company.planPrice > 0 && <span className="text-slate-400 text-xs ml-1">(€{company.planPrice}/mo)</span>}
        </td>
        <td className="px-4 py-3">{statusBadge(company.status)}</td>
        <td className="px-4 py-3 text-center">
          <span className={`text-xs font-medium ${enabledModuleCount > 0 ? "text-emerald-600" : "text-slate-400"}`}>
            {enabledModuleCount}/{modules.length}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`text-xs font-medium ${activeAddonCount > 0 ? "text-purple-600" : "text-slate-400"}`}>
            {activeAddonCount}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-500 text-xs">{formatDateDDMMYYYY(company.createdAt)}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-0 py-0">
            <CompanyPanel company={company} plans={plans} modules={modules} addons={addons} onRefresh={onRefresh} />
          </td>
        </tr>
      )}
    </>
  );
}

function CompanyPanel({
  company, plans, modules, addons, onRefresh,
}: {
  company: CompanyRow; plans: Plan[]; modules: Module[]; addons: Addon[];
  onRefresh: () => void;
}) {
  const [selectedPlan, setSelectedPlan] = useState(company.planId || "");
  const [modStates, setModStates] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const m of modules) {
      const cm = company.modules.find((cm) => cm.moduleId === m.id);
      map[m.id] = cm ? cm.isEnabled : false;
    }
    return map;
  });
  const [addonStates, setAddonStates] = useState<Record<string, { active: boolean; qty: number }>>(() => {
    const map: Record<string, { active: boolean; qty: number }> = {};
    for (const a of addons) {
      const ca = company.addons.find((ca) => ca.addonId === a.id);
      map[a.id] = { active: ca ? ca.isActive : false, qty: ca ? ca.quantity : 1 };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/superadmin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          planId: selectedPlan || null,
          modules: modules.map((m) => ({ moduleId: m.id, isEnabled: !!modStates[m.id] })),
          addons: addons.map((a) => ({ addonId: a.id, quantity: addonStates[a.id]?.qty || 1, isActive: !!addonStates[a.id]?.active })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMsg("Saved");
      onRefresh();
    } catch {
      setMsg("Error saving");
    } finally {
      setSaving(false);
    }
  };

  const enableAll = () => {
    const map: Record<string, boolean> = {};
    for (const m of modules) map[m.id] = true;
    setModStates(map);
  };

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-6 py-5 space-y-5">
      {/* Plan */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tariff Plan</label>
        <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}
          className="mt-1 block w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">No plan (Free)</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — €{Number(p.price_monthly)}/mo
            </option>
          ))}
        </select>
      </div>

      {/* Modules */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Modules</label>
          <button onClick={enableAll} className="text-xs text-purple-600 hover:text-purple-700 font-medium">Enable all</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {modules.map((m) => (
            <label key={m.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-purple-300 transition">
              <input type="checkbox" checked={!!modStates[m.id]}
                onChange={(e) => setModStates((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
              <span className="text-sm text-slate-700">{m.name}</span>
              {m.is_paid && <span className="text-xs text-slate-400">€{Number(m.monthly_price_eur)}</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Add-ons</label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {addons.filter((a) => a.is_active).map((a) => {
            const st = addonStates[a.id] || { active: false, qty: 1 };
            return (
              <div key={a.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
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

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {msg && <span className={`text-sm ${msg === "Saved" ? "text-emerald-600" : "text-red-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Plan Catalog Tab                                                   */
/* ================================================================== */

function PlanCatalogTab({ plans: initialPlans, onRefresh, router }: { plans: Plan[]; onRefresh: () => void; router: ReturnType<typeof useRouter> }) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Plan>>({});
  const [showNew, setShowNew] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", slug: "", description: "", price_monthly: 0, price_yearly: 0, storage_limit_gb: 0.5, orders_limit: "", users_limit: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPlans(initialPlans); }, [initialPlans]);

  const startEdit = (p: Plan) => {
    setEditId(p.id);
    setEditData({ ...p });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/superadmin/subscriptions/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, ...editData }),
      });
      if (!res.ok) {
        if (res.status === 401) { router.push("/superadmin/login"); return; }
        throw new Error("Failed");
      }
      setEditId(null);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/superadmin/subscriptions/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPlan,
          orders_limit: newPlan.orders_limit ? parseInt(newPlan.orders_limit) : null,
          users_limit: newPlan.users_limit ? parseInt(newPlan.users_limit) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Error");
        return;
      }
      setShowNew(false);
      setNewPlan({ name: "", slug: "", description: "", price_monthly: 0, price_yearly: 0, storage_limit_gb: 0.5, orders_limit: "", users_limit: "" });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Tariff Plans</h2>
        <button onClick={() => setShowNew(!showNew)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">
          {showNew ? "Cancel" : "+ Add Plan"}
        </button>
      </div>

      {/* New Plan Form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-purple-200 p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Name" value={newPlan.name} onChange={(v) => setNewPlan({ ...newPlan, name: v })} />
            <InputField label="Slug" value={newPlan.slug} onChange={(v) => setNewPlan({ ...newPlan, slug: v })} />
            <InputField label="Price Monthly (€)" value={String(newPlan.price_monthly)} type="number" onChange={(v) => setNewPlan({ ...newPlan, price_monthly: parseFloat(v) || 0 })} />
            <InputField label="Price Yearly (€)" value={String(newPlan.price_yearly)} type="number" onChange={(v) => setNewPlan({ ...newPlan, price_yearly: parseFloat(v) || 0 })} />
            <InputField label="Storage (GB)" value={String(newPlan.storage_limit_gb)} type="number" onChange={(v) => setNewPlan({ ...newPlan, storage_limit_gb: parseFloat(v) || 0.5 })} />
            <InputField label="Orders Limit" value={newPlan.orders_limit} onChange={(v) => setNewPlan({ ...newPlan, orders_limit: v })} placeholder="unlimited" />
            <InputField label="Users Limit" value={newPlan.users_limit} onChange={(v) => setNewPlan({ ...newPlan, users_limit: v })} placeholder="unlimited" />
          </div>
          <InputField label="Description" value={newPlan.description} onChange={(v) => setNewPlan({ ...newPlan, description: v })} />
          <button onClick={createPlan} disabled={saving || !newPlan.name || !newPlan.slug}
            className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition">
            {saving ? "Creating..." : "Create Plan"}
          </button>
        </div>
      )}

      {/* Plans Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Plan</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Monthly</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Yearly</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Storage</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Orders</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Users</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Active</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plans.map((p) => (
              editId === p.id ? (
                <tr key={p.id} className="bg-purple-50">
                  <td className="px-4 py-2">
                    <input value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={editData.price_monthly ?? 0} onChange={(e) => setEditData({ ...editData, price_monthly: parseFloat(e.target.value) || 0 })}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={editData.price_yearly ?? 0} onChange={(e) => setEditData({ ...editData, price_yearly: parseFloat(e.target.value) || 0 })}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={editData.storage_limit_gb ?? 0} onChange={(e) => setEditData({ ...editData, storage_limit_gb: parseFloat(e.target.value) || 0 })}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={editData.orders_limit ?? ""} onChange={(e) => setEditData({ ...editData, orders_limit: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right" placeholder="∞" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={editData.users_limit ?? ""} onChange={(e) => setEditData({ ...editData, users_limit: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right" placeholder="∞" />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={editData.is_active ?? true} onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
                      className="rounded border-slate-300 text-purple-600" />
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={saveEdit} disabled={saving} className="text-xs text-purple-600 hover:text-purple-700 font-medium">{saving ? "..." : "Save"}</button>
                    <button onClick={() => setEditId(null)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">€{Number(p.price_monthly)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">€{Number(p.price_yearly)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{Number(p.storage_limit_gb)} GB</td>
                  <td className="px-4 py-3 text-right text-slate-600">{p.orders_limit ?? "∞"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{p.users_limit ?? "∞"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`w-2 h-2 rounded-full inline-block ${p.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(p)} className="text-xs text-purple-600 hover:text-purple-700 font-medium">Edit</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Add-ons Catalog Tab                                                */
/* ================================================================== */

function AddonCatalogTab({ addons: initialAddons, onRefresh, router }: { addons: Addon[]; onRefresh: () => void; router: ReturnType<typeof useRouter> }) {
  const [addons, setAddons] = useState<Addon[]>(initialAddons);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Addon>>({});
  const [showNew, setShowNew] = useState(false);
  const [newAddon, setNewAddon] = useState({ name: "", slug: "", description: "", price_monthly: 0, category: "feature" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { setAddons(initialAddons); }, [initialAddons]);

  const categories = [...new Set(addons.map((a) => a.category))].sort();

  const startEdit = (a: Addon) => {
    setEditId(a.id);
    setEditData({ ...a });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/superadmin/subscriptions/addons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, ...editData }),
      });
      if (!res.ok) {
        if (res.status === 401) { router.push("/superadmin/login"); return; }
        throw new Error("Failed");
      }
      setEditId(null);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const createAddon = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/superadmin/subscriptions/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAddon),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Error");
        return;
      }
      setShowNew(false);
      setNewAddon({ name: "", slug: "", description: "", price_monthly: 0, category: "feature" });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Add-ons Catalog</h2>
        <button onClick={() => setShowNew(!showNew)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">
          {showNew ? "Cancel" : "+ Add Add-on"}
        </button>
      </div>

      {/* New Add-on Form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-purple-200 p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Name" value={newAddon.name} onChange={(v) => setNewAddon({ ...newAddon, name: v })} />
            <InputField label="Slug" value={newAddon.slug} onChange={(v) => setNewAddon({ ...newAddon, slug: v })} />
            <InputField label="Price Monthly (€)" value={String(newAddon.price_monthly)} type="number" onChange={(v) => setNewAddon({ ...newAddon, price_monthly: parseFloat(v) || 0 })} />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select value={newAddon.category} onChange={(e) => setNewAddon({ ...newAddon, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="feature">Feature</option>
                <option value="communication">Communication</option>
                <option value="ai">AI</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="storage">Storage</option>
                <option value="integration">Integration</option>
              </select>
            </div>
          </div>
          <button onClick={createAddon} disabled={saving || !newAddon.name || !newAddon.slug}
            className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition">
            {saving ? "Creating..." : "Create Add-on"}
          </button>
        </div>
      )}

      {/* Grouped by category */}
      {categories.map((cat) => (
        <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{cat}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Name</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Slug</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Price/mo</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-slate-600">Active</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {addons.filter((a) => a.category === cat).map((a) =>
                editId === a.id ? (
                  <tr key={a.id} className="bg-purple-50">
                    <td className="px-4 py-2">
                      <input value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
                    </td>
                    <td className="px-4 py-2">
                      <input value={editData.slug || ""} onChange={(e) => setEditData({ ...editData, slug: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={editData.price_monthly ?? 0} onChange={(e) => setEditData({ ...editData, price_monthly: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked={editData.is_active ?? true} onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
                        className="rounded border-slate-300 text-purple-600" />
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={saveEdit} disabled={saving} className="text-xs text-purple-600 hover:text-purple-700 font-medium">{saving ? "..." : "Save"}</button>
                      <button onClick={() => setEditId(null)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{a.name}</td>
                    <td className="px-4 py-2 text-slate-500">{a.slug}</td>
                    <td className="px-4 py-2 text-right text-slate-700">€{Number(a.price_monthly)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`w-2 h-2 rounded-full inline-block ${a.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => startEdit(a)} className="text-xs text-purple-600 hover:text-purple-700 font-medium">Edit</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Shared                                                             */
/* ================================================================== */

function InputField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
    </div>
  );
}
