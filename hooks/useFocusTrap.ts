"use client";

import { useEffect, useRef, RefObject } from "react";

const FOCUSABLE = [
  "a[href]:not([disabled]):not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1']):not([disabled])",
  "[contenteditable='true']",
].join(",");

/**
 * Traps keyboard focus inside a container while it is mounted.
 * - Tab / Shift+Tab cycles within the container
 * - If focus escapes (e.g. mouse click outside), next Tab returns focus inside
 * - Initial focus moves to the first focusable element
 * - On cleanup, focus is restored to the previously active element
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean = true,
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    previousFocus.current = document.activeElement as HTMLElement | null;

    const getFocusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );

    const timer = requestAnimationFrame(() => {
      const els = getFocusables();
      if (els.length > 0) {
        els[0].focus();
      } else {
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const active = document.activeElement as HTMLElement | null;
      if (!active) return;
      // If focus is in another modal (e.g. nested), don't intercept — let that modal's trap handle it.
      const inAnotherModal = active.closest('[role="dialog"]') ?? active.closest('[aria-modal="true"]');
      if (inAnotherModal && !container.contains(inAnotherModal)) return;

      const els = getFocusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }

      const first = els[0];
      const last = els[els.length - 1];
      const focusInside = container.contains(active);

      if (!focusInside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (container.contains(e.target as Node)) return;

      // Focus escaped. If it moved to another modal (e.g. nested AddAccompanyingModal),
      // allow it — don't pull focus back.
      const target = e.target as HTMLElement;
      const inAnotherModal = target.closest('[role="dialog"]') ?? target.closest('[aria-modal="true"]');
      if (inAnotherModal && !container.contains(inAnotherModal)) return;

      const els = getFocusables();
      if (els.length > 0) els[0].focus();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      previousFocus.current?.focus?.();
    };
  }, [active]);

  return containerRef;
}
