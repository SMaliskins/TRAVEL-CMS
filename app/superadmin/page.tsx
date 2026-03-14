"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface KPI {
  totalCompanies: number;
  activeCompanies: number;
  trialCompanies: number;
  expiredTrials: number;
  pendingRegistrations: number;
  mrr: number;
  addonMrr: number;
  totalMrr: number;
  totalStorageBytes: number;
  totalAiCalls: number;
  totalAiCost: number;
}

interface PlanDist {
  name: string;
  slug: string;
  count: number;
  price: number;
}

interface AddonPop {
  name: string;
  slug: string;
  category: string;
  activeCount: number;
  revenue: number;
}

interface CompanyRow {
  id: string;
  name: string;
  legalName: string | null;
  country: string | null;
  createdAt: string;
  status: string;
  plan: string;
  planPrice: number;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  storageUsedBytes: number;
  storageLimit: number;
  addonsCount: number;
  addonsList: Array<{ name: string; quantity: number }>;
  aiCalls: number;
  aiCost: number;
  supabaseStatus: string;
  supabaseConfigured: boolean;
  hasStripe: boolean;
}

interface RecentReg {
  id: string;
  status: string;
  companyName: string;
  email: string;
  planName: string;
  usersCount: number;
  submittedAt: string;
}

interface Alert {
  companyId: string;
  companyName: string;
  type: string;
  detail: string;
}

interface DashboardData {
  kpi: KPI;
  planDistribution: PlanDist[];
  addonPopularity: AddonPop[];
  companies: CompanyRow[];
  recentRegistrations: RecentReg[];
  alerts: Alert[];
  registrationsByMonth: Record<string, number>;
}

