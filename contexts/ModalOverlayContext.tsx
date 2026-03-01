"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface ModalOverlayContextType {
  /** Number of open overlay modals (TabBar hides when > 0) */
  modalCount: number;
  /** Call when overlay modal opens; returns unregister fn to call on close */
  registerModal: () => () => void;
}

const ModalOverlayContext = createContext<ModalOverlayContextType | null>(null);

export function ModalOverlayProvider({ children }: { children: React.ReactNode }) {
  const [modalCount, setModalCount] = useState(0);

  const registerModal = useCallback(() => {
    setModalCount((c) => c + 1);
    return () => setModalCount((c) => Math.max(0, c - 1));
  }, []);

  return (
    <ModalOverlayContext.Provider value={{ modalCount, registerModal }}>
      {children}
    </ModalOverlayContext.Provider>
  );
}

export function useModalOverlayContext() {
  const ctx = useContext(ModalOverlayContext);
  return ctx;
}

/** Call in overlay modals (Edit, Add, LinkedServices, etc.) so TabBar hides while modal is open */
export function useModalOverlay() {
  const ctx = useContext(ModalOverlayContext);
  const unregisterRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!ctx) return;
    unregisterRef.current = ctx.registerModal();
    return () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    };
  }, [ctx]);
}
