"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DirectoryRecord } from "@/lib/types/directory";
import directorySearchStore from "@/lib/stores/directorySearchStore";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

export default function DirectoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState(() => directorySearchStore.getState());

  // Subscribe to search store changes
  useEffect(() => {
    const unsubscribe = directorySearchStore.subscribe((state) => {
      setFilters(state);
    });
    return unsubscribe;
  }, []);

  // Load records when filters change
  useEffect(() => {
    const loadRecords = async () => {
      try {
        setLoading(true);
        
        // Build query parameters from filters
        const params = new URLSearchParams();
        if (filters.name.trim()) params.append("search", filters.name.trim());
        if (filters.personalCode.trim()) params.append("personalCode", filters.personalCode.trim());
        if (filters.phone.trim()) params.append("phone", filters.phone.trim());
        if (filters.email.trim()) params.append("email", filters.email.trim());
        if (filters.type !== "all") params.append("type", filters.type);
        if (filters.role !== "all") params.append("role", filters.role);
        if (filters.isActive !== "all") params.append("status", filters.isActive);
        
        const queryString = params.toString();
        const url = queryString ? `/api/directory?${queryString}` : "/api/directory";
        
        const response = await fetchWithAuth(url);
        if (!response.ok) {
          throw new Error("Failed to fetch directory records");
        }
        const result = await response.json();
        if (result.error) {
          throw new Error(result.error);
        }
        setRecords(result.data || []);
      } catch (error) {
        console.error("Error loading directory records:", error);
        // Optionally show error to user
      } finally {
        setLoading(false);
      }
    };
    
        loadRecords();
  }, [filters]);

  const handleSyncSearch = async () => {
    try {
      setSyncing(true);
      const res = await fetchWithAuth("/api/embeddings/sync-party", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Sync failed");
      }
      const data = await res.json();
      alert(`Synced ${data?.synced ?? 0} party embeddings.`);
    } catch (e) {
      console.error("Sync search failed:", e);
      alert(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Directory</h1>
          <div className="flex gap-2">
            <button
              onClick={handleSyncSearch}
              disabled={syncing}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync search"}
            </button>
            <button
              onClick={() => router.push("/directory/new")}
              className="rounded-lg bg-black px-6 py-2 text-white transition-colors hover:bg-gray-800"
            >
              New Record
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : records.length === 0 ? (
          <div className="rounded-lg bg-white shadow-sm">
            <p className="p-4 text-gray-600">No records found.</p>
          </div>
        ) : (
          <div className="rounded-lg bg-white shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => {
                  const displayName = record.type === "person" 
                    ? `${record.firstName || ""} ${record.lastName || ""}`.trim() || "N/A"
                    : record.companyName || "N/A";
                  
                  return (
                    <tr 
                      key={record.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/directory/${record.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{displayName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 capitalize">{record.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          {record.roles.map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{record.email || "-"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{record.phone || "-"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

