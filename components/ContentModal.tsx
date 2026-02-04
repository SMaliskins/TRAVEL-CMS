"use client";

import React, { useRef, useCallback } from "react";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

export interface ContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Show content from URL in an iframe */
  url?: string;
  /** Show HTML string (e.g. for print preview). Rendered in iframe with srcdoc. */
  htmlContent?: string;
  /** Show Print button (only when htmlContent is set) */
  showPrintButton?: boolean;
  /** Optional class for the iframe container */
  className?: string;
}

export default function ContentModal({
  isOpen,
  onClose,
  title,
  url,
  htmlContent,
  showPrintButton = false,
  className = "",
}: ContentModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEscapeKey(onClose, isOpen);

  const handlePrint = useCallback(() => {
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  }, []);

  if (!isOpen) return null;

  const hasUrl = Boolean(url);
  const hasHtml = Boolean(htmlContent);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "content-modal-title" : undefined}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
          {title && (
            <h2 id="content-modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            {hasHtml && showPrintButton && (
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Print
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>
        <div
          className={`min-h-[400px] flex-1 overflow-hidden ${className}`}
          style={{ height: "70vh" }}
        >
          {hasUrl && (
            <iframe
              src={url}
              title={title || "Content"}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          )}
          {hasHtml && !hasUrl && (
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              title={title || "Preview"}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}
