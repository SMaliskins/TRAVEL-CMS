"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface Company {
  id: string;
  name: string;
  legalName: string;
  country: string;
  isDemo: boolean;
  demoExpiresAt: string | null;
  createdAt: string;
  subscription: {
    status: string;
    planName: string;
    monthlyPrice: number;
  };
}

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadCompanies();
  }, [search, statusFilter, page]);

  const loadCompanies = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", page.toString());

      const response = await fetch(`/api/superadmin/companies?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/superadmin/login");
          return;
        }
        throw new Error("Failed to load companies");
      }

      const data = await response.json();
      setCompanies(data.companies);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to load companies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (company: Company) => {
    if (company.isDemo) {
      const isExpired = company.demoExpiresAt && new Date(company.demoExpiresAt) < new Date();
      if (isExpired) {
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Demo Expired</span>;
      }
      return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Demo</span>;
    }
    
    const status = company.subscription.status;
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-700",
      trialing: "bg-blue-100 text-blue-700",
      past_due: "bg-orange-100 text-orange-700",
      canceled: "bg-gray-100 text-gray-700",
      none: "bg-gray-100 text-gray-700",
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.none}`}>
        {status === "none" ? "No subscription" : status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="text-slate-600">Manage all registered companies</p>
        </div>
        <p className="text-sm text-slate-500">{total} companies total</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="demo">Demo</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No companies found
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Company
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Country
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Created
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{company.name}</p>
                      {company.legalName && (
                        <p className="text-sm text-slate-500">{company.legalName}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {company.country || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-900">{company.subscription.planName}</span>
                    {company.subscription.monthlyPrice > 0 && (
                      <span className="text-slate-500 text-sm ml-1">
                        €{company.subscription.monthlyPrice}/mo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(company)}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {formatDateDDMMYYYY(company.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <a
                      href={`/superadmin/companies/${company.id}`}
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                    >
                      View →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center mt-6 gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-slate-600">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
