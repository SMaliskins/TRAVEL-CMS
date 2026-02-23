"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Phase = "idle" | "source" | "selecting" | "commenting";

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
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const pasteInputRef = useRef<HTMLTextAreaElement>(null);
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  }>({
    dragging: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  const reset = useCallback(() => {
    setPhase("idle");
    setSelection(null);
    setCroppedImage(null);
    setComment("");
    setSending(false);
    setModalOffset({ x: 0, y: 0 });
    startRef.current = null;
    fullScreenshotRef.current = null;
  }, []);

  const handleModalHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    dragStateRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: modalOffset.x,
      baseY: modalOffset.y,
    };
  }, [modalOffset.x, modalOffset.y]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragStateRef.current.dragging) return;
      const dx = e.clientX - dragStateRef.current.startX;
      const dy = e.clientY - dragStateRef.current.startY;
      setModalOffset({
        x: dragStateRef.current.baseX + dx,
        y: dragStateRef.current.baseY + dy,
      });
    };
    const onUp = () => {
      dragStateRef.current.dragging = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Ctrl+Q / Cmd+Q activates bug report mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "q") {
        e.preventDefault();
        if (phase !== "idle") {
          reset();
          return;
        }
        setPhase("source");
      }
      if (e.key === "Escape" && phase !== "idle") {
        reset();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, reset]);

  const CLEAR_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  const blobToDataUrl = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(blob);
    });
  }, []);

  const captureViaDisplayMedia = useCallback(async (): Promise<string | null> => {
    if (!navigator.mediaDevices?.getDisplayMedia) return null;
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: ({
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as unknown as MediaTrackConstraints),
      audio: false,
    });
    try {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      // Wait until browser share-picker fully closes and tab repaints.
      await new Promise((resolve) => setTimeout(resolve, 700));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || window.innerWidth;
      canvas.height = video.videoHeight || window.innerHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      // Capture second frame as a guard against stale first frame.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      await new Promise((resolve) => setTimeout(resolve, 120));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const cropFromDataUrl = useCallback(
    (sourceDataUrl: string, rect: SelectionRect): Promise<string | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const scaleX = img.naturalWidth / window.innerWidth;
            const scaleY = img.naturalHeight / window.innerHeight;
            const sx = rect.x * scaleX;
            const sy = rect.y * scaleY;
            const sw = rect.w * scaleX;
            const sh = rect.h * scaleY;

            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.floor(sw));
            canvas.height = Math.max(1, Math.floor(sh));
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png"));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = sourceDataUrl;
      }),
    []
  );

  const captureAndStartSelection = useCallback(async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        useCORS: false,
        allowTaint: false,
        foreignObjectRendering: false,
        logging: false,
        scale: 1,
        imageTimeout: 0,
        removeContainer: true,
        ignoreElements: (el: Element) => {
          const tag = el.tagName?.toLowerCase();
          if (tag === "iframe" || tag === "video") return true;
          return false;
        },
        onclone: (doc: Document) => {
          const resetStyle = doc.createElement("style");
          resetStyle.textContent = "* { background-image: none !important; }";
          doc.head.appendChild(resetStyle);
          doc.querySelectorAll("img").forEach((img) => {
            img.src = CLEAR_PIXEL;
            img.removeAttribute("srcset");
          });
          doc.querySelectorAll("canvas, iframe, video").forEach((el) => el.remove());
          doc.querySelectorAll("svg image").forEach((el) => el.remove());
          // Avoid brittle selectors here; keep onclone as safe as possible.
        },
      });
      fullScreenshotRef.current = canvas.toDataURL("image/png");
    } catch (err) {
      console.warn("[BugReport] Screenshot failed:", err);
      try {
        // Final fallback for all browsers: native capture.
        fullScreenshotRef.current = await captureViaDisplayMedia();
      } catch (displayErr) {
        console.warn("[BugReport] Native display capture failed:", displayErr);
        fullScreenshotRef.current = null;
      }
    }
    setPhase("selecting");
  }, [CLEAR_PIXEL, captureViaDisplayMedia]);

  const startCaptureFromSource = useCallback(async () => {
    // Hide source modal first so it does not appear in screenshot.
    setPhase("idle");
    setSelection(null);
    setCroppedImage(null);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await captureAndStartSelection();
  }, [captureAndStartSelection]);

  const handleClipboardImage = useCallback(async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        setToast({ type: "error", msg: "Clipboard API unavailable. Press Ctrl+V in this dialog." });
        setTimeout(() => setToast(null), 5000);
        pasteInputRef.current?.focus();
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const dataUrl = await blobToDataUrl(blob);
        setCroppedImage(dataUrl);
        setPhase("commenting");
        return;
      }
      setToast({ type: "error", msg: "No image in clipboard. Use Win+Shift+S then Ctrl+V." });
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      console.warn("[BugReport] Clipboard read failed:", err);
      setToast({ type: "error", msg: "Clipboard read blocked by browser. Press Ctrl+V in this dialog." });
      setTimeout(() => setToast(null), 5000);
      pasteInputRef.current?.focus();
    }
  }, [blobToDataUrl]);

  const handleUploadFile = useCallback(async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast({ type: "error", msg: "Please upload an image file." });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(file);
      setCroppedImage(dataUrl);
      setPhase("commenting");
    } catch (err) {
      console.warn("[BugReport] Upload read failed:", err);
      setToast({ type: "error", msg: "Failed to read uploaded image." });
      setTimeout(() => setToast(null), 5000);
    }
  }, [blobToDataUrl]);

  useEffect(() => {
    if (phase !== "source") return;
    pasteInputRef.current?.focus();
    const onPaste = async (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find((it) =>
        it.type.startsWith("image/")
      );
      if (!item) return;
      e.preventDefault();
      const file = item.getAsFile();
      await handleUploadFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [phase, handleUploadFile]);

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

  const captureSelectionFallback = useCallback(
    async (rect: SelectionRect): Promise<string | null> => {
      const pageX = rect.x + window.scrollX;
      const pageY = rect.y + window.scrollY;
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(document.body, {
          useCORS: false,
          allowTaint: false,
          foreignObjectRendering: false,
          logging: false,
          scale: 1,
          imageTimeout: 0,
          removeContainer: true,
          x: pageX,
          y: pageY,
          width: rect.w,
          height: rect.h,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          ignoreElements: (el: Element) => {
            const tag = el.tagName?.toLowerCase();
            if (tag === "iframe" || tag === "video") return true;
            return false;
          },
          onclone: (doc: Document) => {
            const resetStyle = doc.createElement("style");
            resetStyle.textContent = "* { background-image: none !important; }";
            doc.head.appendChild(resetStyle);
            doc.querySelectorAll("img").forEach((img) => {
              img.src = CLEAR_PIXEL;
              img.removeAttribute("srcset");
            });
            doc.querySelectorAll("canvas, iframe, video").forEach((el) => el.remove());
            doc.querySelectorAll("svg image").forEach((el) => el.remove());
          },
        });
        return canvas.toDataURL("image/png");
      } catch (err1) {
        console.warn("[BugReport] Selection fallback#1 failed:", err1);
        // Minimal attempt: fewer clone mutations, keep same crop coordinates.
        try {
          const html2canvas = (await import("html2canvas")).default;
          const canvas = await html2canvas(document.body, {
            useCORS: true,
            allowTaint: false,
            foreignObjectRendering: false,
            logging: false,
            scale: 1,
            imageTimeout: 3000,
            removeContainer: true,
            backgroundColor: null,
            x: pageX,
            y: pageY,
            width: rect.w,
            height: rect.h,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            ignoreElements: (el: Element) => {
              const tag = el.tagName?.toLowerCase();
              return tag === "iframe" || tag === "video";
            },
          });
          return canvas.toDataURL("image/png");
        } catch (err2) {
          console.warn("[BugReport] Selection fallback#2 failed:", err2);
          return null;
        }
      }
    },
    [CLEAR_PIXEL]
  );

  const cropScreenshot = useCallback(
    async (rect: SelectionRect) => {
      if (!fullScreenshotRef.current) {
        const fallback = await captureSelectionFallback(rect);
        if (fallback) {
          setCroppedImage(fallback);
          setPhase("commenting");
          return;
        }

        // Last chance: native capture and crop selected area.
        try {
          const nativeDataUrl = await captureViaDisplayMedia();
          if (nativeDataUrl) {
            const nativeCrop = await cropFromDataUrl(nativeDataUrl, rect);
            if (nativeCrop) {
              setCroppedImage(nativeCrop);
              setPhase("commenting");
              return;
            }
          }
        } catch (err) {
          console.warn("[BugReport] Native crop fallback failed:", err);
        }

        setToast({ type: "error", msg: "Screenshot capture failed. Please try again." });
        setTimeout(() => setToast(null), 5000);
        reset();
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = rect.w;
          canvas.height = rect.h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { setPhase("commenting"); return; }
          ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
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
    [captureSelectionFallback, captureViaDisplayMedia, cropFromDataUrl, reset]
  );

  const handleSubmit = useCallback(async () => {
    if (sending) return;
    if (!croppedImage) {
      setToast({ type: "error", msg: "Screenshot is required. Please capture again." });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("page_url", window.location.href);
      formData.append("comment", comment);

      const res = await fetch(croppedImage);
      const blob = await res.blob();
      formData.append("screenshot", blob, "screenshot.png");

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
          title="Report a bug (Ctrl+Q)"
        >
          <Camera size={13} />
          <span>Ctrl+Q</span>
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

      {/* Source picker */}
      {phase === "source" && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50">
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            style={{ transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)` }}
          >
            <div
              className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 cursor-move select-none"
              onMouseDown={handleModalHeaderMouseDown}
            >
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Camera size={18} className="text-red-500" />
                Bug Report
              </h3>
              <button onClick={reset} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => { void startCaptureFromSource(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                <Camera size={16} />
                Capture screen area
              </button>
              <button
                onClick={handleClipboardImage}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Paste from clipboard
              </button>
              <button
                onClick={() => uploadInputRef.current?.click()}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Upload image
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  void handleUploadFile(file);
                  e.currentTarget.value = "";
                }}
              />
              <p className="text-xs text-gray-500">
                Tip: You can also press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-mono">Ctrl+V</kbd> to paste an image directly.
              </p>
              <textarea
                ref={pasteInputRef}
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onPaste={(e) => {
                  const item = Array.from(e.clipboardData.items).find((it) =>
                    it.type.startsWith("image/")
                  );
                  if (!item) return;
                  const file = item.getAsFile();
                  void handleUploadFile(file);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Comment modal */}
      {phase === "commenting" && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50">
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            style={{ transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)` }}
          >
            <div
              className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 cursor-move select-none"
              onMouseDown={handleModalHeaderMouseDown}
            >
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
