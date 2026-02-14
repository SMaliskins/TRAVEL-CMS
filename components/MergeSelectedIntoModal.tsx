"use client";

import { useState, useEffect, useCallback } from "react";
import { DirectoryRecord } from "@/lib/types/directory";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

interface MergeSelectedIntoModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceIds: string[];
  onComplete: () => void;
}

export default function MergeSelectedIntoModal({
  isOpen,
  onClose,
  sourceIds,
  onComplete,
}: MergeSelectedIntoModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DirectoryRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<DirectoryRecord | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const validSourceIds = sourceIds.filter((id) => selectedTarget && id !== selectedTarget.id);

  const searchContacts = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("search", searchQuery.trim());
      params.set("limit", "20");
      const response = await fetchWithAuth(`/api/directory?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        const ids = new Set(sourceIds);
        const records = (result.data || []).filter(
          (r: DirectoryRecord) => !ids.has(r.id) && r.isActive !== false
        );
        setSearchResults(records);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search contacts");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, sourceIds]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(searchContacts, 300);
    return () => clearTimeout(timer);
  }, [isOpen, searchQuery, searchContacts]);

  const handleMergeAll = async () => {
    if (!selectedTarget) return;
    const toMerge = sourceIds.filter((id) => id !== selectedTarget.id);
    if (toMerge.length === 0) {
      onClose();
      return;
    }
    setMerging(true);
    setError(null);
    setProgress({ done: 0, total: toMerge.length });
    let failed = 0;
    try {
      for (let i = 0; i < toMerge.length; i++) {
        const sourceId = toMerge[i];
        const response = await fetchWithAuth("/api/directory/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourcePartyId: sourceId,
            targetPartyId: selectedTarget.id,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          failed++;
          setError(result.error || `Merge failed for one contact`);
        }
        setProgress({ done: i + 1, total: toMerge.length });
      }
      if (failed === 0) {
        onComplete();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  const targetName = selectedTarget
    ? selectedTarget.type === "person"
      ? `${selectedTarget.firstName || ""} ${selectedTarget.lastName || ""}`.trim() || "Contact"
      : selectedTarget.companyName || "Contact"
    : "";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Merge selected into</h2>
          <p className="mt-1 text-sm text-gray-500">
            Merge <strong>{sourceIds.length}</strong> contact(s) into one (e.g. Trash). All orders and data will be transferred; sources will be archived.
          </p>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target contact (e.g. Trash)</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, email, phone..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {searching && <p className="text-sm text-gray-500">Searching...</p>}
          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
              {searchResults.map((r) => {
                const name = r.type === "person"
                  ? `${r.firstName || ""} ${r.lastName || ""}`.trim() || "—"
                  : r.companyName || "—";
                const isSelected = selectedTarget?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedTarget(isSelected ? null : r)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                      isSelected ? "bg-blue-50 text-blue-700" : ""
                    }`}
                  >
                    {name}
                    {r.email && <span className="ml-2 text-gray-500">{r.email}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {selectedTarget && (
            <p className="text-sm text-gray-600">
              Will merge all into: <strong>{targetName}</strong>
            </p>
          )}
          {merging && (
            <p className="text-sm text-gray-500">
              Merging... {progress.done} / {progress.total}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
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
            onClick={handleMergeAll}
            disabled={!selectedTarget || merging || validSourceIds.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {merging ? `Merging ${progress.done}/${progress.total}...` : "⇄ Merge all into target"}
          </button>
        </div>
      </div>
    </div>
  );
}
