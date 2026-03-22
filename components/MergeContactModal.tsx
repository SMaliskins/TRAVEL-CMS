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

interface MergeContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceRecord: DirectoryRecord;
  onSuccess: () => void;
}

export default function MergeContactModal({
  isOpen,
  onClose,
  sourceRecord,
  onSuccess,
}: MergeContactModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DirectoryRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<DirectoryRecord | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [previewSource, setPreviewSource] = useState<DirectoryRecord | null>(null);
  const [previewTarget, setPreviewTarget] = useState<DirectoryRecord | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const sourceName = sourceRecord.type === "person"
    ? `${sourceRecord.firstName || ""} ${sourceRecord.lastName || ""}`.trim() || "Contact"
    : sourceRecord.companyName || "Contact";

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
        const records = (result.data || []).filter(
          (r: DirectoryRecord) => r.id !== sourceRecord.id && r.isActive !== false
        );
        setSearchResults(records);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search contacts");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, sourceRecord.id]);

  useEffect(() => {
    const timer = setTimeout(searchContacts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchContacts]);

  useEffect(() => {
    if (!isOpen) return;
    setStep("pick");
    setConfirmChecked(false);
    setPreviewSource(null);
    setPreviewTarget(null);
    setSelectedTarget(null);
    setSearchQuery("");
    setError(null);
  }, [isOpen]);

  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  useModalOverlay(isOpen);

  const loadPreviewRecords = async (tgt: DirectoryRecord) => {
    setLoadingPreview(true);
    setError(null);
    try {
      const [resS, resT] = await Promise.all([
        fetchWithAuth(`/api/directory/${sourceRecord.id}`),
        fetchWithAuth(`/api/directory/${tgt.id}`),
      ]);
      const jsS = resS.ok ? await resS.json() : null;
      const jsT = resT.ok ? await resT.json() : null;
      if (!jsS?.record || !jsT?.record) {
        throw new Error("Failed to load contact details for preview");
      }
      setPreviewSource(jsS.record as DirectoryRecord);
      setPreviewTarget(jsT.record as DirectoryRecord);
      setStep("confirm");
      setConfirmChecked(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedTarget) return;
    setMerging(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/directory/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePartyId: sourceRecord.id,
          targetPartyId: selectedTarget.id,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Merge failed");
      }
      onSuccess();
      onClose();
      window.location.href = `/directory/${selectedTarget.id}`;
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
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4">
      <div ref={trapRef} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Merge contact</h2>
          <p className="mt-1 text-sm text-gray-500">
            {step === "pick" ? (
              <>
                Merge <strong>{sourceName}</strong> into another contact. You will review details before confirming.
              </>
            ) : (
              <>Review both contacts, then confirm.</>
            )}
          </p>
        </div>
        <div className="space-y-4 px-6 py-4">
          {step === "confirm" && previewSource && previewTarget ? (
            <>
              <div className="space-y-3">
                <MergeContactPreviewCard record={previewSource} variant="source" />
                <MergeContactPreviewCard record={previewTarget} variant="target" />
              </div>
              <MergeIrreversibleNotice />
              <MergeConfirmCheckbox checked={confirmChecked} onChange={setConfirmChecked} disabled={merging} />
            </>
          ) : (
            <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search target contact</label>
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
              Will merge into: <strong>{targetName}</strong>
            </p>
          )}
            </>
          )}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
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
                  setPreviewSource(null);
                  setPreviewTarget(null);
                }}
                disabled={merging}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={!confirmChecked || merging}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {merging ? "Merging..." : "Confirm merge"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => selectedTarget && loadPreviewRecords(selectedTarget)}
              disabled={!selectedTarget || loadingPreview}
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
