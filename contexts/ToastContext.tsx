"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type ToastType = "success" | "error";

export interface ToastMessage {
  type: ToastType;
  message: string;
}

const TOAST_EVENT = "show-toast";

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToastState] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToastState({ type, message });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastMessage>).detail;
      if (detail?.type && detail?.message) setToastState({ type: detail.type, message: detail.message });
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToastState(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const dismiss = useCallback(() => setToastState(null), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="fixed left-0 right-0 top-0 z-[200] flex items-center justify-center px-4 py-3 shadow-lg sm:left-4 sm:right-auto sm:top-4 sm:max-w-sm sm:rounded-lg"
          style={{
            backgroundColor: toast.type === "success" ? "#059669" : "#dc2626",
            color: "#fff",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:flex-initial">
            <span className="text-sm font-medium">
              {toast.type === "success" ? "✓ " : "! "}
              {toast.message}
            </span>
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 rounded p-1 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/** Show toast from anywhere (e.g. outside React or before provider). Dispatches event; ToastProvider must be mounted. */
export function showToast(type: ToastType, message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { type, message } }));
}
