"use client";

import { useState, useEffect, useCallback } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";
import { DirectoryRecord } from "@/lib/types/directory";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import DirectoryContactPickerRow from "@/components/DirectoryContactPickerRow";
import {
  MergeContactPreviewCard,
  MergeConfirmCheckbox,
  MergeIrreversibleNotice,
} from "@/components/MergeContactPreview";

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
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<DirectoryRecord[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

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

  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  useModalOverlay(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery("");
    setSearchResults([]);
    setSelectedTarget(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
    setStep("pick");
    setConfirmChecked(false);
    setPreviewRecords([]);
  }, [isOpen]);

  const loadBulkPreview = async () => {
    if (!selectedTarget) return;
    const toFetch = [...new Set([...sourceIds, selectedTarget.id])];
    setLoadingPreview(true);
    setError(null);
    try {
      const results = await Promise.all(
        toFetch.map(async (id) => {
          const res = await fetchWithAuth(`/api/directory/${id}`);
          const json = res.ok ? await res.json() : null;
          return json?.record as DirectoryRecord | undefined;
        })
      );
      const map = new Map<string, DirectoryRecord>();
      toFetch.forEach((id, i) => {
        const r = results[i];
        if (r) map.set(id, r);
      });
      if (map.size !== toFetch.length) {
        throw new Error("Failed to load some contacts for preview");
      }
      const ordered = toFetch.map((id) => map.get(id)!).filter(Boolean);
      setPreviewRecords(ordered);
      setStep("confirm");
      setConfirmChecked(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  };

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

  const previewMap =
    step === "confirm" && previewRecords.length > 0
      ? new Map(previewRecords.map((r) => [r.id, r]))
      : null;
  const targetPreview = selectedTarget && previewMap ? previewMap.get(selectedTarget.id) : null;
  const sourcePreviewIds = selectedTarget
    ? sourceIds.filter((id) => id !== selectedTarget.id)
    : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4">
      <div ref={trapRef} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Merge selected into</h2>
          <p className="mt-1 text-sm text-gray-500">
            {step === "pick"
              ? `Merge ${sourceIds.length} selected contact(s) into one target. You will review every card (passport vs name) before confirming.`
              : "Review all contacts below, then confirm."}
          </p>
        </div>
        <div className="space-y-4 px-6 py-4">
          {step === "confirm" && targetPreview && previewMap ? (
            <>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Target (kept)
                </h3>
                <MergeContactPreviewCard record={targetPreview} variant="target" />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Sources (archived after merge) — {sourcePreviewIds.length}
                </h3>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {sourcePreviewIds.map((id) => {
                    const r = previewMap.get(id);
                    if (!r) return null;
                    return <MergeContactPreviewCard key={id} record={r} variant="source" />;
                  })}
                </div>
              </div>
              <MergeIrreversibleNotice />
              <MergeConfirmCheckbox checked={confirmChecked} onChange={setConfirmChecked} disabled={merging} />
            </>
          ) : (
            <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target contact (card to keep)</label>
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
                const isSelected = selectedTarget?.id === r.id;
                return (
                  <DirectoryContactPickerRow
                    key={r.id}
                    record={r}
                    isSelected={isSelected}
                    onClick={() => setSelectedTarget(isSelected ? null : r)}
                    className="border-b border-gray-100 last:border-b-0"
                  />
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
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={merging || loadingPreview}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {step === "confirm" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep("pick");
                  setConfirmChecked(false);
                  setPreviewRecords([]);
                }}
                disabled={merging}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleMergeAll}
                disabled={!confirmChecked || merging || validSourceIds.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {merging ? `Merging ${progress.done}/${progress.total}...` : "Confirm merge all"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={loadBulkPreview}
              disabled={!selectedTarget || loadingPreview || validSourceIds.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingPreview ? "Loading…" : "Continue to review"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
