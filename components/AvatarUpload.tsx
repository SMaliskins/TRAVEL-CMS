"use client";

import { useState, useRef, useEffect } from "react";

interface AvatarUploadProps {
  avatarUrl: string | undefined;
  placeholder?: string;
  onAvatarChange: (url: string | undefined) => void;
  onDirty?: () => void;
  size?: "sm" | "md" | "lg";
}

export default function AvatarUpload({
  avatarUrl,
  placeholder = "?",
  onAvatarChange,
  onDirty,
  size = "lg",
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClass = size === "sm" ? "h-12 w-12 text-lg" : size === "md" ? "h-14 w-14 text-xl" : "h-16 w-16 text-2xl";

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) return null;
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload-avatar", { method: "POST", body: formData });
    if (!response.ok) return null;
    const result = await response.json();
    return result?.url || result?.data?.url || null;
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      if (url) {
        onAvatarChange(url);
        onDirty?.();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (avatarUrl) {
      setShowModal(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleEdit = () => {
    setShowModal(false);
    fileInputRef.current?.click();
  };

  const handleDelete = () => {
    onAvatarChange(undefined);
    onDirty?.();
    setShowDeleteConfirm(false);
    setShowModal(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) await handleFile(file);
  };

  // Document-level paste (Ctrl+V) for images - when not in input/textarea
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      const file = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"))?.getAsFile();
      if (file) {
        e.preventDefault();
        await handleFile(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else setShowModal(false);
      }
    };
    if (showModal) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal, showDeleteConfirm]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
        className="hidden"
        aria-label="Upload profile photo"
      />
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex-shrink-0 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${sizeClass} flex items-center justify-center overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors`}
        title={avatarUrl ? "Click to view photo" : "Click to upload, drag & drop, or Ctrl+V (paste)"}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className={`text-gray-500 font-medium ${isUploading ? "animate-pulse" : ""}`}>
            {isUploading ? "…" : placeholder}
          </span>
        )}
      </div>

      {/* Modal: view photo with Edit & Delete */}
      {showModal && avatarUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md"
          onClick={() => !showDeleteConfirm && setShowModal(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Photo area */}
            <div className="relative aspect-square bg-gray-100">
              <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
            </div>

            {/* Always-visible action bar (mobile-friendly) */}
            <div className="flex gap-2 p-3 border-t border-gray-100 bg-gray-50/80">
              <button
                type="button"
                onClick={handleEdit}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 16h.01" />
                </svg>
                Change photo
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 hover:border-red-300 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div
              className="absolute inset-0 flex items-center justify-center p-4 bg-black/40"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-gray-800 font-medium mb-4">Delete this photo?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
