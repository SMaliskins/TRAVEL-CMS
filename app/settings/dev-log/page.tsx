"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bug, ExternalLink, Check, XCircle, Eye, Clock, Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface DevLogEntry {
  id: string;
  company_id: string;
  reported_by: string;
  reporter_name: string;
  page_url: string;
  comment: string;
  screenshot_url: string | null;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-red-100", text: "text-red-700", label: "Open" },
  in_progress: { bg: "bg-yellow-100", text: "text-yellow-700", label: "In Progress" },
  resolved: { bg: "bg-green-100", text: "text-green-700", label: "Resolved" },
  dismissed: { bg: "bg-gray-100", text: "text-gray-500", label: "Dismissed" },
};

export default function DevLogPage() {
  const [entries, setEntries] = useState<DevLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("open");
  const [selected, setSelected] = useState<DevLogEntry | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dev-log?status=${filter}`);
      const json = await res.json();
      setEntries(json.data || []);
    } catch {
      console.error("Failed to fetch dev log");
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/dev-log/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution_note: resolutionNote || undefined }),
      });
      if (res.ok) {
        setSelected(null);
        setResolutionNote("");
        fetchEntries();
      }
    } catch {
      console.error("Failed to update");
    }
    setUpdating(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${formatDateDDMMYYYY(dateStr)} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const pathFromUrl = (url: string) => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={20} />
            </Link>
            <Bug size={22} className="text-red-500" />
            <h1 className="text-xl font-semibold text-gray-900">Dev Log</h1>
            <span className="text-sm text-gray-400 ml-2">
              Bug reports from testers
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEntries}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {[
            { value: "open", label: "Open", icon: <Bug size={14} /> },
            { value: "in_progress", label: "In Progress", icon: <Clock size={14} /> },
            { value: "resolved", label: "Resolved", icon: <Check size={14} /> },
            { value: "dismissed", label: "Dismissed", icon: <XCircle size={14} /> },
            { value: "all", label: "All", icon: <Eye size={14} /> },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filter === f.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm px-6 py-16 text-center text-gray-400">
            <Bug size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No reports found</p>
            <p className="text-xs mt-1">Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-mono">Ctrl+Q</kbd> on any page to report a bug</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 w-40">Date</th>
                  <th className="px-4 py-3">Page</th>
                  <th className="px-4 py-3">Comment</th>
                  <th className="px-4 py-3 w-32">Reporter</th>
                  <th className="px-4 py-3 w-28">Status</th>
                  <th className="px-4 py-3 w-16">Image</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => {
                  const st = STATUS_STYLES[e.status] || STATUS_STYLES.open;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => { setSelected(e); setResolutionNote(e.resolution_note || ""); }}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatTime(e.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-blue-600 truncate max-w-[200px]" title={e.page_url}>
                        {pathFromUrl(e.page_url)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 truncate max-w-[300px]" title={e.comment}>
                        {e.comment || <span className="text-gray-300 italic">No comment</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 truncate">
                        {e.reporter_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {e.screenshot_url && (
                          <img
                            src={e.screenshot_url}
                            alt=""
                            className="w-10 h-7 object-cover rounded border"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Bug size={18} className="text-red-500" />
                  Bug Report
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{formatTime(selected.created_at)} by {selected.reporter_name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Screenshot */}
              {selected.screenshot_url && (
                <div className="border rounded-lg overflow-hidden bg-gray-100">
                  <img src={selected.screenshot_url} alt="Screenshot" className="w-full object-contain max-h-96" />
                </div>
              )}

              {/* Page URL */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Page</label>
                <a
                  href={selected.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  {pathFromUrl(selected.page_url)}
                  <ExternalLink size={12} />
                </a>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Comment</label>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 border">
                  {selected.comment || <span className="text-gray-300 italic">No comment</span>}
                </p>
              </div>

              {/* Resolution note */}
              {(selected.status === "open" || selected.status === "in_progress") && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Resolution note (optional)</label>
                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="What was done to fix this?"
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={2}
                  />
                </div>
              )}

              {/* Existing resolution */}
              {selected.resolution_note && (selected.status === "resolved" || selected.status === "dismissed") && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Resolution Note</label>
                  <p className="text-sm text-gray-700 bg-green-50 rounded-lg px-4 py-3 border border-green-200">
                    {selected.resolution_note}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            {(selected.status === "open" || selected.status === "in_progress") && (
              <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button
                  onClick={() => updateStatus(selected.id, "dismissed")}
                  disabled={updating}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Dismiss
                </button>
                {selected.status === "open" && (
                  <button
                    onClick={() => updateStatus(selected.id, "in_progress")}
                    disabled={updating}
                    className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg disabled:opacity-50"
                  >
                    In Progress
                  </button>
                )}
                <button
                  onClick={() => updateStatus(selected.id, "resolved")}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                >
                  {updating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Resolve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
