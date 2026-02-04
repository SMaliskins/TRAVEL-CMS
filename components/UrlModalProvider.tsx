"use client";

import React, { useState, useEffect, useCallback } from "react";
import ContentModal from "./ContentModal";

export const OPEN_URL_IN_MODAL_EVENT = "open-url-in-modal";

export interface OpenUrlInModalDetail {
  url: string;
  title?: string;
}

export function openUrlInModal(url: string, title?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_URL_IN_MODAL_EVENT, { detail: { url, title } })
  );
}

export default function UrlModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ url: string; title?: string } | null>(null);

  const handleOpen = useCallback((e: CustomEvent<OpenUrlInModalDetail>) => {
    const { url, title } = e.detail || {};
    if (url) setState({ url, title });
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_URL_IN_MODAL_EVENT, handleOpen as EventListener);
    return () => {
      window.removeEventListener(OPEN_URL_IN_MODAL_EVENT, handleOpen as EventListener);
    };
  }, [handleOpen]);

  const close = useCallback(() => setState(null), []);

  return (
    <>
      {children}
      {state && (
        <ContentModal
          isOpen={true}
          onClose={close}
          title={state.title}
          url={state.url}
        />
      )}
    </>
  );
}
