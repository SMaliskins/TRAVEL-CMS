import { useCallback, useRef } from "react";

interface Position {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

interface UseClampedPopoverPositionOptions {
  anchorRef: React.RefObject<HTMLElement | null>;
  popoverWidth?: number;
  padding?: number;
  minSpaceBelow?: number;
}

/**
 * Hook for calculating clamped popover position that stays within viewport
 */
export function useClampedPopoverPosition({
  anchorRef,
  popoverWidth = 960,
  padding = 12,
  minSpaceBelow = 300,
}: UseClampedPopoverPositionOptions) {
  const calculatePosition = useCallback((): Position | null => {
    if (!anchorRef.current) return null;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate width
    const width = Math.min(popoverWidth, viewportWidth - padding * 2);

    // Calculate left position (clamped to viewport)
    let left = anchorRect.left;
    const maxLeft = viewportWidth - width - padding;
    const minLeft = padding;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    // Calculate top position
    // Prefer below anchor, but show above if not enough space
    const spaceBelow = viewportHeight - anchorRect.bottom - padding;
    const spaceAbove = anchorRect.top - padding;

    let top: number;
    if (spaceBelow >= minSpaceBelow || spaceBelow >= spaceAbove) {
      // Show below
      top = anchorRect.bottom + 8; // 8px gap
    } else {
      // Show above
      top = anchorRect.top - padding; // Will be adjusted based on maxHeight
    }

    // Calculate maxHeight
    const maxHeight =
      spaceBelow >= minSpaceBelow || spaceBelow >= spaceAbove
        ? Math.min(viewportHeight - top - padding, viewportHeight - padding * 2)
        : Math.min(top + anchorRect.height + 8 - padding, viewportHeight - padding * 2);

    // Adjust top if showing above to account for maxHeight
    if (spaceBelow < minSpaceBelow && spaceBelow < spaceAbove) {
      const estimatedHeight = Math.min(600, maxHeight); // Estimate popover height
      top = Math.max(padding, anchorRect.top - estimatedHeight - 8);
    }

    return { left, top, width, maxHeight };
  }, [anchorRef, popoverWidth, padding, minSpaceBelow]);

  return calculatePosition;
}

