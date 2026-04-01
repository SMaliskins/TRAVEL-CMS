"use client";

import React from "react";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEscapeKey(onCancel, isOpen);
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  useModalOverlay(isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50">
      <div ref={trapRef} role="dialog" aria-modal="true" className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mb-6 text-sm text-gray-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