type PeriodType = "week" | "month" | "year" | "custom";
type Tab = "overview" | "companies" | "subscriptions" | "billing";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [companySearch, setCompanySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [companySortField, setCompanySortField] = useState<string>("createdAt");
  const [companySortDir, setCompanySortDir] = useState<"asc" | "desc">("desc");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ period });
      if (period === "custom" && customFrom && customTo) {
        params.set("from", customFrom);
        params.set("to", customTo);
      }
      const res = await fetch(`/api/superadmin/dashboard?${params}`);
      if (!res.ok) {
        if (res.status === 401) { router.push("/superadmin/login"); return; }
        throw new Error("Failed");
      }
      setData(await res.json());
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [period, customFrom, customTo, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCompanies = useMemo(() => {
    if (!data) return [];
    let list = data.companies;
    if (companySearch) {
      const q = companySearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.legalName && c.legalName.toLowerCase().includes(q)) ||
          (c.country && c.country.toLowerCase().includes(q))
      );
    }
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (planFilter) list = list.filter((c) => c.plan === planFilter);

    list = [...list].sort((a, b) => {
      const field = companySortField as keyof CompanyRow;
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return companySortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return companySortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [data, companySearch, statusFilter, planFilter, companySortField, companySortDir]);

  const toggleSort = (field: string) => {
    if (companySortField === field) {
      setCompanySortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setCompanySortField(field);
      setCompanySortDir("desc");
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!data) return null;
  const { kpi, planDistribution, addonPopularity, alerts, recentRegistrations } = data;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "companies", label: `Companies (${kpi.totalCompanies})` },
    { key: "subscriptions", label: "Subscriptions & Add-ons" },
    { key: "billing", label: "Billing & Revenue" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Platform management & analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector
            period={period}
            setPeriod={setPeriod}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
            onApply={loadData}
          />
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition text-slate-600"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === t.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && activeTab === "overview" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">
            Attention Required ({alerts.length})
          </h3>
          <div className="space-y-1.5">
            {alerts.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${
                  a.type === "past_due" ? "bg-red-500" : a.type === "trial_expired" ? "bg-orange-500" : "bg-amber-500"
                }`} />
                <span className="font-medium text-amber-900">{a.companyName}</span>
                <span className="text-amber-700">— {a.detail}</span>
              </div>
            ))}
            {alerts.length > 5 && (
              <p className="text-xs text-amber-600 mt-1">+{alerts.length - 5} more</p>
            )}
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab kpi={kpi} planDistribution={planDistribution} recentRegistrations={recentRegistrations} />}
      {activeTab === "companies" && (
        <CompaniesTab
          companies={filteredCompanies}
          search={companySearch}
          setSearch={setCompanySearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          planFilter={planFilter}
          setPlanFilter={setPlanFilter}
          plans={planDistribution}
          sortField={companySortField}
          sortDir={companySortDir}
          toggleSort={toggleSort}
          expandedCompany={expandedCompany}
          setExpandedCompany={setExpandedCompany}
        />
      )}
      {activeTab === "subscriptions" && (
        <SubscriptionsTab planDistribution={planDistribution} addonPopularity={addonPopularity} kpi={kpi} companies={data.companies} />
      )}
      {activeTab === "billing" && <BillingTab kpi={kpi} companies={data.companies} planDistribution={planDistribution} addonPopularity={addonPopularity} />}
    </div>
  );
}

/* ==================== Period Selector ==================== */
function PeriodSelector({
  period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, onApply,
}: {
  period: PeriodType;
  setPeriod: (p: PeriodType) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(["week", "month", "year"] as PeriodType[]).map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            period === p ? "bg-purple-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {p === "week" ? "7 Days" : p === "month" ? "30 Days" : "Year"}
        </button>
      ))}
      <button
        onClick={() => setPeriod("custom")}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
          period === "custom" ? "bg-purple-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        Custom
      </button>
      {period === "custom" && (
        <>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-lg text-xs" />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-lg text-xs" />
          <button onClick={onApply} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium">
            Apply
          </button>
        </>
      )}
    </div>
  );
}

/* ==================== Overview Tab ==================== */
function OverviewTab({ kpi, planDistribution, recentRegistrations }: {
  kpi: KPI; planDistribution: PlanDist[]; recentRegistrations: RecentReg[];
}) {
  const totalPlanCompanies = planDistribution.reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <KpiCard label="Total Companies" value={kpi.totalCompanies} color="slate" />
        <KpiCard label="Active" value={kpi.activeCompanies} color="emerald" />
        <KpiCard label="On Trial" value={kpi.trialCompanies} color="blue" />
        <KpiCard label="Pending Registrations" value={kpi.pendingRegistrations} color="amber" href="/superadmin/registrations" />
        <KpiCard label="MRR (Plans)" value={`€${kpi.mrr.toLocaleString()}`} color="purple" />
        <KpiCard label="MRR (Total)" value={`€${kpi.totalMrr.toLocaleString()}`} color="violet" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Add-on MRR" value={`€${kpi.addonMrr.toLocaleString()}`} color="indigo" />
        <KpiCard label="Platform Storage" value={formatBytes(kpi.totalStorageBytes)} color="cyan" />
        <KpiCard label="AI Calls (Period)" value={kpi.totalAiCalls.toLocaleString()} color="fuchsia" />
        <KpiCard label="AI Cost (Period)" value={`$${kpi.totalAiCost.toFixed(2)}`} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Plan Distribution</h3>
          <div className="space-y-3">
            {planDistribution.map((p) => (
              <div key={p.slug}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{p.name}</span>
                  <span className="text-slate-500">{p.count} companies</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-purple-500 rounded-full h-2 transition-all"
                    style={{ width: `${totalPlanCompanies ? (p.count / totalPlanCompanies) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Registrations */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent Registrations</h3>
            <a href="/superadmin/registrations" className="text-xs text-purple-600 hover:text-purple-700 font-medium">
              View all →
            </a>
          </div>
          {recentRegistrations.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No registrations yet</p>
          ) : (
            <div className="space-y-3">
              {recentRegistrations.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.companyName}</p>
                    <p className="text-xs text-slate-500 truncate">{r.email} · {r.usersCount} user(s)</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(r.status === "pending" ? "trial" : r.status === "approved" ? "active" : "cancelled")}
                    <span className="text-xs text-slate-400">{formatDateDDMMYYYY(r.submittedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expired Trials */}
      {kpi.expiredTrials > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-medium text-orange-800">
            {kpi.expiredTrials} company(ies) with expired trial and no active subscription
          </p>
        </div>
      )}
    </div>
  );
}

/* ==================== Companies Tab ==================== */
function CompaniesTab({
  companies, search, setSearch, statusFilter, setStatusFilter,
  planFilter, setPlanFilter, plans, sortField, sortDir, toggleSort,
  expandedCompany, setExpandedCompany,
}: {
  companies: CompanyRow[];
  search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  planFilter: string; setPlanFilter: (v: string) => void;
  plans: PlanDist[];
  sortField: string; sortDir: "asc" | "desc"; toggleSort: (f: string) => void;
  expandedCompany: string | null; setExpandedCompany: (v: string | null) => void;
}) {
  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && (
          <svg className={`w-3 h-3 transition ${sortDir === "asc" ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="past_due">Past Due</option>
            <option value="trial_expired">Trial Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Plans</option>
            {plans.map((p) => (
              <option key={p.slug} value={p.name}>{p.name}</option>
            ))}
          </select>
          <div className="flex items-center text-sm text-slate-500">
            {companies.length} result(s)
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-8 px-4 py-3" />
                <SortHeader field="name">Company</SortHeader>
                <SortHeader field="status">Status</SortHeader>
                <SortHeader field="plan">Plan</SortHeader>
                <SortHeader field="planPrice">Price</SortHeader>
                <SortHeader field="storageUsedBytes">Storage</SortHeader>
                <SortHeader field="addonsCount">Add-ons</SortHeader>
                <SortHeader field="aiCalls">AI Calls</SortHeader>
                <SortHeader field="createdAt">Registered</SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => (
                <CompanyTableRow
                  key={c.id}
                  company={c}
                  isExpanded={expandedCompany === c.id}
                  onToggle={() => setExpandedCompany(expandedCompany === c.id ? null : c.id)}
                />
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">No companies found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CompanyTableRow({ company: c, isExpanded, onToggle }: {
  company: CompanyRow; isExpanded: boolean; onToggle: () => void;
}) {
  const storagePct = c.storageLimit > 0 ? Math.min(100, (c.storageUsedBytes / c.storageLimit) * 100) : 0;

  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          <svg className={`w-4 h-4 text-slate-400 transition ${isExpanded ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M7.293 4.707a1 1 0 011.414 0L14 10l-5.293 5.293a1 1 0 01-1.414-1.414L11.172 10 7.293 6.121a1 1 0 010-1.414z" />
          </svg>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-slate-900 text-sm">{c.name}</p>
          {c.country && <p className="text-xs text-slate-400">{c.country}</p>}
        </td>
        <td className="px-4 py-3">{statusBadge(c.status)}</td>
        <td className="px-4 py-3 text-sm text-slate-700">{c.plan}</td>
        <td className="px-4 py-3 text-sm text-slate-700">
          {c.planPrice > 0 ? `€${c.planPrice}/mo` : "Free"}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-16 bg-slate-100 rounded-full h-1.5">
              <div
                className={`rounded-full h-1.5 ${storagePct > 90 ? "bg-red-500" : storagePct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${storagePct}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{formatBytes(c.storageUsedBytes)}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-700">{c.addonsCount}</td>
        <td className="px-4 py-3 text-sm text-slate-700">{c.aiCalls}</td>
        <td className="px-4 py-3 text-xs text-slate-500">{formatDateDDMMYYYY(c.createdAt)}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} className="bg-slate-50 px-8 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoBlock label="Legal Name" value={c.legalName || "—"} />
              <InfoBlock label="Supabase" value={c.supabaseConfigured ? `Active (${c.supabaseStatus})` : "Not configured"} />
              <InfoBlock label="Stripe" value={c.hasStripe ? "Connected" : "Not connected"} />
              <InfoBlock label="Subscription" value={c.subscriptionStatus} />
              {c.trialEndsAt && <InfoBlock label="Trial Ends" value={formatDateDDMMYYYY(c.trialEndsAt)} />}
              <InfoBlock label="Storage Used" value={`${formatBytes(c.storageUsedBytes)} / ${c.storageLimit > 0 ? formatBytes(c.storageLimit) : "∞"}`} />
              <InfoBlock label="AI Cost (Period)" value={`$${c.aiCost.toFixed(2)}`} />
              <InfoBlock label="Add-ons" value={
                c.addonsList.length > 0
                  ? c.addonsList.map((a) => `${a.name}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`).join(", ")
                  : "None"
              } />
            </div>
            <div className="mt-3 flex gap-2">
              <a
                href={`/superadmin/companies/${c.id}`}
                className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition"
              >
                Full Details →
              </a>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

/* ==================== Subscriptions Tab ==================== */
function SubscriptionsTab({ planDistribution, addonPopularity, kpi, companies }: {
  planDistribution: PlanDist[]; addonPopularity: AddonPop[]; kpi: KPI; companies: CompanyRow[];
}) {
  const totalPlanCompanies = planDistribution.reduce((s, p) => s + p.count, 0);
  const categories = [...new Set(addonPopularity.map((a) => a.category))];

  const statusCounts = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Object.entries(statusCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([status, count]) => (
            <div key={status} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <div className="mt-1">{statusBadge(status)}</div>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plans breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Plans Breakdown</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left pb-2 text-slate-500 font-medium">Plan</th>
                <th className="text-right pb-2 text-slate-500 font-medium">Companies</th>
                <th className="text-right pb-2 text-slate-500 font-medium">Share</th>
                <th className="text-right pb-2 text-slate-500 font-medium">Price</th>
                <th className="text-right pb-2 text-slate-500 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {planDistribution.map((p) => (
                <tr key={p.slug} className="border-b border-slate-50">
                  <td className="py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="py-2 text-right text-slate-600">{p.count}</td>
                  <td className="py-2 text-right text-slate-600">
                    {totalPlanCompanies ? Math.round((p.count / totalPlanCompanies) * 100) : 0}%
                  </td>
                  <td className="py-2 text-right text-slate-600">
                    {p.price > 0 ? `€${p.price}` : "Free"}
                  </td>
                  <td className="py-2 text-right font-medium text-slate-900">
                    €{(p.count * p.price).toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="pt-3 text-slate-900">Total</td>
                <td className="pt-3 text-right text-slate-900">{totalPlanCompanies}</td>
                <td className="pt-3 text-right text-slate-900">100%</td>
                <td className="pt-3 text-right" />
                <td className="pt-3 text-right text-purple-700">€{kpi.mrr.toLocaleString()}/mo</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add-ons */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Add-ons Marketplace</h3>
          {categories.map((cat) => (
            <div key={cat} className="mb-4 last:mb-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{cat}</p>
              <div className="space-y-2">
                {addonPopularity.filter((a) => a.category === cat).map((a) => (
                  <div key={a.slug} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${a.activeCount > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span className="text-sm text-slate-700">{a.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">{a.activeCount} active</span>
                      {a.revenue > 0 && (
                        <span className="font-medium text-slate-700">€{a.revenue.toLocaleString()}/mo</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {addonPopularity.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No add-ons configured</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== Billing Tab ==================== */
function BillingTab({ kpi, companies, planDistribution, addonPopularity }: {
  kpi: KPI; companies: CompanyRow[]; planDistribution: PlanDist[]; addonPopularity: AddonPop[];
}) {
  const payingCompanies = companies.filter((c) => c.planPrice > 0 && c.status === "active");
  const avgRevenuePerCompany = payingCompanies.length > 0
    ? payingCompanies.reduce((s, c) => s + c.planPrice, 0) / payingCompanies.length
    : 0;

  const totalAddonRevenue = addonPopularity.reduce((s, a) => s + a.revenue, 0);

  const storageByPlan = planDistribution.map((p) => {
    const planCompanies = companies.filter((c) => c.plan === p.name);
    const totalStorage = planCompanies.reduce((s, c) => s + c.storageUsedBytes, 0);
    return { plan: p.name, companies: planCompanies.length, storage: totalStorage };
  });

  return (
    <div className="space-y-6">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Plan MRR" value={`€${kpi.mrr.toLocaleString()}`} color="purple" />
        <KpiCard label="Add-on MRR" value={`€${totalAddonRevenue.toLocaleString()}`} color="indigo" />
        <KpiCard label="Total MRR" value={`€${kpi.totalMrr.toLocaleString()}`} color="violet" />
        <KpiCard label="ARR (Estimate)" value={`€${(kpi.totalMrr * 12).toLocaleString()}`} color="fuchsia" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue per plan */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Revenue by Plan</h3>
          <div className="space-y-4">
            {planDistribution.filter((p) => p.price > 0).map((p) => {
              const revenue = p.count * p.price;
              const maxRevenue = Math.max(...planDistribution.map((pp) => pp.count * pp.price));
              const pct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
              return (
                <div key={p.slug}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{p.name} ({p.count})</span>
                    <span className="font-semibold text-slate-900">€{revenue.toLocaleString()}/mo</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className="bg-gradient-to-r from-purple-500 to-violet-500 rounded-full h-3 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick stats */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Key Metrics</h3>
          <MetricRow label="Paying Companies" value={payingCompanies.length.toString()} />
          <MetricRow label="Free / Trial" value={(kpi.totalCompanies - payingCompanies.length).toString()} />
          <MetricRow label="Avg Revenue / Company" value={`€${avgRevenuePerCompany.toFixed(0)}`} />
          <MetricRow label="Conversion Rate" value={`${kpi.totalCompanies > 0 ? Math.round((payingCompanies.length / kpi.totalCompanies) * 100) : 0}%`} />
          <MetricRow label="AI Cost (Period)" value={`$${kpi.totalAiCost.toFixed(2)}`} />
          <MetricRow label="AI Margin" value={kpi.totalMrr > 0 ? `${Math.round(((kpi.totalMrr - kpi.totalAiCost) / kpi.totalMrr) * 100)}%` : "N/A"} />
        </div>
      </div>

      {/* Storage by Plan */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Storage Usage by Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {storageByPlan.map((s) => (
            <div key={s.plan} className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-700">{s.plan}</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{formatBytes(s.storage)}</p>
              <p className="text-xs text-slate-500">{s.companies} companies</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top spending companies */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Top Revenue Companies</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left pb-2 text-slate-500 font-medium">Company</th>
              <th className="text-right pb-2 text-slate-500 font-medium">Plan</th>
              <th className="text-right pb-2 text-slate-500 font-medium">Plan €/mo</th>
              <th className="text-right pb-2 text-slate-500 font-medium">Add-ons</th>
              <th className="text-right pb-2 text-slate-500 font-medium">Storage</th>
            </tr>
          </thead>
          <tbody>
            {[...companies]
              .sort((a, b) => b.planPrice - a.planPrice)
              .slice(0, 10)
              .map((c) => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="py-2">
                    <span className="font-medium text-slate-800">{c.name}</span>
                  </td>
                  <td className="py-2 text-right text-slate-600">{c.plan}</td>
                  <td className="py-2 text-right font-medium text-slate-900">€{c.planPrice}</td>
                  <td className="py-2 text-right text-slate-600">{c.addonsCount}</td>
                  <td className="py-2 text-right text-slate-600">{formatBytes(c.storageUsedBytes)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== Shared Components ==================== */

function KpiCard({ label, value, color, href }: {
  label: string;
  value: string | number;
  color: string;
  href?: string;
}) {
  const colorMap: Record<string, string> = {
    slate: "from-slate-500 to-slate-600",
    emerald: "from-emerald-500 to-emerald-600",
    blue: "from-blue-500 to-blue-600",
    amber: "from-amber-500 to-amber-600",
    purple: "from-purple-500 to-purple-600",
    violet: "from-violet-500 to-violet-600",
    indigo: "from-indigo-500 to-indigo-600",
    cyan: "from-cyan-500 to-cyan-600",
    fuchsia: "from-fuchsia-500 to-fuchsia-600",
    rose: "from-rose-500 to-rose-600",
  };

  const content = (
    <div className={`relative overflow-hidden rounded-xl p-4 bg-gradient-to-br ${colorMap[color] || colorMap.slate} text-white ${href ? "hover:shadow-lg transition cursor-pointer" : ""}`}>
      <p className="text-xs font-medium text-white/80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <div className="absolute -right-2 -bottom-2 w-16 h-16 rounded-full bg-white/10" />
    </div>
  );

  return href ? <a href={href}>{content}</a> : content;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
