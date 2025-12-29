"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DirectoryRecord, DirectoryRole, DirectoryStatus } from "@/lib/types/directory";
import directorySearchStore from "@/lib/stores/directorySearchStore";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

// Format currency
const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return "-";
  return `€${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format date
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return "-";
  }
};

// Format updated timestamp
const formatUpdated = (dateString: string | undefined): string => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  } catch {
    return "-";
  }
};

// Get status dot color
const getStatusDotColor = (status: DirectoryStatus): string => {
  switch (status) {
    case "active":
      return "bg-green-500";
    case "inactive":
      return "bg-gray-400";
    case "blocked":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
};

// Get role badge color
const getRoleBadgeColor = (role: DirectoryRole): string => {
  switch (role) {
    case "client":
      return "bg-blue-100 text-blue-800";
    case "supplier":
      return "bg-purple-100 text-purple-800";
    case "subagent":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

// Format rating display
const formatRating = (rating: number | undefined): string => {
  if (rating === undefined || rating === null) return "-";
  return `${rating}/10`;
};

// Format name with title, role badges, and status dot
const formatName = (record: DirectoryRecord): React.ReactElement => {
  let nameText = "";
  if (record.party_type === "person") {
    const parts: string[] = [];
    if (record.title) parts.push(record.title);
    if (record.first_name) parts.push(record.first_name);
    if (record.last_name) parts.push(record.last_name);
    nameText = parts.join(" ") || record.display_name;
  } else {
    nameText = record.company_name || record.display_name;
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${getStatusDotColor(record.status)}`} title={record.status} />
      <span className="font-medium text-gray-900">{nameText}</span>
      <div className="flex gap-1">
        {record.roles.map((role) => (
          <span
            key={role}
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(role)}`}
          >
            {role}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function DirectoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState(() => directorySearchStore.getState());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // Initialize store and subscribe to search store changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const store = directorySearchStore.getState() as any;
      if (store.init) {
        store.init();
      }
    }
    const unsubscribe = directorySearchStore.subscribe((state) => {
      setSearchState(state);
      setPage(1); // Reset to first page when filters change
    });
    return unsubscribe;
  }, []);

  // Fetch records from API
  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError(null);

      try {
        // Build query params from search state
        const params = new URLSearchParams();
        if (searchState.name.trim()) params.set("search", searchState.name.trim());
        if (searchState.type !== "all") params.set("type", searchState.type);
        if (searchState.role !== "all") params.set("role", searchState.role);
        if (searchState.isActive !== "all") {
          params.set("status", searchState.isActive);
        }
        params.set("page", page.toString());
        params.set("limit", limit.toString());

        const response = await fetchWithAuth(`/api/directory?${params.toString()}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to fetch directory" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setRecords(data.data || []);
        setTotal(data.total || 0);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load directory records";
        setError(errorMsg);
        console.error("Error fetching directory:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [searchState, page]);

  // Handle row click
  const handleRowClick = (recordId: string) => {
    router.push(`/directory/${recordId}`);
  };

  // Handle quick actions
  const handleCall = (e: React.MouseEvent, phone: string | undefined) => {
    e.stopPropagation();
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleEmail = (e: React.MouseEvent, email: string | undefined) => {
    e.stopPropagation();
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  };

  const handleEdit = (e: React.MouseEvent, recordId: string) => {
    e.stopPropagation();
    router.push(`/directory/${recordId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1800px] px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Directory</h1>
          <button
            onClick={() => router.push("/directory/new")}
            className="rounded-lg bg-black px-6 py-2 text-white transition-colors hover:bg-gray-800"
          >
            New Record
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="rounded-lg bg-white shadow-sm p-8 text-center">
            <p className="text-gray-600">Loading directory records...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-lg bg-white shadow-sm p-8 text-center">
            <p className="text-red-600">Error: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-black px-4 py-2 text-white transition-colors hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && records.length === 0 && (
          <div className="rounded-lg bg-white shadow-sm p-8 text-center">
            <p className="text-gray-600">No directory records found.</p>
            <button
              onClick={() => router.push("/directory/new")}
              className="mt-4 rounded-lg bg-black px-4 py-2 text-white transition-colors hover:bg-gray-800"
            >
              Create First Record
            </button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && records.length > 0 && (
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Email
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700">
                    Type
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700">
                    Rating
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Last Trip
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Next Trip
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                    Total Spent
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                    Debt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                    onClick={() => handleRowClick(record.id)}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {formatName(record)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {record.phone ? (
                        <a
                          href={`tel:${record.phone}`}
                          onClick={(e) => handleCall(e, record.phone)}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {record.phone}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {record.email ? (
                        <a
                          href={`mailto:${record.email}`}
                          onClick={(e) => handleEmail(e, record.email)}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {record.email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                      {record.party_type === "person" ? (
                        <span title="Person">👤</span>
                      ) : (
                        <span title="Company">🏢</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                      {formatRating(record.rating)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {formatDate(record.last_trip_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {formatDate(record.next_trip_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                      {formatCurrency(record.total_spent)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right text-sm ${
                        record.debt && record.debt > 0 ? "font-medium text-orange-600" : "text-gray-700"
                      }`}
                    >
                      {formatCurrency(record.debt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {formatUpdated(record.updated_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                      <div className="flex items-center justify-center gap-2">
                        {record.phone && (
                          <button
                            onClick={(e) => handleCall(e, record.phone)}
                            className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            title="Call"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </button>
                        )}
                        {record.email && (
                          <button
                            onClick={(e) => handleEmail(e, record.email)}
                            className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            title="Email"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => handleEdit(e, record.id)}
                          className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                          title="Edit"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
                <div className="text-sm text-gray-700">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} records
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * limit >= total}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
