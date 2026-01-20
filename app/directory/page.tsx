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

  return (
    <div className="bg-gray-50 p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-900">Directory</h1>
            <button
              onClick={() => router.push("/directory/new")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New
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

