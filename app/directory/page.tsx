"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DirectoryRecord } from "@/lib/types/directory";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

// Role colors for badges
const roleColors: Record<string, string> = {
  client: "bg-blue-100 text-blue-800",
  supplier: "bg-green-100 text-green-800",
  subagent: "bg-purple-100 text-purple-800",
};

interface DirectoryStats {
  totals: {
    clients: number;
    suppliers: number;
    subagents: number;
    total: number;
  };
  clientsByNationality: { country: string; count: number }[];
  suppliersByCountry: { country: string; count: number }[];
}

export default function DirectoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<DirectoryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{ imported: number; failed: number } | null>(null);

  // Load statistics and first page of contacts in parallel on mount; then keep records in sync with search/role
  const loadRecords = useCallback(async (query: string, role: string | null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (query.trim()) params.append("search", query.trim());
      if (role) params.append("role", role);
      const url = `/api/directory?${params.toString()}`;
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const result = await response.json();
        setRecords(result.data || []);
      }
    } catch (error) {
      console.error("Error loading directory records:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load statistics on mount (in parallel with list below)
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    fetchWithAuth("/api/directory/statistics")
      .then((response) => {
        if (cancelled) return null;
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (!cancelled && data) setStats(data);
      })
      .catch((error) => {
        if (!cancelled) console.error("Error loading directory stats:", error);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Load first page on mount and when search/role change (debounce only when user is typing)
  useEffect(() => {
    const delay = searchQuery.trim() || selectedRole ? 300 : 0;
    const timer = setTimeout(() => {
      loadRecords(searchQuery, selectedRole);
    }, delay);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedRole, loadRecords]);

  const handleRoleClick = (role: string) => {
    if (selectedRole === role) {
      setSelectedRole(null);
    } else {
      setSelectedRole(role);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setImportError("Please select a CSV file");
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Get auth token for manual fetch
      const { data: { session } } = await (await import('@/lib/supabaseClient')).supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/directory/import', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import contacts');
      }

      const result = await response.json();
      setImportSuccess({ imported: result.imported || 0, failed: result.failed || 0 });
      
      if (result.errors && result.errors.length > 0) {
        setImportError(result.errors.slice(0, 3).join('; '));
      }
      
      // Reload stats after import
      const statsResponse = await fetchWithAuth("/api/directory/statistics");
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Close modal after 3 seconds if successful
      if (result.imported > 0) {
        setTimeout(() => {
          setShowImportModal(false);
          setImportSuccess(null);
          setImportError(null);
        }, 3000);
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportError(error instanceof Error ? error.message : "Failed to import contacts");
    } finally {
      setImporting(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const hasSearch = searchQuery.trim().length > 0 || selectedRole !== null;

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Directory</h1>
            <div className="flex items-center gap-4">
              {/* Search Input */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-80 rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Import Button - secondary, smaller */}
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Import contacts
              </button>
              {/* New Button */}
              <button
                onClick={() => router.push("/directory/new")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            </div>
          </div>
        </div>

        {/* Role filter chips */}
        {selectedRole && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filtered by:</span>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${roleColors[selectedRole]} capitalize`}>
              {selectedRole}
              <button onClick={() => setSelectedRole(null)} className="ml-1 hover:opacity-70" aria-label="Clear role filter">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : hasSearch ? (
          /* Search Results Table */
          records.length === 0 ? (
            <div className="rounded-lg bg-white shadow-sm p-8 text-center">
              <p className="text-gray-500">No records found.</p>
            </div>
          ) : (
            <div className="rounded-lg bg-white shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.map((record, index) => {
                    const displayName = record.type === "person" 
                      ? `${record.firstName || ""} ${record.lastName || ""}`.trim() || "N/A"
                      : record.companyName || "N/A";
                    const recordWithExtras = record as DirectoryRecord & { displayId?: string; avatarUrl?: string };
                    
                    return (
                      <tr 
                        key={record.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/directory/${record.id}`)}
                      >
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="text-xs font-mono text-gray-400">
                            {recordWithExtras.displayId ? String(recordWithExtras.displayId).padStart(5, '0') : String(index + 1).padStart(5, '0')}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {record.type === "person" && recordWithExtras.avatarUrl ? (
                              <img
                                src={recordWithExtras.avatarUrl}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 font-medium">
                                {record.type === "person" ? (record.firstName?.[0] || record.lastName?.[0] || "?") : (record.companyName?.[0] || "?")}
                              </div>
                            )}
                            <div className="text-sm font-medium text-gray-900">{displayName}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="text-sm text-gray-500 capitalize">{record.type}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex gap-1">
                            {record.roles.map((role) => (
                              <span
                                key={role}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[role] || "bg-gray-100 text-gray-800"} capitalize`}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="text-sm text-gray-500">{record.email || "-"}</span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="text-sm text-gray-500">{record.phone || "-"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Statistics Dashboard (Empty State) */
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Clients Card */}
              <div 
                onClick={() => handleRoleClick("client")}
                className={`bg-white rounded-lg shadow-sm p-6 cursor-pointer transition-all hover:shadow-md ${selectedRole === "client" ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Clients</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {statsLoading ? "..." : stats?.totals.clients || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Suppliers Card */}
              <div 
                onClick={() => handleRoleClick("supplier")}
                className={`bg-white rounded-lg shadow-sm p-6 cursor-pointer transition-all hover:shadow-md ${selectedRole === "supplier" ? "ring-2 ring-green-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Suppliers</p>
                    <p className="text-3xl font-bold text-green-600">
                      {statsLoading ? "..." : stats?.totals.suppliers || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Subagents Card */}
              <div 
                onClick={() => handleRoleClick("subagent")}
                className={`bg-white rounded-lg shadow-sm p-6 cursor-pointer transition-all hover:shadow-md ${selectedRole === "subagent" ? "ring-2 ring-purple-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Subagents</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {statsLoading ? "..." : stats?.totals.subagents || 0}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Clients by Nationality */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Clients by Nationality</h3>
                {statsLoading ? (
                  <p className="text-gray-500">Loading...</p>
                ) : stats?.clientsByNationality && stats.clientsByNationality.length > 0 ? (
                  <div className="space-y-3">
                    {stats.clientsByNationality.slice(0, 8).map((item) => (
                      <div key={item.country} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{item.country || "Unknown"}</span>
                        <span className="text-sm font-medium text-gray-900">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No nationality data available</p>
                )}
              </div>

              {/* Suppliers by Country */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Suppliers by Country</h3>
                {statsLoading ? (
                  <p className="text-gray-500">Loading...</p>
                ) : stats?.suppliersByCountry && stats.suppliersByCountry.length > 0 ? (
                  <div className="space-y-3">
                    {stats.suppliersByCountry.slice(0, 8).map((item) => (
                      <div key={item.country} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{item.country || "Unknown"}</span>
                        <span className="text-sm font-medium text-gray-900">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No country data available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Import CSV Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Import Contacts from CSV</h3>
              <p className="mb-4 text-sm text-gray-600">
                Upload a CSV file with contacts. Expected columns:
              </p>
              <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs font-mono text-gray-700">
                <div className="mb-2 font-semibold">Required columns:</div>
                <div>Type, First Name, Last Name (for person), Company Name (for company), Roles</div>
                <div className="mt-2 mb-2 font-semibold">Optional columns:</div>
                <div>Email, Phone, Country, Nationality, Personal Code, Date of Birth, Service Areas (for suppliers)</div>
                <div className="mt-2 text-xs text-gray-500 italic">
                  Example: Type,First Name,Last Name,Email,Phone,Roles,Country
                </div>
              </div>
              
              {importError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-700">{importError}</p>
                </div>
              )}

              {importSuccess && (
                <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-sm text-green-700">
                    Successfully imported {importSuccess.imported} contact(s). {importSuccess.failed > 0 && `${importSuccess.failed} failed.`}
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={importing}
                  aria-label="Select CSV file to import contacts"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportError(null);
                    setImportSuccess(null);
                  }}
                  disabled={importing}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importSuccess ? "Close" : "Cancel"}
                </button>
              </div>

              {importing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Importing contacts...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
