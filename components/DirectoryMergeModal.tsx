"use client";

import { useState, useEffect, useCallback } from "react";
import { DirectoryRecord } from "@/lib/types/directory";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

interface DirectoryMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function recordName(r: DirectoryRecord): string {
  return r.type === "person"
    ? `${r.firstName || ""} ${r.lastName || ""}`.trim() || "—"
    : r.companyName || "—";
}

export default function DirectoryMergeModal({
  isOpen,
  onClose,
  onSuccess,
}: DirectoryMergeModalProps) {
  const [sourceQuery, setSourceQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [sourceResults, setSourceResults] = useState<DirectoryRecord[]>([]);
  const [targetResults, setTargetResults] = useState<DirectoryRecord[]>([]);
  const [searchingSource, setSearchingSource] = useState(false);
  const [searchingTarget, setSearchingTarget] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DirectoryRecord | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<DirectoryRecord | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchSource = useCallback(async () => {
    if (!sourceQuery.trim()) {
      setSourceResults([]);
      return;
    }
    setSearchingSource(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("search", sourceQuery.trim());
      params.set("limit", "20");
      params.set("status", "active");
      const response = await fetchWithAuth(`/api/directory?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        const records = (result.data || []).filter((r: DirectoryRecord) => r.isActive !== false);
        setSourceResults(records);
      }
    } catch (err) {
      console.error("Search source error:", err);
      setError("Failed to search contacts");
    } finally {
      setSearchingSource(false);
    }
  }, [sourceQuery]);

  const searchTarget = useCallback(async () => {
    if (!targetQuery.trim()) {
      setTargetResults([]);
      return;
    }
    setSearchingTarget(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("search", targetQuery.trim());
      params.set("limit", "20");
      params.set("status", "active");
      const response = await fetchWithAuth(`/api/directory?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        const records = (result.data || []).filter(
          (r: DirectoryRecord) => r.isActive !== false && r.id !== selectedSource?.id
        );
        setTargetResults(records);
      }
    } catch (err) {
      console.error("Search target error:", err);
      setError("Failed to search contacts");
    } finally {
      setSearchingTarget(false);
    }
  }, [targetQuery, selectedSource?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(searchSource, 300);
    return () => clearTimeout(t);
  }, [isOpen, sourceQuery, searchSource]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(searchTarget, 300);
    return () => clearTimeout(t);
  }, [isOpen, targetQuery, searchTarget]);

  useEffect(() => {
    if (selectedSource) {
      setTargetResults((prev) => prev.filter((r) => r.id !== selectedSource.id));
      if (selectedTarget?.id === selectedSource.id) setSelectedTarget(null);
    }
  }, [selectedSource]);

  useEffect(() => {
    if (isOpen) {
      setSourceQuery("");
      setTargetQuery("");
      setSourceResults([]);
      setTargetResults([]);
      setSelectedSource(null);
      setSelectedTarget(null);
      setError(null);
    }
  }, [isOpen]);

  const handleMerge = async () => {
    if (!selectedSource || !selectedTarget) return;
    setMerging(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/directory/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePartyId: selectedSource.id,
          targetPartyId: selectedTarget.id,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Merge failed");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Merge contact</h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose the contact to merge away (source) and the contact to merge into (target, e.g. Trash). Source will be archived.
          </p>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Merge this contact (source)</label>
            <input
              type="text"
              value={sourceQuery}
              onChange={(e) => setSourceQuery(e.target.value)}
              placeholder="Name, email, phone..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchingSource && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
            {sourceResults.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 mt-1">
                {sourceResults.map((r) => {
                  const isSelected = selectedSource?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedSource(isSelected ? null : r)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${isSelected ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                      {recordName(r)}
                      {r.email && <span className="ml-2 text-gray-500">{r.email}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedSource && (
              <p className="text-sm text-gray-600 mt-1">Source: <strong>{recordName(selectedSource)}</strong></p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Into this contact (target, e.g. Trash)</label>
            <input
              type="text"
              value={targetQuery}
              onChange={(e) => setTargetQuery(e.target.value)}
              placeholder="Name, email, phone..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchingTarget && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
            {targetResults.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 mt-1">
                {targetResults.map((r) => {
                  const isSelected = selectedTarget?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedTarget(isSelected ? null : r)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${isSelected ? "bg-blue-50 text-blue-700" : ""}`}
                    >
                      {recordName(r)}
                      {r.email && <span className="ml-2 text-gray-500">{r.email}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedTarget && (
              <p className="text-sm text-gray-600 mt-1">Target: <strong>{recordName(selectedTarget)}</strong></p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={merging}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={!selectedSource || !selectedTarget || merging}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {merging ? "Merging..." : "⇄ Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
