"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bug, ExternalLink, Check, XCircle, Eye, Clock, Loader2, RefreshCw, LogOut } from "lucide-react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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

export default function DevLogStandalone() {
  const router = useRouter();
  const [entries, setEntries] = useState<DevLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [userName, setUserName] = useState("");
  const [filter, setFilter] = useState<string>("open");
  const [selected, setSelected] = useState<DevLogEntry | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUserName(session.user?.email || "");
      setAuthChecking(false);
    })();
  }, [router]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/dev-log?status=${filter}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
        credentials: "include",
      });
      const json = await res.json();
      setEntries(json.data || []);
    } catch {
      console.error("Failed to fetch dev log");
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (!authChecking) fetchEntries();
  }, [fetchEntries, authChecking]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
      const res = await fetch(`/api/dev-log/${id}`, {
        method: "PATCH",
        headers,
        credentials: "include",
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
    try { return new URL(url).pathname; } catch { return url; }
  };

  const buildCursorPrompt = (entry: DevLogEntry) => {
    const pagePath = pathFromUrl(entry.page_url);
    const screenshotLine = entry.screenshot_url
      ? `Screenshot URL: ${entry.screenshot_url}`
      : "Screenshot URL: not available";

    return [
      "You are fixing a bug in TRAVEL CMS.",
      "",
      `Bug ID: ${entry.id}`,
      `Page URL: ${entry.page_url}`,
      `Page Path: ${pagePath}`,
      `Reported by: ${entry.reporter_name}`,
      `Reported at: ${formatTime(entry.created_at)}`,
      `Current status: ${entry.status}`,
      screenshotLine,
      "",
      "Reporter comment:",
      entry.comment || "No comment provided.",
      "",
      "Task:",
      "1) Analyze what is visible on the screenshot and describe the UI problem in 1-2 lines.",
      "2) Identify the root cause in code for this specific page/component.",
      "3) Implement a minimal, safe fix without breaking existing behavior.",
      "4) Add/update validation or guard logic if needed to prevent regression.",
      "5) Provide a short test plan and exact files changed.",
    ].join("\n");
  };

  const copyCursorPrompt = async (entry: DevLogEntry) => {
    try {
      await navigator.clipboard.writeText(buildCursorPrompt(entry));
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      setCopiedPrompt(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-500" />
      </div>
    );
  }

  const openCount = entries.filter((e) => e.status === "open").length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bug size={22} className="text-red-500" />
          <h1 className="text-lg font-bold tracking-tight">Bug Tracker</h1>
          {openCount > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {openCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{userName}</span>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1 hover:text-white transition-colors"
            title="Back to CMS"
          >
            <LogOut size={14} />
            CMS
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
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
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500"
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={fetchEntries}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-500" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 px-6 py-16 text-center text-gray-500">
            <Bug size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No reports found</p>
            <p className="text-xs mt-1">
              Press <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-[11px] font-mono">Ctrl+Q</kbd> on any CMS page to report a bug
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 w-40">Date</th>
                  <th className="px-4 py-3">Page</th>
                  <th className="px-4 py-3">Comment</th>
                  <th className="px-4 py-3 w-32">Reporter</th>
                  <th className="px-4 py-3 w-28">Status</th>
                  <th className="px-4 py-3 w-20">Image</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {entries.map((e) => {
                  const st = STATUS_STYLES[e.status] || STATUS_STYLES.open;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => {
                        setSelected(e);
                        setResolutionNote(e.resolution_note || "");
                        setCopiedPrompt(false);
                      }}
                      className="hover:bg-gray-800/60 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {formatTime(e.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-blue-400 truncate max-w-[200px]" title={e.page_url}>
                        {pathFromUrl(e.page_url)}
                      </td>
                      <td className="px-4 py-3 text-gray-300 truncate max-w-[300px]" title={e.comment}>
                        {e.comment || <span className="text-gray-600 italic">No comment</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 truncate">
                        {e.reporter_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {e.screenshot_url && (
                          <img src={e.screenshot_url} alt="" className="w-12 h-8 object-cover rounded border border-gray-700" />
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
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="font-semibold text-gray-100 flex items-center gap-2">
                  <Bug size={18} className="text-red-500" />
                  Bug Report
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{formatTime(selected.created_at)} by {selected.reporter_name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {selected.screenshot_url && (
                <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800">
                  <img src={selected.screenshot_url} alt="Screenshot" className="w-full object-contain max-h-96" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Page</label>
                <a href={selected.page_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline flex items-center gap-1">
                  {pathFromUrl(selected.page_url)}
                  <ExternalLink size={12} />
                </a>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Comment</label>
                <p className="text-sm text-gray-300 bg-gray-800 rounded-lg px-4 py-3 border border-gray-700">
                  {selected.comment || <span className="text-gray-600 italic">No comment</span>}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-500">Cursor Prompt</label>
                  <button
                    onClick={() => void copyCursorPrompt(selected)}
                    className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                  >
                    {copiedPrompt ? "Copied" : "Copy Prompt"}
                  </button>
                </div>
                <pre className="text-xs text-gray-300 bg-gray-800 rounded-lg px-4 py-3 border border-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {buildCursorPrompt(selected)}
                </pre>
              </div>

              {(selected.status === "open" || selected.status === "in_progress") && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Resolution note (optional)</label>
                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="What was done to fix this?"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 resize-none focus:ring-2 focus:ring-red-500 outline-none placeholder-gray-600"
                    rows={2}
                  />
                </div>
              )}

              {selected.resolution_note && (selected.status === "resolved" || selected.status === "dismissed") && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Resolution Note</label>
                  <p className="text-sm text-gray-200 bg-green-900/30 rounded-lg px-4 py-3 border border-green-800">
                    {selected.resolution_note}
                  </p>
                </div>
              )}
            </div>

            {(selected.status === "open" || selected.status === "in_progress") && (
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-800">
                <button
                  onClick={() => updateStatus(selected.id, "dismissed")}
                  disabled={updating}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  Dismiss
                </button>
                {selected.status === "open" && (
                  <button
                    onClick={() => updateStatus(selected.id, "in_progress")}
                    disabled={updating}
                    className="px-4 py-2 text-sm font-medium text-yellow-400 bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-800 rounded-lg disabled:opacity-50"
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
