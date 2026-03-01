"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { DirectoryRecord } from "@/lib/types/directory";
import DirectoryForm, { DirectoryFormHandle } from "@/components/DirectoryForm";
import AvatarUpload from "@/components/AvatarUpload";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import ConfirmModal from "@/components/ConfirmModal";
import MergeContactModal from "@/components/MergeContactModal";

export default function DirectoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [record, setRecord] = useState<DirectoryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const formRef = useRef<DirectoryFormHandle | null>(null);

  useEffect(() => {
    const loadRecord = async () => {
      try {
        setLoading(true);
        const response = await fetchWithAuth(`/api/directory/${id}`);
        
        // Log response details for debugging
        console.log("API Response status:", response.status);
        console.log("API Response ok:", response.ok);
        
        const result = await response.json();
        console.log("API Response data:", result);
        
        if (!response.ok) {
          // Handle 404 as normal case (record not found)
          if (response.status === 404) {
            console.log("Record not found (404):", id);
            setRecord(null);
            return;
          }
          // For other errors, log but don't throw
          console.error("API Error:", result.error || "Failed to fetch directory record");
          setRecord(null);
          return;
        }
        if (result.error) {
          // Handle error in response
          if (result.error.includes("not found") || result.error.includes("Party not found")) {
            console.log("Record not found:", id);
            setRecord(null);
            return;
          }
          console.error("API Error in result:", result.error);
          setRecord(null);
          return;
        }
        if (!result.record) {
          console.log("No record in response:", result);
          setRecord(null);
        } else {
          setRecord(result.record);
        }
      } catch (error) {
        // Only log unexpected errors, don't throw
        console.error("Unexpected error loading directory record:", error);
        setRecord(null); // Show "Record not found" message
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      loadRecord();
    }
  }, [id]);

  const handleSubmit = async (data: Partial<DirectoryRecord>, closeAfterSave: boolean) => {
    if (!record) return;
    
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetchWithAuth(`/api/directory/${record.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        // Include details, hint, and code in error message if available
        let errorMessage = result.error || "Failed to update directory record";
        if (result.details) {
          errorMessage += ` (${result.details})`;
        }
        if (result.hint) {
          errorMessage += ` Hint: ${result.hint}`;
        }
        if (result.code) {
          console.error("API Error Code:", result.code);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setRecord(result.record || record);
      setIsSaving(false);
      setSaveSuccess(true);
      setSavedAt(new Date());
      
      // Save isDirty value before resetting it
      const hadChanges = isDirty;
      setIsDirty(false);

      // Clear success message after 2 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);

      if (closeAfterSave) {
        // Delay only if there were changes (to show green border effect)
        if (hadChanges) {
          setTimeout(() => {
            router.push("/directory");
          }, 1000);
        } else {
          router.push("/directory");
        }
      }
    } catch (error: unknown) {
      console.error("ERROR: Failed to save directory record:", error);
      const errorMsg = error instanceof Error ? error.message : error ? String(error) : "Unknown error";
      setIsSaving(false);
      const finalErrorMsg = errorMsg || "Save failed. Please try again.";
      setSaveError(finalErrorMsg);
      setUiError(finalErrorMsg);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      router.push("/directory");
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    router.push("/directory");
  };

  const handleSave = () => {
    formRef.current?.submit(false);
  };

  const handleSaveAndClose = () => {
    formRef.current?.submit(true);
  };

  const handleConfirmArchive = async () => {
    if (!record?.id) return;
    setIsDeleting(true);
    setUiError(null);
    try {
      const response = await fetchWithAuth(`/api/directory/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Failed to archive contact");
      }
      setShowArchiveConfirm(false);
      setRecord((prev) => (prev ? { ...prev, isActive: false } : null));
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Failed to archive contact");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (!record?.id) return;
    setIsDeleting(true);
    setUiError(null);
    try {
      const response = await fetchWithAuth(`/api/directory/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Failed to restore contact");
      }
      setRecord((prev) => (prev ? { ...prev, isActive: true } : null));
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Failed to restore contact");
    } finally {
      setIsDeleting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isFormValid && !isSaving) {
          handleSave();
        }
      }
      // Ctrl+Enter / Cmd+Enter - Save & Close
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (isFormValid && !isSaving) {
          handleSaveAndClose();
        }
      }
      // Esc - Close confirm modal or cancel if dirty
      if (e.key === "Escape") {
        if (showCancelConfirm) {
          setShowCancelConfirm(false);
        } else if (showArchiveConfirm) {
          setShowArchiveConfirm(false);
        } else if (isDirty) {
          handleCancel();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFormValid, isSaving, isDirty, showCancelConfirm, showArchiveConfirm]);

  const formatSavedTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canSave = isFormValid && !isSaving;

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!record) {
    return <div className="p-6">Record not found</div>;
  }

  const displayName = record.type === "person" 
    ? `${record.firstName || ""} ${record.lastName || ""}`.trim() || "N/A"
    : record.companyName || "N/A";

  const ageFromDob = (dob: string | undefined): number | null => {
    if (!dob) return null;
    const birth = new Date(dob + "T00:00:00");
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  };

  const personAge = record.type === "person" ? ageFromDob(record.dob) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto w-full max-w-[95vw] space-y-6">
        {/* PageHeader - Settings style */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {record.type === "person" ? (
                <AvatarUpload
                  avatarUrl={record.avatarUrl}
                  placeholder={record.firstName?.[0] || record.lastName?.[0] || "?"}
                  onAvatarChange={(url) => setRecord((prev) => (prev ? { ...prev, avatarUrl: url } : null))}
                  onDirty={() => setIsDirty(true)}
                  size="lg"
                />
              ) : (
                <div className="relative group">
                  <AvatarUpload
                    avatarUrl={record.companyAvatarUrl}
                    placeholder={record.companyName?.[0] || "?"}
                    onAvatarChange={(url) => setRecord((prev) => (prev ? { ...prev, companyAvatarUrl: url } : null))}
                    onDirty={() => setIsDirty(true)}
                    size="lg"
                  />
                  {!record.companyAvatarUrl && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none text-xs text-white font-medium opacity-0 group-hover:opacity-100">
                      Ctrl+V
                    </span>
                  )}
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {displayName}
                    {personAge !== null && (
                      <span className="ml-2 text-base font-normal text-gray-500">
                        ({personAge} years)
                      </span>
                    )}
                  </h1>
                  {record.isActive === false && (
                    <span
                      className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800"
                      title="Contact is archived"
                    >
                      Archived
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleCancel}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                ← Back to Directory
              </button>
              <Link
                href={`/orders/new?clientId=${encodeURIComponent(record.id)}&clientName=${encodeURIComponent(displayName)}`}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                aria-label="Create order for this client"
              >
                Create order
              </Link>
              <button
                type="button"
                onClick={() => setShowMergeModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                aria-label="Merge this contact into another"
              >
                ⇄ Merge contacts
              </button>
              {isDirty && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-600"></span>
                  Unsaved
                </span>
              )}
              {saveSuccess && (
                <span className="text-sm text-green-600">Saved!</span>
              )}
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleSaveAndClose}
                disabled={!canSave}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save & Back to Directory"}
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {uiError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-800">{uiError}</p>
              <button
                onClick={() => setUiError(null)}
                className="text-red-600 hover:text-red-800"
                aria-label="Dismiss error"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        <DirectoryForm
          ref={formRef as any}
          record={record}
          mode="edit"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onValidationChange={setIsFormValid}
          onDirtyChange={setIsDirty}
          onAvatarChange={(avatarUrl) => setRecord((prev) => prev ? { ...prev, avatarUrl } : null)}
          onDocumentsChange={(documents) =>
            setRecord((prev) =>
              prev ? { ...prev, supplierExtras: { ...prev.supplierExtras, documents } } : null
            )
          }
          saveSuccess={saveSuccess}
        />

        <div className="mt-4 flex justify-end gap-2">
          {record.isActive === false ? (
            <button
              type="button"
              onClick={handleRestore}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-800 shadow-sm hover:bg-green-50 disabled:opacity-50"
              aria-label="Restore this contact from archive"
            >
              {isDeleting ? "Restoring…" : "Restore from archive"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-50"
              aria-label="Archive this contact"
            >
              Archive
            </button>
          )}
        </div>

        {/* Merge Contact Modal */}
        <MergeContactModal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          sourceRecord={record}
          onSuccess={() => {}}
        />

        {/* Cancel Confirmation Modal */}
        <ConfirmModal
          isOpen={showCancelConfirm}
          onCancel={() => setShowCancelConfirm(false)}
          onConfirm={handleConfirmCancel}
          title="Discard changes?"
          message="You have unsaved changes. Are you sure you want to leave this page?"
          confirmText="Discard"
          cancelText="Cancel"
        />

        {/* Archive Contact Confirmation Modal */}
        <ConfirmModal
          isOpen={showArchiveConfirm}
          onCancel={() => !isDeleting && setShowArchiveConfirm(false)}
          onConfirm={handleConfirmArchive}
          title="Archive contact?"
          message="This contact will be moved to archive and hidden from the main list. They will remain as client or payer in all orders, services and invoices."
          confirmText={isDeleting ? "Archiving..." : "Archive"}
          confirmDisabled={isDeleting}
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}

