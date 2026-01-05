"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDirectoryStore } from "@/lib/directory/directoryStore";
import DirectoryForm, { DirectoryFormHandle } from "@/components/DirectoryForm";
import ConfirmModal from "@/components/ConfirmModal";
import { DirectoryRecord, DirectoryRole } from "@/lib/types/directory";

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
  const [roles, setRoles] = useState<DirectoryRole[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const formRef = useRef<DirectoryFormHandle>(null);

  const handleSubmit = async (data: Partial<DirectoryRecord>, closeAfterSave: boolean) => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setRolesError(null);

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newRecord = await createRecord({
        ...data,
        roles: data.roles || [],
        isActive: data.isActive ?? true,
      } as Omit<DirectoryRecord, "id" | "createdAt">);

      setIsSaving(false);
      setSaveSuccess(true);
      setSavedAt(new Date());
      setIsDirty(false);

      // Clear success message after 2 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);

      if (closeAfterSave) {
        // Small delay to show success message before navigation
        setTimeout(() => {
          router.push("/directory");
        }, 100);
      } else {
        // Redirect to edit page after creation
        setTimeout(() => {
          router.push(`/directory/${newRecord.id}`);
        }, 100);
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
    if (roles.length === 0) {
      setRolesError("At least one role must be selected");
      return;
    }
    setRolesError(null);
    formRef.current?.submit(false);
  };

  const handleSaveAndClose = () => {
    if (roles.length === 0) {
      setRolesError("At least one role must be selected");
      return;
    }
    setRolesError(null);
    formRef.current?.submit(true);
  };

  const handleRoleToggle = (role: DirectoryRole) => {
    const newRoles = roles.includes(role)
      ? roles.filter((r) => r !== role)
      : [...roles, role];
    setRoles(newRoles);
    setRolesError(null);
    // Also trigger form validation check
    if (newRoles.length > 0 && rolesError) {
      setRolesError(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isFormValid && !isSaving && roles.length > 0) {
          handleSave();
        }
      }
      // Ctrl+Enter / Cmd+Enter - Save & Close
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (isFormValid && !isSaving && roles.length > 0) {
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
  }, [isFormValid, isSaving, isDirty, showCancelConfirm, roles]);

  const formatSavedTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canSave = isFormValid && roles.length > 0 && !isSaving;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Error Alert */}
        {uiError && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-800">{uiError}</p>
              <button
                onClick={() => setUiError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* Sticky Page Header */}
        <div className="sticky top-14 z-30 -mx-6 bg-white border-b border-gray-200 px-6 py-4 shadow-sm mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-gray-900">New record</h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                {isDirty && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
            
            {/* Roles & Status - Compact */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                {/* Roles */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Roles:</span>
                  <div className="flex items-center gap-1.5">
                    {(["client", "supplier", "subagent"] as DirectoryRole[]).map((role) => (
                      <label key={role} className="flex cursor-pointer items-center gap-1">
                        <input
                          type="checkbox"
                          checked={roles.includes(role)}
                          onChange={() => handleRoleToggle(role)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-black focus:ring-black"
                        />
                        <span className="text-xs text-gray-700 capitalize">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Active */}
                <label className="flex cursor-pointer items-center gap-1">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-black focus:ring-black"
                  />
                  <span className="text-xs font-medium text-gray-700">Active</span>
                </label>
              </div>
              {rolesError && (
                <p className="text-xs text-red-600">{rolesError}</p>
              )}
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-1">
                {saveError && (
                  <span className="text-xs text-red-600">{saveError}</span>
                )}
                {saveSuccess && savedAt && (
                  <span className="text-xs text-green-600">
                    Saved ✓
                  </span>
                )}
                <button
                  onClick={handleCancel}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    saveSuccess
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  }`}
                  style={isSaving ? { cursor: "wait" } : {}}
                >
                  {isSaving ? (
                    <>
                      <svg
                        className="h-3.5 w-3.5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Saving…
                    </>
                  ) : saveSuccess ? (
                    <>
                      <span>Saved</span>
                      <span className="text-green-600">✓</span>
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
                <button
                  onClick={handleSaveAndClose}
                  disabled={!canSave}
                  className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  style={isSaving ? { cursor: "wait" } : {}}
                >
                  Save & Close
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <DirectoryForm
          ref={formRef}
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onValidationChange={setIsFormValid}
          onDirtyChange={setIsDirty}
          onRolesChange={setRoles}
          onActiveChange={setIsActive}
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
