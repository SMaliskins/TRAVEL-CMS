"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDirectoryStore } from "@/lib/directory/directoryStore";
import DirectoryForm, { DirectoryFormHandle } from "@/components/DirectoryForm";
import ConfirmModal from "@/components/ConfirmModal";

export default function NewDirectoryPage() {
  const router = useRouter();
  const { createRecord } = useDirectoryStore();
  const [isFormValid, setIsFormValid] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const formRef = useRef<DirectoryFormHandle>(null);

  const handleSubmit = async (data: Partial<any>, closeAfterSave: boolean) => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    // Save isDirty value before resetting it
    const hadChanges = isDirty;

    try {
      const newRecord = await createRecord({
        ...data,
      } as any);

      setIsSaving(false);
      setSaveSuccess(true);
      setSavedAt(new Date());
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
      } else {
        // Redirect to edit page after creation
        if (hadChanges) {
          setTimeout(() => {
            router.push(`/directory/${newRecord.id}`);
          }, 1000);
        } else {
          router.push(`/directory/${newRecord.id}`);
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
        } else if (isDirty) {
          handleCancel();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFormValid, isSaving, isDirty, showCancelConfirm]);

  const formatSavedTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canSave = isFormValid && !isSaving;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto w-full max-w-[95vw] space-y-6">
        {/* PageHeader - Settings style with buttons */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">New Record</h1>
              <p className="text-sm text-gray-500">Create a new contact in directory</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/directory" className="text-sm text-blue-600 hover:text-blue-700">
                ← Back to Directory
              </Link>
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
          <div className="opacity-0 animate-[fadeInSlideDown_0.3s_ease-in-out_forwards] rounded-lg border border-red-300 bg-gradient-to-r from-red-50 to-red-50/80 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-red-600 opacity-0 animate-[fadeInZoom_0.2s_ease-in-out_forwards]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-red-800">{uiError}</p>
              </div>
              <button
                onClick={() => setUiError(null)}
                className="rounded-lg p-1 text-red-600 transition-all duration-200 hover:bg-red-100 hover:text-red-800"
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
          ref={formRef}
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onValidationChange={setIsFormValid}
          onDirtyChange={setIsDirty}
          saveSuccess={saveSuccess}
        />

        {/* Cancel confirmation modal */}
        <ConfirmModal
          isOpen={showCancelConfirm}
          title="Discard changes?"
          message="You have unsaved changes. Are you sure you want to cancel?"
          confirmText="Discard"
          cancelText="Keep editing"
          onConfirm={handleConfirmCancel}
          onCancel={() => setShowCancelConfirm(false)}
        />

        {/* Cancel confirmation modal */}
        <ConfirmModal
          isOpen={showCancelConfirm}
          title="Discard changes?"
          message="You have unsaved changes. Are you sure you want to cancel?"
          confirmText="Discard"
          cancelText="Keep editing"
          onConfirm={handleConfirmCancel}
          onCancel={() => setShowCancelConfirm(false)}
        />
      </div>
    </div>
  );
}
