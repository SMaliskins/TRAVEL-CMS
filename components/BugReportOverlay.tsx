"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Phase = "idle" | "selecting" | "commenting";

interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function BugReportOverlay() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fullScreenshotRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setSelection(null);
    setCroppedImage(null);
    setComment("");
    setSending(false);
    startRef.current = null;
    fullScreenshotRef.current = null;
  }, []);

  // Ctrl+E / Cmd+E activates bug report mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        if (phase !== "idle") {
          reset();
          return;
        }
        captureAndStartSelection();
      }
      if (e.key === "Escape" && phase !== "idle") {
        reset();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, reset]);

  const captureAndStartSelection = useCallback(async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: false,
        logging: false,
        scale: Math.min(window.devicePixelRatio, 2),
        imageTimeout: 5000,
        removeContainer: true,
      });
      fullScreenshotRef.current = canvas.toDataURL("image/png");
      setPhase("selecting");
    } catch {
      fullScreenshotRef.current = null;
      setPhase("selecting");
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (phase !== "selecting") return;
      startRef.current = { x: e.clientX, y: e.clientY };
      setSelection(null);
    },
    [phase]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (phase !== "selecting" || !startRef.current) return;
      const x = Math.min(startRef.current.x, e.clientX);
      const y = Math.min(startRef.current.y, e.clientY);
      const w = Math.abs(e.clientX - startRef.current.x);
      const h = Math.abs(e.clientY - startRef.current.y);
      setSelection({ x, y, w, h });
    },
    [phase]
  );

  const handleMouseUp = useCallback(() => {
    if (phase !== "selecting" || !startRef.current || !selection) return;
    if (selection.w < 10 || selection.h < 10) {
      startRef.current = null;
      setSelection(null);
      return;
    }
    cropScreenshot(selection);
  }, [phase, selection]);

  const cropScreenshot = useCallback(
    (rect: SelectionRect) => {
      if (!fullScreenshotRef.current) {
        setCroppedImage(null);
        setPhase("commenting");
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const dpr = Math.min(window.devicePixelRatio, 2);
          const canvas = document.createElement("canvas");
          canvas.width = rect.w * dpr;
          canvas.height = rect.h * dpr;
          const ctx = canvas.getContext("2d");
          if (!ctx) { setPhase("commenting"); return; }
          const sx = (rect.x + window.scrollX) * dpr;
          const sy = (rect.y + window.scrollY) * dpr;
          ctx.drawImage(img, sx, sy, rect.w * dpr, rect.h * dpr, 0, 0, rect.w * dpr, rect.h * dpr);
          setCroppedImage(canvas.toDataURL("image/png"));
        } catch {
          setCroppedImage(null);
        }
        setPhase("commenting");
      };
      img.onerror = () => {
        setCroppedImage(null);
        setPhase("commenting");
      };
      img.src = fullScreenshotRef.current;
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (sending) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("page_url", window.location.href);
      formData.append("comment", comment);

      if (croppedImage) {
        const res = await fetch(croppedImage);
        const blob = await res.blob();
        formData.append("screenshot", blob, "screenshot.png");
      }

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/dev-log", {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      setToast({ type: "success", msg: "Bug report submitted!" });
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[BugReport] Submit failed:", msg);
      setToast({ type: "error", msg: `Submit failed: ${msg}` });
      setSending(false);
    }
    setTimeout(() => setToast(null), 5000);
  }, [comment, croppedImage, sending, reset]);

  if (phase === "idle" && !toast) {
    return (
      <div className="fixed bottom-3 right-3 z-[100] opacity-40 hover:opacity-100 transition-opacity">
        <button
          onClick={captureAndStartSelection}
          className="flex items-center gap-1.5 bg-gray-800 text-white text-[11px] px-2.5 py-1.5 rounded-md shadow-lg"
          title="Report a bug (Ctrl+E)"
        >
          <Camera size={13} />
          <span>Ctrl+E</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[250] px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Selection phase */}
      {phase === "selecting" && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[150] cursor-crosshair"
          style={{ background: "rgba(0,0,0,0.25)" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Instruction banner */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-3">
            <Camera size={16} />
            <span>Drag to select the area with the issue</span>
            <button onClick={reset} className="ml-2 hover:text-red-300">
              <X size={16} />
            </button>
          </div>

          {/* Selection rectangle */}
          {selection && (
            <div
              className="absolute border-2 border-red-500 bg-red-500/10 rounded"
              style={{
                left: selection.x,
                top: selection.y,
                width: selection.w,
                height: selection.h,
              }}
            />
          )}
        </div>
      )}

      {/* Comment modal */}
      {phase === "commenting" && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Camera size={18} className="text-red-500" />
                Bug Report
              </h3>
              <button onClick={reset} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Screenshot preview */}
              {croppedImage ? (
                <div className="border rounded-lg overflow-hidden bg-gray-100 max-h-64 flex items-center justify-center">
                  <img
                    src={croppedImage}
                    alt="Selected area"
                    className="max-w-full max-h-64 object-contain"
                  />
                </div>
              ) : (
                <div className="border rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-400 text-center">
                  Screenshot not available — your comment and page URL will be saved
                </div>
              )}

              {/* Page URL */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Page</label>
                <div className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-1.5 truncate border">
                  {typeof window !== "undefined" ? window.location.pathname : ""}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Describe the issue
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What went wrong? What did you expect?"
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={3}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? "Sending..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
